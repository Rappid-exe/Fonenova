import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { needsImport, newestTracker, syncFile } from '@/lib/sync-core'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fn-sync-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })

async function touch(rel: string, when: string) {
  const f = path.join(dir, rel)
  await fs.mkdir(path.dirname(f), { recursive: true })
  await fs.writeFile(f, 'x')
  const t = new Date(when)
  await fs.utimes(f, t, t)
  return f
}

describe('picking the VAT tracker', () => {
  it('takes the newest tracker, skipping backups, Excel lock files and other names', async () => {
    await touch('VAT Return From Sept-Dec, 2026.xlsx', '2026-10-19T10:00:00Z')
    await touch('_backups/2026-10-19_104305_add/VAT Return From Sept-Dec, 2026.xlsx', '2026-10-19T11:43:00Z')
    await touch('~$VAT Return From Sept-Dec, 2026.xlsx', '2026-10-19T12:00:00Z')
    await touch('Other notes.xlsx', '2026-10-19T13:00:00Z')
    const best = await newestTracker(dir)
    expect(best?.file).toBe(path.join(dir, 'VAT Return From Sept-Dec, 2026.xlsx'))
  })
  it('returns null for a missing folder', async () => {
    expect(await newestTracker(path.join(dir, 'nope'))).toBeNull()
  })
})

describe('when to re-import', () => {
  it('imports when there is no copy, or the file was saved after it', () => {
    expect(needsImport(1000, null)).toBe(true)
    expect(needsImport(Date.parse('2026-10-19T12:00:00Z'), { sourceModifiedAt: '2026-10-19T11:00:00.000Z' })).toBe(true)
    expect(needsImport(Date.parse('2026-10-19T11:00:00Z'), { sourceModifiedAt: '2026-10-19T11:00:00.000Z' })).toBe(false)
    // file systems report fractions of a millisecond: an unchanged file must not look newer
    expect(needsImport(Date.parse('2026-10-19T11:00:00.123Z') + 0.456, { sourceModifiedAt: '2026-10-19T11:00:00.123Z' })).toBe(false)
  })
})

describe('syncing a file', () => {
  type D = { meta: { sourceModifiedAt?: string; importedAt: string }; n: number }
  const opts = (file: string | null, run: (f: string) => Promise<D>) => ({
    source: 'ledger' as const, label: 'Ledger', file, outFile: path.join(dir, 'out', 'data.json'), notConfigured: 'off',
    run, describe: (d: D) => ({ ok: true, message: `n=${d.n}` }),
  })
  const read = async () => JSON.parse(await fs.readFile(path.join(dir, 'out', 'data.json'), 'utf8')) as D

  it('imports a changed file, records when it was saved, then skips it until it changes again', async () => {
    const src = await touch('ledger.xlsx', '2026-10-19T10:00:00Z')
    let calls = 0
    const run = async () => ({ meta: { importedAt: 'now' }, n: ++calls })
    const first = await syncFile(opts(src, run))
    expect(first).toMatchObject({ changed: true, ok: true, message: 'n=1', fileName: 'ledger.xlsx' })
    expect((await read()).meta.sourceModifiedAt).toBe('2026-10-19T10:00:00.000Z')
    expect((await syncFile(opts(src, run))).changed).toBe(false)
    await touch('ledger.xlsx', '2026-10-19T11:00:00Z')
    expect(await syncFile(opts(src, run))).toMatchObject({ changed: true, message: 'n=2' })
  })
  it('keeps the last good data when the new save cannot be read', async () => {
    const src = await touch('ledger.xlsx', '2026-10-19T10:00:00Z')
    await syncFile(opts(src, async () => ({ meta: { importedAt: 'good' }, n: 7 })))
    await touch('ledger.xlsx', '2026-10-19T11:00:00Z')
    const bad = await syncFile(opts(src, async () => { throw new Error('file is locked') }))
    expect(bad).toMatchObject({ ok: false, changed: false })
    expect(bad.message).toMatch(/file is locked.*last good import/)
    expect((await read()).n).toBe(7)
  })
  it('reports a missing file or a missing setting without touching existing data', async () => {
    expect(await syncFile(opts(path.join(dir, 'gone.xlsx'), async () => ({ meta: { importedAt: 'x' }, n: 1 })))).toMatchObject({ ok: false, message: expect.stringMatching(/not found/) })
    expect(await syncFile(opts(null, async () => ({ meta: { importedAt: 'x' }, n: 1 })))).toMatchObject({ configured: false, message: 'off' })
  })
})
