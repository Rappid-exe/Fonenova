import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { classifyExpense, mergeExpenseLogs } from '@/lib/expenses'
import { importExpenses, parseDate } from '@/lib/importers/expenses'
import { expenseSummary } from '@/lib/metrics'
import { isArchiveName, isTrackerName } from '@/lib/sync-core'
import type { Expense, ExpenseLog, Overhead } from '@/lib/types'

/** A Sheet2 laid out like the May to Aug tracker: header in row 4, dates as text, a TOTAL row. */
async function trackerFile(rows: (string | number | null)[][], total: number | null): Promise<string> {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('Sheet1')
  const ws = wb.addWorksheet('Sheet2')
  const header = ['Dated:', 'Currency%', '', 'Dated:', 'Beneficiary:', '', 'Description:', '', 'Amount:', '', 'Ref No:', '', '', 'Receipt No:', '', 'VAT No:', 'VAT Rate:', 'Remarks:']
  ws.getRow(4).values = header
  rows.forEach(([date, payee, desc, amount, flag, vat], i) => {
    const r = ws.getRow(5 + i)
    r.getCell(4).value = date; r.getCell(5).value = payee; r.getCell(7).value = desc; r.getCell(9).value = amount
    r.getCell(11).value = 'ref'; r.getCell(16).value = flag; r.getCell(17).value = vat
  })
  const t = ws.getRow(5 + rows.length)
  t.getCell(4).value = 'Total :'
  t.getCell(9).value = total === null ? { formula: 'SUM(I5:I9)' } as ExcelJS.CellFormulaValue : { formula: 'SUM(I5:I9)', result: total } as ExcelJS.CellFormulaValue
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fn-v18-'))
  const file = path.join(dir, 'VATReturn_Automated_v18_delivered_1.xlsx')
  await wb.xlsx.writeFile(file)
  return file
}

describe('the May to Aug tracker', () => {
  it('reads its dates, including the older "16.5.26" style', () => {
    expect(parseDate('16.5.26')).toBe('2026-05-16')
    expect(parseDate('01.05.26')).toBe('2026-05-01')
    expect(parseDate('32.5.26')).toBeNull()
    expect(parseDate('5/1/2026')).toBeNull()
  })
  it('is recognised by name, separately from the current tracker', () => {
    expect(isArchiveName('VATReturn_Automated_v18_delivered_1.xlsx')).toBe(true)
    expect(isArchiveName('~$VATReturn_Automated_v18_delivered_1.xlsx')).toBe(false)
    expect(isTrackerName('VATReturn_Automated_v18_delivered_1.xlsx')).toBe(false)
  })
  it('imports every row and checks itself against the TOTAL row', async () => {
    const rows = [['01.05.26', 'Simply Business', 'B.Insurance', 48.63, 'VAT-No', null], ['16.5.26', 'PC-Currys ', 'Printer', 114.99, 'VAT-Yes', 19.16], ['19.05.26', 'Refund from Currys Leyton', 'Refund', -5, 'VAT-No', null], ['07.08.26', 'club24', null, null, null, null]]
    const ok = await importExpenses(await trackerFile(rows, 158.62))
    expect(ok.log.expenses.map((e) => e.date)).toEqual(['2026-05-01', '2026-05-16', '2026-05-19'])
    expect(ok.log.expenses[1].vatCents).toBe(1916)
    expect(ok.check).toMatchObject({ found: true, matches: true, imported: { amountCents: 15862 } })
    expect(ok.skipped).toHaveLength(1) // the blank club24 row, reported rather than guessed

    const off = await importExpenses(await trackerFile(rows, 200))
    expect(off.check).toMatchObject({ found: true, matches: false, sheet: { amountCents: 20000 } })
    const noResult = await importExpenses(await trackerFile(rows, null))
    expect(noResult.check.found).toBe(false)
  })
})

let n = 0
const ex = (date: string, payee: string, amount: number, id = `x${++n}`): Expense => ({ id, date, payee, description: '', amountCents: Math.round(amount * 100), vatCents: 0, reference: '', remarks: '' })
const log = (file: string, expenses: Expense[], fx: ExpenseLog['fxConversions'] = []): ExpenseLog => ({ meta: { sourceFile: file, importedAt: 't', currency: 'GBP' }, expenses, fxConversions: fx })

describe('joining the two trackers', () => {
  const archive = log('v18.xlsx', [ex('2026-05-30', 'HQ - IWG Service', 2160), ex('2026-08-31', 'Tesco', 26.9), ex('2026-09-01', 'Tesco Express', 5.5, 'dup')], [{ date: '2026-08-31', eurCents: 750000, gbpCents: 638827, feeCents: 3856 }])
  const current = log('Sept-Dec.xlsx', [ex('2026-09-01', 'Tesco Express', 5.5, 'dup'), ex('2026-09-02', 'DHL', 100)], [{ date: '2026-08-31', eurCents: 750000, gbpCents: 638827, feeCents: 3856 }, { date: '2026-09-19', eurCents: 467000, gbpCents: 394446, feeCents: 5804 }])

  it('lets the current tracker win from its first date, so the 1 Sept row counts once', () => {
    const m = mergeExpenseLogs(current, archive)!
    expect(m.expenses.map((e) => e.date)).toEqual(['2026-05-30', '2026-08-31', '2026-09-01', '2026-09-02'])
    expect(m.meta.overlapDropped).toBe(1)
    expect(m.meta.parts).toEqual([
      { sourceFile: 'v18.xlsx', rows: 3, from: '2026-05-30', to: '2026-09-01' },
      { sourceFile: 'Sept-Dec.xlsx', rows: 2, from: '2026-09-01', to: '2026-09-02' },
    ])
    expect(m.fxConversions).toHaveLength(2) // the 31 Aug conversion is in both files
  })
  it('works with either file missing', () => {
    expect(mergeExpenseLogs(current, null)).toBe(current)
    expect(mergeExpenseLogs(null, archive)).toBe(archive)
    expect(mergeExpenseLogs(null, null)).toBeNull()
  })
  it('still counts office rent paid before the office-rent overhead starts', () => {
    const office: Overhead = { id: 'office-rent', name: 'Office rent', amountCents: 216000, currency: 'GBP', dayOfMonth: 15, category: 'business', startDate: '2026-09-15', endDate: null }
    const both = log('m', [ex('2026-05-30', 'HQ - IWG Service Office Rent', 2160), ex('2026-09-15', 'HQ - IWG Service Office Rent', 2160)])
    const s = expenseSummary(both, {}, [office], null)
    expect(s.businessCents).toBe(216000) // May: real cost, the overhead did not exist yet
    expect(s.coveredByOverheadCents).toBe(216000) // Sept: charged by the overhead instead
  })
})

describe('rules for the May to Aug payees', () => {
  const cases: [string, string, string, string][] = [
    ['Toyota Finance S', 'Car Finance', 'review', 'Car finance'],
    ['Abn Invest Ltd', 'Accountant F', 'business', 'Accountancy'],
    ['Simply Business', 'B.Insurance', 'business', 'Insurance'],
    ['Revolut B Fee', 'Fee', 'business', 'Bank and FX fees'],
    ['Bank Transfer', 'Loan Paid Back', 'review', 'Loan repayment'],
    ['Bank Transfer', 'Exp-Repaymnt', 'review', 'Expense repayment'],
    ['Mobile One Trade', 'Refund', 'review', 'Stock supplier'],
    ['WAGES-PAID', 'Wahidullah Ismati', 'business', 'Wages'],
    ['WAGES-PAID', 'Hamza Ismati', 'review', 'Wages'],
    ['B&M-Shopping', 'Essentials', 'review', 'Supplies'],
    ['Istanbul Market', 'Shopping', 'personal', 'Food, groceries, household'],
    ['Hopp-Bike', 'Transport', 'review', 'Travel and parking'],
    ['Asda Shopping', 'Stationeries', 'business', 'Office equipment'],
    ['Rent 4 Room', 'Room-Rent', 'review', 'Accommodation'],
  ]
  it.each(cases)('%s / %s', (payee, description, cls, category) => {
    expect(classifyExpense({ payee, description })).toMatchObject({ cls, category })
  })
  it('links Toyota car finance to the car payment overhead', () => {
    expect(classifyExpense({ payee: 'Toyota Finance S', description: 'Car Finance' }).overheadId).toBe('car-payment')
  })
})
