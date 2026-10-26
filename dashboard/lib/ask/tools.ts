/**
 * The AI bar's tools: small, read-only lookups over the same data the dashboard shows (a
 * LiveView). Each returns compact JSON with money already formatted, so the model copies figures
 * rather than doing sums. Nothing here can change data.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { checkDeal } from '../deal'
import type { LiveView } from '../live-view'
import { cashCalendar, creditTotals, customerRows, expenseSummary, filterOrders, marginSchemeVat, orderMargin, overdueOrders, profitAfterCredits, supplierRows, totals, unitsByOrder } from '../metrics'
import type { Cents, ExpenseLog, ExpenseOverrides, IsoDate, Order, Overhead } from '../types'

export interface AskData {
  view: LiveView
  today: IsoDate
  expenses: ExpenseLog | null
  expenseOverrides: ExpenseOverrides
  overheads: Overhead[]
}

const amount = (symbol: string, c: Cents) => `${c < 0 ? '-' : ''}${symbol}${(Math.abs(c) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const eur = (c: Cents | null) => (c === null ? 'unknown' : amount('€', c))
const gbp = (c: Cents) => amount('£', c)
const pctOf = (r: number | null) => (r === null ? null : `${(r * 100).toFixed(2)}%`)
const like = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '').includes(b.toLowerCase().replace(/[^a-z0-9]/g, ''))
/** A string or null ('not given'), in the anyOf form strict tool schemas document. */
const orNull = (description: string) => ({ anyOf: [{ type: 'string' }, { type: 'null' }], description })
const DATE = orNull('YYYY-MM-DD, or null for no limit')

/** Strict schemas: every property required, null meaning "not given". */
function tool(name: string, description: string, properties: Record<string, unknown>): Anthropic.Tool {
  return { name, description, strict: true, input_schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } } as Anthropic.Tool
}

export const TOOLS: Anthropic.Tool[] = [
  tool('find_orders', 'List orders (one client invoice paired with one supplier bill). Filter by customer name, order date range, payment state and margin. Newest first.', {
    customer: orNull('Part of the customer name, or null for all'),
    from: DATE,
    to: DATE,
    state: { type: 'string', enum: ['any', 'client_unpaid', 'client_overdue', 'supplier_unpaid', 'loss_or_thin'], description: 'loss_or_thin = margin under 0.5%' },
    limit: { type: 'integer', description: 'At most this many, 1 to 40' },
  }),
  tool('period_totals', 'Sales, cost, gross profit, credit notes, profit after credits and margin-scheme VAT estimate for orders dated in a period.', {
    from: DATE,
    to: DATE,
    customer: orNull('Part of the customer name, or null for all'),
  }),
  tool('customers', 'Each customer (or supplier) with orders, sales, profit, average margin, open balance and overdue amount.', {
    side: { type: 'string', enum: ['customers', 'suppliers'] },
    name: orNull('Part of the name to look up one, or null for all'),
  }),
  tool('overdue', 'Client invoices past their due date and still owed, oldest first.', {}),
  tool('cash_next_days', 'Money due in from clients and out to suppliers over the next N days, with overdue supplier bills, from open order balances.', {
    days: { type: 'integer', description: '1 to 90' },
  }),
  tool('xero_problems', 'Problems the live checks found between the ledger and Xero: missing or over-allocated credit notes, totals that differ, unpaid bills, old drafts.', {}),
  tool('expenses', 'Business expenses from the VAT trackers (GBP): totals by class and category in a period.', { from: DATE, to: DATE }),
  tool('deal_check', 'Work out what a proposed order would earn: margin after shipping, optional margin-scheme VAT, and cash tied up.', {
    lines: { type: 'array', items: { type: 'object', properties: { units: { type: 'number' }, buy_eur: { type: 'number' }, sell_eur: { type: 'number' } }, required: ['units', 'buy_eur', 'sell_eur'], additionalProperties: false } },
    supplier_shipping_eur: { type: 'number' },
    shipping_recharged_eur: { type: 'number' },
    margin_vat: { type: 'boolean' },
    supplier_due_days: { type: 'integer' },
    client_due_days: { type: 'integer' },
  }),
]

const range = (from: unknown, to: unknown) => ({ start: (typeof from === 'string' && from) || '2000-01-01', end: (typeof to === 'string' && to) || '2999-12-31' })
const byCustomer = (orders: readonly Order[], name: unknown) => (typeof name === 'string' && name.trim() ? orders.filter((o) => like(o.customerName, name)) : orders)

function orderRow(o: Order, today: IsoDate) {
  const overdue = overdueOrders([o], today)[0]
  return {
    id: o.id,
    date: o.date,
    customer: o.customerName,
    invoice: o.clientInvoiceNo,
    bill: o.supplierInvoiceNo,
    sales: eur(o.clientTotalCents),
    profit: eur(o.grossMarginCents),
    margin: pctOf(orderMargin(o)),
    client_owes: eur(o.clientOwesCents),
    we_owe_supplier: eur(o.weOweSupplierCents),
    ...(overdue ? { client_days_late: overdue.days } : {}),
  }
}

/** Run one tool. Unknown names and bad input come back as an error message for the model. */
export function runTool(name: string, input: Record<string, unknown>, d: AskData): unknown {
  const orders = d.view.ledger.orders
  const units = unitsByOrder(d.view.ledger.lines)
  switch (name) {
    case 'find_orders': {
      let list = byCustomer(orders, input.customer).filter((o) => o.date >= range(input.from, input.to).start && o.date <= range(input.from, input.to).end)
      const late = new Set(overdueOrders(list, d.today).map((x) => x.order.id))
      if (input.state === 'client_unpaid') list = list.filter((o) => (o.clientOwesCents ?? 0) > 0)
      if (input.state === 'client_overdue') list = list.filter((o) => late.has(o.id))
      if (input.state === 'supplier_unpaid') list = list.filter((o) => (o.weOweSupplierCents ?? 0) > 0)
      if (input.state === 'loss_or_thin') list = list.filter((o) => (orderMargin(o) ?? 1) < 0.005)
      const limit = Math.min(40, Math.max(1, Number(input.limit) || 20))
      const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date))
      return { matching: sorted.length, shown: Math.min(limit, sorted.length), orders: sorted.slice(0, limit).map((o) => orderRow(o, d.today)) }
    }
    case 'period_totals': {
      const r = range(input.from, input.to)
      const list = byCustomer(filterOrders(orders, { range: r }), input.customer)
      const t = totals(list, units)
      const c = creditTotals(d.view.ledger.creditNotes, orders, { range: r })
      return {
        period: `${r.start} to ${r.end}`,
        orders: t.orderCount,
        units: t.units,
        sales: eur(t.salesCents),
        cost: eur(t.costCents),
        gross_profit: eur(t.grossProfitCents),
        margin: pctOf(t.marginRatio),
        loss_making_orders: t.lossMakingCount,
        ...(typeof input.customer === 'string' && input.customer ? { note: 'Credit notes are only shown for all customers' } : { client_credits: eur(c.clientCreditsCents), supplier_credits: eur(c.supplierCreditsCents), profit_after_credits: eur(profitAfterCredits(t.grossProfitCents, c)) }),
        margin_scheme_vat_estimate: eur(marginSchemeVat(list)),
      }
    }
    case 'customers': {
      const rows = input.side === 'suppliers' ? supplierRows(orders, units, d.view.ledger.creditNotes, null) : customerRows(orders, units, d.view.ledger.creditNotes, null)
      const picked = typeof input.name === 'string' && input.name.trim() ? rows.filter((r) => like(r.name, input.name as string)) : rows
      return picked.map((r) => {
        const late = input.side === 'suppliers' ? [] : overdueOrders(orders.filter((o) => o.customerId === r.id), d.today)
        return { name: r.name, orders: r.orderCount, sales: eur(r.salesCents), profit: eur(r.grossProfitCents), margin: pctOf(r.marginRatio), open_balance: eur(r.openCents), ...(late.length ? { overdue: eur(late.reduce((n, x) => n + x.owedCents, 0)), oldest_days_late: late[0].days } : {}), last_order: r.lastOrder }
      })
    }
    case 'overdue': {
      const late = overdueOrders(orders, d.today)
      return { total: eur(late.reduce((n, x) => n + x.owedCents, 0)), invoices: late.map((x) => ({ order: x.order.id, customer: x.order.customerName, invoice: x.order.clientInvoiceNo, owed: eur(x.owedCents), days_late: x.days })) }
    }
    case 'cash_next_days': {
      const days = Math.min(90, Math.max(1, Number(input.days) || 14))
      const cal = cashCalendar({ orders, overheads: [], today: d.today, days, fx: null, bank: null })
      const entries = [...cal.overdue.filter((e) => e.kind === 'out'), ...cal.days.flatMap((x) => x.entries)]
      return {
        due_in: eur(entries.filter((e) => e.kind === 'in').reduce((n, e) => n + e.amountCents, 0)),
        due_out: eur(-entries.filter((e) => e.kind === 'out').reduce((n, e) => n + e.amountCents, 0)),
        items: entries.slice(0, 40).map((e) => ({ date: e.date && e.date < d.today ? `overdue (${e.date})` : e.date, what: e.label, order: e.orderId, amount: eur(e.amountCents), ...(e.fundingGap ? { client_not_paid_yet: true } : {}) })),
        undated_open_balances: cal.undated.length,
      }
    }
    case 'xero_problems':
      return d.view.checks.items.map((i) => ({ priority: i.priority, reference: i.reference, order: i.orderId, issue: i.issue, amount: eur(i.impactCents), action: i.action }))
    case 'expenses': {
      const r = input.from || input.to ? range(input.from, input.to) : null
      const s = expenseSummary(d.expenses, d.expenseOverrides, d.overheads, r)
      return {
        currency: 'GBP',
        covers: s.coverage,
        business: gbp(s.businessCents),
        still_to_review: gbp(s.reviewCents),
        personal: gbp(s.personalCents),
        vat_reclaimed_on_business: gbp(s.vatOnBusinessCents),
        vat_at_risk_not_confirmed_business: gbp(s.vatAtRiskCents),
        by_category: s.byCategory.slice(0, 15).map((c) => ({ category: c.category, class: c.cls, amount: gbp(c.cents), rows: c.count })),
      }
    }
    case 'deal_check': {
      const lines = Array.isArray(input.lines) ? (input.lines as { units: number; buy_eur: number; sell_eur: number }[]) : []
      const r = checkDeal({
        lines: lines.map((l) => ({ units: Number(l.units) || 0, buyCents: Math.round(Number(l.buy_eur) * 100) || 0, sellCents: Math.round(Number(l.sell_eur) * 100) || 0 })),
        supplierShippingCents: Math.round(Number(input.supplier_shipping_eur) * 100) || 0,
        shippingRechargedCents: Math.round(Number(input.shipping_recharged_eur) * 100) || 0,
        marginVat: input.margin_vat === true,
        fxCushionPct: 0,
        supplierDueDays: Number(input.supplier_due_days) || 0,
        clientDueDays: Number(input.client_due_days) || 0,
      })
      return { client_pays: eur(r.salesCents), supplier_charges: eur(r.costCents), gross_profit: eur(r.grossCents), margin_vat: eur(r.marginVatCents), you_keep: eur(r.netCents), margin: pctOf(r.netRatio), verdict: r.verdict, warnings: r.warnings }
    }
    default:
      return { error: `Unknown tool ${name}` }
  }
}
