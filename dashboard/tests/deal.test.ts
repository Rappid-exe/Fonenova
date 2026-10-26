import { describe, expect, it } from 'vitest'
import { checkDeal, parseEuro } from '@/lib/deal'

const base = { supplierShippingCents: 0, shippingRechargedCents: 0, marginVat: false, fxCushionPct: 0, supplierDueDays: 7, clientDueDays: 7 }

describe('deal checker', () => {
  it('replays FN-ORD-017: €600 on goods, shipping recharged at half its cost, a €50 loss', () => {
    const r = checkDeal({ ...base, lines: [{ units: 10, buyCents: 100_00, sellCents: 160_00 }], supplierShippingCents: 1_300_00, shippingRechargedCents: 650_00 })
    expect([r.goodsMarginCents, r.shippingMarginCents, r.grossCents, r.verdict]).toEqual([600_00, -650_00, -50_00, 'loss'])
    expect(r.warnings[0]).toContain('€650 lost on shipping')
  })

  it('takes margin VAT and the FX cushion off the margin, and calls a thin deal thin', () => {
    // €100,000 sale at 1.5% gross: VAT 1/6 of €1,500 = €250, cushion 0.5% = €500.
    const r = checkDeal({ ...base, lines: [{ units: 100, buyCents: 985_00, sellCents: 1_000_00 }], marginVat: true, fxCushionPct: 0.5 })
    expect([r.grossCents, r.marginVatCents, r.fxCushionCents, r.netCents]).toEqual([1_500_00, 250_00, 500_00, 750_00])
    expect(r.netRatio).toBeCloseTo(0.0075)
    expect(r.verdict).toBe('ok')
    expect(checkDeal({ ...base, lines: [{ units: 100, buyCents: 997_00, sellCents: 1_000_00 }] }).verdict).toBe('thin')
  })

  it('warns about a line below cost and about paying the supplier first', () => {
    const r = checkDeal({ ...base, lines: [{ description: 'iPhone 15', units: 2, buyCents: 400_00, sellCents: 390_00 }, { units: 10, buyCents: 100_00, sellCents: 120_00 }], supplierDueDays: 3, clientDueDays: 14 })
    expect(r.warnings).toEqual([
      'Line 1 (iPhone 15) sells at €390 a unit, below its €400 cost.',
      'You pay Mobile One 11 days before the client is due to pay: €1,800 of your own cash is tied up.',
    ])
    expect([r.fundedDays, r.fundedCents]).toEqual([11, 1_800_00])
  })

  it('reads euro amounts the way people type them', () => {
    expect(['419', '€1,234.50', '419,5', ' 12.3 ', '', 'abc', '1.2.3'].map(parseEuro)).toEqual([41900, 123450, 41950, 1230, null, null, null])
  })
})
