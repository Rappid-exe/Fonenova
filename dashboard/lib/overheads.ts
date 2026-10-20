/** Overhead list validation and the starting list. Pure, so it is shared by the API and tests. */
import type { Overhead } from './types'

/**
 * The owner's starting list: names, days and type only. Amounts and start dates are never
 * assumed. Housing rent defaults to personal: it is invoiced to the owner for their home.
 */
export const STARTER_OVERHEADS: Overhead[] = [
  { id: 'office-rent', name: 'Office rent', amountCents: null, currency: 'GBP', dayOfMonth: 15, category: 'business', startDate: null, endDate: null },
  { id: 'housing-rent', name: 'Housing rent', amountCents: null, currency: 'GBP', dayOfMonth: 1, category: 'personal', startDate: null, endDate: null },
  { id: 'car-payment', name: 'Car payment', amountCents: null, currency: 'GBP', dayOfMonth: 7, category: 'business', startDate: null, endDate: null },
]

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function validateOverheads(input: unknown): { ok: true; overheads: Overhead[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length > 100) return { ok: false, error: 'Expected a list of up to 100 overheads' }
  const out: Overhead[] = []
  const ids = new Set<string>()
  for (const [i, raw] of input.entries()) {
    const o = raw as Partial<Overhead>
    const at = `Row ${i + 1}`
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 80) : ''
    if (!name) return { ok: false, error: `${at}: name is required` }
    const id = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : ''
    if (!id || ids.has(id)) return { ok: false, error: `${at}: missing or duplicate id` }
    ids.add(id)
    const amount = o.amountCents
    if (amount !== null && !(Number.isInteger(amount) && (amount as number) >= 0 && (amount as number) <= 100_000_000_00)) {
      return { ok: false, error: `${name}: amount must be a positive figure in pence or cents` }
    }
    if (o.currency !== 'GBP' && o.currency !== 'EUR') return { ok: false, error: `${name}: currency must be GBP or EUR` }
    if (!Number.isInteger(o.dayOfMonth) || o.dayOfMonth! < 1 || o.dayOfMonth! > 31) return { ok: false, error: `${name}: day must be 1 to 31` }
    if (o.category !== 'business' && o.category !== 'personal') return { ok: false, error: `${name}: choose business or personal` }
    const start = o.startDate ?? null
    const end = o.endDate ?? null
    if (start !== null && !ISO.test(start)) return { ok: false, error: `${name}: start date is not a date` }
    if (end !== null && !ISO.test(end)) return { ok: false, error: `${name}: end date is not a date` }
    if (start && end && end < start) return { ok: false, error: `${name}: end date is before the start date` }
    out.push({ id, name, amountCents: amount ?? null, currency: o.currency, dayOfMonth: o.dayOfMonth!, category: o.category, startDate: start, endDate: end })
  }
  return { ok: true, overheads: out }
}
