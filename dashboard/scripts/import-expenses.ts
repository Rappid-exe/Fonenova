/**
 * Reads the VAT return expense tracker (xlsx) and writes data/generated/expenses.json.
 *
 *   npm run import-expenses -- "C:\path\VAT Return From Sept-Dec, 2026.xlsx"
 *
 * With no path it reads FN_EXPENSES_PATH, then data/expenses.xlsx. Reads Sheet2 (the expense
 * log) and, if present, the "FX Exchanges (Reference)" sheet. Amounts are GBP. Nothing is
 * adjusted: the script prints its totals so they can be checked against the tracker's summary.
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { importExpenses } from '../lib/importers/expenses'

loadEnvConfig(process.cwd())

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'))
  const input = arg ?? process.env.FN_EXPENSES_PATH ?? 'data/expenses.xlsx'
  if (!fs.existsSync(input)) {
    console.error(`Expense tracker not found: ${input}\nPass its path, set FN_EXPENSES_PATH, or save it as dashboard/data/expenses.xlsx.`)
    process.exit(2)
  }
  const { log, skipped } = await importExpenses(input)
  const out = path.join('data', 'generated', 'expenses.json')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(log, null, 2) + '\n')
  const total = log.expenses.reduce((n, e) => n + e.amountCents, 0)
  const vat = log.expenses.reduce((n, e) => n + e.vatCents, 0)
  const dates = log.expenses.map((e) => e.date).sort()
  const gbp = (c: number) => `£${(c / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
  console.log(`Read ${input} (last saved ${fs.statSync(input).mtime.toLocaleString('en-GB')})`)
  console.log(`  ${log.expenses.length} expense rows, ${dates[0]} to ${dates.at(-1)}`)
  console.log(`  Total ${gbp(total)}, VAT reclaimed ${gbp(vat)}  (compare with the tracker's Sheet1 TOTAL row)`)
  console.log(`  ${log.fxConversions.length} EUR to GBP conversions`)
  for (const s of skipped) console.warn(`  SKIPPED ${s}`)
  console.log(`Wrote ${out}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
