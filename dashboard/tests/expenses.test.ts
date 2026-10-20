import { describe, expect, it } from 'vitest'
import { classifyExpense } from '@/lib/expenses'
import { expenseSummary, fxSummary, netBusinessProfit } from '@/lib/metrics'
import type { Expense, ExpenseLog, FxRate, Overhead } from '@/lib/types'

const fx: FxRate = { base: 'EUR', quote: 'GBP', rate: 0.8, rateDate: '2026-10-20', source: 't', fetchedAt: 't' }
let n = 0
const ex = (payee: string, description: string, amount: number, vat = 0, date = '2026-09-15'): Expense => ({
  id: `e${++n}`, date, payee, description, amountCents: Math.round(amount * 100), vatCents: Math.round(vat * 100), reference: '', remarks: '',
})
const office: Overhead = { id: 'office-rent', name: 'Office rent', amountCents: 216000, currency: 'GBP', dayOfMonth: 15, category: 'business', startDate: '2026-01-15', endDate: null }

describe('expense rules (rows as they appear in the tracker)', () => {
  const cases: [string, string, string, string | null][] = [
    ['HQ - IWG Service', 'Office Rent', 'business', 'office-rent'],
    ['DHL Express', 'International Shipping (Economy Select EU/doc)', 'business', null],
    ['Revolut', 'FX Conversion Fee (EUR to GBP)', 'business', null],
    ['Anthropic-Claude', 'Claude Subscription (Sep14-Oct14)', 'business', null],
    ['Wahidullah Ismati', 'Wage Payment (Xero Payroll Run)', 'business', null],
    ['WAGES-PAID', 'Hamza Ismati', 'review', null],
    ['Toyota Financial Services', 'Vehicle Finance - Direct Debit', 'review', 'car-payment'],
    ['Tesla Motors Limited', 'EV Charging - Supercharger', 'review', null],
    ['Ryanair', 'Flight ticket', 'review', null],
    ['fonaCAB', 'Taxi fare, Exchange St to Cliftonpark Ave, Belfast', 'review', null],
    ['Property People Belfast Ltd', 'Rent - 148 Cliftonpark Ave (Oct)', 'personal', 'housing-rent'],
    ['Chingford Mount Dental', 'Dental Treatment', 'personal', null],
    ['Tesco Express', 'Groceries', 'personal', null],
    ['Asda', 'Dehumidifier', 'personal', null],
    ['Club24fitness Ltd', 'Card payment (drink per Hamza note)', 'personal', null],
    ['Something New Ltd', 'Unknown', 'review', null],
  ]
  for (const [payee, desc, cls, overhead] of cases) {
    it(`${payee}: ${cls}`, () => {
      const c = classifyExpense({ payee, description: desc })
      expect(c.cls).toBe(cls)
      expect(c.overheadId).toBe(overhead)
    })
  }
})

describe('expense totals', () => {
  const log: ExpenseLog = {
    meta: { sourceFile: 't', importedAt: 't', currency: 'GBP' },
    expenses: [
      ex('HQ - IWG Service', 'Office Rent', 2160, 360),
      ex('DHL Express', 'Shipping', 100),
      ex('Tesla Motors Limited', 'EV Charging', 30, 5),
      ex('Tesco Express', 'Groceries', 20, 1),
    ],
    fxConversions: [{ date: '2026-09-19', eurCents: 467000, gbpCents: 394446, feeCents: 5804 }],
  }
  it('counts business only, skips rows the overhead schedule already charges, and totals VAT at risk', () => {
    const s = expenseSummary(log, {}, [office], null)
    expect(s.businessCents).toBe(10000) // DHL; office rent is covered by the overhead
    expect(s.coveredByOverheadCents).toBe(216000)
    expect(s.reviewCents).toBe(3000)
    expect(s.personalCents).toBe(2000)
    expect(s.vatAtRiskCents).toBe(600) // Tesla £5 + Tesco £1
  })
  it('counts the logged payment when that overhead is not entered, so nothing is lost', () => {
    expect(expenseSummary(log, {}, [{ ...office, amountCents: null }], null).businessCents).toBe(226000)
  })
  it('lets the owner override a row', () => {
    const tesla = log.expenses[2].id
    const s = expenseSummary(log, { [tesla]: 'business' }, [office], null)
    expect(s.businessCents).toBe(13000)
    expect(s.vatAtRiskCents).toBe(100)
    expect(s.rows.find((r) => r.expense.id === tesla)!.overridden).toBe(true)
  })
  it('takes business expenses off net profit without double counting office rent', () => {
    const net = netBusinessProfit({ grossAfterCreditsEurCents: 1_000_000, overheads: [office], range: { start: '2026-09-01', end: '2026-09-30' }, today: '2026-10-20', fx, expenses: log })
    if (net.status !== 'ok') throw new Error(net.status)
    expect(net.businessOverheads.GBP).toBe(216000)
    expect(net.businessExpensesCents).toBe(10000)
    expect(net.netGbpCents).toBe(800000 - 216000 - 10000)
  })
  it('warns when the log starts after the period does', () => {
    const net = netBusinessProfit({ grossAfterCreditsEurCents: 1_000_000, overheads: [office], range: { start: '2026-02-01', end: '2026-09-30' }, today: '2026-10-20', fx, expenses: log })
    if (net.status !== 'ok') throw new Error(net.status)
    expect(net.warnings.join(' ')).toMatch(/expense log starts 15 Sep 2026/)
  })
  it('summarises actual EUR to GBP conversions', () => {
    const f = fxSummary(log.fxConversions, null)
    expect(f.effectiveRate).toBeCloseTo(3944.46 / 4670, 6)
    expect(f.feeCents).toBe(5804)
  })
})
