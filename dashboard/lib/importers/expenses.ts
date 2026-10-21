/**
 * Reads the VAT return tracker (Sheet2 expense log and the FX conversions sheet) into an
 * ExpenseLog. Used by the import script and by the dashboard's automatic sync.
 */
import crypto from 'node:crypto'
import ExcelJS from 'exceljs'
import { loadWorkbook, type XlsxInput } from './xlsx'
import path from 'node:path'
import { toCents } from '../money'
import type { Expense, ExpenseLog, FxConversion } from '../types'

function plain(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('result' in v) return plain((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('')
    if ('text' in v) return (v as ExcelJS.CellHyperlinkValue).text
    if ('formula' in v || 'sharedFormula' in v) return null
  }
  return v
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

/** The tracker writes dates as text, "02.09.26". */
function parseDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const m = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(str(v))
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : null
}

function headerColumns(ws: ExcelJS.Worksheet, row: number, wanted: Record<string, RegExp>): Record<string, number> {
  const found: Record<string, number> = {}
  ws.getRow(row).eachCell((cell, col) => {
    const t = str(plain(cell.value))
    for (const [key, re] of Object.entries(wanted)) if (!(key in found) && re.test(t)) found[key] = col
  })
  const missing = Object.keys(wanted).filter((k) => !(k in found))
  if (missing.length) throw new Error(`${ws.name}: could not find columns ${missing.join(', ')} in row ${row}. The tracker layout has changed.`)
  return found
}

/** Reads a file path, or a file already downloaded (e.g. from OneDrive) as `{ name, data }`. */
export async function importExpenses(input: XlsxInput): Promise<{ log: ExpenseLog; skipped: string[] }> {
  const file = typeof input === 'string' ? input : input.name
  const wb = new ExcelJS.Workbook()
  await loadWorkbook(wb, input)
  const ws = wb.getWorksheet('Sheet2')
  if (!ws) throw new Error(`No "Sheet2" (expense log) in ${path.basename(file)}`)

  // Header row: "Dated:" in column D, "Beneficiary:", "Description:", "Amount:" ...
  let headerRow = 0
  for (let r = 1; r <= 10 && !headerRow; r++) if (/beneficiary/i.test(str(plain(ws.getRow(r).getCell(5).value)))) headerRow = r
  if (!headerRow) throw new Error('Sheet2: header row with "Beneficiary:" not found in the first 10 rows')
  const col = headerColumns(ws, headerRow, {
    payee: /^beneficiary/i, description: /^description/i, amount: /^amount/i,
    reference: /^ref no/i, vatFlag: /^vat no/i, vat: /^vat rate/i, remarks: /^remarks/i,
  })
  // Date is the "Dated:" column just before Beneficiary (column A also says "Dated:" but is unused).
  const dateCol = col.payee - 1

  const expenses: Expense[] = []
  const skipped: string[] = []
  const seen = new Map<string, number>()
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const rawDate = plain(row.getCell(dateCol).value)
    const payee = str(plain(row.getCell(col.payee).value))
    const amount = plain(row.getCell(col.amount).value)
    if (!payee && (amount === null || amount === '')) continue
    if (/^total|^net total/i.test(str(rawDate))) continue
    const date = parseDate(rawDate)
    if (!date || typeof amount !== 'number') {
      skipped.push(`row ${r}: ${str(rawDate)} ${payee} ${str(amount)}`)
      continue
    }
    const description = str(plain(row.getCell(col.description).value))
    const reference = str(plain(row.getCell(col.reference).value))
    const flagYes = /vat-yes/i.test(str(plain(row.getCell(col.vatFlag).value)))
    const vatRaw = plain(row.getCell(col.vat).value)
    const amountCents = toCents(amount)
    // Stable id from the row's own content, so owner overrides survive re-imports and re-ordering.
    const base = crypto.createHash('sha1').update(`${date}|${payee}|${amountCents}|${reference}`).digest('hex').slice(0, 12)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    expenses.push({
      id: n === 1 ? base : `${base}-${n}`,
      date,
      payee,
      description,
      amountCents,
      vatCents: flagYes && typeof vatRaw === 'number' ? toCents(vatRaw) : 0,
      reference,
      remarks: str(plain(row.getCell(col.remarks).value)),
    })
  }

  const fxConversions: FxConversion[] = []
  const fx = wb.worksheets.find((w) => /fx exchanges/i.test(w.name))
  if (fx) {
    let hr = 0
    for (let r = 1; r <= 10 && !hr; r++) if (/eur converted/i.test(str(plain(fx.getRow(r).getCell(2).value)))) hr = r
    if (hr) {
      for (let r = hr + 1; r <= fx.rowCount; r++) {
        const row = fx.getRow(r)
        const date = parseDate(plain(row.getCell(1).value))
        const eur = Number(plain(row.getCell(2).value))
        const gbp = Number(plain(row.getCell(3).value))
        const fee = Number(plain(row.getCell(5).value) ?? 0)
        if (!date || !Number.isFinite(eur) || !Number.isFinite(gbp) || eur <= 0) continue
        fxConversions.push({ date, eurCents: toCents(eur), gbpCents: toCents(gbp), feeCents: Number.isFinite(fee) ? toCents(fee) : 0 })
      }
    }
  }

  return {
    log: { meta: { sourceFile: path.basename(file), importedAt: new Date().toISOString(), currency: 'GBP' }, expenses, fxConversions },
    skipped,
  }
}
