/**
 * "Needs attention" items. Only data-backed: rows from the ledger's Exceptions tab, plus a
 * few checks derived directly from the order and credit data. No inferred "insights".
 */
import { orderMargin, marginBand, type CreditAllocation } from './metrics'
import type { Cents, Ledger, Priority } from './types'

export interface AttentionItem {
  id: string
  priority: Priority
  source: 'Exceptions tab' | 'Derived from ledger'
  reference: string
  orderId: string | null
  /** Orders this item concerns, for the customer filter. Empty = portfolio-wide. */
  orderIds: string[]
  issue: string
  impactCents: Cents
  impactLabel: string
  action: string | null
}

const RANK: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export function attentionItems(ledger: Ledger, allocation: CreditAllocation): AttentionItem[] {
  const items: AttentionItem[] = ledger.exceptions.map((e) => ({
    id: e.id,
    priority: e.priority,
    source: 'Exceptions tab',
    reference: e.reference,
    orderId: e.orderId,
    orderIds: e.orderId ? [e.orderId] : [],
    issue: e.issue,
    impactCents: e.impactCents,
    impactLabel: 'EUR impact',
    action: e.suggestedAction || null,
  }))

  const covered = new Set(ledger.exceptions.map((e) => e.orderId).filter(Boolean))
  for (const o of ledger.orders) {
    const band = marginBand(orderMargin(o))
    if (band !== 'thin' || covered.has(o.id)) continue
    items.push({
      id: `D-THIN-${o.id}`,
      priority: 'MEDIUM',
      source: 'Derived from ledger',
      reference: `${o.id} / invoice ${o.clientInvoiceNo}`,
      orderId: o.id,
      orderIds: [o.id],
      issue: `Margin under 0.5% (${((orderMargin(o) ?? 0) * 100).toFixed(2)}%). A small cost or FX move on this order would turn it into a loss.`,
      impactCents: o.grossMarginCents,
      impactLabel: 'Gross profit',
      action: 'Check pricing and shipping recharge on similar orders.',
    })
  }

  for (const n of allocation.unallocated) {
    items.push({
      id: `D-UNALLOC-${n.number}`,
      priority: 'MEDIUM',
      source: 'Derived from ledger',
      reference: `${n.side === 'client' ? 'Client' : 'Supplier'} credit note ${n.number}`,
      orderId: null,
      orderIds: n.orderIds,
      issue: `Covers ${n.orderIds.length} orders (${n.orderIds.join(', ')}), so it is not attributed to any one order. It counts in portfolio totals only. Xero shows: ${n.xeroShows}`,
      impactCents: n.amountCents,
      impactLabel: 'Credit amount',
      action: n.check || null,
    })
  }

  return items.sort((a, b) => RANK[a.priority] - RANK[b.priority])
}
