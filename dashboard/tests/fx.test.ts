import { describe, expect, it } from 'vitest'
import { parseFxResponse } from '@/lib/fx'
import { convertCents } from '@/lib/metrics'
import type { FxRate } from '@/lib/types'

const fx: FxRate = { base: 'EUR', quote: 'GBP', rate: 0.84028, rateDate: '2026-10-20', source: 'test', fetchedAt: '2026-10-20T15:00:00Z' }

describe('currency conversion', () => {
  it('converts EUR to GBP once, rounded to the cent', () => {
    expect(convertCents(4260636, 'EUR', 'GBP', fx)).toBe(Math.round(4260636 * 0.84028)) // €42,606.36 -> £35,801.27
    expect(convertCents(4260636, 'EUR', 'GBP', fx)).toBe(3580127)
    expect(convertCents(-5000, 'EUR', 'GBP', fx)).toBe(-4201)
  })
  it('converts GBP to EUR by dividing by the same rate', () => {
    expect(convertCents(84028, 'GBP', 'EUR', fx)).toBe(100000)
  })
  it('never converts without a rate, and leaves same-currency figures alone', () => {
    expect(convertCents(100, 'EUR', 'GBP', null)).toBeNull()
    expect(convertCents(100, 'EUR', 'EUR', null)).toBe(100)
    expect(convertCents(0, 'EUR', 'GBP', fx)).toBe(0)
  })
})

describe('rate response validation', () => {
  it('accepts a valid ECB response', () => {
    const r = parseFxResponse({ amount: 1, base: 'EUR', date: '2026-10-20', rates: { GBP: 0.84028 } }, 'now')
    expect(r).toMatchObject({ ok: true, fx: { rate: 0.84028, rateDate: '2026-10-20' } })
  })
  it('refuses anything that is not a plausible EUR to GBP rate', () => {
    for (const bad of [{}, { base: 'USD', date: '2026-10-20', rates: { GBP: 0.8 } }, { base: 'EUR', date: '2026-10-20', rates: { GBP: 84 } }, { base: 'EUR', date: 'today', rates: { GBP: 0.84 } }, null]) {
      expect(parseFxResponse(bad, 'now').ok).toBe(false)
    }
  })
})
