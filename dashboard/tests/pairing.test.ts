import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildXeroOrders, matchInvoices, nextOrderId, withXero } from '@/lib/xero/pairing'
import { unitsByOrder } from '@/lib/metrics'
import type { Ledger, Order, XeroInvoice } from '@/lib/types'

const doc = (p: Partial<XeroInvoice> & Pick<XeroInvoice, 'id' | 'kind' | 'totalCents'>): XeroInvoice => ({
  number: p.id, reference: '', status: 'AUTHORISED', contactName: p.kind === 'sale' ? 'Wave Phone B.V.' : 'Mobile One Trade B.V.', currency: 'EUR',
  date: '2026-10-10', dueDate: '2026-10-17', amountDueCents: p.totalCents, amountPaidCents: 0, payments: [], ...p,
})

/** Replay a ledger's pairs as fresh Xero documents. The ledger has no bill dates, so bills get a small, varying gap. */
function replay(orders: Order[]) {
  const invoices: XeroInvoice[] = []
  orders.forEach((o, i) => {
    const d = new Date(Date.parse(o.date) + ((i % 5) - 2) * 86_400_000).toISOString().slice(0, 10)
    invoices.push(doc({ id: `s-${o.id}`, kind: 'sale', number: `X${o.clientInvoiceNo}`, totalCents: o.clientTotalCents, date: o.date }))
    invoices.push(doc({ id: `b-${o.id}`, kind: 'bill', number: `X${o.supplierInvoiceNo}`, totalCents: o.supplierTotalCents, date: d }))
  })
  return invoices
}

function score(orders: Order[]) {
  const m = matchInvoices({ invoices: replay(orders), ledgerOrders: [], pairs: [] })
  const right = m.suggestions.filter((s) => s.bill && s.bill.id === s.invoice.id.replace(/^s-/, 'b-')).length
  const offered = m.suggestions.map((s) => s.bill?.id).filter(Boolean)
  return { right, total: orders.length, misses: m.suggestions.filter((s) => s.bill?.id !== s.invoice.id.replace(/^s-/, 'b-')).map((s) => s.invoice.id.slice(2)), unique: new Set(offered).size === offered.length }
}

const real = path.join(__dirname, '..', 'data', 'generated', 'ledger.json')
const sample = path.join(__dirname, '..', 'data', 'sample', 'ledger.json')

describe.skipIf(!fs.existsSync(real))('matcher against the real 34 orders', () => {
  it('suggests the right bill for at least 30 of 34, and never the same bill twice', () => {
    const r = score((JSON.parse(fs.readFileSync(real, 'utf8')) as Ledger).orders)
    console.log(`real ledger: ${r.right}/${r.total} right first time; misses: ${r.misses.join(', ') || 'none'}`)
    expect(r.unique).toBe(true)
    expect(r.right).toBeGreaterThanOrEqual(30)
  })
})

describe('matcher', () => {
  it('gets the sample ledger right as well', () => {
    const r = score((JSON.parse(fs.readFileSync(sample, 'utf8')) as Ledger).orders)
    expect(r.unique).toBe(true)
    expect(r.right / r.total).toBeGreaterThanOrEqual(0.85)
  })
  it('pairs straight away when both sides carry the same order reference', () => {
    const m = matchInvoices({ invoices: [
      doc({ id: 's1', kind: 'sale', totalCents: 100_00, reference: 'FN-ORD-035' }),
      doc({ id: 'b1', kind: 'bill', totalCents: 50_00, reference: 'Your ref FN-ORD-035' }), // fits by reference even though the amount would not
    ], ledgerOrders: [], pairs: [] })
    expect(m.auto).toEqual([{ orderId: 'FN-ORD-035', invoiceId: 's1', billId: 'b1', confirmedAt: 'reference' }])
    expect(m.suggestions).toHaveLength(0)
  })
  it('leaves out documents the ledger or a confirmed pair already uses, so nothing counts twice', () => {
    const ledgerOrder = { id: 'FN-ORD-034', clientInvoiceNo: '2026042', supplierInvoiceNo: '2026090091' } as Order
    const m = matchInvoices({ invoices: [
      doc({ id: 'old-s', kind: 'sale', number: '2026042', totalCents: 326_500_00 }),
      doc({ id: 'old-b', kind: 'bill', number: '2026090091', totalCents: 323_600_00 }),
      doc({ id: 'p-s', kind: 'sale', totalCents: 10_000_00 }),
      doc({ id: 'p-b', kind: 'bill', totalCents: 9_800_00 }),
      doc({ id: 'new-s', kind: 'sale', totalCents: 20_000_00 }),
      doc({ id: 'gbp', kind: 'bill', totalCents: 19_700_00, currency: 'GBP' }), // GBP running cost: never a stock bill
      doc({ id: 'void', kind: 'bill', totalCents: 19_700_00, status: 'VOIDED' }),
    ], ledgerOrders: [ledgerOrder], pairs: [{ orderId: 'FN-ORD-035', invoiceId: 'p-s', billId: 'p-b', confirmedAt: 't' }] })
    expect(m.suggestions.map((s) => s.invoice.id)).toEqual(['new-s'])
    expect(m.suggestions[0].bill).toBeNull()
    expect(m.freeBills).toEqual([])
  })
  it('refuses bills outside the margin or date window', () => {
    const m = matchInvoices({ invoices: [
      doc({ id: 's', kind: 'sale', totalCents: 100_000_00, date: '2026-10-10' }),
      doc({ id: 'cheap', kind: 'bill', totalCents: 80_000_00, date: '2026-10-10' }), // 20% below: not this order
      doc({ id: 'late', kind: 'bill', totalCents: 98_000_00, date: '2026-11-30' }), // 7 weeks later
    ], ledgerOrders: [], pairs: [] })
    expect(m.suggestions[0].bill).toBeNull()
    expect(m.freeBills.map((b) => b.id).sort()).toEqual(['cheap', 'late'])
  })
  it('numbers new orders after the highest existing one', () => {
    expect(nextOrderId(['FN-ORD-034', 'FN-ORD-002', 'FN-ORD-035'])).toBe('FN-ORD-036')
    expect(nextOrderId([])).toBe('FN-ORD-001')
  })
})

describe('orders built from Xero pairs', () => {
  it('have the same shape as ledger orders: margin split, statuses, units, flags', () => {
    const inv = doc({ id: 's', kind: 'sale', number: '2026043', totalCents: 28_307_11, amountDueCents: 28_307_11, dueDate: '2026-10-01',
      lines: [{ description: 'iPhone 15 128 GB', quantity: 77, unitCents: 362_43, amountCents: 27_907_11 }, { description: 'SHIPPING CHARGES', quantity: 1, unitCents: 400_00, amountCents: 400_00 }] })
    const bill = doc({ id: 'b', kind: 'bill', number: '2026100095', totalCents: 27_700_00, status: 'PAID', amountDueCents: 0,
      lines: [{ description: 'IPHONE 15 128 GB', quantity: 77, unitCents: 354_55, amountCents: 27_300_00 }, { description: 'Shipping charges', quantity: 1, unitCents: 400_00, amountCents: 400_00 }] })
    const { orders, lines } = buildXeroOrders({ pairs: [{ orderId: 'FN-ORD-035', invoiceId: 's', billId: 'b', confirmedAt: 't' }], invoices: [inv, bill], today: '2026-10-21', knownParties: [{ id: 'wave-phone-b-v', name: 'Wave Phone B.V.' }] })
    expect(orders[0]).toMatchObject({
      id: 'FN-ORD-035', source: 'xero', customerId: 'wave-phone-b-v', clientInvoiceNo: '2026043', supplierInvoiceNo: '2026100095',
      grossMarginCents: 607_11, goodsMarginCents: 607_11, shippingMarginCents: 0,
      clientStatus: 'AUTHORISED', clientOwesCents: 28_307_11, supplierStatus: 'PAID', weOweSupplierCents: 0,
      flags: ['Client overdue 20 days'],
    })
    expect(unitsByOrder(lines).get('FN-ORD-035')).toBe(77)
    expect(lines.find((l) => l.type === 'goods')).toMatchObject({ marginCents: 607_11, supplierAmountCents: 27_300_00 })
  })
  it('flags a loss, and drops a pair whose document was deleted in Xero', () => {
    const inv = doc({ id: 's', kind: 'sale', totalCents: 100_00 })
    const bill = doc({ id: 'b', kind: 'bill', totalCents: 101_00 })
    const { orders } = buildXeroOrders({ pairs: [{ orderId: 'FN-ORD-040', invoiceId: 's', billId: 'b', confirmedAt: 't' }, { orderId: 'FN-ORD-041', invoiceId: 's', billId: 'gone', confirmedAt: 't' }], invoices: [inv, bill], today: '2026-10-01' })
    expect(orders.map((o) => o.id)).toEqual(['FN-ORD-040'])
    expect(orders[0].flags[0]).toBe('LOSS-MAKING order')
  })
})

describe('ledger plus Xero', () => {
  const ledger = JSON.parse(fs.readFileSync(sample, 'utf8')) as Ledger
  const first = ledger.orders[0]
  const snapshot = {
    fetchedAt: '2026-10-21T10:00:00Z', tenantName: 'Fone Nova', baseCurrency: 'GBP', bankBalances: null, problems: [],
    invoices: [
      doc({ id: 'dup-s', kind: 'sale', number: first.clientInvoiceNo, totalCents: first.clientTotalCents, date: first.date }), // already a ledger order
      doc({ id: 'dup-b', kind: 'bill', number: first.supplierInvoiceNo, totalCents: first.supplierTotalCents, date: first.date }),
      doc({ id: 'new-s', kind: 'sale', number: '2026050', totalCents: 50_000_00, date: '2026-10-15' }),
      doc({ id: 'new-b', kind: 'bill', number: '2026100101', totalCents: 49_100_00, date: '2026-10-14' }),
    ],
    creditNotes: [
      { id: 'c1', number: ledger.creditNotes[0]?.number ?? 'none', reference: '', kind: 'sale' as const, status: 'AUTHORISED', contactName: 'x', currency: 'EUR', date: '2026-08-19', totalCents: 1, allocatedTo: [] },
      { id: 'c2', number: 'CN-NEW', reference: 'damaged unit', kind: 'sale' as const, status: 'AUTHORISED', contactName: 'x', currency: 'EUR', date: '2026-10-16', totalCents: 500_00, allocatedTo: ['2026050'] },
    ],
  }
  it('adds confirmed pairs as new orders without counting ledger orders or credits twice', () => {
    const before = withXero(ledger, snapshot, [], '2026-10-21')
    expect(before.ledger.orders).toHaveLength(ledger.orders.length) // nothing confirmed yet
    expect(before.matching!.suggestions.map((s) => [s.invoice.id, s.bill?.id])).toEqual([['new-s', 'new-b']])

    const pair = { orderId: nextOrderId(ledger.orders.map((o) => o.id)), invoiceId: 'new-s', billId: 'new-b', confirmedAt: 't' }
    const after = withXero(ledger, snapshot, [pair], '2026-10-21')
    expect(after.ledger.orders).toHaveLength(ledger.orders.length + 1)
    expect(after.ledger.orders.filter((o) => o.clientInvoiceNo === first.clientInvoiceNo)).toHaveLength(1)
    expect(after.matching!.suggestions).toHaveLength(0)
    const added = after.ledger.creditNotes.slice(ledger.creditNotes.length)
    expect(added.map((n) => [n.number, n.orderIds])).toEqual([['CN-NEW', [pair.orderId]]]) // the ledger's own credit is not repeated
  })
  it('changes nothing without a Xero snapshot', () => {
    expect(withXero(ledger, null, [], '2026-10-21')).toEqual({ ledger, matching: null })
  })
})

describe('drafts awaiting approval', () => {
  it('lists drafts of both kinds, newest first, with a Xero link', async () => {
    const { draftsAwaiting, xeroLink } = await import('@/lib/xero/pairing')
    const snap = { fetchedAt: 't', tenantName: 'x', baseCurrency: 'GBP', bankBalances: null, problems: [], invoices: [
      doc({ id: 'a', kind: 'sale', totalCents: 1, status: 'DRAFT', date: '2026-10-20' }),
      doc({ id: 'b', kind: 'bill', totalCents: 1, status: 'DRAFT', date: '2026-10-22' }),
      doc({ id: 'c', kind: 'sale', totalCents: 1, status: 'AUTHORISED' }),
    ] }
    expect(draftsAwaiting(snap).map((d) => d.id)).toEqual(['b', 'a'])
    expect(draftsAwaiting(null)).toEqual([])
    expect(xeroLink({ id: 'b', kind: 'bill' })).toBe('https://go.xero.com/AccountsPayable/Edit.aspx?InvoiceID=b')
  })
})
