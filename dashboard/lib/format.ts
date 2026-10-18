/**
 * Display formatting only. Inputs are integer cents; nothing here adds figures up.
 * Negative values use a true minus sign so they never read as a hyphen.
 */
import type { Cents } from './types'

const MINUS = '−'

const eur2 = new Intl.NumberFormat('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const eur0 = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 })
const int = new Intl.NumberFormat('en-IE')

export function eur(cents: Cents, opts: { sign?: boolean; whole?: boolean } = {}): string {
  const abs = Math.abs(cents) / 100
  const body = `€${(opts.whole ? eur0 : eur2).format(abs)}`
  if (cents < 0) return `${MINUS}${body}`
  if (opts.sign && cents > 0) return `+${body}`
  return body
}

/** Axis labels: €1.2m, €350k. */
export function eurCompact(cents: Cents): string {
  const v = Math.abs(cents) / 100
  const sign = cents < 0 ? MINUS : ''
  if (v >= 1_000_000) return `${sign}€${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`
  if (v >= 1_000) return `${sign}€${(v / 1_000).toFixed(v >= 100_000 ? 0 : v >= 10_000 ? 0 : 1)}k`
  return `${sign}€${v.toFixed(0)}`
}

export function pct(r: number | null, digits = 2, opts: { sign?: boolean } = {}): string {
  if (r === null || !Number.isFinite(r)) return 'n/a'
  const v = (r * 100).toFixed(digits)
  if (r < 0) return `${MINUS}${v.replace('-', '')}%`
  return `${opts.sign && r > 0 ? '+' : ''}${v}%`
}

export function pts(p: number | null): string {
  if (p === null) return 'n/a'
  const v = Math.abs(p).toFixed(2)
  return `${p < 0 ? MINUS : p > 0 ? '+' : ''}${v} pp`
}

export function count(n: number, opts: { sign?: boolean } = {}): string {
  const body = int.format(Math.abs(n))
  if (n < 0) return `${MINUS}${body}`
  return `${opts.sign && n > 0 ? '+' : ''}${body}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`
}
