/**
 * The invoice matcher: pair each Xero sales invoice with the supplier bill for the same goods,
 * and turn confirmed pairs into dashboard orders. Pure functions, tested against the ledger's
 * 34 known pairs.
 *
 * Fone Nova buys and sells the same stock within days at a thin margin, so the bill for an
 * invoice is the EUR bill dated close to it whose total is slightly below it. Across the ledger
 * the bill sits between 0.12% above and 6.43% below the invoice.
 */
import { orderMargin } from '../metrics'
import type { CreditNote, IsoDate, Ledger, Order, OrderLine, XeroCreditNote, XeroInvoice, XeroPair, XeroSnapshot } from '../types'
import { matchOrders } from './map'

/** Bill total as a share below the invoice total that still counts as a likely pair. */
const MIN_MARGIN = -0.01
const MAX_MARGIN = 0.08
const MAX_DAYS = 10
/** Typical margin, so among several fits the most ordinary one ranks first. */
const TYPICAL_MARGIN = 0.017

const ORDER_REF = /\bFN-ORD-(\d{3,})\b/i

const usable = (i: XeroInvoice) => i.currency === 'EUR' && !['VOIDED', 'DELETED'].includes(i.status)
const days = (a: IsoDate | null, b: IsoDate | null) => (a && b ? Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000 : MAX_DAYS)

export interface Suggestion {
  invoice: XeroInvoice
  /** Best-fitting free bill, or null when none fits. */
  bill: XeroInvoice | null
  margin: number | null
  dayGap: number | null
}

export interface Matching {
  /** Pairs made without asking: both sides carry the same FN-ORD reference. */
  auto: XeroPair[]
  /** Sales invoices still without a partner, with the best guess for each. */
  suggestions: Suggestion[]
  /** EUR bills no order uses yet. */
  freeBills: XeroInvoice[]
}

/** How well a bill fits an invoice; lower is better, null means it does not fit. */
export function fit(invoice: XeroInvoice, bill: XeroInvoice): { score: number; margin: number; dayGap: number } | null {
  if (!invoice.totalCents) return null
  const margin = 1 - bill.totalCents / invoice.totalCents
  const dayGap = days(invoice.date, bill.date)
  if (margin < MIN_MARGIN || margin > MAX_MARGIN || dayGap > MAX_DAYS) return null
  return { score: Math.abs(margin - TYPICAL_MARGIN) * 100 + dayGap * 0.15, margin, dayGap }
}

/**
 * Work out what still needs matching. Documents the ledger already pairs (by invoice number or
 * Order ID) and confirmed pairs are left out, so nothing is ever counted twice.
 */
export function matchInvoices(args: { invoices: readonly XeroInvoice[]; ledgerOrders: readonly Order[]; pairs: readonly XeroPair[]; since?: IsoDate | null }): Matching {
  const docs = args.invoices.filter((i) => usable(i) && (!args.since || !i.date || i.date >= args.since))
  const used = new Set<string>()
  for (const m of matchOrders(args.ledgerOrders, args.invoices).values()) {
    if (m.client) used.add(m.client.id)
    if (m.bill) used.add(m.bill.id)
  }
  for (const p of args.pairs) {
    used.add(p.invoiceId)
    used.add(p.billId)
  }
  let sales = docs.filter((i) => i.kind === 'sale' && !used.has(i.id))
  let bills = docs.filter((i) => i.kind === 'bill' && !used.has(i.id))

  // Same FN-ORD reference on both sides: pair them straight away.
  const auto: XeroPair[] = []
  for (const s of sales) {
    const ref = ORDER_REF.exec(s.reference)?.[1]
    if (!ref) continue
    const b = bills.find((x) => ORDER_REF.exec(x.reference)?.[1] === ref)
    if (!b) continue
    auto.push({ orderId: `FN-ORD-${ref}`, invoiceId: s.id, billId: b.id, confirmedAt: 'reference' })
    bills = bills.filter((x) => x.id !== b.id)
  }
  const autoSales = new Set(auto.map((p) => p.invoiceId))
  sales = sales.filter((s) => !autoSales.has(s.id))

  // Best overall fit first, so one bill is never offered to two invoices.
  const candidates = sales.flatMap((s) => bills.map((b) => ({ s, b, f: fit(s, b) }))).filter((c) => c.f) as { s: XeroInvoice; b: XeroInvoice; f: NonNullable<ReturnType<typeof fit>> }[]
  candidates.sort((x, y) => x.f.score - y.f.score)
  const chosen = new Map<string, { b: XeroInvoice; margin: number; dayGap: number }>()
  const taken = new Set<string>()
  for (const c of candidates) {
    if (chosen.has(c.s.id) || taken.has(c.b.id)) continue
    chosen.set(c.s.id, { b: c.b, margin: c.f.margin, dayGap: c.f.dayGap })
    taken.add(c.b.id)
  }
  const suggestions = sales
    .map((invoice) => {
      const c = chosen.get(invoice.id)
      return { invoice, bill: c?.b ?? null, margin: c?.margin ?? null, dayGap: c ? Math.round(c.dayGap) : null }
    })
    .sort((a, b) => (b.invoice.date ?? '').localeCompare(a.invoice.date ?? ''))
  return { auto, suggestions, freeBills: bills }
}

/** Next free order number after the ledger's and every pair's. */
export function nextOrderId(existing: readonly string[]): string {
  const max = existing.reduce((n, id) => Math.max(n, Number(ORDER_REF.exec(id)?.[1] ?? 0)), 0)
  return `FN-ORD-${String(max + 1).padStart(3, '0')}`
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const SHIPPING = /shipping|freight|delivery|courier|carriage/i

function status(i: XeroInvoice): Order['clientStatus'] {
  if (i.status === 'PAID') return 'PAID'
  if (i.status === 'AUTHORISED' || i.status === 'SUBMITTED') return 'AUTHORISED'
  return 'UNKNOWN'
}

function overdueDays(i: XeroInvoice, today: IsoDate): number | null {
  if (!i.dueDate || i.amountDueCents <= 0) return null
  const d = Math.round((Date.parse(today) - Date.parse(i.dueDate)) / 86_400_000)
  return d > 0 ? d : null
}

/**
 * Orders from confirmed (and reference) pairs, in the same shape as ledger orders, so every page
 * uses them unchanged. Customer and supplier ids reuse the ledger's when the names match.
 */
export function buildXeroOrders(args: {
  pairs: readonly XeroPair[]
  invoices: readonly XeroInvoice[]
  today: IsoDate
  knownParties?: { id: string; name: string }[]
}): { orders: Order[]; lines: OrderLine[] } {
  const byId = new Map(args.invoices.map((i) => [i.id, i]))
  const known = new Map((args.knownParties ?? []).map((p) => [slug(p.name), p.id]))
  const party = (name: string) => known.get(slug(name)) ?? slug(name)
  const orders: Order[] = []
  const lines: OrderLine[] = []
  for (const p of args.pairs) {
    const inv = byId.get(p.invoiceId)
    const bill = byId.get(p.billId)
    if (!inv || !bill) continue // a document deleted in Xero since: drop quietly, Matching shows the other side again
    const shipSale = (inv.lines ?? []).filter((l) => SHIPPING.test(l.description)).reduce((n, l) => n + l.amountCents, 0)
    const shipCost = (bill.lines ?? []).filter((l) => SHIPPING.test(l.description)).reduce((n, l) => n + l.amountCents, 0)
    const gross = inv.totalCents - bill.totalCents
    const shippingMargin = shipSale - shipCost
    const flags: string[] = []
    const co = overdueDays(inv, args.today)
    const so = overdueDays(bill, args.today)
    if (co) flags.push(`Client overdue ${co} days`)
    if (so) flags.push(`Supplier overdue ${so} days`)
    if (bill.status === 'DRAFT') flags.push('Bill still a draft in Xero')
    if (inv.status === 'DRAFT') flags.push('Invoice still a draft in Xero')
    const o: Order = {
      id: p.orderId,
      date: inv.date ?? bill.date ?? args.today,
      customerId: party(inv.contactName),
      customerName: inv.contactName,
      supplierId: party(bill.contactName),
      supplierName: bill.contactName,
      clientInvoiceNo: inv.number,
      supplierInvoiceNo: bill.number || bill.reference,
      clientTotalCents: inv.totalCents,
      supplierTotalCents: bill.totalCents,
      grossMarginCents: gross,
      goodsMarginCents: gross - shippingMargin,
      shippingMarginCents: shippingMargin,
      ledgerMarginRatio: null,
      clientStatus: status(inv),
      clientOwesCents: inv.amountDueCents,
      supplierStatus: status(bill),
      weOweSupplierCents: bill.amountDueCents,
      clientOwesMinusWeOweCents: inv.amountDueCents - bill.amountDueCents,
      flags,
      clientPdf: { fileName: null },
      supplierPdf: { fileName: null },
      live: { clientDueDate: inv.dueDate, billDueDate: bill.dueDate, clientPayments: inv.payments, billPayments: bill.payments },
      source: 'xero',
    }
    const m = orderMargin(o)
    if (gross < 0) o.flags.unshift('LOSS-MAKING order')
    else if (m !== null && m < 0.005) o.flags.push('Margin under 0.5%')
    orders.push(o)

    // Lines: the invoice's, with the bill line of the same description as its cost.
    const billLines = [...(bill.lines ?? [])]
    ;(inv.lines ?? []).forEach((l, n) => {
      const k = billLines.findIndex((b) => b.description.toLowerCase() === l.description.toLowerCase())
      const cost = k >= 0 ? billLines.splice(k, 1)[0] : null
      const type = SHIPPING.test(l.description) ? 'shipping' : 'goods'
      lines.push({
        orderId: o.id,
        lineNo: n + 1,
        type,
        description: l.description,
        qty: l.quantity,
        clientUnitCents: l.unitCents,
        supplierUnitCents: cost?.unitCents ?? 0,
        clientAmountCents: l.amountCents,
        supplierAmountCents: cost?.amountCents ?? 0,
        marginCents: l.amountCents - (cost?.amountCents ?? 0),
        marginPerUnitCents: l.quantity ? Math.round((l.amountCents - (cost?.amountCents ?? 0)) / l.quantity) : 0,
        note: cost ? null : 'No bill line with the same description',
      })
    })
  }
  return { orders, lines }
}

/** Credit notes Xero has that the ledger does not, linked to orders through what they were allocated to. */
export function xeroCreditNotes(notes: readonly XeroCreditNote[], orders: readonly Order[], ledgerNotes: readonly CreditNote[], after: IsoDate | null = null): CreditNote[] {
  const known = new Set(ledgerNotes.map((n) => n.number.toLowerCase()))
  // Xero may number the ledger's own credits differently, so also treat a credit with the same
  // side, amount and (near) date as the same one.
  const sameAsLedger = (n: XeroCreditNote) =>
    ledgerNotes.some((l) => l.side === (n.kind === 'sale' ? 'client' : 'supplier') && Math.abs(l.amountCents - n.totalCents) <= 1 && (!n.date || !l.date || Math.abs(Date.parse(l.date) - Date.parse(n.date)) <= 7 * 86_400_000))
  const byInvoice = new Map<string, string>()
  for (const o of orders) {
    if (o.clientInvoiceNo) byInvoice.set(`sale:${o.clientInvoiceNo.toLowerCase()}`, o.id)
    if (o.supplierInvoiceNo) byInvoice.set(`bill:${o.supplierInvoiceNo.toLowerCase()}`, o.id)
  }
  return notes
    .filter((n) => n.currency === 'EUR' && ['AUTHORISED', 'PAID'].includes(n.status) && !known.has(n.number.toLowerCase()) && !sameAsLedger(n))
    // The ledger is the record up to its snapshot; only credits after it are new.
    .filter((n) => !after || (n.date !== null && n.date > after))
    .map((n) => {
      const orderIds = [...new Set(n.allocatedTo.map((no) => byInvoice.get(`${n.kind}:${no.toLowerCase()}`)).filter(Boolean) as string[])]
      return {
        side: n.kind === 'sale' ? 'client' : 'supplier',
        number: n.number,
        date: n.date ?? '',
        amountCents: n.totalCents,
        refersToInvoices: n.allocatedTo.join(', '),
        orderIds,
        covers: n.reference,
        xeroShows: 'From Xero',
        check: orderIds.length ? '' : 'Not allocated to an invoice in Xero yet',
      } satisfies CreditNote
    })
}

/**
 * The ledger as the dashboard shows it: ledger orders, plus orders from confirmed and
 * reference-matched Xero pairs, plus Xero credit notes the ledger lacks. Anything the ledger
 * already pairs stays the ledger's, so no order or credit is counted twice.
 */
export function withXero(ledger: Ledger, snapshot: XeroSnapshot | null, pairs: readonly XeroPair[], today: IsoDate): { ledger: Ledger; matching: Matching | null } {
  if (!snapshot) return { ledger, matching: null }
  const since = ledger.orders.map((o) => o.date).sort()[0] ?? null
  const matching = matchInvoices({ invoices: snapshot.invoices, ledgerOrders: ledger.orders, pairs, since })
  const taken = new Set(ledger.orders.map((o) => o.id))
  const all = [...pairs, ...matching.auto].filter((p) => !taken.has(p.orderId))
  const built = buildXeroOrders({ pairs: all, invoices: snapshot.invoices, today, knownParties: [...ledger.customers, ...ledger.suppliers] })
  if (!built.orders.length && !(snapshot.creditNotes ?? []).length) return { ledger, matching }
  const orders = [...ledger.orders, ...built.orders]
  const addParties = (list: { id: string; name: string }[], more: { id: string; name: string }[]) => {
    const ids = new Set(list.map((x) => x.id))
    return [...list, ...more.filter((x) => !ids.has(x.id) && (ids.add(x.id), true))]
  }
  return {
    ledger: {
      ...ledger,
      orders,
      lines: [...ledger.lines, ...built.lines],
      customers: addParties(ledger.customers, built.orders.map((o) => ({ id: o.customerId, name: o.customerName }))),
      suppliers: addParties(ledger.suppliers, built.orders.map((o) => ({ id: o.supplierId, name: o.supplierName }))),
      creditNotes: [...ledger.creditNotes, ...xeroCreditNotes(snapshot.creditNotes ?? [], orders, ledger.creditNotes, ledger.meta.snapshotDate)],
    },
    matching,
  }
}

/** Synced invoices and bills still waiting for someone to approve them in Xero, newest first. */
export function draftsAwaiting(snapshot: XeroSnapshot | null): XeroInvoice[] {
  return (snapshot?.invoices ?? []).filter((i) => i.status === 'DRAFT').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/** Where to open a document in Xero. */
export function xeroLink(i: Pick<XeroInvoice, 'id' | 'kind'>): string {
  return i.kind === 'sale'
    ? `https://go.xero.com/AccountsReceivable/Edit.aspx?InvoiceID=${encodeURIComponent(i.id)}`
    : `https://go.xero.com/AccountsPayable/Edit.aspx?InvoiceID=${encodeURIComponent(i.id)}`
}
