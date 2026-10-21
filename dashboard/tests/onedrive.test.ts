import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cronAuthorised } from '@/lib/cron'
import { importExpenses } from '@/lib/importers/expenses'
import { importLedger } from '@/lib/importers/ledger'
import { newestDriveTracker, normalisePath, type DriveItem } from '@/lib/onedrive'

describe('OneDrive paths', () => {
  it('accepts a path pasted from Windows or a OneDrive-relative one', () => {
    expect(normalisePath('C:\\Users\\fonen\\OneDrive\\Desktop\\Ledger\\FoneNova_Order_Ledger.xlsx')).toBe('Desktop/Ledger/FoneNova_Order_Ledger.xlsx')
    expect(normalisePath('"C:\\Users\\fonen\\OneDrive - Personal\\Desktop\\VAT RETURNS"')).toBe('Desktop/VAT RETURNS')
    expect(normalisePath('/Desktop/VAT RETURNS/')).toBe('Desktop/VAT RETURNS')
    expect(normalisePath('  ')).toBeNull()
    expect(normalisePath(undefined)).toBeNull()
  })
})

describe('newest tracker in OneDrive', () => {
  const tree: Record<string, DriveItem[]> = {
    root: [
      { id: 'a', name: 'VAT Return From Sept-Dec, 2026.xlsx', lastModifiedDateTime: '2026-10-19T10:00:00Z', file: {} },
      { id: 'b', name: '~$VAT Return From Sept-Dec, 2026.xlsx', lastModifiedDateTime: '2026-10-19T12:00:00Z', file: {} },
      { id: 'c', name: 'Notes.xlsx', lastModifiedDateTime: '2026-10-19T13:00:00Z', file: {} },
      { id: 'bk', name: '_backups', lastModifiedDateTime: '2026-10-19T14:00:00Z', folder: {} },
      { id: 'q', name: 'Q3', lastModifiedDateTime: '2026-10-01T00:00:00Z', folder: {} },
    ],
    bk: [{ id: 'd', name: 'VAT Return From Sept-Dec, 2026.xlsx', lastModifiedDateTime: '2026-10-19T15:00:00Z', file: {} }],
    q: [{ id: 'e', name: 'VAT Return From June-Aug, 2026.xlsx', lastModifiedDateTime: '2026-09-01T00:00:00Z', file: {} }],
  }
  it('uses the same rules as on the PC: backups and lock files skipped, newest wins', async () => {
    const best = await newestDriveTracker(async (id) => tree[id] ?? [], 'root')
    expect(best?.id).toBe('a')
  })
  it('finds nothing in an empty folder', async () => {
    expect(await newestDriveTracker(async () => [], 'root')).toBeNull()
  })
})

describe('scheduled sync lock', () => {
  const secret = 'a-cron-secret-of-some-length'
  it('lets in only the exact bearer token, and nothing when no secret is set', () => {
    expect(cronAuthorised(`Bearer ${secret}`, secret)).toBe(true)
    expect(cronAuthorised(null, secret)).toBe(false)
    expect(cronAuthorised(`Bearer ${secret}x`, secret)).toBe(false)
    expect(cronAuthorised('Bearer ', '')).toBe(false)
    expect(cronAuthorised('Bearer undefined', undefined)).toBe(false)
    expect(cronAuthorised('Bearer short', 'short')).toBe(false)
  })
})

// The real spreadsheets are git-ignored, so these run only where they exist.
const ledgerFile = path.join(__dirname, '..', 'data', 'FoneNova_Order_Ledger.xlsx')
const trackerFile = path.join(__dirname, '..', 'data', 'expenses.xlsx')
const strip = <T extends { meta: { importedAt: string } }>(x: T) => ({ ...x, meta: { ...x.meta, importedAt: '' } })

describe.skipIf(!fs.existsSync(ledgerFile))('importing a downloaded ledger', () => {
  it('gives exactly the same result as reading it from disk', async () => {
    const fromDisk = await importLedger(ledgerFile)
    const fromBuffer = await importLedger({ name: path.basename(ledgerFile), data: fs.readFileSync(ledgerFile) })
    expect(strip(fromBuffer)).toEqual(strip(fromDisk))
  })
})

describe.skipIf(!fs.existsSync(trackerFile))('importing a downloaded tracker', () => {
  it('gives exactly the same result as reading it from disk', async () => {
    const fromDisk = await importExpenses(trackerFile)
    const fromBuffer = await importExpenses({ name: path.basename(trackerFile), data: fs.readFileSync(trackerFile) })
    expect({ ...fromBuffer, log: strip(fromBuffer.log) }).toEqual({ ...fromDisk, log: strip(fromDisk.log) })
  })
})
