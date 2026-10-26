/**
 * Reads the VAT return expense tracker (xlsx) and writes data/generated/expenses.json.
 *
 *   npm run import-expenses -- "C:\path\VAT Return From Sept-Dec, 2026.xlsx"
 *
 * With no path it reads FN_EXPENSES_PATH; else, with FN_EXPENSES_DIR, every quarter's tracker (one
 * "VAT Return From…" file per VAT return, joined into one) and the May to Aug tracker in that
 * folder (as the dashboard does); else data/expenses.xlsx. The May to Aug tracker
 * (VATReturn_Automated_….xlsx) goes to expenses-archive.json; the dashboard joins the two. Reads Sheet2 (the expense
 * log) and, if present, the "FX Exchanges (Reference)" sheet. Amounts are GBP. Nothing is
 * adjusted: the script prints its totals so they can be checked against the tracker's summary.
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { importExpenses } from '../lib/importers/expenses'
import { combineQuarterLogs } from '../lib/expenses'
import { allTrackers, isArchiveName, newestTracker } from '../lib/sync-core'
import type { ExpenseLog } from '../lib/types'

loadEnvConfig(process.cwd())

async function inputs(): Promise<string[]> {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'))
  if (arg ?? process.env.FN_EXPENSES_PATH) return [(arg ?? process.env.FN_EXPENSES_PATH)!]
  const dir = process.env.FN_EXPENSES_DIR
  if (dir) {
    const quarters = (await allTrackers(dir)).map((t) => t.file)
    const archive = process.env.FN_EXPENSES_ARCHIVE ?? (await newestTracker(dir, 3, isArchiveName))?.file
    const found = [...quarters, archive].filter((f): f is string => !!f)
    if (found.length) return found
    console.error(`No expense tracker found in FN_EXPENSES_DIR (${dir}).`)
    process.exit(2)
  }
  return ['data/expenses.xlsx']
}

async function main() {
  const quarters: ExpenseLog[] = []
  for (const input of await inputs()) {
    const log = await importOne(input)
    if (isArchiveName(path.basename(input))) write('expenses-archive.json', log)
    else quarters.push(log)
  }
  // Every quarter's tracker goes into one expenses.json; the dashboard joins it with May to Aug.
  if (quarters.length) write('expenses.json', combineQuarterLogs(quarters)!)
}

function write(name: string, log: ExpenseLog) {
  const out = path.join('data', 'generated', name)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(log, null, 2) + '\n')
  console.log(`Wrote ${out}`)
}

async function importOne(input: string): Promise<ExpenseLog> {
  if (!fs.existsSync(input)) {
    console.error(`Expense tracker not found: ${input}\nPass its path, set FN_EXPENSES_PATH or FN_EXPENSES_DIR, or save it as dashboard/data/expenses.xlsx.`)
    process.exit(2)
  }
  const { log, skipped, check } = await importExpenses(input)
  const total = log.expenses.reduce((n, e) => n + e.amountCents, 0)
  const vat = log.expenses.reduce((n, e) => n + e.vatCents, 0)
  const dates = log.expenses.map((e) => e.date).sort()
  const gbp = (c: number) => `£${(c / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
  console.log(`Read ${input} (last saved ${fs.statSync(input).mtime.toLocaleString('en-GB')})`)
  console.log(`  ${log.expenses.length} expense rows, ${dates[0]} to ${dates.at(-1)}`)
  console.log(`  Total ${gbp(total)}, VAT reclaimed ${gbp(vat)}  (compare with the tracker's Sheet1 TOTAL row)`)
  console.log(`  ${log.fxConversions.length} EUR to GBP conversions`)
  if (!check.found) console.log("  The tracker's TOTAL row has no saved figure, so the total could not be checked")
  else if (check.matches) console.log(`  Matches the tracker's TOTAL row (${gbp(check.sheet!.amountCents)})`)
  else console.warn(`  MISMATCH: the tracker's TOTAL row says ${gbp(check.sheet!.amountCents)}`)
  for (const s of skipped) console.warn(`  SKIPPED ${s}`)
  return log
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
