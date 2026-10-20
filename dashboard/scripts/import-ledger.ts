/**
 * Reads FoneNova_Order_Ledger.xlsx and writes typed JSON for the dashboard.
 *
 *   npm run import                          # data/FoneNova_Order_Ledger.xlsx -> data/generated/ledger.json
 *   npm run import -- path/to/file.xlsx     # another copy of the ledger
 *   npm run import -- in.xlsx --out dir     # another output folder
 *
 * With no path given, it reads FN_LEDGER_PATH if set (e.g. the copy OneDrive syncs to the
 * desktop), otherwise data/FoneNova_Order_Ledger.xlsx.
 *
 * The script never adjusts figures to make them fit. It writes what the ledger says, then runs
 * the reconciliation checks and exits with code 1 if any check fails.
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { reconcileLedger } from '../lib/metrics'
import { importLedger, importNotes } from '../lib/importers/ledger'

loadEnvConfig(process.cwd())

async function main() {
  const args = process.argv.slice(2)
  const outIdx = args.indexOf('--out')
  const outDir = outIdx >= 0 ? args[outIdx + 1] : 'data/generated'
  const input =
    args.find((a, i) => !a.startsWith('--') && (outIdx === -1 || i !== outIdx + 1)) ??
    process.env.FN_LEDGER_PATH ??
    'data/FoneNova_Order_Ledger.xlsx'

  if (!fs.existsSync(input)) {
    console.error(`Ledger not found: ${input}\nSet FN_LEDGER_PATH to the ledger's location, pass the path, or place the file in dashboard/data/.`)
    process.exit(2)
  }

  const ledger = await importLedger(input)
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'ledger.json')
  fs.writeFileSync(outFile, JSON.stringify(ledger, null, 2) + '\n')

  const goods = ledger.lines.filter((l) => l.type === 'goods').length
  console.log(`Read ${input} (last saved ${fs.statSync(input).mtime.toLocaleString('en-GB')})`)
  console.log(`  Orders ${ledger.orders.length} (TOTAL row excluded)  Lines ${ledger.lines.length} (${goods} goods, ${ledger.lines.length - goods} shipping)`)
  console.log(`  Credit notes ${ledger.creditNotes.length}  Exceptions ${ledger.exceptions.length}  Customers ${ledger.customers.length}  Suppliers ${ledger.suppliers.length}`)
  console.log(`  Order dates ${ledger.orders.map((o) => o.date).sort()[0]} to ${ledger.orders.map((o) => o.date).sort().at(-1)}  Xero snapshot ${ledger.meta.snapshotDate}`)
  console.log(`  Formula cells read as 0 (no cached result stored): ${importNotes().formulasWithoutResult}`)
  console.log(`Wrote ${outFile}\n`)

  for (const w of importNotes().warnings) console.warn(`WARN  ${w}`)

  const checks = reconcileLedger(ledger)
  for (const c of checks) {
    console.log(`${c.ok ? 'OK  ' : 'FAIL'}  ${c.label.padEnd(48)} ${c.detail}`)
  }
  const failed = checks.filter((c) => !c.ok)
  if (failed.length) {
    console.error(`\n${failed.length} reconciliation check(s) failed. Figures were written as found, not adjusted.`)
    process.exit(1)
  }
  console.log(`\nAll ${checks.length} reconciliation checks pass.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
