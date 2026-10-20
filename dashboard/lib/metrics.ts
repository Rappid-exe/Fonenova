/**
 * Every figure the dashboard shows is calculated here, from integer cents.
 * Components format numbers; they never add them up.
 */
import { ratio, sumCents } from './money'
import { addDays, bucketKey, buckets, formatDate, inRange, monthEnd, monthStart, type DateRange, type Granularity } from './periods'
import { classifyExpense, type Classified } from './expenses'
import type { Cents, CreditNote, Expense, ExpenseClass, ExpenseLog, ExpenseOverrides, FxConversion, FxRate, InvoiceStatus, IsoDate, Ledger, LiveOrderStatus, Order, OrderLine, Overhead, XeroBankBalance, XeroInvoice } from './types'

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface OrderFilter {
  range?: DateRange | null
  customerId?: string | null
}

export function filterOrders(orders: readonly Order[], f: OrderFilter): Order[] {
  return orders.filter(
    (o) => (!f.range || inRange(o.date, f.range)) && (!f.customerId || o.customerId === f.customerId),
  )
}

// ---------------------------------------------------------------------------
// Margin rules (the ledger's own: amber under 0.5%, red below zero)
// ---------------------------------------------------------------------------

export const THIN_MARGIN = 0.005

export type MarginBand = 'loss' | 'thin' | 'ok' | 'none'

export function marginBand(r: number | null): MarginBand {
  if (r === null) return 'none'
  if (r < 0) return 'loss'
  if (r < THIN_MARGIN) return 'thin'
  return 'ok'
}

export function orderMargin(o: Order): number | null {
  return ratio(o.grossMarginCents, o.clientTotalCents)
}

// ---------------------------------------------------------------------------
// Units and lines
// ---------------------------------------------------------------------------

/** Units per order = sum of Qty on goods lines only. Shipping rows carry Qty 1 and are not units. */
export function unitsByOrder(lines: readonly OrderLine[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of lines) {
    if (l.type !== 'goods') continue
    m.set(l.orderId, (m.get(l.orderId) ?? 0) + l.qty)
  }
  return m
}

export function linesFor(lines: readonly OrderLine[], orderId: string): OrderLine[] {
  return lines.filter((l) => l.orderId === orderId).sort((a, b) => a.lineNo - b.lineNo)
}

// ---------------------------------------------------------------------------
// Period totals
// ---------------------------------------------------------------------------

export interface Totals {
  orderCount: number
  units: number
  salesCents: Cents
  costCents: Cents
  grossProfitCents: Cents
  goodsMarginCents: Cents
  shippingMarginCents: Cents
  marginRatio: number | null
  avgProfitPerOrderCents: Cents | null
  lossMakingCount: number
  thinMarginCount: number
}

export function totals(orders: readonly Order[], units: Map<string, number>): Totals {
  const salesCents = sumCents(orders, (o) => o.clientTotalCents)
  const costCents = sumCents(orders, (o) => o.supplierTotalCents)
  const grossProfitCents = sumCents(orders, (o) => o.grossMarginCents)
  return {
    orderCount: orders.length,
    units: orders.reduce((n, o) => n + (units.get(o.id) ?? 0), 0),
    salesCents,
    costCents,
    grossProfitCents,
    goodsMarginCents: sumCents(orders, (o) => o.goodsMarginCents),
    shippingMarginCents: sumCents(orders, (o) => o.shippingMarginCents),
    marginRatio: ratio(grossProfitCents, salesCents),
    avgProfitPerOrderCents: orders.length ? Math.round(grossProfitCents / orders.length) : null,
    lossMakingCount: orders.filter((o) => marginBand(orderMargin(o)) === 'loss').length,
    thinMarginCount: orders.filter((o) => marginBand(orderMargin(o)) === 'thin').length,
  }
}

// ---------------------------------------------------------------------------
// Credit notes
// ---------------------------------------------------------------------------

export interface CreditAllocation {
  /** Credits that reference exactly one order. */
  byOrder: Map<string, CreditNote[]>
  /** Credits spanning several orders. Never split evenly; shown at portfolio level. */
  unallocated: CreditNote[]
}

export function allocateCredits(notes: readonly CreditNote[]): CreditAllocation {
  const byOrder = new Map<string, CreditNote[]>()
  const unallocated: CreditNote[] = []
  for (const n of notes) {
    if (n.orderIds.length === 1) {
      const id = n.orderIds[0]
      byOrder.set(id, [...(byOrder.get(id) ?? []), n])
    } else {
      unallocated.push(n)
    }
  }
  return { byOrder, unallocated }
}

export interface CreditTotals {
  notes: CreditNote[]
  clientCreditsCents: Cents
  supplierCreditsCents: Cents
  /** Supplier credits received minus client credits issued. */
  netEffectCents: Cents
  unallocated: CreditNote[]
  /** Credits left out because they span customers other than the filtered one. */
  excludedMixedCustomer: CreditNote[]
}

/**
 * Credits count in the period of their own credit note date. With a customer filter, a credit
 * counts only when every order it references belongs to that customer.
 */
export function creditTotals(
  notes: readonly CreditNote[],
  orders: readonly Order[],
  f: OrderFilter,
): CreditTotals {
  const customerOf = new Map(orders.map((o) => [o.id, o.customerId]))
  const inScope: CreditNote[] = []
  const excludedMixedCustomer: CreditNote[] = []
  for (const n of notes) {
    if (f.range && !inRange(n.date, f.range)) continue
    if (f.customerId) {
      const custs = new Set(n.orderIds.map((id) => customerOf.get(id)))
      if (!custs.has(f.customerId)) continue
      if (custs.size > 1) {
        excludedMixedCustomer.push(n)
        continue
      }
    }
    inScope.push(n)
  }
  const clientCreditsCents = sumCents(inScope.filter((n) => n.side === 'client'), (n) => n.amountCents)
  const supplierCreditsCents = sumCents(inScope.filter((n) => n.side === 'supplier'), (n) => n.amountCents)
  return {
    notes: inScope,
    clientCreditsCents,
    supplierCreditsCents,
    netEffectCents: supplierCreditsCents - clientCreditsCents,
    unallocated: inScope.filter((n) => n.orderIds.length !== 1),
    excludedMixedCustomer,
  }
}

/** Gross profit after credit notes = gross margin + supplier credits - client credits. */
export function profitAfterCredits(grossProfitCents: Cents, c: Pick<CreditTotals, 'netEffectCents'>): Cents {
  return grossProfitCents + c.netEffectCents
}

// ---------------------------------------------------------------------------
// Period comparison
// ---------------------------------------------------------------------------

export interface Change {
  delta: number
  /** Relative change. Null when the previous value is zero, where a percentage means nothing. */
  pct: number | null
}

export function change(current: number, previous: number): Change {
  return { delta: current - previous, pct: previous === 0 ? null : (current - previous) / Math.abs(previous) }
}

/** Margin change in percentage points. Null if either period has no sales. */
export function marginChangePts(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return (current - previous) * 100
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  key: string
  label: string
  start: string
  end: string
  orderCount: number
  salesCents: Cents
  costCents: Cents
  grossProfitCents: Cents
  /** Null for a bucket with no orders, so lines show a gap rather than a fake zero margin. */
  marginRatio: number | null
}

export function timeSeries(orders: readonly Order[], range: DateRange, g: Granularity): SeriesPoint[] {
  const grouped = new Map<string, Order[]>()
  for (const o of orders) {
    if (!inRange(o.date, range)) continue
    const k = bucketKey(o.date, g)
    grouped.set(k, [...(grouped.get(k) ?? []), o])
  }
  return buckets(range, g).map((b) => {
    const os = grouped.get(b.key) ?? []
    const sales = sumCents(os, (o) => o.clientTotalCents)
    const gross = sumCents(os, (o) => o.grossMarginCents)
    return {
      key: b.key,
      label: b.label,
      start: b.start,
      end: b.end,
      orderCount: os.length,
      salesCents: sales,
      costCents: sumCents(os, (o) => o.supplierTotalCents),
      grossProfitCents: gross,
      marginRatio: os.length ? ratio(gross, sales) : null,
    }
  })
}

// ---------------------------------------------------------------------------
// Customer concentration
// ---------------------------------------------------------------------------

export interface CustomerShare {
  customerId: string
  customerName: string
  orderCount: number
  salesCents: Cents
  grossProfitCents: Cents
  salesShare: number | null
  profitShare: number | null
  marginRatio: number | null
}

export function concentration(orders: readonly Order[]): CustomerShare[] {
  const totalSales = sumCents(orders, (o) => o.clientTotalCents)
  const totalGross = sumCents(orders, (o) => o.grossMarginCents)
  const by = new Map<string, Order[]>()
  for (const o of orders) by.set(o.customerId, [...(by.get(o.customerId) ?? []), o])
  return [...by.entries()]
    .map(([customerId, os]) => {
      const sales = sumCents(os, (o) => o.clientTotalCents)
      const gross = sumCents(os, (o) => o.grossMarginCents)
      return {
        customerId,
        customerName: os[0].customerName,
        orderCount: os.length,
        salesCents: sales,
        grossProfitCents: gross,
        salesShare: ratio(sales, totalSales),
        profitShare: totalGross > 0 ? gross / totalGross : null,
        marginRatio: ratio(gross, sales),
      }
    })
    .sort((a, b) => b.salesCents - a.salesCents)
}

// ---------------------------------------------------------------------------
// Cash position (Xero snapshot)
// ---------------------------------------------------------------------------

export interface OpenOrder {
  order: Order
  clientOwesCents: Cents | null
  weOweCents: Cents
  /** Fone Nova owes the supplier while the client has not paid (or is not in Xero). */
  fundingGap: boolean
}

export interface CashPosition {
  clientsOweCents: Cents
  weOweSupplierCents: Cents
  differenceCents: Cents
  fundingGapCents: Cents
  open: OpenOrder[]
  unknownClientBalances: number
}

export function cashPosition(orders: readonly Order[]): CashPosition {
  const open: OpenOrder[] = []
  for (const o of orders) {
    const clientOwes = o.clientOwesCents
    const weOwe = o.weOweSupplierCents ?? 0
    const clientOpen = clientOwes === null || clientOwes !== 0
    if (!clientOpen && weOwe === 0) continue
    open.push({
      order: o,
      clientOwesCents: clientOwes,
      weOweCents: weOwe,
      fundingGap: weOwe > 0 && (clientOwes === null || clientOwes > 0),
    })
  }
  open.sort((a, b) => Number(b.fundingGap) - Number(a.fundingGap) || b.weOweCents - a.weOweCents || (b.clientOwesCents ?? 0) - (a.clientOwesCents ?? 0))
  const clientsOweCents = sumCents(orders, (o) => o.clientOwesCents)
  const weOweSupplierCents = sumCents(orders, (o) => o.weOweSupplierCents)
  return {
    clientsOweCents,
    weOweSupplierCents,
    differenceCents: clientsOweCents - weOweSupplierCents,
    fundingGapCents: sumCents(open.filter((x) => x.fundingGap), (x) => x.weOweCents),
    open,
    unknownClientBalances: orders.filter((o) => o.clientOwesCents === null).length,
  }
}

// ---------------------------------------------------------------------------
// Currency conversion (display only; booked figures stay in their own currency)
// ---------------------------------------------------------------------------

export type Currency = 'EUR' | 'GBP'

/**
 * Convert one figure at the reference rate, rounding once to the cent. Convert each figure you
 * show from its own booked total; never add converted figures to unconverted ones. Returns null
 * when a conversion is needed and no rate is available, so the caller cannot fall back to a guess.
 */
export function convertCents(cents: Cents, from: Currency, to: Currency, fx: FxRate | null): Cents | null {
  if (from === to || cents === 0) return cents
  if (!fx || !(fx.rate > 0)) return null
  const v = from === 'EUR' ? Math.round(cents * fx.rate) : Math.round(cents / fx.rate)
  return v === 0 ? 0 : v
}

// ---------------------------------------------------------------------------
// Overheads and net profit
// ---------------------------------------------------------------------------

export interface OverheadCharge {
  date: IsoDate
  overhead: Overhead
  amountCents: Cents
}

/** An overhead counts only once its amount and start date are entered. */
export function overheadReady(o: Overhead): boolean {
  return o.amountCents !== null && o.startDate !== null
}

/** Every date an overhead is taken inside the range. Day 31 lands on 30 Apr, 28 Feb, and so on. */
export function overheadCharges(overheads: readonly Overhead[], range: DateRange): OverheadCharge[] {
  const out: OverheadCharge[] = []
  for (const o of overheads) {
    if (!overheadReady(o)) continue
    let m = monthStart(range.start)
    while (m <= range.end) {
      const end = monthEnd(m)
      const day = Math.min(Math.max(1, Math.trunc(o.dayOfMonth)), Number(end.slice(8)))
      const date = `${m.slice(0, 8)}${String(day).padStart(2, '0')}`
      if (inRange(date, range) && date >= o.startDate! && (!o.endDate || date <= o.endDate)) {
        out.push({ date, overhead: o, amountCents: o.amountCents! })
      }
      m = addDays(end, 1)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.overhead.name.localeCompare(b.overhead.name))
}

export type ByCurrency = Record<Currency, Cents>

export function sumByCurrency(charges: readonly { amountCents: Cents; overhead: Overhead }[]): ByCurrency {
  const out: ByCurrency = { EUR: 0, GBP: 0 }
  for (const c of charges) out[c.overhead.currency] += c.amountCents
  return out
}

/** Monthly cost of overheads active on `onDate`, per currency. Never mixed. */
export function monthlyOverheads(overheads: readonly Overhead[], onDate: IsoDate, category?: Overhead['category']): ByCurrency {
  const out: ByCurrency = { EUR: 0, GBP: 0 }
  for (const o of overheads) {
    if (!overheadReady(o) || (category && o.category !== category)) continue
    if (o.startDate! > onDate || (o.endDate && o.endDate < onDate)) continue
    out[o.currency] += o.amountCents!
  }
  return out
}

// ---------------------------------------------------------------------------
// Expense log
// ---------------------------------------------------------------------------

export interface ExpenseRow {
  expense: Expense
  auto: Classified
  cls: ExpenseClass
  overridden: boolean
  /** The overhead schedule already charges this cost, so it is not counted again. */
  coveredBy: string | null
}

export interface ExpenseSummary {
  rows: ExpenseRow[]
  /** First and last date in the whole log, so screens can say what period it covers. */
  coverage: { start: IsoDate; end: IsoDate } | null
  /** Business costs counted in net profit (GBP pence). */
  businessCents: Cents
  coveredByOverheadCents: Cents
  reviewCents: Cents
  personalCents: Cents
  /** VAT reclaimed on rows that are not confirmed business. */
  vatAtRiskCents: Cents
  vatOnBusinessCents: Cents
  byCategory: { category: string; cls: ExpenseClass; cents: Cents; count: number }[]
}

export function expenseSummary(log: ExpenseLog | null, overrides: ExpenseOverrides, overheads: readonly Overhead[], range: DateRange | null): ExpenseSummary {
  const all = log?.expenses ?? []
  const dates = all.map((e) => e.date).sort()
  const rows: ExpenseRow[] = all
    .filter((e) => !range || inRange(e.date, range))
    .map((e) => {
      const auto = classifyExpense(e)
      const cls = overrides[e.id] ?? auto.cls
      const linked = auto.overheadId ? overheads.find((o) => o.id === auto.overheadId && overheadReady(o)) : undefined
      return { expense: e, auto, cls, overridden: overrides[e.id] !== undefined && overrides[e.id] !== auto.cls, coveredBy: linked ? linked.name : null }
    })
    .sort((a, b) => b.expense.date.localeCompare(a.expense.date) || b.expense.amountCents - a.expense.amountCents)
  const sum = (f: (r: ExpenseRow) => boolean, v: (r: ExpenseRow) => Cents = (r) => r.expense.amountCents) => rows.filter(f).reduce((n, r) => n + v(r), 0)
  const cats = new Map<string, { category: string; cls: ExpenseClass; cents: Cents; count: number }>()
  for (const r of rows) {
    const key = `${r.cls}|${r.auto.category}`
    const c = cats.get(key) ?? { category: r.auto.category, cls: r.cls, cents: 0, count: 0 }
    c.cents += r.expense.amountCents
    c.count++
    cats.set(key, c)
  }
  return {
    rows,
    coverage: dates.length ? { start: dates[0], end: dates.at(-1)! } : null,
    businessCents: sum((r) => r.cls === 'business' && !r.coveredBy),
    coveredByOverheadCents: sum((r) => !!r.coveredBy),
    reviewCents: sum((r) => r.cls === 'review' && !r.coveredBy),
    personalCents: sum((r) => r.cls === 'personal'),
    vatAtRiskCents: sum((r) => r.cls !== 'business', (r) => r.expense.vatCents),
    vatOnBusinessCents: sum((r) => r.cls === 'business', (r) => r.expense.vatCents),
    byCategory: [...cats.values()].sort((a, b) => b.cents - a.cents),
  }
}

export interface FxSummary {
  count: number
  eurCents: Cents
  gbpCents: Cents
  feeCents: Cents
  /** GBP received per EUR, before the separate fee. */
  effectiveRate: number | null
  feeShare: number | null
}

export function fxSummary(conversions: readonly FxConversion[], range: DateRange | null): FxSummary {
  const cs = conversions.filter((c) => !range || inRange(c.date, range))
  const eur = cs.reduce((n, c) => n + c.eurCents, 0)
  const gbp = cs.reduce((n, c) => n + c.gbpCents, 0)
  const fee = cs.reduce((n, c) => n + c.feeCents, 0)
  return { count: cs.length, eurCents: eur, gbpCents: gbp, feeCents: fee, effectiveRate: eur ? gbp / eur : null, feeShare: gbp ? fee / gbp : null }
}

export type NetProfit =
  | { status: 'not-entered' }
  | { status: 'needs-rate' }
  | {
      status: 'ok'
      /** Costs counted from the period start up to this date (today, or the period end if earlier). */
      chargedTo: IsoDate
      charges: OverheadCharge[]
      businessOverheads: ByCurrency
      /** Business costs from the expense log, GBP pence. */
      businessExpensesCents: Cents
      /** Net business profit, in each currency. Each is converted once from its booked figures. */
      netEurCents: Cents
      netGbpCents: Cents
      /** Plain-words caveats: overheads not entered, expense log not covering the whole period. */
      warnings: string[]
    }

/**
 * Net business profit = gross profit after credit notes, minus business overheads taken in the
 * period, minus business costs from the expense log. Personal and unreviewed items never come
 * off business profit. Costs count up to today, not future dates.
 */
export function netBusinessProfit(args: {
  grossAfterCreditsEurCents: Cents
  overheads: readonly Overhead[]
  range: DateRange
  today: IsoDate
  fx: FxRate | null
  expenses?: ExpenseLog | null
  overrides?: ExpenseOverrides
}): NetProfit {
  const chargedTo = args.range.end < args.today ? args.range.end : args.today
  const window = args.range.start > chargedTo ? null : { start: args.range.start, end: chargedTo }
  const business = args.overheads.filter((o) => o.category === 'business')
  const ready = business.filter(overheadReady)
  const charges = window ? overheadCharges(ready, window) : []
  const exp = window ? expenseSummary(args.expenses ?? null, args.overrides ?? {}, args.overheads, window) : null
  const expCents = exp?.businessCents ?? 0
  if (ready.length === 0 && expCents === 0) return { status: 'not-entered' }

  const sums = sumByCurrency(charges)
  const gbpCosts = sums.GBP + expCents
  const gbpAsEur = convertCents(gbpCosts, 'GBP', 'EUR', args.fx)
  const eurAsGbp = convertCents(sums.EUR, 'EUR', 'GBP', args.fx)
  const grossGbp = convertCents(args.grossAfterCreditsEurCents, 'EUR', 'GBP', args.fx)
  if (gbpAsEur === null || eurAsGbp === null || grossGbp === null) return { status: 'needs-rate' }

  const warnings: string[] = []
  const missing = business.filter((o) => !overheadReady(o)).map((o) => o.name)
  if (missing.length) warnings.push(`${missing.join(', ')} not entered as overheads, so only payments in the expense log count for them`)
  const cov = exp?.coverage
  if (!cov) warnings.push('No expense log imported, so day-to-day business costs are not included')
  else if (window && cov.start > window.start) warnings.push(`The expense log starts ${formatDate(cov.start)}, so business costs before then are not included`)

  return {
    status: 'ok',
    chargedTo,
    charges,
    businessOverheads: sums,
    businessExpensesCents: expCents,
    netEurCents: args.grossAfterCreditsEurCents - sums.EUR - gbpAsEur,
    netGbpCents: grossGbp - gbpCosts - eurAsGbp,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Live statuses from Xero, laid over the ledger's snapshot
// ---------------------------------------------------------------------------

export interface LiveSummary {
  orders: number
  clientMatched: number
  billMatched: number
  /** Orders where one or both invoices were not found in Xero, or not in EUR. */
  gaps: { orderId: string; problem: string }[]
}

function liveStatus(i: XeroInvoice): InvoiceStatus {
  if (i.status === 'PAID') return 'PAID'
  if (i.status === 'AUTHORISED' || i.status === 'SUBMITTED') return 'AUTHORISED'
  return 'UNKNOWN'
}

/**
 * Replace each order's status and balances with Xero's current figures where its invoice was
 * found. Only EUR documents are used, since the ledger is EUR. Sales and costs stay as the
 * ledger states them, so the 25 reconciliation checks still run against the untouched ledger.
 */
export function applyLiveStatus(orders: readonly Order[], live: Map<string, LiveOrderStatus>): { orders: Order[]; summary: LiveSummary } {
  const gaps: LiveSummary['gaps'] = []
  let clientMatched = 0
  let billMatched = 0
  const out = orders.map((o) => {
    const m = live.get(o.id)
    const client = m?.client && m.client.currency === 'EUR' ? m.client : null
    const bill = m?.bill && m.bill.currency === 'EUR' ? m.bill : null
    const problems: string[] = []
    if (!m?.client) problems.push('client invoice not found in Xero')
    else if (!client) problems.push(`client invoice in Xero is ${m.client.currency}, not EUR`)
    if (!m?.bill) problems.push('supplier bill not found in Xero')
    else if (!bill) problems.push(`supplier bill in Xero is ${m.bill.currency}, not EUR`)
    if (problems.length) gaps.push({ orderId: o.id, problem: problems.join('; ') })
    if (client) clientMatched++
    if (bill) billMatched++
    if (!client && !bill) return o
    const clientOwes = client ? client.amountDueCents : o.clientOwesCents
    const weOwe = bill ? bill.amountDueCents : o.weOweSupplierCents
    return {
      ...o,
      clientStatus: client ? liveStatus(client) : o.clientStatus,
      clientOwesCents: clientOwes,
      supplierStatus: bill ? liveStatus(bill) : o.supplierStatus,
      weOweSupplierCents: weOwe,
      clientOwesMinusWeOweCents: (clientOwes ?? 0) - (weOwe ?? 0),
      live: {
        clientDueDate: client?.dueDate ?? null,
        billDueDate: bill?.dueDate ?? null,
        clientPayments: client?.payments ?? [],
        billPayments: bill?.payments ?? [],
      },
    }
  })
  return { orders: out, summary: { orders: orders.length, clientMatched, billMatched, gaps } }
}

// ---------------------------------------------------------------------------
// Cash calendar
// ---------------------------------------------------------------------------

export interface CashEntry {
  date: IsoDate | null
  kind: 'in' | 'out' | 'overhead'
  label: string
  orderId: string | null
  currency: Currency
  /** Signed: money in is positive, money out negative. */
  amountCents: Cents
  category: Overhead['category'] | null
  /** A supplier payment due while the client for the same order has not paid. */
  fundingGap: boolean
}

export interface CashDay {
  date: IsoDate
  entries: CashEntry[]
  /** Running bank balance after this day, in the bank's base currency. Null when not computable. */
  balanceCents: Cents | null
  belowZero: boolean
  fundingGap: boolean
}

export interface CashCalendar {
  start: { balanceCents: Cents; currency: Currency; accounts: XeroBankBalance[] } | null
  /** Why there is no running balance, in plain words. */
  noBalanceReason: string | null
  overdue: CashEntry[]
  days: CashDay[]
  /** Open balances with no due date yet (the ledger has none; Xero supplies them). */
  undated: CashEntry[]
  laterCount: number
}

/**
 * Money in and out by date, from open order balances and overheads. The running balance starts
 * from Xero's bank balances (base currency). It counts overdue supplier bills as due today, but
 * not overdue client payments: money owed to you is not counted until it arrives.
 */
export function cashCalendar(args: {
  orders: readonly Order[]
  overheads: readonly Overhead[]
  today: IsoDate
  days: number
  fx: FxRate | null
  bank: { balances: XeroBankBalance[] | null; currency: string } | null
}): CashCalendar {
  const end = addDays(args.today, args.days - 1)
  const entries: CashEntry[] = []
  for (const o of args.orders) {
    const clientOpen = o.clientOwesCents === null || o.clientOwesCents > 0
    const clientDue = o.live?.clientDueDate ?? null
    if (o.clientOwesCents && o.clientOwesCents > 0) {
      entries.push({ date: clientDue, kind: 'in', label: `${o.customerName} pays ${o.clientInvoiceNo}`, orderId: o.id, currency: 'EUR', amountCents: o.clientOwesCents, category: null, fundingGap: false })
    }
    const weOwe = o.weOweSupplierCents ?? 0
    if (weOwe > 0) {
      const billDue = o.live?.billDueDate ?? null
      const gap = clientOpen && (!clientDue || !billDue || clientDue > billDue || clientDue < args.today)
      entries.push({ date: billDue, kind: 'out', label: `Pay ${o.supplierName} ${o.supplierInvoiceNo}`, orderId: o.id, currency: 'EUR', amountCents: -weOwe, category: null, fundingGap: gap })
    }
  }
  for (const c of overheadCharges(args.overheads, { start: args.today, end })) {
    entries.push({ date: c.date, kind: 'overhead', label: c.overhead.name, orderId: null, currency: c.overhead.currency, amountCents: -c.amountCents, category: c.overhead.category, fundingGap: false })
  }

  const overdue = entries.filter((e) => e.date !== null && e.date < args.today).sort((a, b) => a.date!.localeCompare(b.date!) || a.amountCents - b.amountCents)
  const undated = entries.filter((e) => e.date === null)
  const inWindow = entries.filter((e) => e.date !== null && e.date >= args.today && e.date <= end)
  const laterCount = entries.filter((e) => e.date !== null && e.date > end).length

  // Opening balance, in the bank's base currency. Every flow is converted into it once.
  let start: CashCalendar['start'] = null
  let noBalanceReason: string | null = null
  const base = args.bank?.currency
  if (!args.bank || !args.bank.balances) noBalanceReason = 'Bank balances come from Xero, which is not connected or did not return them'
  else if (base !== 'GBP' && base !== 'EUR') noBalanceReason = `Xero reports bank balances in ${base}, which this dashboard does not convert`
  else start = { balanceCents: args.bank.balances.reduce((n, b) => n + b.closingCents, 0), currency: base, accounts: args.bank.balances }

  const toBase = (e: CashEntry): Cents | null => (start ? convertCents(e.amountCents, e.currency, start.currency, args.fx) : null)
  if (start && [...inWindow, ...overdue].some((e) => e.currency !== start!.currency) && !args.fx) {
    noBalanceReason = 'A running balance needs the exchange rate to combine EUR and GBP, and none is available'
    start = null
  }

  const byDay = new Map<IsoDate, CashEntry[]>()
  for (const e of inWindow) byDay.set(e.date!, [...(byDay.get(e.date!) ?? []), e])
  let balance: Cents | null = start ? start.balanceCents : null
  if (balance !== null) for (const e of overdue) if (e.amountCents < 0) balance += toBase(e) ?? 0

  const days: CashDay[] = []
  for (const date of [...byDay.keys()].sort()) {
    const es = byDay.get(date)!.sort((a, b) => b.amountCents - a.amountCents)
    if (balance !== null) for (const e of es) balance += toBase(e) ?? 0
    days.push({ date, entries: es, balanceCents: balance, belowZero: balance !== null && balance < 0, fundingGap: es.some((e) => e.fundingGap) })
  }
  return { start, noBalanceReason, overdue, days, undated, laterCount }
}

// ---------------------------------------------------------------------------
// Reconciliation against the ledger's own Summary tab and TOTAL row
// ---------------------------------------------------------------------------

export interface Check {
  label: string
  ok: boolean
  expected: number
  actual: number
  detail: string
}

function centsCheck(label: string, expected: Cents, actual: Cents): Check {
  const ok = expected === actual
  const diff = actual - expected
  return {
    label,
    ok,
    expected,
    actual,
    detail: ok ? `${fmt(actual)}` : `ledger ${fmt(expected)}, calculated ${fmt(actual)} (difference ${fmt(diff)})`,
  }
}

function countCheck(label: string, expected: number, actual: number): Check {
  return { label, ok: expected === actual, expected, actual, detail: expected === actual ? `${actual}` : `ledger ${expected}, calculated ${actual}` }
}

function fmt(c: Cents): string {
  const sign = c < 0 ? '-' : ''
  const abs = Math.abs(c)
  return `${sign}EUR ${Math.floor(abs / 100).toLocaleString('en-GB')}.${String(abs % 100).padStart(2, '0')}`
}

export function reconcileLedger(ledger: Ledger): Check[] {
  const { orders, lines, summary: s, totalRow: t } = ledger
  const all = totals(orders, unitsByOrder(lines))
  const credits = creditTotals(ledger.creditNotes, orders, {})
  const cash = cashPosition(orders)
  const checks: Check[] = [
    countCheck('Orders matched', s.ordersMatched, all.orderCount),
    centsCheck('Sales (client invoices) vs Summary', s.clientTotalCents, all.salesCents),
    centsCheck('Sales vs Orders TOTAL row', t.clientTotalCents, all.salesCents),
    centsCheck('Cost (supplier invoices) vs Summary', s.supplierTotalCents, all.costCents),
    centsCheck('Cost vs Orders TOTAL row', t.supplierTotalCents, all.costCents),
    centsCheck('Gross margin vs Summary', s.grossMarginCents, all.grossProfitCents),
    centsCheck('Gross margin = sales minus cost', all.salesCents - all.costCents, all.grossProfitCents),
    centsCheck('Goods margin vs TOTAL row', t.goodsMarginCents, all.goodsMarginCents),
    centsCheck('Shipping & other margin vs TOTAL row', t.shippingMarginCents, all.shippingMarginCents),
    centsCheck('Client credits issued vs Summary', s.clientCreditsCents, credits.clientCreditsCents),
    centsCheck('Supplier credits received vs Summary', s.supplierCreditsCents, credits.supplierCreditsCents),
    centsCheck('Gross margin after credits vs Summary', s.marginAfterCreditsCents, profitAfterCredits(all.grossProfitCents, credits)),
    centsCheck('Clients still owe vs Summary', s.clientsOweCents, cash.clientsOweCents),
    centsCheck('Fone Nova owes supplier vs Summary', s.weOweSupplierCents, cash.weOweSupplierCents),
    countCheck('Orders with a flag vs Summary', s.ordersWithFlag, orders.filter((o) => o.flags.length > 0).length),
  ]

  for (const c of s.byCustomer) {
    const os = orders.filter((o) => o.customerName === c.customerName)
    checks.push(countCheck(`${c.customerName}: orders`, c.orders, os.length))
    checks.push(centsCheck(`${c.customerName}: sales`, c.clientTotalCents, sumCents(os, (o) => o.clientTotalCents)))
    checks.push(centsCheck(`${c.customerName}: gross margin`, c.grossMarginCents, sumCents(os, (o) => o.grossMarginCents)))
  }

  const lineMismatches: string[] = []
  for (const o of orders) {
    const ls = lines.filter((l) => l.orderId === o.id)
    const goods = ls.filter((l) => l.type === 'goods')
    const ship = ls.filter((l) => l.type === 'shipping')
    const problems: string[] = []
    if (sumCents(ls, (l) => l.clientAmountCents) !== o.clientTotalCents) problems.push('client total')
    if (sumCents(ls, (l) => l.supplierAmountCents) !== o.supplierTotalCents) problems.push('supplier total')
    if (sumCents(goods, (l) => l.marginCents) !== o.goodsMarginCents) problems.push('goods margin')
    if (sumCents(ship, (l) => l.marginCents) !== o.shippingMarginCents) problems.push('shipping margin')
    if (o.goodsMarginCents + o.shippingMarginCents !== o.grossMarginCents) problems.push('goods + shipping != gross')
    if (o.clientTotalCents - o.supplierTotalCents !== o.grossMarginCents) problems.push('client - supplier != gross')
    if (problems.length) lineMismatches.push(`${o.id} (${problems.join(', ')})`)
  }
  checks.push({
    label: 'Each order: Lines sum to Orders row',
    ok: lineMismatches.length === 0,
    expected: 0,
    actual: lineMismatches.length,
    detail: lineMismatches.length ? lineMismatches.join('; ') : `${orders.length} of ${orders.length} orders`,
  })
  return checks
}
