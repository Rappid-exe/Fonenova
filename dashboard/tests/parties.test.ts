import { describe, expect, it } from 'vitest'
import { customerRows, supplierRows } from '@/lib/metrics'
import type { CreditNote, Order } from '@/lib/types'

const order = (id: string, customerId: string, supplierId: string, sales: number, cost: number, date: string, owes: number | null, weOwe: number | null): Order => ({
  id, date, customerId, customerName: customerId.toUpperCase(), supplierId, supplierName: supplierId.toUpperCase(),
  clientInvoiceNo: '', supplierInvoiceNo: '', clientTotalCents: sales, supplierTotalCents: cost, grossMarginCents: sales - cost,
  goodsMarginCents: sales - cost, shippingMarginCents: 0, ledgerMarginRatio: null, clientStatus: 'PAID', clientOwesCents: owes,
  supplierStatus: 'PAID', weOweSupplierCents: weOwe, clientOwesMinusWeOweCents: 0, flags: [], clientPdf: { fileName: null }, supplierPdf: { fileName: null },
})
const note = (side: CreditNote['side'], orderIds: string[], amountCents: number, date = '2026-09-10'): CreditNote => ({ side, number: 'CN', date, amountCents, refersToInvoices: '', orderIds, covers: '', xeroShows: '', check: '' })

const orders = [
  order('o1', 'a', 's1', 100_00, 95_00, '2026-09-01', 0, 0),
  order('o2', 'a', 's1', 200_00, 202_00, '2026-09-05', 200_00, null),
  order('o3', 'b', 's1', 50_00, 48_00, '2026-09-07', null, 48_00),
]
const units = new Map([['o1', 2], ['o2', 3], ['o3', 1]])

describe('customer rows', () => {
  it('totals each customer, with open balances, unknowns, losses and own credits', () => {
    const notes = [note('client', ['o1'], 5_00), note('client', ['o1', 'o3'], 9_00), note('supplier', ['o2'], 3_00), note('client', ['o2'], 1_00, '2026-08-01')]
    const rows = customerRows(orders, units, notes, { start: '2026-09-01', end: '2026-09-30' })
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']) // biggest sales first
    expect(rows[0]).toMatchObject({ orderCount: 2, units: 5, salesCents: 300_00, grossProfitCents: 3_00, openCents: 200_00, unknownCount: 0, lossCount: 1, lastOrder: '2026-09-05' })
    // only the credit wholly on customer a and dated in the period; the a+b credit and the August one are left out
    expect(rows[0]).toMatchObject({ creditsCents: 5_00, creditCount: 1 })
    expect(rows[1]).toMatchObject({ openCents: 0, unknownCount: 1, creditsCents: 0 })
  })
})

describe('supplier rows', () => {
  it('totals what each supplier is owed and their credits', () => {
    const rows = supplierRows(orders, units, [note('supplier', ['o2'], 3_00)], null)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 's1', orderCount: 3, costCents: 345_00, openCents: 48_00, unknownCount: 1, creditsCents: 3_00 })
  })
})
