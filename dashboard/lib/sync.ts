/**
 * Automatic sync: re-import the ledger and the VAT tracker when they are saved, and refresh
 * Xero when its snapshot is old. Runs on page load (at most every 30s) and from the hourly
 * scheduled job.
 *
 * Files come from this PC when FN_LEDGER_PATH / FN_EXPENSES_DIR are set, otherwise from
 * OneDrive once it is connected (the hosted version). Results go into the store.
 */
import 'server-only'
import { importExpenses } from './importers/expenses'
import { importLedger } from './importers/ledger'
import { reconcileLedger } from './metrics'
import { oneDriveConfig, oneDriveConnected, oneDriveSources } from './onedrive'
import { getStore, type Store } from './store'
import { localFile, newestTracker, syncFile, type FileSource, type SourceStatus } from './sync-core'
import { loadSnapshot, refreshSnapshot, xeroAvailable, xeroConfig, xeroConnected } from './xero/client'
import type { ExpenseLog, Ledger } from './types'

export type { SourceStatus }

const THROTTLE_MS = 30_000
const XERO_MAX_AGE_MS = 30 * 60_000

let last: { at: number; result: SourceStatus[] } | null = null
let running: Promise<SourceStatus[]> | null = null

/**
 * Sync everything that is set up. `force` skips the 30s throttle (the scheduled job uses it).
 * Never throws: every problem comes back as a red line in the status bar.
 */
export async function syncSources(opts: { force?: boolean } = {}): Promise<SourceStatus[]> {
  if (process.env.FN_LEDGER_BR) return []
  if (!opts.force && last && Date.now() - last.at < THROTTLE_MS) return last.result
  running ??= run().finally(() => { running = null })
  const result = await running
  last = { at: Date.now(), result }
  return result
}

async function run(): Promise<SourceStatus[]> {
  let store: Store
  try {
    store = getStore()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const now = new Date().toISOString()
    return [{ source: 'ledger', label: 'Sync', configured: true, fileName: null, fileSavedAt: null, importedAt: null, checkedAt: now, changed: false, ok: false, message }]
  }
  const files = await fileSources(store)
  const ledger = await syncFile<Ledger>({
    source: 'ledger',
    label: 'Order ledger',
    file: files.ledger,
    store,
    key: 'ledger',
    notConfigured: files.ledgerNote,
    run: importLedger,
    describe: (l) => {
      const failed = reconcileLedger(l).filter((c) => !c.ok).length
      return failed ? { ok: false, message: `Imported, but ${failed} reconciliation check(s) fail` } : { ok: true, message: `Imported, reconciled ${l.orders.length} orders` }
    },
  })
  const expenses = await syncFile<ExpenseLog>({
    source: 'expenses',
    label: 'VAT tracker',
    file: files.expenses,
    store,
    key: 'expenses',
    notConfigured: files.expensesNote,
    run: async (f) => (await importExpenses(f)).log,
    describe: (l) => ({ ok: true, message: `Imported ${l.expenses.length} rows` }),
  })
  return [ledger, expenses, await syncXero()]
}

/** Pick where the two spreadsheets come from: this PC's OneDrive folder first, then OneDrive online. */
async function fileSources(store: Store): Promise<{ ledger: FileSource | null; expenses: FileSource | null; ledgerNote: string; expensesNote: string }> {
  const ledgerPath = process.env.FN_LEDGER_PATH
  const trackerDir = process.env.FN_EXPENSES_DIR
  const trackerPath = process.env.FN_EXPENSES_PATH
  if (!process.env.VERCEL && (ledgerPath || trackerDir || trackerPath)) {
    const tracker = trackerPath ?? (trackerDir ? (await newestTracker(trackerDir))?.file ?? null : null)
    return {
      ledger: ledgerPath ? localFile(ledgerPath) : null,
      expenses: tracker ? localFile(tracker) : null,
      ledgerNote: 'Automatic sync is off: set FN_LEDGER_PATH in .env.local. Showing the last manual import.',
      expensesNote: trackerDir
        ? 'No "VAT Return From…xlsx" found in that folder (backups are skipped).'
        : 'Automatic sync is off: set FN_EXPENSES_DIR in .env.local. Showing the last manual import.',
    }
  }

  const c = oneDriveConfig()
  if (!c) {
    const note = process.env.VERCEL
      ? 'OneDrive is not set up: add MS_CLIENT_ID. Showing the last import.'
      : 'Automatic sync is off: set FN_LEDGER_PATH in .env.local. Showing the last manual import.'
    return { ledger: null, expenses: null, ledgerNote: note, expensesNote: note.replace('FN_LEDGER_PATH', 'FN_EXPENSES_DIR') }
  }
  if (!(await oneDriveConnected(store)).connected) {
    const note = 'OneDrive is not connected yet. Showing the last import.'
    return { ledger: null, expenses: null, ledgerNote: note, expensesNote: note }
  }
  try {
    const s = await oneDriveSources(c, store)
    return {
      ledger: s.ledger,
      expenses: s.expenses,
      ledgerNote: 'Set FN_ONEDRIVE_LEDGER to the ledger\'s place in OneDrive. Showing the last import.',
      expensesNote: s.expensesNote ?? 'Set FN_ONEDRIVE_EXPENSES_DIR to the VAT returns folder in OneDrive. Showing the last import.',
    }
  } catch (e) {
    const note = `OneDrive could not be read (${e instanceof Error ? e.message.slice(0, 140) : 'unknown'}). Showing the last import.`
    return { ledger: null, expenses: null, ledgerNote: note, expensesNote: note }
  }
}

async function syncXero(): Promise<SourceStatus> {
  const base = { source: 'xero' as const, label: 'Xero', fileName: null, fileSavedAt: null, checkedAt: new Date().toISOString() }
  const c = xeroConfig()
  if (!c || !xeroAvailable()) return { ...base, configured: false, importedAt: null, changed: false, ok: false, message: 'Not set up' }
  try {
    if (!(await xeroConnected()).connected) return { ...base, configured: true, importedAt: null, changed: false, ok: false, message: 'Not connected' }
  } catch (e) {
    return { ...base, configured: true, importedAt: null, changed: false, ok: false, message: e instanceof Error ? e.message.slice(0, 160) : 'Store unavailable' }
  }
  const snap = await loadSnapshot()
  if (snap && Date.now() - Date.parse(snap.fetchedAt) < XERO_MAX_AGE_MS) {
    return { ...base, configured: true, importedAt: snap.fetchedAt, changed: false, ok: snap.problems.length === 0, message: snap.problems[0] ?? 'Up to date' }
  }
  try {
    const s = await refreshSnapshot(c)
    return { ...base, configured: true, importedAt: s.fetchedAt, changed: true, ok: s.problems.length === 0, message: s.problems[0] ?? `Refreshed ${s.invoices.length} invoices` }
  } catch (e) {
    return { ...base, configured: true, importedAt: snap?.fetchedAt ?? null, changed: false, ok: false, message: `Refresh failed (${e instanceof Error ? e.message.slice(0, 120) : 'unknown'}). Showing the last refresh.` }
  }
}
