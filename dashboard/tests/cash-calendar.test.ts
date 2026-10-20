import { describe, expect, it } from 'vitest'
import { cashCalendar } from '@/lib/metrics'
import type { FxRate, Order, Overhead } from '@/lib/types'

const fx: FxRate = { base: 'EUR', quote: 'GBP', rate: 0.8, rateDate: '2026-10-20', source: 't', fetchedAt: 't' }
const order = (p: Partial<Order>): Order => ({
  id: 'O1', date: '2026-09-01', customerId: 'w', customerName: 'Wave', supplierId: 's', supplierName: 'Mobile One',
  clientInvoiceNo: 'C1', supplierInvoiceNo: 'S1', clientTotalCents: 0, supplierTotalCents: 0, grossMarginCents: 0,
  goodsMarginCents: 0, shippingMarginCents: 0, ledgerMarginRatio: null, clientStatus: 'AUTHORISED', clientOwesCents: 0,
  supplierStatus: 'AUTHORISED', weOweSupplierCents: 0, clientOwesMinusWeOweCents: 0, flags: [],
  clientPdf: { fileName: null }, supplierPdf: { fileName: null }, ...p,
})
const live = (clientDueDate: string | null, billDueDate: string | null) => ({ clientDueDate, billDueDate, clientPayments: [], billPayments: [] })
const rent: Overhead = { id: 'r', name: 'Office rent', amountCents: 50000, currency: 'GBP', dayOfMonth: 15, category: 'business', startDate: '2026-01-01', endDate: null }

describe('cash calendar', () => {
  const today = '2026-10-10'
  it('without Xero: overheads are dated, open balances are listed as undated, no running balance', () => {
    const c = cashCalendar({ orders: [order({ clientOwesCents: 10000, weOweSupplierCents: 9000 })], overheads: [rent], today, days: 30, fx, bank: null })
    expect(c.days.map((d) => [d.date, d.entries.map((e) => e.label)])).toEqual([['2026-10-15', ['Office rent']]])
    expect(c.undated.map((e) => e.kind)).toEqual(['in', 'out'])
    expect(c.start).toBeNull()
    expect(c.noBalanceReason).toMatch(/Xero/)
    expect(c.days[0].balanceCents).toBeNull()
  })
  it('flags the supplier being paid before the client pays', () => {
    const o = order({ clientOwesCents: 10000, weOweSupplierCents: 9000, live: live('2026-10-20', '2026-10-12') })
    const c = cashCalendar({ orders: [o], overheads: [], today, days: 30, fx, bank: null })
    const out = c.days.find((d) => d.date === '2026-10-12')!
    expect(out.fundingGap).toBe(true)
    const paidFirst = cashCalendar({ orders: [order({ ...o, live: live('2026-10-11', '2026-10-12') })], overheads: [], today, days: 30, fx, bank: null })
    expect(paidFirst.days.find((d) => d.date === '2026-10-12')!.fundingGap).toBe(false)
  })
  it('runs a GBP balance from Xero, converting EUR flows once and counting overdue bills now', () => {
    const o1 = order({ id: 'A', clientOwesCents: 100000, weOweSupplierCents: 0, live: live('2026-10-20', null) }) // +€1,000 = +£800
    const o2 = order({ id: 'B', clientOwesCents: 0, weOweSupplierCents: 50000, live: live(null, '2026-10-01') }) // overdue bill -€500 = -£400
    const o3 = order({ id: 'C', clientOwesCents: 20000, weOweSupplierCents: 0, live: live('2026-10-02', null) }) // overdue receipt: not counted
    const c = cashCalendar({ orders: [o1, o2, o3], overheads: [rent], today, days: 30, fx, bank: { balances: [{ accountName: 'Current', closingCents: 100000 }], currency: 'GBP' } })
    expect(c.start).toMatchObject({ balanceCents: 100000, currency: 'GBP' })
    expect(c.overdue.map((e) => e.orderId)).toEqual(['B', 'C']) // date order: 1 Oct, then 2 Oct
    expect(c.days.map((d) => [d.date, d.balanceCents])).toEqual([
      ['2026-10-15', 100000 - 40000 - 50000], // £1,000 - overdue £400 - rent £500
      ['2026-10-20', 10000 + 80000],
    ])
  })
  it('flags days where the running balance goes below zero', () => {
    const c = cashCalendar({ orders: [], overheads: [rent], today, days: 30, fx, bank: { balances: [{ accountName: 'C', closingCents: 10000 }], currency: 'GBP' } })
    expect(c.days[0]).toMatchObject({ balanceCents: -40000, belowZero: true })
  })
  it('refuses a running balance that would need a missing exchange rate', () => {
    const o = order({ clientOwesCents: 100, live: live('2026-10-20', null) })
    const c = cashCalendar({ orders: [o], overheads: [], today, days: 30, fx: null, bank: { balances: [{ accountName: 'C', closingCents: 1 }], currency: 'GBP' } })
    expect(c.start).toBeNull()
    expect(c.noBalanceReason).toMatch(/exchange rate/)
  })
  it('counts items beyond the window instead of hiding them silently', () => {
    const o = order({ clientOwesCents: 100, live: live('2027-01-20', null) })
    expect(cashCalendar({ orders: [o], overheads: [], today, days: 30, fx, bank: null }).laterCount).toBe(1)
  })
})
