/**
 * Packs data/generated/ledger.json for hosting: strips local file paths, brotli-compresses,
 * base64-encodes, and writes data/generated/ledger.br.b64 (git-ignored). That string is the
 * value of the FN_LEDGER_BR environment variable on Vercel.
 *
 *   npm run import && npm run pack-ledger
 */
import fs from 'node:fs'
import zlib from 'node:zlib'
import type { Ledger } from '../lib/types'

const ledger = JSON.parse(fs.readFileSync('data/generated/ledger.json', 'utf8')) as Ledger
if (ledger.meta.isSample) throw new Error('Refusing to pack sample data')
for (const o of ledger.orders) {
  delete o.clientPdf.path
  delete o.supplierPdf.path
}
const json = JSON.stringify(ledger)
const packed = zlib.brotliCompressSync(Buffer.from(json), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).toString('base64')
if (packed.length > 60_000) throw new Error(`Packed ledger is ${packed.length} bytes; Vercel allows 64 KB of environment variables in total`)
fs.writeFileSync('data/generated/ledger.br.b64', packed)
console.log(`Wrote data/generated/ledger.br.b64: ${packed.length} bytes (from ${json.length} bytes of JSON, ${ledger.orders.length} orders)`)
