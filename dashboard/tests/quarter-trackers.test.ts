import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyExpense, combineQuarterLogs, mergeExpenseLogs } from '@/lib/expenses'
import { allDriveTrackers, type DriveItem } from '@/lib/onedrive'
import { allTrackers, combinedSource, isTrackerName, type FileSource } from '@/lib/sync-core'
import type { Expense, ExpenseLog } from '@/lib/types'

const ex = (id: string, date: string, payee: string, amount: number, remarks = ''): Expense => ({
  id, date, payee, description: '', amountCents: Math.round(amount * 100), vatCents: 0, reference: '', remarks,
})
const log = (file: string, expenses: Expense[], sheet?: number): ExpenseLog => {
  const amountCents = expenses.reduce((n, e) => n + e.amountCents, 0)
  return {
    meta: { sourceFile: file, importedAt: 't', currency: 'GBP',
      totalCheck: sheet === undefined ? { found: false, sheet: null, imported: { amountCents, vatCents: 0 }, matches: false }
        : { found: true, sheet: { amountCents: sheet, vatCents: 0 }, imported: { amountCents, vatCents: 0 }, matches: sheet === amountCents } },
    expenses, fxConversions: [],
  }
}

describe('one tracker per VAT quarter', () => {
  it('joins every quarter, so a new quarter never hides the previous one', () => {
    const mayOct = log('VAT Return From May-October, 2026.xlsx', [ex('a', '2026-09-01', 'Property People', 10), ex('b', '2026-10-23', 'HMRC', 1395.75)], 140575)
    const novJan = log('VAT Return From Nov 2026-Jan 2027.xlsx', [ex('c', '2026-11-03', 'Lidl', 9.99), ex('d', '2026-10-29', 'Late Ltd', 4)], 1399)
    const all = combineQuarterLogs([novJan, mayOct])!
    expect(all.expenses.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])        // late receipt kept in its quarter
    expect(all.meta.parts?.map((p) => p.sourceFile)).toEqual([mayOct.meta.sourceFile, novJan.meta.sourceFile])
    expect(all.meta.totalCheck).toMatchObject({ found: true, matches: true, sheet: { amountCents: 141974 } })
    // Joined with May to Aug, the archive still stops where the quarters start (1 Sept).
    const archive = log('VATReturn_Automated_v18_delivered_1.xlsx', [ex('z', '2026-08-30', 'Asda', 5), ex('y', '2026-09-01', 'Tesco', 5.5)])
    expect(mergeExpenseLogs(all, archive)!.expenses.map((e) => e.id)).toEqual(['z', 'a', 'b', 'c', 'd'])
  })

  it('finds every quarter tracker on this PC, skipping backups, lock files and failed copies', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fn-q-'))
    const put = async (rel: string) => {
      await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true })
      await fs.writeFile(path.join(dir, rel), 'x')
    }
    await put('VAT Return-May-October 2026/VAT Return From May-October, 2026.xlsx')
    await put('VAT Return-Nov 2026-Jan 2027/VAT Return From Nov 2026-Jan 2027.xlsx')
    await put('VAT Return-Nov 2026-Jan 2027/VAT Return From Nov 2026-Jan 2027 (FAILED, ignore).xlsx')
    await put('VAT Return-Nov 2026-Jan 2027/~$VAT Return From Nov 2026-Jan 2027.xlsx')
    await put('_backups/2026-10-26_add/VAT Return From May-October, 2026.xlsx')
    const found = (await allTrackers(dir)).map((t) => path.basename(t.file))
    expect(found).toEqual(['VAT Return From May-October, 2026.xlsx', 'VAT Return From Nov 2026-Jan 2027.xlsx'])
    expect(isTrackerName('VAT Return From X (FAILED, ignore).xlsx')).toBe(false)
  })

  it('finds every quarter tracker in OneDrive', async () => {
    const f = (id: string, name: string, when = '2026-11-01T10:00:00Z'): DriveItem => ({ id, name, lastModifiedDateTime: when, file: {} } as DriveItem)
    const d = (id: string, name: string): DriveItem => ({ id, name, lastModifiedDateTime: '2026-11-01T10:00:00Z', folder: {} } as DriveItem)
    const tree: Record<string, DriveItem[]> = {
      root: [d('q1', 'VAT Return-May-October 2026'), d('q2', 'VAT Return-Nov 2026-Jan 2027'), d('bk', '_backups')],
      q1: [f('t1', 'VAT Return From May-October, 2026.xlsx')],
      q2: [f('t2', 'VAT Return From Nov 2026-Jan 2027.xlsx')],
      bk: [f('t3', 'VAT Return From May-October, 2026.xlsx', '2026-12-01T00:00:00Z')],
    }
    const found = await allDriveTrackers(async (id) => tree[id] ?? [], 'root')
    expect(found.map((i) => i.id)).toEqual(['t1', 't2'])
  })

  it('re-imports when any quarter file is saved', async () => {
    const part = (name: string, t: number | null): FileSource => ({ fileName: name, savedAt: async () => t, read: async () => Buffer.alloc(0) })
    expect(await combinedSource([part('a', 100), part('b', 300)]).savedAt()).toBe(300)
    expect(await combinedSource([part('a', 100), part('b', null)]).savedAt()).toBeNull()
  })
})

describe('tags from the expense system', () => {
  const c = (remarks: string, payee = 'Someone', description = 'Transfer (from bank statement)') => classifyExpense({ payee, description, remarks })
  it('treats wages and PAYE as costs', () => {
    expect(c('[OUTSIDE VAT SCOPE: PAYE/NIC] Revolut transfer confirmation', 'HMRC')).toMatchObject({ cls: 'business', category: 'PAYE / NIC' })
    expect(c('[OUTSIDE VAT SCOPE: wages] ...')).toMatchObject({ cls: 'business', category: 'Wages' })
  })
  it('asks about money that moves but is not a cost', () => {
    expect(c('[OUTSIDE VAT SCOPE: HMRC] VAT payment', 'HMRC')).toMatchObject({ cls: 'review', category: 'HMRC payment' })
    expect(c('[NOT A PURCHASE: payment to director] ...', 'Wahidullah Ismati')).toMatchObject({ cls: 'review', category: 'Director payment' })
    expect(c('[NOT A PURCHASE: loan repayment] ...')).toMatchObject({ cls: 'review', category: 'Loan repayment' })
  })
  it('leaves untagged rows to the normal rules', () => {
    expect(c('Matched to Tesco.pdf', 'Tesco Express', 'Groceries').category).toBe('Food, groceries, household')
  })
})
