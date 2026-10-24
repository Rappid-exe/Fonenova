import { describe, expect, it } from 'vitest'
import { toCents } from '@/lib/money'
import {
  allocateCredits, cashPosition, change, concentration, creditTotals, filterOrders, marginBand,
  marginChangePts, profitAfterCredits, timeSeries, totals, unitsByOrder,
} from '@/lib/metrics'
import { comparisonFor, coverageFor, presetRange, previousRange } from '@/lib/periods'
import type { CreditNote, Order, OrderLine } from '@/lib/types'

function order(p: Partial<Order> & Pick<Order, 'id' | 'date' | 'clientTotalCents' | 'supplierTotalCents'>): Order {
  const gross = p.clientTotalCents - p.supplierTotalCents
  return {
    customerId: 'a', customerName: 'A', supplierId: 's', supplierName: 'S', clientInvoiceNo: 'C', supplierInvoiceNo: 'S',
    grossMarginCents: gross, goodsMarginCents: gross, shippingMarginCents: 0, ledgerMarginRatio: null,
    clientStatus: 'PAID', clientOwesCents: 0, supplierStatus: 'PAID', weOweSupplierCents: 0, clientOwesMinusWeOweCents: 0,
    flags: [], clientPdf: { fileName: null }, supplierPdf: { fileName: null }, ...p,
  }
}
function line(orderId: string, type: 'goods' | 'shipping', qty: number): OrderLine {
  return { orderId, lineNo: 1, type, description: '', qty, clientUnitCents: 0, supplierUnitCents: 0, clientAmountCents: 0, supplierAmountCents: 0, marginCents: 0, marginPerUnitCents: 0, note: null }
}
function credit(side: 'client' | 'supplier', amountCents: number, date: string, orderIds: string[]): CreditNote {
  return { side, number: `${side}-${amountCents}`, date, amountCents, refersToInvoices: '', orderIds, covers: '', xeroShows: '', check: '' }
}

const O = [
  order({ id: '1', date: '2026-05-10', clientTotalCents: 100_00, supplierTotalCents: 98_00, customerId: 'a' }),
  order({ id: '2', date: '2026-05-20', clientTotalCents: 200_00, supplierTotalCents: 201_00, customerId: 'b', customerName: 'B' }),
  order({ id: '3', date: '2026-07-01', clientTotalCents: 1000_00, supplierTotalCents: 996_00, customerId: 'a' }),
]

describe('money', () => {
  it('rounds spreadsheet float noise to the cent once', () => {
    expect(toCents(42606.3599999999)).toBe(4260636)
    expect(toCents(-0.639999999999418)).toBe(-64)
    expect(toCents(null)).toBe(0)
    expect(Object.is(toCents(-0.001), -0)).toBe(false)
  })
  it('sums 0.1 + 0.2 exactly in cents', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3))
  })
})

describe('profit and margin', () => {
  it('totals gross profit, margin and average per order', () => {
    const t = totals(O, unitsByOrder([line('1', 'goods', 3), line('1', 'shipping', 1), line('3', 'goods', 5)]))
    expect(t.salesCents).toBe(1300_00)
    expect(t.costCents).toBe(1295_00)
    expect(t.grossProfitCents).toBe(5_00)
    expect(t.marginRatio).toBeCloseTo(5 / 1300, 12)
    expect(t.avgProfitPerOrderCents).toBe(167) // 500 / 3 = 166.67, rounded
    expect(t.units).toBe(8) // shipping Qty excluded
    expect(t.lossMakingCount).toBe(1)
  })
  it('returns null margin and average for an empty period, not zero', () => {
    const t = totals([], new Map())
    expect(t.marginRatio).toBeNull()
    expect(t.avgProfitPerOrderCents).toBeNull()
  })
  it('uses the ledger margin bands: red below zero, amber under 0.5%', () => {
    expect(marginBand(-0.0001)).toBe('loss')
    expect(marginBand(0)).toBe('thin')
    expect(marginBand(0.00499)).toBe('thin')
    expect(marginBand(0.005)).toBe('ok')
    expect(marginBand(null)).toBe('none')
  })
})

describe('filters', () => {
  it('filters by inclusive date range and customer', () => {
    expect(filterOrders(O, { range: { start: '2026-05-10', end: '2026-05-20' } }).map((o) => o.id)).toEqual(['1', '2'])
    expect(filterOrders(O, { customerId: 'a' }).map((o) => o.id)).toEqual(['1', '3'])
  })
})

describe('credit notes', () => {
  const notes = [
    credit('client', 50_00, '2026-08-01', ['3']),
    credit('supplier', 40_00, '2026-08-01', ['3']),
    credit('supplier', 30_00, '2026-08-02', ['1', '3']),
    credit('supplier', 7_00, '2026-08-03', ['1', '2']),
  ]
  it('allocates only single-order credits; multi-order credits are never split', () => {
    const a = allocateCredits(notes)
    expect(a.byOrder.get('3')?.length).toBe(2)
    expect(a.byOrder.has('1')).toBe(false)
    expect(a.unallocated.map((n) => n.amountCents)).toEqual([30_00, 7_00])
  })
  it('profit after credits = gross + supplier credits - client credits', () => {
    const c = creditTotals(notes, O, {})
    expect(c.clientCreditsCents).toBe(50_00)
    expect(c.supplierCreditsCents).toBe(77_00)
    expect(profitAfterCredits(5_00, c)).toBe(5_00 + 77_00 - 50_00)
  })
  it('counts credits by their own date', () => {
    const c = creditTotals(notes, O, { range: { start: '2026-08-02', end: '2026-08-31' } })
    expect(c.notes.map((n) => n.amountCents)).toEqual([30_00, 7_00])
  })
  it('with a customer filter, drops credits that span another customer', () => {
    const c = creditTotals(notes, O, { customerId: 'a' })
    expect(c.supplierCreditsCents).toBe(70_00)
    expect(c.excludedMixedCustomer.map((n) => n.amountCents)).toEqual([7_00])
  })
})

describe('period comparisons', () => {
  // Ledger shape: first order 5 Feb, Xero snapshot 4 Oct.
  const coverage = coverageFor(['2026-02-05', ...O.map((o) => o.date)], '2026-10-04')
  it('builds presets from today', () => {
    expect(presetRange('last-month', '2026-10-18', coverage)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(presetRange('last-quarter', '2026-10-18', coverage)).toEqual({ start: '2026-07-01', end: '2026-09-30' })
    expect(presetRange('this-quarter', '2026-02-10', coverage)).toEqual({ start: '2026-01-01', end: '2026-03-31' })
    expect(presetRange('ytd', '2026-10-18', coverage)).toEqual({ start: '2026-01-01', end: '2026-10-18' })
  })
  it('previous period matches length and calendar unit', () => {
    expect(previousRange('last-month', { start: '2026-03-01', end: '2026-03-31' })).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(previousRange('last-quarter', { start: '2026-07-01', end: '2026-09-30' })).toEqual({ start: '2026-04-01', end: '2026-06-30' })
    expect(previousRange('custom', { start: '2026-06-11', end: '2026-06-20' })).toEqual({ start: '2026-06-01', end: '2026-06-10' })
    expect(previousRange('all', coverage)).toBeNull()
  })
  it('only compares when both periods are inside the ledger coverage', () => {
    expect(comparisonFor('last-quarter', { start: '2026-07-01', end: '2026-09-30' }, coverage).valid).toBe(true)
    expect(comparisonFor('this-month', { start: '2026-10-01', end: '2026-10-31' }, coverage).valid).toBe(false) // runs past snapshot
    expect(comparisonFor('last-month', { start: '2026-02-01', end: '2026-02-28' }, coverage).valid).toBe(false) // January is before the ledger
    expect(comparisonFor('last-month', { start: '2026-05-01', end: '2026-05-31' }, coverage).valid).toBe(true) // April had no orders: a real zero
    expect(comparisonFor('all', coverage, coverage).valid).toBe(false)
  })
  it('change has no percentage from a zero base', () => {
    expect(change(150, 100)).toEqual({ delta: 50, pct: 0.5 })
    expect(change(-50, 100).pct).toBe(-1.5)
    expect(change(100, 0).pct).toBeNull()
    expect(change(100, -200).pct).toBe(1.5)
    expect(marginChangePts(0.015, 0.012)).toBeCloseTo(0.3, 10)
    expect(marginChangePts(0.015, null)).toBeNull()
  })
})

describe('time series', () => {
  it('keeps empty months as gaps with null margin, not interpolated', () => {
    const s = timeSeries(O, { start: '2026-05-01', end: '2026-07-31' }, 'month')
    expect(s.map((p) => p.key)).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(s[1]).toMatchObject({ orderCount: 0, salesCents: 0, marginRatio: null })
    expect(s[0].grossProfitCents).toBe(1_00)
  })
  it('weekly buckets start on Monday', () => {
    const s = timeSeries(O, { start: '2026-05-10', end: '2026-05-20' }, 'week')
    expect(s.map((p) => p.start)).toEqual(['2026-05-04', '2026-05-11', '2026-05-18'])
    expect(s.map((p) => p.orderCount)).toEqual([1, 0, 1])
  })
})

describe('concentration and cash', () => {
  it('ranks customers by sales share', () => {
    const c = concentration(O)
    expect(c[0].customerId).toBe('a')
    expect(c[0].salesShare).toBeCloseTo(1100 / 1300, 12)
  })
  it('flags a funding gap when we owe the supplier and the client has not paid', () => {
    const cash = cashPosition([
      order({ id: 'x', date: '2026-09-01', clientTotalCents: 100, supplierTotalCents: 90, clientOwesCents: 100, weOweSupplierCents: 90 }),
      order({ id: 'y', date: '2026-09-01', clientTotalCents: 100, supplierTotalCents: 90, clientOwesCents: 0, weOweSupplierCents: 90 }),
      order({ id: 'z', date: '2026-09-01', clientTotalCents: 100, supplierTotalCents: 90, clientStatus: 'NOT_IN_XERO', clientOwesCents: null, weOweSupplierCents: 90 }),
      order({ id: 'paid', date: '2026-09-01', clientTotalCents: 100, supplierTotalCents: 90 }),
    ])
    expect(cash.open.map((x) => [x.order.id, x.fundingGap])).toEqual([['x', true], ['z', true], ['y', false]])
    expect(cash.clientsOweCents).toBe(100)
    expect(cash.weOweSupplierCents).toBe(270)
    expect(cash.differenceCents).toBe(-170)
    expect(cash.unknownClientBalances).toBe(1)
  })
})

describe('margin-scheme VAT', () => {
  it('is 1/6 of each positive margin, with losses not offset', async () => {
    const { marginSchemeVat } = await import('@/lib/metrics')
    const o = (grossMarginCents: number) => ({ grossMarginCents }) as never
    expect(marginSchemeVat([o(600_00), o(-50_00), o(1)])).toBe(100_00)
    expect(marginSchemeVat([])).toBe(0)
  })
  it('comes off net profit only when passed in', async () => {
    const { netBusinessProfit } = await import('@/lib/metrics')
    const fx = { base: 'EUR', quote: 'GBP', rate: 0.8, rateDate: '2026-10-20', source: 't', fetchedAt: 't' } as const
    const office = { id: 'office-rent', name: 'Office rent', amountCents: 1000_00, currency: 'GBP' as const, dayOfMonth: 15, category: 'business' as const, startDate: '2026-01-15', endDate: null }
    const args = { grossAfterCreditsEurCents: 10_000_00, overheads: [office], range: { start: '2026-09-01', end: '2026-09-30' }, today: '2026-10-20', fx }
    const off = netBusinessProfit(args)
    const on = netBusinessProfit({ ...args, marginVatEurCents: 1_000_00 })
    if (off.status !== 'ok' || on.status !== 'ok') throw new Error('expected ok')
    expect(off.netEurCents - on.netEurCents).toBe(1_000_00)
    expect(off.netGbpCents - on.netGbpCents).toBe(800_00)
    expect(on.marginVatEurCents).toBe(1_000_00)
  })
})
