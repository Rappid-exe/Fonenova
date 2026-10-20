import type { FxResult } from './types'

/** Validate a Frankfurter response. A rate outside a sane band is refused, never used. */
export function parseFxResponse(json: unknown, fetchedAt: string): FxResult {
  const j = json as { base?: string; date?: string; rates?: { GBP?: number } }
  const rate = j?.rates?.GBP
  if (j?.base !== 'EUR' || typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0.5 || rate > 1.5) {
    return { ok: false, reason: 'The rate service returned something that is not a valid EUR to GBP rate' }
  }
  if (typeof j.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(j.date)) {
    return { ok: false, reason: 'The rate service did not say which day the rate is for' }
  }
  return { ok: true, fx: { base: 'EUR', quote: 'GBP', rate, rateDate: j.date, source: 'European Central Bank reference rate (via Frankfurter)', fetchedAt } }
}
