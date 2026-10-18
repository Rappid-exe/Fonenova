import type { Cents } from './types'

/**
 * Convert a spreadsheet euro value to integer cents.
 * Spreadsheet formulas carry float noise (42606.3599999999), so round to the cent once, here,
 * and do every later sum in integers.
 */
export function toCents(value: unknown): Cents {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[€,\s]/g, ''))
  if (!Number.isFinite(n)) throw new Error(`Not a money value: ${String(value)}`)
  const cents = Math.round(n * 100)
  return cents === 0 ? 0 : cents // normalise -0
}

export function sumCents<T>(items: readonly T[], pick: (item: T) => Cents | null | undefined): Cents {
  let total = 0
  for (const item of items) {
    const v = pick(item)
    if (v === null || v === undefined) continue
    if (!Number.isInteger(v)) throw new Error(`Non-integer cents value: ${v}`)
    total += v
  }
  return total
}

/** Ratio of two cent amounts. Null when the base is zero, because a margin on no sales is undefined. */
export function ratio(numerator: Cents, denominator: Cents): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}
