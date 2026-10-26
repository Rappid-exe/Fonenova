/**
 * What an order really made in pounds. Fone Nova trades in EUR but keeps its books in GBP, so the
 * same euro margin is worth more or less in sterling depending on the rates on the day.
 *
 * Uses Xero's own rates (CurrencyRate = euros per 1 pound, e.g. 1.17041):
 *   booked    = sale at the invoice's rate − cost at the bill's rate (what Xero books at the time)
 *   realised  = each client payment at its rate − each supplier payment at its rate
 *   FX effect = realised − booked (Xero's realised currency gain or loss on this order)
 * Realised is only worked out once both sides are fully paid in cash: a credit note or a part
 * payment would make it a guess.
 */
import type { Cents, Order, XeroInvoice } from './types'
import { matchOrders } from './xero/map'

export interface FxProfit {
  orderId: string
  /** GBP pence. */
  bookedGbpCents: Cents
  realisedGbpCents: Cents | null
  effectGbpCents: Cents | null
  invoiceRate: number
  billRate: number
  /** Why realised is not shown yet, in plain words. */
  pending: string | null
}

const gbp = (eurCents: Cents, rate: number) => Math.round(eurCents / rate)

function paidInCash(d: XeroInvoice): { ok: true; gbp: Cents } | { ok: false; why: string } {
  if (d.status !== 'PAID' || d.amountDueCents > 0) return { ok: false, why: 'not fully paid' }
  const paid = d.payments.reduce((n, p) => n + p.amountCents, 0)
  if (Math.abs(paid - d.totalCents) > 1) return { ok: false, why: 'settled partly by a credit note' }
  if (d.payments.some((p) => !p.currencyRate)) return { ok: false, why: 'payment rates not read from Xero yet' }
  return { ok: true, gbp: d.payments.reduce((n, p) => n + gbp(p.amountCents, p.currencyRate!), 0) }
}

/** Null when the order has no EUR invoice and bill in Xero with rates (e.g. a base-currency document). */
export function fxProfit(orderId: string, client: XeroInvoice | null, bill: XeroInvoice | null): FxProfit | null {
  if (!client || !bill || client.currency !== 'EUR' || bill.currency !== 'EUR' || !client.currencyRate || !bill.currencyRate) return null
  const booked = gbp(client.totalCents, client.currencyRate) - gbp(bill.totalCents, bill.currencyRate)
  const c = paidInCash(client)
  const b = paidInCash(bill)
  const realised = c.ok && b.ok ? c.gbp - b.gbp : null
  return {
    orderId,
    bookedGbpCents: booked,
    realisedGbpCents: realised,
    effectGbpCents: realised === null ? null : realised - booked,
    invoiceRate: client.currencyRate,
    billRate: bill.currencyRate,
    pending: realised !== null ? null : !c.ok ? `Client invoice ${c.why}` : `Supplier bill ${(b as { why: string }).why}`,
  }
}

export function fxProfits(orders: readonly Order[], invoices: readonly XeroInvoice[]): Map<string, FxProfit> {
  const links = matchOrders(orders, invoices)
  const out = new Map<string, FxProfit>()
  for (const o of orders) {
    const l = links.get(o.id)
    const f = fxProfit(o.id, l?.client ?? null, l?.bill ?? null)
    if (f) out.set(o.id, f)
  }
  return out
}

/** Totals over the orders that are settled, so booked and realised compare like for like. */
export function fxTotals(list: readonly FxProfit[]): { settled: number; bookedGbpCents: Cents; realisedGbpCents: Cents; effectGbpCents: Cents; pending: number } {
  const settled = list.filter((f) => f.realisedGbpCents !== null)
  return {
    settled: settled.length,
    bookedGbpCents: settled.reduce((n, f) => n + f.bookedGbpCents, 0),
    realisedGbpCents: settled.reduce((n, f) => n + f.realisedGbpCents!, 0),
    effectGbpCents: settled.reduce((n, f) => n + f.effectGbpCents!, 0),
    pending: list.length - settled.length,
  }
}
