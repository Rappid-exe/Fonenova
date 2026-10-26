import { describe, expect, it } from 'vitest'
import { fxProfit, fxTotals } from '@/lib/fx-profit'
import type { XeroInvoice } from '@/lib/types'

const doc = (p: Partial<XeroInvoice> & Pick<XeroInvoice, 'kind' | 'totalCents'>): XeroInvoice => ({
  id: p.kind, number: p.kind, reference: '', status: 'PAID', contactName: '', currency: 'EUR', date: '2026-08-11', dueDate: '2026-08-18',
  amountDueCents: 0, amountPaidCents: p.totalCents, payments: [], ...p,
})

describe('GBP profit per order from Xero rates', () => {
  it('books at the document rates and realises at the payment rates', () => {
    // Invoice 2026038 (€158,901 at 1.17041, paid 28 Aug) against a €156,000 bill at 1.17041 paid on 12 Aug at 1.16000.
    const client = doc({ kind: 'sale', totalCents: 158_901_00, currencyRate: 1.17041, payments: [{ id: 'p', date: '2026-08-28', amountCents: 158_901_00, currencyRate: 1.15500 }] })
    const bill = doc({ kind: 'bill', totalCents: 156_000_00, currencyRate: 1.17041, payments: [{ id: 'q', date: '2026-08-12', amountCents: 156_000_00, currencyRate: 1.16000 }] })
    const f = fxProfit('FN-ORD-032', client, bill)!
    expect(f.bookedGbpCents).toBe(Math.round(158_901_00 / 1.17041) - Math.round(156_000_00 / 1.17041)) // £2,478.62
    expect(f.realisedGbpCents).toBe(Math.round(158_901_00 / 1.155) - Math.round(156_000_00 / 1.16))
    expect(f.effectGbpCents).toBe(f.realisedGbpCents! - f.bookedGbpCents)
    expect(f.effectGbpCents! > 0).toBe(true) // the pound weakened between paying out and getting paid
    expect(f.pending).toBeNull()
  })

  it('does not guess realised profit while unpaid or settled by a credit note', () => {
    const bill = doc({ kind: 'bill', totalCents: 100_00, currencyRate: 1.17, payments: [{ id: 'q', date: null, amountCents: 100_00, currencyRate: 1.17 }] })
    const credited = doc({ kind: 'sale', totalCents: 91_107_50, currencyRate: 1.16651, payments: [{ id: 'p', date: null, amountCents: 18_396_39, currencyRate: 1.16 }] })
    expect(fxProfit('x', credited, bill)!.pending).toBe('Client invoice settled partly by a credit note')
    expect(fxProfit('x', doc({ kind: 'sale', totalCents: 1, status: 'AUTHORISED', amountDueCents: 1, currencyRate: 1.1 }), bill)!.pending).toBe('Client invoice not fully paid')
    expect(fxProfit('x', doc({ kind: 'sale', totalCents: 1 }), bill)).toBeNull() // no rate: an old snapshot
  })

  it('totals only the settled orders', () => {
    const t = fxTotals([
      { orderId: 'a', bookedGbpCents: 100, realisedGbpCents: 120, effectGbpCents: 20, invoiceRate: 1, billRate: 1, pending: null },
      { orderId: 'b', bookedGbpCents: 500, realisedGbpCents: null, effectGbpCents: null, invoiceRate: 1, billRate: 1, pending: 'x' },
    ])
    expect(t).toEqual({ settled: 1, bookedGbpCents: 100, realisedGbpCents: 120, effectGbpCents: 20, pending: 1 })
  })
})
