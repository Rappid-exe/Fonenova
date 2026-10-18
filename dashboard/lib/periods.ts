import type { IsoDate } from './types'

/** Inclusive calendar date range. */
export interface DateRange {
  start: IsoDate
  end: IsoDate
}

export type PresetId = 'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 'ytd' | 'all' | 'custom'

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'this-quarter', label: 'This quarter' },
  { id: 'last-quarter', label: 'Last quarter' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
]

/** What the ledger can speak for: from the first order's month to the Xero snapshot date. */
export interface Coverage {
  start: IsoDate
  end: IsoDate
}

// ---- date primitives (UTC, no time component) ----

export function parseIso(d: IsoDate): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: IsoDate, n: number): IsoDate {
  const x = parseIso(d)
  x.setUTCDate(x.getUTCDate() + n)
  return toIso(x)
}

function ymd(y: number, m0: number, day: number): IsoDate {
  return toIso(new Date(Date.UTC(y, m0, day)))
}

export function monthStart(d: IsoDate): IsoDate {
  const x = parseIso(d)
  return ymd(x.getUTCFullYear(), x.getUTCMonth(), 1)
}

export function monthEnd(d: IsoDate): IsoDate {
  const x = parseIso(d)
  return ymd(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)
}

export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000)
}

export function inRange(d: IsoDate, r: DateRange): boolean {
  return d >= r.start && d <= r.end
}

export function todayIso(now: Date = new Date()): IsoDate {
  return ymd(now.getFullYear(), now.getMonth(), now.getDate())
}

// ---- presets ----

export function coverageFor(orderDates: IsoDate[], snapshotDate: IsoDate): Coverage {
  const sorted = [...orderDates].sort()
  const first = sorted[0] ?? snapshotDate
  const last = sorted.at(-1) ?? snapshotDate
  return { start: monthStart(first), end: last > snapshotDate ? last : snapshotDate }
}

export function presetRange(id: Exclude<PresetId, 'custom'>, today: IsoDate, coverage: Coverage): DateRange {
  const t = parseIso(today)
  const y = t.getUTCFullYear()
  const m = t.getUTCMonth()
  const q = Math.floor(m / 3)
  switch (id) {
    case 'this-month':
      return { start: ymd(y, m, 1), end: ymd(y, m + 1, 0) }
    case 'last-month':
      return { start: ymd(y, m - 1, 1), end: ymd(y, m, 0) }
    case 'this-quarter':
      return { start: ymd(y, q * 3, 1), end: ymd(y, q * 3 + 3, 0) }
    case 'last-quarter':
      return { start: ymd(y, q * 3 - 3, 1), end: ymd(y, q * 3, 0) }
    case 'ytd':
      return { start: ymd(y, 0, 1), end: today }
    case 'all':
      return { start: coverage.start, end: coverage.end }
  }
}

/** The period to compare against. Null for All time, which has nothing before it. */
export function previousRange(id: PresetId, range: DateRange): DateRange | null {
  const s = parseIso(range.start)
  const y = s.getUTCFullYear()
  const m = s.getUTCMonth()
  switch (id) {
    case 'this-month':
    case 'last-month':
      return { start: ymd(y, m - 1, 1), end: ymd(y, m, 0) }
    case 'this-quarter':
    case 'last-quarter':
      return { start: ymd(y, m - 3, 1), end: ymd(y, m, 0) }
    case 'ytd': {
      const e = parseIso(range.end)
      return { start: ymd(y - 1, 0, 1), end: ymd(e.getUTCFullYear() - 1, e.getUTCMonth(), e.getUTCDate()) }
    }
    case 'all':
      return null
    case 'custom': {
      const len = daysBetween(range.start, range.end) + 1
      return { start: addDays(range.start, -len), end: addDays(range.start, -1) }
    }
  }
}

export type Comparison =
  | { valid: true; previous: DateRange }
  | { valid: false; reason: string }

/**
 * A comparison is only shown when both periods sit fully inside what the ledger covers.
 * A period that runs past the Xero snapshot is incomplete, and a period before the first
 * order month is unknown, not zero.
 */
export function comparisonFor(id: PresetId, range: DateRange, coverage: Coverage): Comparison {
  const previous = previousRange(id, range)
  if (!previous) return { valid: false, reason: 'No earlier period to compare with' }
  if (range.end > coverage.end) {
    return { valid: false, reason: `Period runs past the ledger's last update (${formatDate(coverage.end)})` }
  }
  if (previous.start < coverage.start) {
    return { valid: false, reason: `Previous period starts before the ledger (${formatDate(coverage.start)})` }
  }
  return { valid: true, previous }
}

// ---- chart buckets ----

export type Granularity = 'month' | 'week'

export interface Bucket {
  key: string
  start: IsoDate
  end: IsoDate
  label: string
}

/** Monday of the ISO week containing d. */
export function weekStart(d: IsoDate): IsoDate {
  const x = parseIso(d)
  const dow = (x.getUTCDay() + 6) % 7
  return addDays(d, -dow)
}

export function buckets(range: DateRange, g: Granularity): Bucket[] {
  const out: Bucket[] = []
  if (range.end < range.start) return out
  if (g === 'month') {
    let cur = monthStart(range.start)
    while (cur <= range.end) {
      const end = monthEnd(cur)
      out.push({ key: cur.slice(0, 7), start: cur, end, label: formatMonth(cur) })
      cur = addDays(end, 1)
    }
  } else {
    let cur = weekStart(range.start)
    while (cur <= range.end) {
      out.push({ key: cur, start: cur, end: addDays(cur, 6), label: formatDay(cur) })
      cur = addDays(cur, 7)
    }
  }
  return out
}

export function bucketKey(d: IsoDate, g: Granularity): string {
  return g === 'month' ? d.slice(0, 7) : weekStart(d)
}

// ---- labels ----

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(d: IsoDate): string {
  const x = parseIso(d)
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`
}

export function formatDay(d: IsoDate): string {
  const x = parseIso(d)
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`
}

export function formatMonth(d: IsoDate): string {
  const x = parseIso(d)
  return `${MONTHS[x.getUTCMonth()]} ${String(x.getUTCFullYear()).slice(2)}`
}

export function formatRange(r: DateRange): string {
  return `${formatDate(r.start)} to ${formatDate(r.end)}`
}
