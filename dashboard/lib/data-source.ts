/**
 * The only way the UI gets data. Swap the adapter, keep the UI.
 *
 * StoreLedgerSource reads the imported ledger from the store (data/ on your PC, encrypted
 * online storage when hosted). A Xero adapter would implement the same interface and
 * return the same Ledger shape (see lib/types.ts).
 */
import 'server-only'
import fs from 'node:fs/promises'
import zlib from 'node:zlib'
import path from 'node:path'
import { parseFxResponse } from './fx'
import { STARTER_OVERHEADS, validateOverheads } from './overheads'
import { dataDir, getStore, storeWritable, type ReadResult, type Store } from './store'
import { oneDriveConfig, oneDriveConnected } from './onedrive'
import { loadSnapshot, xeroAvailable, xeroConfig, xeroConnected } from './xero/client'
import type { ExpenseClass, ExpenseLog, ExpenseOverrides, FxResult, Ledger, Overhead, XeroSnapshot } from './types'

export type LoadResult =
  | { ok: true; ledger: Ledger }
  | { ok: false; title: string; detail: string }

export interface DataSource {
  readonly name: string
  load(): Promise<LoadResult>
}

const REQUIRED_KEYS: (keyof Ledger)[] = ['meta', 'summary', 'totalRow', 'customers', 'orders', 'lines', 'creditNotes', 'exceptions']

export class StoreLedgerSource implements DataSource {
  constructor(
    private readonly store: Store,
    private readonly sampleFile: string,
  ) {}

  get name() {
    return this.store.name
  }

  async load(): Promise<LoadResult> {
    let real: ReadResult
    try {
      real = await this.store.get('ledger')
    } catch (e) {
      return { ok: false, title: 'Ledger data could not be read', detail: e instanceof Error ? e.message : String(e) }
    }
    if (real.kind === 'ok') return validate(real.value, 'The imported ledger')
    if (real.kind === 'invalid') {
      return { ok: false, title: 'Ledger data could not be read', detail: `${real.message}. Sync or run "npm run import" again.` }
    }
    // No real data yet: fall back to the fake sample so the project still runs.
    // The UI shows a persistent "sample data" banner whenever meta.isSample is true.
    const sample = await readJsonFile(this.sampleFile)
    if (sample.kind === 'ok') return validate(sample.value, 'The sample ledger')
    return {
      ok: false,
      title: 'No ledger data found',
      detail: 'Connect OneDrive (hosted), set FN_LEDGER_PATH (on your PC), or run "npm run import". "npm run sample" generates fake sample data.',
    }
  }
}

async function readJsonFile(file: string): Promise<ReadResult> {
  let text: string
  try {
    text = await fs.readFile(file, 'utf8')
  } catch {
    return { kind: 'missing' }
  }
  try {
    return { kind: 'ok', value: JSON.parse(text) }
  } catch (e) {
    return { kind: 'invalid', message: e instanceof Error ? e.message : String(e) }
  }
}

/** Read from the store, turning a store outage into an "invalid" result instead of a crash. */
async function read(key: Parameters<Store['get']>[0]): Promise<ReadResult> {
  try {
    return await getStore().get(key)
  } catch (e) {
    return { kind: 'invalid', message: e instanceof Error ? e.message : String(e) }
  }
}

function validate(value: unknown, what: string): LoadResult {
  const v = value as Partial<Ledger>
  const missing = REQUIRED_KEYS.filter((k) => !(v && k in v))
  if (missing.length) {
    return { ok: false, title: 'Ledger data is incomplete', detail: `${what} is missing: ${missing.join(', ')}. Sync or run "npm run import" again.` }
  }
  return { ok: true, ledger: v as Ledger }
}

/**
 * Hosted adapter: the ledger arrives brotli-compressed and base64-encoded in an encrypted
 * environment variable (FN_LEDGER_BR, written by `npm run pack-ledger`), so real figures
 * never pass through git.
 */
export class EnvLedgerSource implements DataSource {
  readonly name = 'Hosted ledger (encrypted environment variable)'

  constructor(private readonly encoded: string) {}

  async load(): Promise<LoadResult> {
    let value: unknown
    try {
      value = JSON.parse(zlib.brotliDecompressSync(Buffer.from(this.encoded, 'base64')).toString('utf8'))
    } catch (e) {
      return { ok: false, title: 'Hosted ledger could not be read', detail: `FN_LEDGER_BR did not decode (${e instanceof Error ? e.message : String(e)}). Run "npm run pack-ledger" and update the variable.` }
    }
    return validate(value, 'FN_LEDGER_BR')
  }
}

export function getDataSource(): DataSource {
  if (process.env.FN_LEDGER_BR) return new EnvLedgerSource(process.env.FN_LEDGER_BR)
  const sample = path.join(dataDir(), 'sample', 'ledger.json')
  try {
    return new StoreLedgerSource(getStore(), sample)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return { name: 'Online store', load: async () => ({ ok: false, title: 'Online storage is not set up correctly', detail }) }
  }
}

/** Remove anything that must not reach the browser (full local file paths). */
export function toClientLedger(ledger: Ledger): Ledger {
  return {
    ...ledger,
    orders: ledger.orders.map((o) => ({
      ...o,
      clientPdf: { fileName: o.clientPdf.fileName },
      supplierPdf: { fileName: o.supplierPdf.fileName },
    })),
  }
}

// ---------------------------------------------------------------------------
// Exchange rate: European Central Bank daily reference rate, via Frankfurter (no key).
// ---------------------------------------------------------------------------

const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=GBP'
const FX_TTL_MS = 60 * 60 * 1000
let fxCache: { at: number; result: FxResult } | null = null

export async function loadFxRate(fetchImpl: typeof fetch = fetch): Promise<FxResult> {
  if (fxCache && Date.now() - fxCache.at < FX_TTL_MS && fxCache.result.ok) return fxCache.result
  let result: FxResult
  try {
    const res = await fetchImpl(process.env.FN_FX_URL ?? FX_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    result = res.ok ? parseFxResponse(await res.json(), new Date().toISOString()) : { ok: false, reason: `The rate service answered ${res.status}` }
  } catch {
    result = { ok: false, reason: 'The rate service could not be reached' }
  }
  fxCache = { at: Date.now(), result }
  return result
}

// ---------------------------------------------------------------------------
// Overheads: edited from the dashboard, kept in the store (data/ locally, online when hosted).
// ---------------------------------------------------------------------------

/** Hosted (Vercel) disks are read-only and reset on deploy, so saving there needs online storage. */
export function overheadsWritable(): boolean {
  return storeWritable()
}

export async function loadOverheads(): Promise<{ overheads: Overhead[]; saved: boolean; error?: string }> {
  const r = await read('overheads')
  if (r.kind === 'missing') return { overheads: STARTER_OVERHEADS, saved: false }
  if (r.kind === 'invalid') return { overheads: STARTER_OVERHEADS, saved: false, error: `Saved overheads could not be read (${r.message})` }
  const v = validateOverheads(r.value)
  return v.ok ? { overheads: v.overheads, saved: true } : { overheads: STARTER_OVERHEADS, saved: false, error: `Saved overheads: ${v.error}` }
}

export async function saveOverheads(overheads: Overhead[]): Promise<void> {
  await getStore().set('overheads', overheads)
}

// ---------------------------------------------------------------------------
// Live Xero status (read-only). The snapshot is refreshed by POST /xero/refresh.
// ---------------------------------------------------------------------------

export interface XeroState {
  /** XERO_CLIENT_ID is set and this machine can store tokens. */
  configured: boolean
  connected: boolean
  tenantName: string | null
  snapshot: XeroSnapshot | null
}

export async function loadXeroState(): Promise<XeroState> {
  const configured = !!xeroConfig() && xeroAvailable()
  if (!configured) return { configured, connected: false, tenantName: null, snapshot: null }
  try {
    const { connected, tenantName } = await xeroConnected()
    return { configured, connected, tenantName, snapshot: connected ? await loadSnapshot() : null }
  } catch {
    return { configured, connected: false, tenantName: null, snapshot: null } // the sync line says why
  }
}

// ---------------------------------------------------------------------------
// OneDrive (read-only): where the hosted version reads the ledger and VAT tracker
// ---------------------------------------------------------------------------

export interface OneDriveState {
  /** Shown at all: hosted, or MS_CLIENT_ID is set on this PC. */
  relevant: boolean
  /** MS_CLIENT_ID and MS_CLIENT_SECRET are set and tokens can be stored. */
  configured: boolean
  connected: boolean
  accountName: string | null
}

export async function loadOneDriveState(): Promise<OneDriveState> {
  const c = oneDriveConfig()
  const relevant = !!process.env.VERCEL || !!c
  const configured = !!c && storeWritable()
  if (!configured) return { relevant, configured, connected: false, accountName: null }
  try {
    return { relevant, configured, ...(await oneDriveConnected()) }
  } catch {
    return { relevant, configured, connected: false, accountName: null }
  }
}

/** Running on Vercel rather than on your PC. Changes setup hints only, never figures. */
export function isHosted(): boolean {
  return !!process.env.VERCEL
}

// ---------------------------------------------------------------------------
// Expense log (from the VAT return tracker) and the owner's overrides. Never in git.
// ---------------------------------------------------------------------------

export async function loadExpenses(): Promise<{ log: ExpenseLog | null; overrides: ExpenseOverrides; error?: string }> {
  const [r, ov] = await Promise.all([read('expenses'), read('expense-overrides')])
  const overrides = ov.kind === 'ok' ? validateOverrides(ov.value) ?? {} : {}
  if (r.kind === 'missing') return { log: null, overrides }
  if (r.kind === 'invalid') return { log: null, overrides, error: `The imported expenses could not be read (${r.message})` }
  const v = r.value as Partial<ExpenseLog>
  if (!Array.isArray(v?.expenses)) return { log: null, overrides, error: 'expenses.json has no expense list. Run "npm run import-expenses" again.' }
  return { log: { meta: v.meta!, expenses: v.expenses, fxConversions: v.fxConversions ?? [] }, overrides }
}

const CLASSES: ExpenseClass[] = ['business', 'review', 'personal']

export function validateOverrides(input: unknown): ExpenseOverrides | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const out: ExpenseOverrides = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[a-f0-9]{12}(-\d+)?$/.test(k) || !CLASSES.includes(v as ExpenseClass)) return null
    out[k] = v as ExpenseClass
  }
  return out
}

export async function saveExpenseOverrides(o: ExpenseOverrides): Promise<void> {
  await getStore().set('expense-overrides', o)
}
