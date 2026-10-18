/**
 * Every figure the dashboard shows is calculated here, from integer cents.
 * Components format numbers; they never add them up.
 */
import { ratio, sumCents } from './money'
import { bucketKey, buckets, inRange, type DateRange, type Granularity } from './periods'
import type { Cents, CreditNote, Ledger, Order, OrderLine } from './types'

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
