/**
 * The decisions behind automatic sync, kept free of Next.js so they are unit-tested:
 * which tracker file to read, whether a source changed, and how to re-import without ever
 * replacing good data with a failed or half-written import. The same rules apply whether
 * the file is on this PC or in OneDrive.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { getJson, type Store, type StoreKey } from './store'

export interface SourceStatus {
  source: 'ledger' | 'expenses' | 'expenses-archive' | 'xero'
  label: string
  /** The setting is filled in, so this source can sync at all. */
  configured: boolean
  /** File name only (never the full path, which stays on the server). */
  fileName: string | null
  fileSavedAt: string | null
  /** When the data now in use was imported. */
  importedAt: string | null
  /** When this source was last checked for changes. */
  checkedAt: string
  /** True when this sync run re-imported. */
  changed: boolean
  ok: boolean
  message: string
}

const TRACKER = /^vat return from.*\.xlsx$/i
/** The May to Aug 2026 tracker, kept read-only: "VATReturn_Automated_v18_delivered_1.xlsx". */
const ARCHIVE = /^vatreturn_automated.*\.xlsx$/i

/** The VAT return tracker's file name, excluding Excel's own `~$` lock files. */
export function isTrackerName(name: string): boolean {
  return TRACKER.test(name) && !name.startsWith('~$')
}

/** The earlier (May to Aug) tracker's file name. The newest saved copy wins. */
export function isArchiveName(name: string): boolean {
  return ARCHIVE.test(name) && !name.startsWith('~$')
}

/** Folders never searched for the tracker: copies in `_backups` would look newer than the real one. */
export function skipFolder(name: string): boolean {
  return /backup/i.test(name)
}

/**
 * Newest VAT return tracker under `dir`, by last-saved time. Skips any `_backups` folder,
 * Excel's own `~$` lock files and anything not named like the tracker. Looks 3 folders deep.
 */
export async function newestTracker(dir: string, depth = 3, matches: (name: string) => boolean = isTrackerName): Promise<{ file: string; mtimeMs: number } | null> {
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
        if (skipFolder(e.name) || level >= depth) continue
        await walk(full, level + 1)
      } else if (matches(e.name)) {
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

/** A spreadsheet to sync from: a file on this PC, or one in OneDrive. */
export interface FileSource {
  /** File name only (never the full path, which stays on the server). */
  fileName: string
  /** Last-saved time in ms, or null when the file is not there. */
  savedAt(): Promise<number | null>
  read(): Promise<Buffer>
}

export function localFile(file: string): FileSource {
  return {
    fileName: path.basename(file),
    savedAt: async () => (await fs.stat(file).catch(() => null))?.mtimeMs ?? null,
    read: () => fs.readFile(file),
  }
}

/**
 * Sync one file-based source. On any failure the data in the store is left exactly as it
 * was, so the dashboard keeps showing the last good import and says what went wrong.
 */
export async function syncFile<T extends { meta: { sourceModifiedAt?: string; importedAt: string } }>(opts: {
  source: SourceStatus['source']
  label: string
  file: FileSource | null
  store: Store
  key: StoreKey
  notConfigured: string
  run: (input: { name: string; data: Buffer }) => Promise<T>
  /** Plain-words result for a successful import, e.g. "reconciled 25/25". */
  describe: (data: T) => { ok: boolean; message: string }
}): Promise<SourceStatus> {
  const prev = (await getJson<{ meta?: { sourceModifiedAt?: string; importedAt?: string } }>(opts.store, opts.key))?.meta ?? null
  const base = { source: opts.source, label: opts.label, importedAt: prev?.importedAt ?? null, checkedAt: new Date().toISOString() }
  if (!opts.file) return { ...base, configured: false, fileName: null, fileSavedAt: null, changed: false, ok: !!prev, message: opts.notConfigured }

  const { fileName } = opts.file
  const fail = (raw: string, fileSavedAt: string | null): SourceStatus => {
    const why = /central directory|zip|EBUSY|EPERM|locked/i.test(raw) ? 'the file is not a readable .xlsx yet; it may still be saving or syncing' : raw
    return { ...base, configured: true, fileName, fileSavedAt, changed: false, ok: false, message: `Could not read the latest save (${why.slice(0, 160)}). ${prev ? 'Showing the last good import.' : 'Nothing imported yet.'}` }
  }

  let mtime: number | null
  try {
    mtime = await opts.file.savedAt()
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), null)
  }
  if (mtime === null) {
    return { ...base, configured: true, fileName, fileSavedAt: null, changed: false, ok: false, message: `File not found. ${prev ? 'Showing the last import.' : 'Nothing imported yet.'}` }
  }
  const fileSavedAt = new Date(Math.floor(mtime)).toISOString()
  if (!needsImport(mtime, prev)) {
    return { ...base, configured: true, fileName, fileSavedAt, changed: false, ok: true, message: 'Up to date' }
  }

  let data: T
  try {
    data = await opts.run({ name: fileName, data: await opts.file.read() })
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), fileSavedAt)
  }
  data.meta.sourceModifiedAt = fileSavedAt
  await opts.store.set(opts.key, data)
  return { ...base, importedAt: data.meta.importedAt, configured: true, fileName, fileSavedAt, changed: true, ...opts.describe(data) }
}
