import { describe, expect, it } from 'vitest'
import { monthlyOverheads, netBusinessProfit, overheadCharges, sumByCurrency } from '@/lib/metrics'
import type { FxRate, Overhead } from '@/lib/types'

const fx: FxRate = { base: 'EUR', quote: 'GBP', rate: 0.8, rateDate: '2026-10-20', source: 't', fetchedAt: 't' }
const oh = (p: Partial<Overhead>): Overhead => ({
  id: p.name ?? 'x', name: 'x', amountCents: 100000, currency: 'GBP', dayOfMonth: 1, category: 'business', startDate: '2026-01-01', endDate: null, ...p,
})
const office = oh({ name: 'Office rent', dayOfMonth: 15, amountCents: 80000 })
const housing = oh({ name: 'Housing rent', dayOfMonth: 1, amountCents: 120000 })
const car = oh({ name: 'Car payment', dayOfMonth: 1, amountCents: 40000, category: 'personal' })

describe('overhead schedule', () => {
  it('places office rent on the 15th and housing and car on the 1st', () => {
    const c = overheadCharges([office, housing, car], { start: '2026-10-01', end: '2026-10-31' })
    expect(c.map((x) => [x.date, x.overhead.name])).toEqual([
      ['2026-10-01', 'Car payment'], ['2026-10-01', 'Housing rent'], ['2026-10-15', 'Office rent'],
    ])
  })
  it('moves day 31 to the last day of shorter months', () => {
    const c = overheadCharges([oh({ dayOfMonth: 31 })], { start: '2026-02-01', end: '2026-04-30' })
    expect(c.map((x) => x.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
  })
  it('respects start and end dates and skips items with no amount or start date', () => {
    const c = overheadCharges(
      [oh({ startDate: '2026-03-10', dayOfMonth: 1 }), oh({ name: 'n', amountCents: null }), oh({ name: 's', startDate: null }), oh({ name: 'e', endDate: '2026-03-31' })],
      { start: '2026-02-01', end: '2026-05-31' },
    )
    expect(c.filter((x) => x.overhead.name === 'x').map((x) => x.date)).toEqual(['2026-04-01', '2026-05-01'])
    expect(c.filter((x) => x.overhead.name === 'e').map((x) => x.date)).toEqual(['2026-02-01', '2026-03-01'])
    expect(c.some((x) => x.overhead.name === 'n' || x.overhead.name === 's')).toBe(false)
  })
  it('keeps currencies apart in totals', () => {
    const c = overheadCharges([office, oh({ name: 'eu', currency: 'EUR', amountCents: 5000 })], { start: '2026-10-01', end: '2026-10-31' })
    expect(sumByCurrency(c)).toEqual({ GBP: 80000, EUR: 5000 })
    expect(monthlyOverheads([office, housing, car], '2026-10-20', 'business')).toEqual({ GBP: 200000, EUR: 0 })
  })
})

describe('net business profit', () => {
  const base = { grossAfterCreditsEurCents: 1_000_000, range: { start: '2026-10-01', end: '2026-10-31' }, today: '2026-10-20', fx }
  it('is not shown until business overheads are entered', () => {
    expect(netBusinessProfit({ ...base, overheads: [] }).status).toBe('not-entered')
    expect(netBusinessProfit({ ...base, overheads: [oh({ amountCents: null })] }).status).toBe('not-entered')
    const partial = netBusinessProfit({ ...base, overheads: [office, oh({ name: 'Housing rent', amountCents: null })] })
    expect(partial.status).toBe('ok')
    if (partial.status === 'ok') expect(partial.warnings.join(' ')).toMatch(/Housing rent not entered/)
  })
  it('subtracts business overheads taken up to today, in both currencies, ignoring personal ones', () => {
    const n = netBusinessProfit({ ...base, overheads: [office, housing, car] })
    if (n.status !== 'ok') throw new Error(n.status)
    expect(n.chargedTo).toBe('2026-10-20')
    expect(n.businessOverheads).toEqual({ GBP: 200000, EUR: 0 }) // office + housing; car is personal
    expect(n.netGbpCents).toBe(800000 - 200000) // €10,000 = £8,000, less £2,000
    expect(n.netEurCents).toBe(1_000_000 - 250000) // £2,000 = €2,500
  })
  it('does not charge rent dated after today', () => {
    const n = netBusinessProfit({ ...base, today: '2026-10-10', overheads: [office, housing] })
    if (n.status !== 'ok') throw new Error(n.status)
    expect(n.businessOverheads.GBP).toBe(120000) // office rent on the 15th not yet taken
  })
  it('refuses to mix currencies without a rate', () => {
    expect(netBusinessProfit({ ...base, fx: null, overheads: [office] }).status).toBe('needs-rate')
  })
})

import { STARTER_OVERHEADS, validateOverheads } from '@/lib/overheads'

describe('overhead input checks', () => {
  it('starts with the three named items and no assumed amounts or dates', () => {
    expect(STARTER_OVERHEADS.map((o) => [o.name, o.dayOfMonth, o.amountCents, o.startDate])).toEqual([
      ['Office rent', 15, null, null], ['Housing rent', 1, null, null], ['Car payment', 7, null, null],
    ])
    expect(STARTER_OVERHEADS.map((o) => o.category)).toEqual(['business', 'personal', 'business'])
    expect(validateOverheads(STARTER_OVERHEADS).ok).toBe(true)
  })
  it('rejects bad rows with a reason', () => {
    const good = STARTER_OVERHEADS[0]
    const cases: [object, RegExp][] = [
      [{ ...good, amountCents: -1 }, /amount/],
      [{ ...good, amountCents: 12.5 }, /amount/],
      [{ ...good, currency: 'USD' }, /currency/],
      [{ ...good, dayOfMonth: 0 }, /day/],
      [{ ...good, category: 'other' }, /business or personal/],
      [{ ...good, startDate: '2026-05-01', endDate: '2026-04-01' }, /before/],
      [{ ...good, name: '  ' }, /name/],
    ]
    for (const [row, msg] of cases) {
      const r = validateOverheads([row])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(msg)
    }
    expect(validateOverheads([good, good]).ok).toBe(false) // duplicate id
    expect(validateOverheads('nope').ok).toBe(false)
  })
})
