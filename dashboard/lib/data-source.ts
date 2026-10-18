/**
 * The only way the UI gets data. Swap the adapter, keep the UI.
 *
 * v1 ships one adapter, LocalFileDataSource, which reads the JSON written by
 * scripts/import-ledger.ts. A Xero adapter would implement the same interface and
 * return the same Ledger shape (see lib/types.ts).
 */
import 'server-only'
import fs from 'node:fs/promises'
import zlib from 'node:zlib'
import path from 'node:path'
import type { Ledger } from './types'

export type LoadResult =
  | { ok: true; ledger: Ledger }
  | { ok: false; title: string; detail: string }

export interface DataSource {
  readonly name: string
  load(): Promise<LoadResult>
}

const REQUIRED_KEYS: (keyof Ledger)[] = ['meta', 'summary', 'totalRow', 'customers', 'orders', 'lines', 'creditNotes', 'exceptions']

export class LocalFileDataSource implements DataSource {
  readonly name = 'Local ledger file'

  constructor(
    private readonly realFile: string,
    private readonly sampleFile: string,
  ) {}

  async load(): Promise<LoadResult> {
    const real = await readJson(this.realFile)
    if (real.kind === 'ok') return validate(real.value, this.realFile)
    if (real.kind === 'invalid') {
      return { ok: false, title: 'Ledger data could not be read', detail: `${path.basename(this.realFile)} is not valid JSON (${real.message}). Run "npm run import" again.` }
    }
    // No real data on this machine: fall back to the fake sample so the project still runs.
    // The UI shows a persistent "sample data" banner whenever meta.isSample is true.
    const sample = await readJson(this.sampleFile)
    if (sample.kind === 'ok') return validate(sample.value, this.sampleFile)
    return {
      ok: false,
      title: 'No ledger data found',
      detail: 'Place FoneNova_Order_Ledger.xlsx in dashboard/data/ and run "npm run import", or run "npm run sample" to generate fake sample data.',
    }
  }
}

type ReadResult = { kind: 'ok'; value: unknown } | { kind: 'missing' } | { kind: 'invalid'; message: string }

async function readJson(file: string): Promise<ReadResult> {
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

function validate(value: unknown, file: string): LoadResult {
  const v = value as Partial<Ledger>
  const missing = REQUIRED_KEYS.filter((k) => !(v && k in v))
  if (missing.length) {
    return { ok: false, title: 'Ledger data is incomplete', detail: `${path.basename(file)} is missing: ${missing.join(', ')}. Run "npm run import" again.` }
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
  const kind = process.env.FN_DATA_SOURCE ?? 'local'
  if (kind !== 'local') throw new Error(`Data source "${kind}" is not available in v1`)
  const dir = process.env.FN_DATA_DIR ?? path.join(process.cwd(), 'data')
  return new LocalFileDataSource(path.join(dir, 'generated', 'ledger.json'), path.join(dir, 'sample', 'ledger.json'))
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
