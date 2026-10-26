import { describe, expect, it } from 'vitest'
import { buildDigest } from '@/lib/digest'
import { liveView } from '@/lib/live-view'
import type { Ledger, Order, XeroInvoice } from '@/lib/types'

const order = (p: Partial<Order> & Pick<Order, 'id'>): Order => ({
  date: '2026-10-01', customerId: 'wave', customerName: 'Wave Phone B.V.', supplierId: 'mo', supplierName: 'Mobile One Trade B.V.',
  clientInvoiceNo: `I-${p.id}`, supplierInvoiceNo: `B-${p.id}`, clientTotalCents: 100_000_00, supplierTotalCents: 98_000_00, grossMarginCents: 2_000_00,
  goodsMarginCents: 2_000_00, shippingMarginCents: 0, ledgerMarginRatio: null, clientStatus: 'AUTHORISED', clientOwesCents: 0, supplierStatus: 'PAID',
  weOweSupplierCents: 0, clientOwesMinusWeOweCents: 0, flags: [], clientPdf: { fileName: null }, supplierPdf: { fileName: null }, ...p,
})
const ledger = (orders: Order[]) => ({ meta: { snapshotDate: '2026-10-04', isSample: false }, creditNotes: [], exceptions: [], orders, customers: [], suppliers: [], lines: [] }) as unknown as Ledger
const view = (orders: Order[]) => liveView(ledger(orders), null, [], '2026-10-30')

describe('Friday cash email', () => {
  it('lists late payers, bills due with the funding gap, Xero problems and drafts', () => {
    const d = buildDigest({
      view: view([
        order({ id: 'FN-ORD-016', customerName: 'G & I Global Ltd', clientOwesCents: 55_290_00, live: { clientDueDate: '2026-07-25', billDueDate: null, clientPayments: [], billPayments: [] } }),
        order({ id: 'FN-ORD-040', clientOwesCents: 120_000_00, weOweSupplierCents: 118_000_00, live: { clientDueDate: '2026-11-20', billDueDate: '2026-11-05', clientPayments: [], billPayments: [] } }),
      ]),
      fx: null,
      today: '2026-10-30',
      appUrl: 'https://dashboard.fonenova.com',
      drafts: [{ id: 'd' } as XeroInvoice],
      problems: [{ id: 'X-1', priority: 'HIGH', source: 'Xero check', reference: 'Supplier credit note 2026080086', orderId: null, orderIds: [], issue: '€43,668.00 credit is not in Xero at all.', impactCents: 43_668_00, impactLabel: 'Missing in Xero', action: null, link: 'https://go.xero.com/x' }],
    })
    expect(d.subject).toBe('QuayPilot weekly: €55k overdue, €118k to pay in 14 days, 1 Xero problem')
    expect(d.figures).toMatchObject({ overdueCents: 55_290_00, overdueCount: 1, dueOutCents: 118_000_00, dueInCents: 0, drafts: 1, problems: 1 })
    expect(d.text).toContain('G & I Global Ltd: invoice I-FN-ORD-016, €55,290, 97 days late')
    expect(d.text).toContain('(client not paid yet)')
    expect(d.text).toContain('Gap: €118,000')
    expect(d.html).toContain('G &amp; I Global Ltd') // escaped
    expect(d.html).toContain('https://dashboard.fonenova.com/#matching')
  })

  it('says so plainly in a quiet week', () => {
    const d = buildDigest({ view: view([order({ id: 'FN-ORD-001' })]), fx: null, today: '2026-10-30', appUrl: 'https://x', drafts: [], problems: [] })
    expect(d.subject).toBe('QuayPilot weekly: nothing overdue')
    expect(d.html).toContain('Nothing overdue, nothing due out and no Xero problems this week.')
  })
})
