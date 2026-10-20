/**
 * The decisions behind automatic sync, kept free of Next.js so they are unit-tested:
 * which tracker file to read, whether a source changed, and how to re-import without ever
 * replacing good data with a failed or half-written import.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

export interface SourceStatus {
  source: 'ledger' | 'expenses' | 'xero'
  label: string
  /** The setting is filled in, so this source can sync at all. */
  configured: boolean
  /** File name only (never the full path, which stays on the server). */
  fileName: string | null
  fileSavedAt: string | null
  /** When the data now in use was imported. */
  importedAt: string | null
  /** True when this sync run re-imported. */
  changed: boolean
  ok: boolean
  message: string
}

const TRACKER = /^vat return from.*\.xlsx$/i

/**
 * Newest VAT return tracker under `dir`, by last-saved time. Skips any `_backups` folder,
 * Excel's own `~$` lock files and anything not named like the tracker. Looks 3 folders deep.
 */
export async function newestTracker(dir: string, depth = 3): Promise<{ file: string; mtimeMs: number } | null> {
  let best: { file: string; mtimeMs: number } | null = null
  async function walk(d: string, level: number) {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) {
        if (/backup/i.test(e.name) || level >= depth) continue
        await walk(full, level + 1)
      } else if (TRACKER.test(e.name) && !e.name.startsWith('~$')) {
        const st = await fs.stat(full).catch(() => null)
        if (st && (!best || st.mtimeMs > best.mtimeMs)) best = { file: full, mtimeMs: st.mtimeMs }
      }
    }
  }
  await walk(dir, 0)
  return best
}

/** Re-import only when the source was saved after the copy in use, or there is no copy yet. */
export function needsImport(sourceMtimeMs: number, imported: { sourceModifiedAt?: string } | null): boolean {
  if (!imported?.sourceModifiedAt) return true
  // File times can carry fractions of a millisecond; the stored date cannot, so compare whole ms.
  return Math.floor(sourceMtimeMs) > Date.parse(imported.sourceModifiedAt)
}

async function readMeta(outFile: string): Promise<{ sourceModifiedAt?: string; importedAt?: string } | null> {
  try {
    return (JSON.parse(await fs.readFile(outFile, 'utf8')) as { meta?: { sourceModifiedAt?: string; importedAt?: string } }).meta ?? null
  } catch {
    return null
  }
}

/**
 * Sync one file-based source. On any failure the existing output file is left exactly as it
 * was, so the dashboard keeps showing the last good import and says what went wrong.
 */
export async function syncFile<T extends { meta: { sourceModifiedAt?: string; importedAt: string } }>(opts: {
  source: 'ledger' | 'expenses'
  label: string
  file: string | null
  outFile: string
  notConfigured: string
  run: (file: string) => Promise<T>
  /** Plain-words result for a successful import, e.g. "reconciled 25/25". */
  describe: (data: T) => { ok: boolean; message: string }
  /** Plain-words summary of the data already in use, when nothing changed. */
  describeExisting?: () => Promise<string>
}): Promise<SourceStatus> {
  const prev = await readMeta(opts.outFile)
  const base = { source: opts.source, label: opts.label, importedAt: prev?.importedAt ?? null }
  if (!opts.file) return { ...base, configured: false, fileName: null, fileSavedAt: null, changed: false, ok: !!prev, message: opts.notConfigured }

  const fileName = path.basename(opts.file)
  const st = await fs.stat(opts.file).catch(() => null)
  if (!st) {
    return { ...base, configured: true, fileName, fileSavedAt: null, changed: false, ok: false, message: `File not found. ${prev ? 'Showing the last import.' : 'Nothing imported yet.'}` }
  }
  const fileSavedAt = new Date(st.mtimeMs).toISOString()
  if (!needsImport(st.mtimeMs, prev)) {
    return { ...base, configured: true, fileName, fileSavedAt, changed: false, ok: true, message: opts.describeExisting ? await opts.describeExisting() : 'Up to date' }
  }

  let data: T
  try {
    data = await opts.run(opts.file)
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    const why = /central directory|zip|EBUSY|EPERM/i.test(raw) ? 'the file is not a readable .xlsx yet; it may still be saving or syncing' : raw
    return { ...base, configured: true, fileName, fileSavedAt, changed: false, ok: false, message: `Could not read the latest save (${why.slice(0, 160)}). ${prev ? 'Showing the last good import.' : 'Nothing imported yet.'}` }
  }
  data.meta.sourceModifiedAt = fileSavedAt
  await fs.mkdir(path.dirname(opts.outFile), { recursive: true })
  const tmp = `${opts.outFile}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n')
  await fs.rename(tmp, opts.outFile) // atomic: readers see the old file or the new one, never half of it
  const d = opts.describe(data)
  return { ...base, importedAt: data.meta.importedAt, configured: true, fileName, fileSavedAt, changed: true, ...d }
}
