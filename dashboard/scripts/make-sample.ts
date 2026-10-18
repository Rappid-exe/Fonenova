/**
 * Writes data/sample/ledger.json: clearly FAKE data in the same shape as the real import,
 * so the project runs on a machine without the real ledger. Deterministic (seeded).
 *
 *   npm run sample
 */
import fs from 'node:fs'
import path from 'node:path'
import { sumCents } from '../lib/money'
import { cashPosition, creditTotals, totals, unitsByOrder } from '../lib/metrics'
import type { CreditNote, Ledger, LedgerException, Order, OrderLine } from '../lib/types'

let seed = 42
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32
  return seed / 2 ** 32
}
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]

const CUSTOMERS = [
  { id: 'sample-customer-a', name: 'Sample Customer A (fake)', weight: 0.8 },
  { id: 'sample-customer-b', name: 'Sample Customer B (fake)', weight: 0.15 },
  { id: 'sample-customer-c', name: 'Sample Customer C (fake)', weight: 0.05 },
]
const SUPPLIER = { id: 'sample-supplier', name: 'Sample Supplier (fake)' }
const PRODUCTS = ['Phone Model X 128GB - Used', 'Phone Model Y 256GB - Used', 'Phone Model Z 128GB - Grade A', 'Tablet Model Q 64GB - Used']
const DATES = ['2026-03-04', '2026-05-06', '2026-05-20', '2026-06-03', '2026-06-17', '2026-06-25', '2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-08-05', '2026-08-26', '2026-09-09', '2026-09-23']

const orders: Order[] = []
const lines: OrderLine[] = []

DATES.forEach((date, i) => {
  const id = `SAMPLE-${String(i + 1).padStart(3, '0')}`
  const r = rand()
  const cust = r < CUSTOMERS[0].weight ? CUSTOMERS[0] : r < CUSTOMERS[0].weight + CUSTOMERS[1].weight ? CUSTOMERS[1] : CUSTOMERS[2]
  const orderLines: OrderLine[] = []
  const n = 1 + Math.floor(rand() * 3)
  for (let k = 0; k < n; k++) {
    const qty = 10 + Math.floor(rand() * 60)
    const supplierUnit = (150 + Math.floor(rand() * 400)) * 100
    const markupPerUnit = i === 6 && k === 0 ? -300 : (1 + Math.floor(rand() * 6)) * 100
    const clientUnit = supplierUnit + markupPerUnit
    orderLines.push({
      orderId: id, lineNo: k + 1, type: 'goods', description: pick(PRODUCTS), qty,
      clientUnitCents: clientUnit, supplierUnitCents: supplierUnit,
      clientAmountCents: clientUnit * qty, supplierAmountCents: supplierUnit * qty,
      marginCents: markupPerUnit * qty, marginPerUnitCents: markupPerUnit, note: null,
    })
  }
  const shipSupplier = 20000
  const shipClient = i % 4 === 0 ? 15000 : 40000
  orderLines.push({
    orderId: id, lineNo: n + 1, type: 'shipping', description: 'Shipping, freight and any invoice-level discounts (net)', qty: 1,
    clientUnitCents: 0, supplierUnitCents: 0, clientAmountCents: shipClient, supplierAmountCents: shipSupplier,
    marginCents: shipClient - shipSupplier, marginPerUnitCents: 0,
    note: shipClient < shipSupplier ? 'Shipping/discounts recharged below what supplier charged' : null,
  })
  lines.push(...orderLines)
  const client = sumCents(orderLines, (l) => l.clientAmountCents)
  const supplier = sumCents(orderLines, (l) => l.supplierAmountCents)
  const goods = sumCents(orderLines.filter((l) => l.type === 'goods'), (l) => l.marginCents)
  const open = i >= DATES.length - 4
  const flags: string[] = []
  if (client - supplier < 0) flags.push('LOSS-MAKING order')
  if (shipClient < shipSupplier) flags.push('Shipping under-recharged')
  if (open) flags.push('Client overdue 10 days (sample)')
  orders.push({
    id, date, customerId: cust.id, customerName: cust.name, supplierId: SUPPLIER.id, supplierName: SUPPLIER.name,
    clientInvoiceNo: `S-INV-${1000 + i}`, supplierInvoiceNo: `S-BILL-${5000 + i}`,
    clientTotalCents: client, supplierTotalCents: supplier, grossMarginCents: client - supplier,
    goodsMarginCents: goods, shippingMarginCents: shipClient - shipSupplier,
    ledgerMarginRatio: (client - supplier) / client,
    clientStatus: open ? 'AUTHORISED' : 'PAID', clientOwesCents: open ? client : 0,
    supplierStatus: open && i % 2 === 0 ? 'AUTHORISED' : 'PAID', weOweSupplierCents: open && i % 2 === 0 ? supplier : 0,
    clientOwesMinusWeOweCents: (open ? client : 0) - (open && i % 2 === 0 ? supplier : 0),
    flags,
    clientPdf: { fileName: `sample-invoice-${1000 + i}.pdf` }, supplierPdf: { fileName: `sample-bill-${5000 + i}.pdf` },
  })
})

const creditNotes: CreditNote[] = [
  { side: 'client', number: 'S-CN-01', date: '2026-08-12', amountCents: 250000, refersToInvoices: 'S-INV-1007', orderIds: ['SAMPLE-008'], covers: 'Returned units (fake)', xeroShows: 'Sample', check: 'Sample data' },
  { side: 'supplier', number: 'S-SCN-01', date: '2026-08-10', amountCents: 240000, refersToInvoices: 'S-BILL-5007', orderIds: ['SAMPLE-008'], covers: 'Returned units (fake)', xeroShows: 'Sample', check: 'Sample data' },
  { side: 'supplier', number: 'S-SCN-02', date: '2026-08-20', amountCents: 90000, refersToInvoices: 'S-BILL-5008 & S-BILL-5009', orderIds: ['SAMPLE-009', 'SAMPLE-010'], covers: 'Price adjustment across two orders (fake)', xeroShows: 'Sample', check: 'Sample data' },
]

const exceptions: LedgerException[] = [
  { id: 'EX-01', priority: 'HIGH', reference: 'SAMPLE-007', orderId: 'SAMPLE-007', issue: 'Loss-making sample order.', impactCents: orders[6].grossMarginCents, suggestedAction: 'Sample data: no action.' },
  { id: 'EX-02', priority: 'MEDIUM', reference: 'SAMPLE-013', orderId: 'SAMPLE-013', issue: 'Client invoice overdue (sample).', impactCents: orders[12].clientTotalCents, suggestedAction: 'Sample data: no action.' },
  { id: 'EX-03', priority: 'LOW', reference: 'All orders', orderId: null, issue: 'This is fake sample data for development.', impactCents: 0, suggestedAction: 'Import the real ledger with npm run import.' },
]

const units = unitsByOrder(lines)
const t = totals(orders, units)
const c = creditTotals(creditNotes, orders, {})
const cash = cashPosition(orders)

const ledger: Ledger = {
  meta: { sourceFile: 'sample (generated)', importedAt: '2026-10-04T00:00:00.000Z', snapshotDate: '2026-10-04', currency: 'EUR', isSample: true },
  summary: {
    ordersMatched: orders.length, clientTotalCents: t.salesCents, supplierTotalCents: t.costCents, grossMarginCents: t.grossProfitCents,
    clientCreditsCents: c.clientCreditsCents, supplierCreditsCents: c.supplierCreditsCents, marginAfterCreditsCents: t.grossProfitCents + c.netEffectCents,
    clientsOweCents: cash.clientsOweCents, weOweSupplierCents: cash.weOweSupplierCents,
    ordersWithFlag: orders.filter((o) => o.flags.length).length,
    byCustomer: CUSTOMERS.map((cu) => {
      const os = orders.filter((o) => o.customerId === cu.id)
      return { customerName: cu.name, orders: os.length, clientTotalCents: sumCents(os, (o) => o.clientTotalCents), grossMarginCents: sumCents(os, (o) => o.grossMarginCents) }
    }).filter((x) => x.orders > 0),
  },
  totalRow: {
    clientTotalCents: t.salesCents, supplierTotalCents: t.costCents, grossMarginCents: t.grossProfitCents,
    goodsMarginCents: t.goodsMarginCents, shippingMarginCents: t.shippingMarginCents,
    clientOwesCents: cash.clientsOweCents, weOweSupplierCents: cash.weOweSupplierCents,
  },
  customers: CUSTOMERS.filter((cu) => orders.some((o) => o.customerId === cu.id)).map(({ id, name }) => ({ id, name })),
  suppliers: [SUPPLIER],
  orders, lines, creditNotes, exceptions,
}

const out = path.join('data', 'sample', 'ledger.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(ledger, null, 2) + '\n')
console.log(`Wrote ${out}: ${orders.length} fake orders`)
