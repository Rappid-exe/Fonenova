/**
 * Reads FoneNova_Order_Ledger.xlsx into the Ledger shape. Used by the import script and by the
 * dashboard's automatic sync. Never adjusts figures; the caller runs the reconciliation.
 */
import ExcelJS from 'exceljs'
import { loadWorkbook, type XlsxInput } from './xlsx'
import path from 'node:path'
import { toCents } from '../money'
import type {
  CreditNote,
  Customer,
  InvoiceStatus,
  Ledger,
  LedgerException,
  LedgerSummary,
  LedgerTotalRow,
  Order,
  OrderLine,
  Priority,
  Supplier,
} from '../types'

const EXPECTED_HEADERS = {
  Orders: [
    'Order ID', 'Order date', 'Customer', 'Client invoice', 'Client total EUR', 'Supplier', 'Supplier invoice',
    'Supplier total EUR', 'Gross margin EUR', 'Margin %', 'Goods margin EUR', 'Shipping & other margin EUR',
    'Client status (Xero)', 'Client still owes EUR', 'Supplier status (Xero)', 'We still owe supplier EUR',
    'Client owes minus we owe EUR', 'Flags', 'Client PDF', 'Supplier PDF',
  ],
  Lines: [
    'Order ID', 'Type', 'Description (client invoice)', 'Qty', 'Client unit EUR', 'Supplier unit EUR',
    'Client amount EUR', 'Supplier amount EUR', 'Margin EUR', 'Margin per unit EUR', 'Note',
  ],
  'Credit Notes': [
    'Side', 'Credit note no', 'Date', 'Amount EUR', 'Refers to invoice(s)', 'Order ID(s)', 'What it covers',
    /^Xero shows/, 'Check',
  ],
  Exceptions: ['Priority', 'Order / item', 'Issue', 'EUR impact', 'Suggested action'],
} as const

type Row = Record<string, unknown>

let formulasWithoutResult = 0

/** Warnings and the zero-formula count from the most recent importLedger() call. */
export function importNotes(): { warnings: string[]; formulasWithoutResult: number } {
  return { warnings: [...warnings], formulasWithoutResult }
}

/** Unwrap exceljs cell values: formulas, rich text, hyperlinks. */
function plain(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('result' in v) return plain((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
    // exceljs drops a cached formula result of 0 (it tests the value for truthiness), so a formula
    // with no result means 0. A formula that was truly never calculated would also land here; the
    // reconciliation checks would then fail rather than pass silently.
    if ('formula' in v || 'sharedFormula' in v) {
      formulasWithoutResult++
      return 0
    }
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('')
    if ('text' in v) return (v as ExcelJS.CellHyperlinkValue).text
    if ('error' in v) throw new Error(`Spreadsheet error value: ${JSON.stringify(v)}`)
  }
  return v
}

function sheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name)
  if (!ws) throw new Error(`Tab "${name}" not found. Tabs present: ${wb.worksheets.map((w) => w.name).join(', ')}`)
  return ws
}

function table(wb: ExcelJS.Workbook, name: keyof typeof EXPECTED_HEADERS): { headers: string[]; rows: Row[] } {
  const ws = sheet(wb, name)
  const headers: string[] = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(plain(cell.value) ?? '').trim()
  })
  const expected = EXPECTED_HEADERS[name]
  expected.forEach((want, i) => {
    const got = headers[i]
    const ok = typeof want === 'string' ? got === want : want.test(got ?? '')
    if (!ok) throw new Error(`${name}: column ${i + 1} is "${got}", expected "${String(want)}". The ledger layout has changed.`)
  })
  const rows: Row[] = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const rec: Row = {}
    let any = false
    headers.forEach((h, i) => {
      const v = plain(row.getCell(i + 1).value)
      if (v !== null && v !== '') any = true
      rec[h] = typeof v === 'string' ? v.trim() : v
    })
    if (any) rows.push(rec)
  }
  return { headers, rows }
}

function isoDate(v: unknown, where: string): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  throw new Error(`${where}: not a date: ${String(v)}`)
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function nullableCents(v: unknown): number | null {
  return v === null || v === undefined || v === '' ? null : toCents(v)
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function fileName(p: unknown): string | null {
  const s = str(p)
  if (!s) return null
  return s.split(/[\\/]/).pop() ?? null
}

const warnings: string[] = []

function status(v: unknown, where: string): InvoiceStatus {
  const s = str(v).toUpperCase()
  if (s === 'PAID' || s === 'AUTHORISED') return s
  if (s === 'NOT IN XERO') return 'NOT_IN_XERO'
  warnings.push(`${where}: unrecognised Xero status "${str(v)}"`)
  return 'UNKNOWN'
}

function parseSummary(wb: ExcelJS.Workbook): { summary: LedgerSummary; snapshotText: string } {
  const ws = sheet(wb, 'Summary')
  const pairs: [string, unknown][] = []
  const byCustomer: LedgerSummary['byCustomer'] = []
  let inCustomers = false
  let snapshotText = ''
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const label = str(plain(row.getCell(1).value))
    const value = plain(row.getCell(2).value)
    if (/snapshot taken on/i.test(label)) snapshotText = label
    if (label === 'By customer') { inCustomers = true; continue }
    if (inCustomers) {
      if (label === 'Customer') continue
      if (!label || label.startsWith('Legend')) { inCustomers = false; continue }
      byCustomer.push({
        customerName: label,
        orders: Number(value),
        clientTotalCents: toCents(plain(row.getCell(3).value)),
        grossMarginCents: toCents(plain(row.getCell(4).value)),
      })
      continue
    }
    if (label) pairs.push([label, value])
  }
  const get = (prefix: string): unknown => {
    const hit = pairs.find(([l]) => l.toLowerCase().startsWith(prefix.toLowerCase()))
    if (!hit) throw new Error(`Summary: label starting "${prefix}" not found`)
    return hit[1]
  }
  return {
    snapshotText,
    summary: {
      ordersMatched: Number(get('Orders matched')),
      clientTotalCents: toCents(get('Client invoices total')),
      supplierTotalCents: toCents(get('Supplier invoices total')),
      grossMarginCents: toCents(get('Gross margin before credit notes')),
      clientCreditsCents: toCents(get('Client credit memos issued')),
      supplierCreditsCents: toCents(get('Supplier credit notes received')),
      marginAfterCreditsCents: toCents(get('Gross margin after credit notes')),
      clientsOweCents: toCents(get('Clients still owe')),
      weOweSupplierCents: toCents(get('You still owe Mobile One')),
      ordersWithFlag: Number(get('Orders with a flag')),
      byCustomer,
    },
  }
}

/** Reads a file path, or a file already downloaded (e.g. from OneDrive) as `{ name, data }`. */
export async function importLedger(input: XlsxInput): Promise<Ledger> {
  const inputPath = typeof input === 'string' ? input : input.name
  warnings.length = 0
  formulasWithoutResult = 0
  const wb = new ExcelJS.Workbook()
  await loadWorkbook(wb, input)

  const { summary, snapshotText } = parseSummary(wb)

  // ---- Orders (last row is TOTAL: reconcile only, never import) ----
  const ordersTab = table(wb, 'Orders')
  const totalIdx = ordersTab.rows.findIndex((r) => str(r['Order ID']).toUpperCase() === 'TOTAL')
  if (totalIdx === -1) throw new Error('Orders: TOTAL row not found')
  if (totalIdx !== ordersTab.rows.length - 1) warnings.push('Orders: TOTAL row is not the last row')
  const t = ordersTab.rows[totalIdx]
  const totalRow: LedgerTotalRow = {
    clientTotalCents: toCents(t['Client total EUR']),
    supplierTotalCents: toCents(t['Supplier total EUR']),
    grossMarginCents: toCents(t['Gross margin EUR']),
    goodsMarginCents: toCents(t['Goods margin EUR']),
    shippingMarginCents: toCents(t['Shipping & other margin EUR']),
    clientOwesCents: toCents(t['Client still owes EUR']),
    weOweSupplierCents: toCents(t['We still owe supplier EUR']),
  }

  const customers = new Map<string, Customer>()
  const suppliers = new Map<string, Supplier>()
  const orders: Order[] = ordersTab.rows
    .filter((_, i) => i !== totalIdx)
    .map((r) => {
      const id = str(r['Order ID'])
      if (!/^FN-ORD-\d{3,}$/.test(id)) throw new Error(`Orders: unexpected Order ID "${id}"`)
      const customerName = str(r['Customer'])
      const supplierName = str(r['Supplier'])
      const customerId = slug(customerName)
      const supplierId = slug(supplierName)
      customers.set(customerId, { id: customerId, name: customerName })
      suppliers.set(supplierId, { id: supplierId, name: supplierName })
      const margin = r['Margin %']
      return {
        id,
        date: isoDate(r['Order date'], `${id} Order date`),
        customerId,
        customerName,
        supplierId,
        supplierName,
        clientInvoiceNo: str(r['Client invoice']),
        supplierInvoiceNo: str(r['Supplier invoice']),
        clientTotalCents: toCents(r['Client total EUR']),
        supplierTotalCents: toCents(r['Supplier total EUR']),
        grossMarginCents: toCents(r['Gross margin EUR']),
        goodsMarginCents: toCents(r['Goods margin EUR']),
        shippingMarginCents: toCents(r['Shipping & other margin EUR']),
        ledgerMarginRatio: typeof margin === 'number' ? margin : null,
        clientStatus: status(r['Client status (Xero)'], `${id} client status`),
        clientOwesCents: nullableCents(r['Client still owes EUR']),
        supplierStatus: status(r['Supplier status (Xero)'], `${id} supplier status`),
        weOweSupplierCents: nullableCents(r['We still owe supplier EUR']),
        clientOwesMinusWeOweCents: toCents(r['Client owes minus we owe EUR']),
        flags: str(r['Flags']).split(';').map((f) => f.trim()).filter(Boolean),
        clientPdf: { fileName: fileName(r['Client PDF']), path: str(r['Client PDF']) || null },
        supplierPdf: { fileName: fileName(r['Supplier PDF']), path: str(r['Supplier PDF']) || null },
      }
    })
  const orderIds = new Set(orders.map((o) => o.id))

  // ---- Lines ----
  const lineCounter = new Map<string, number>()
  const lines: OrderLine[] = table(wb, 'Lines').rows.map((r) => {
    const orderId = str(r['Order ID'])
    if (!orderIds.has(orderId)) warnings.push(`Lines: row for unknown order ${orderId}`)
    const typeRaw = str(r['Type'])
    if (typeRaw !== 'Goods' && typeRaw !== 'Shipping & discounts') throw new Error(`Lines: unknown Type "${typeRaw}"`)
    const lineNo = (lineCounter.get(orderId) ?? 0) + 1
    lineCounter.set(orderId, lineNo)
    return {
      orderId,
      lineNo,
      type: typeRaw === 'Goods' ? 'goods' : 'shipping',
      description: str(r['Description (client invoice)']),
      qty: Number(r['Qty'] ?? 0),
      clientUnitCents: toCents(r['Client unit EUR']),
      supplierUnitCents: toCents(r['Supplier unit EUR']),
      clientAmountCents: toCents(r['Client amount EUR']),
      supplierAmountCents: toCents(r['Supplier amount EUR']),
      marginCents: toCents(r['Margin EUR']),
      marginPerUnitCents: toCents(r['Margin per unit EUR']),
      note: str(r['Note']) || null,
    }
  })

  // ---- Credit notes ----
  const cnTab = table(wb, 'Credit Notes')
  const xeroHeader = cnTab.headers[7]
  const creditNotes: CreditNote[] = cnTab.rows.map((r) => {
    const side = str(r['Side']).toLowerCase()
    if (side !== 'client' && side !== 'supplier') throw new Error(`Credit Notes: unknown Side "${str(r['Side'])}"`)
    const ids = str(r['Order ID(s)']).split(',').map((s) => s.trim()).filter(Boolean)
    ids.forEach((id) => { if (!orderIds.has(id)) warnings.push(`Credit note ${str(r['Credit note no'])}: unknown order ${id}`) })
    return {
      side,
      number: str(r['Credit note no']),
      date: isoDate(r['Date'], `Credit note ${str(r['Credit note no'])}`),
      amountCents: toCents(r['Amount EUR']),
      refersToInvoices: str(r['Refers to invoice(s)']),
      orderIds: ids,
      covers: str(r['What it covers']),
      xeroShows: str(r[xeroHeader]),
      check: str(r['Check']),
    }
  })

  // ---- Snapshot date: when Xero statuses were read. Overdue text is frozen at this date. ----
  const snap = /(\d{4}-\d{2}-\d{2})/.exec(xeroHeader)?.[1] ?? parseLongDate(snapshotText)
  if (!snap) throw new Error('Could not find the Xero snapshot date in the ledger')

  // ---- Exceptions ----
  const exceptions: LedgerException[] = table(wb, 'Exceptions').rows.map((r, i) => {
    const reference = str(r['Order / item'])
    const priority = str(r['Priority']).toUpperCase()
    if (priority !== 'HIGH' && priority !== 'MEDIUM' && priority !== 'LOW') throw new Error(`Exceptions: unknown priority "${priority}"`)
    let orderId = /FN-ORD-\d{3,}/.exec(reference)?.[0] ?? null
    if (!orderId) {
      // "Invoice 2026/02/0001 (...)": resolve through the client invoice number.
      const hit = orders.find((o) => o.clientInvoiceNo && new RegExp(`\\b${escapeRe(o.clientInvoiceNo)}\\b`).test(reference))
      orderId = hit?.id ?? null
    }
    return {
      id: `EX-${String(i + 1).padStart(2, '0')}`,
      priority: priority as Priority,
      reference,
      orderId,
      issue: str(r['Issue']),
      impactCents: toCents(r['EUR impact']),
      suggestedAction: str(r['Suggested action']),
    }
  })

  return {
    meta: {
      sourceFile: path.basename(inputPath),
      importedAt: new Date().toISOString(),
      snapshotDate: snap,
      currency: 'EUR',
      isSample: false,
    },
    summary,
    totalRow,
    customers: [...customers.values()],
    suppliers: [...suppliers.values()],
    orders,
    lines,
    creditNotes,
    exceptions,
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function parseLongDate(text: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(text)
  if (!m) return null
  const month = MONTHS.indexOf(m[2].toLowerCase())
  if (month === -1) return null
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
