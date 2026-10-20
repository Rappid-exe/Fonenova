/**
 * Automatic sync for the local dashboard: re-import the ledger and the VAT tracker when they
 * are saved, and refresh Xero when its snapshot is old. Runs on page load, at most every 30s.
 * Hosted builds skip file sync (there is no OneDrive folder on Vercel).
 */
import 'server-only'
import path from 'node:path'
import { importExpenses } from './importers/expenses'
import { importLedger } from './importers/ledger'
import { reconcileLedger } from './metrics'
import { newestTracker, syncFile, type SourceStatus } from './sync-core'
import { loadSnapshot, refreshSnapshot, xeroAvailable, xeroConfig, xeroConnected } from './xero/client'
import type { ExpenseLog, Ledger } from './types'

export type { SourceStatus }

const THROTTLE_MS = 30_000
const XERO_MAX_AGE_MS = 30 * 60_000

let last: { at: number; result: SourceStatus[] } | null = null
let running: Promise<SourceStatus[]> | null = null

function dataDir(): string {
  return process.env.FN_DATA_DIR ?? path.join(process.cwd(), 'data')
}

export async function syncSources(): Promise<SourceStatus[]> {
  if (process.env.VERCEL || process.env.FN_LEDGER_BR) return []
  if (last && Date.now() - last.at < THROTTLE_MS) return last.result
  running ??= run().finally(() => { running = null })
  const result = await running
  last = { at: Date.now(), result }
  return result
}

async function run(): Promise<SourceStatus[]> {
  const out = path.join(dataDir(), 'generated')

  const ledger = await syncFile<Ledger>({
    source: 'ledger',
    label: 'Order ledger',
    file: process.env.FN_LEDGER_PATH ?? null,
    outFile: path.join(out, 'ledger.json'),
    notConfigured: 'Automatic sync is off: set FN_LEDGER_PATH in .env.local. Showing the last manual import.',
    run: importLedger,
    describe: (l) => {
      const failed = reconcileLedger(l).filter((c) => !c.ok).length
      return failed ? { ok: false, message: `Imported, but ${failed} reconciliation check(s) fail` } : { ok: true, message: `Imported, reconciled ${l.orders.length} orders` }
    },
    describeExisting: async () => 'Up to date',
  })

  const trackerDir = process.env.FN_EXPENSES_DIR
  const tracker = process.env.FN_EXPENSES_PATH ?? (trackerDir ? (await newestTracker(trackerDir))?.file ?? null : null)
  const expenses = await syncFile<ExpenseLog>({
    source: 'expenses',
    label: 'VAT tracker',
    file: tracker,
    outFile: path.join(out, 'expenses.json'),
    notConfigured: trackerDir
      ? `No "VAT Return From…xlsx" found in that folder (backups are skipped).`
      : 'Automatic sync is off: set FN_EXPENSES_DIR in .env.local. Showing the last manual import.',
    run: async (f) => (await importExpenses(f)).log,
    describe: (l) => ({ ok: true, message: `Imported ${l.expenses.length} rows` }),
  })

  return [ledger, expenses, await syncXero()]
}

async function syncXero(): Promise<SourceStatus> {
  const base = { source: 'xero' as const, label: 'Xero', fileName: null, fileSavedAt: null }
  const c = xeroConfig()
  if (!c || !xeroAvailable()) return { ...base, configured: false, importedAt: null, changed: false, ok: false, message: 'Not set up' }
  if (!(await xeroConnected()).connected) return { ...base, configured: true, importedAt: null, changed: false, ok: false, message: 'Not connected' }
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
