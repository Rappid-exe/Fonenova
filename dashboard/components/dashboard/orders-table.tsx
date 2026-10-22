'use client'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { marginBand, orderMargin } from '@/lib/metrics'
import { count, pct } from '@/lib/format'
import { useMoney } from '@/components/currency'
import { formatDate } from '@/lib/periods'
import type { Customer, InvoiceStatus, LedgerException, Order } from '@/lib/types'
import { cn } from '@/lib/utils'

type SortKey = 'id' | 'date' | 'customer' | 'units' | 'sales' | 'cost' | 'profit' | 'margin'
type QuickFilter = 'loss' | 'thin' | 'flagged' | 'exception' | 'unmatched'

const QUICK: { id: QuickFilter; label: string }[] = [
  { id: 'loss', label: 'Loss-making' },
  { id: 'thin', label: 'Margin under 0.5%' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'exception', label: 'In Exceptions' },
  { id: 'unmatched', label: 'Not in Xero' },
]

export function statusLabel(s: InvoiceStatus): { label: string; tone: 'gain' | 'warn' | 'loss' | 'neutral' } {
  switch (s) {
    case 'PAID': return { label: 'Paid', tone: 'gain' }
    case 'AUTHORISED': return { label: 'Awaiting payment', tone: 'warn' }
    case 'NOT_IN_XERO': return { label: 'Not in Xero', tone: 'loss' }
    default: return { label: 'Unknown', tone: 'neutral' }
  }
}

export function flagTone(f: string): 'loss' | 'warn' | 'neutral' {
  if (/loss|not in xero|differs/i.test(f)) return 'loss'
  if (/overdue|under|margin/i.test(f)) return 'warn'
  return 'neutral'
}

type Sort = { key: SortKey; dir: 'asc' | 'desc' }

function Th({ k, children, right, className, sort, setSort }: { k: SortKey; children: React.ReactNode; right?: boolean; className?: string; sort: Sort; setSort: React.Dispatch<React.SetStateAction<Sort>> }) {
  const active = sort.key === k
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('whitespace-nowrap px-2.5 py-2 font-medium', right ? 'text-right' : 'text-left', className)}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 'asc' ? 'desc' : 'asc') : k === 'id' || k === 'customer' ? 'asc' : 'desc' }))}
        className={cn('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink', right && 'flex-row-reverse')}
      >
        {children}
        <Icon className={cn('h-3 w-3', !active && 'opacity-40')} aria-hidden />
      </button>
    </th>
  )
}


export function OrdersTable({
  orders,
  totalInLedger,
  units,
  exceptions,
  customers,
  customerId,
  onCustomer,
  onOpenOrder,
  periodEmpty,
}: {
  orders: Order[]
  totalInLedger: number
  units: Map<string, number>
  exceptions: LedgerException[]
  customers: Customer[]
  customerId: string
  onCustomer: (id: string) => void
  onOpenOrder: (id: string) => void
  periodEmpty: boolean
}) {
  const { money } = useMoney()
  const [q, setQ] = useState('')
  const [quick, setQuick] = useState<Set<QuickFilter>>(new Set())
  const [sort, setSort] = useState<Sort>({ key: 'date', dir: 'desc' })
  const exceptionOrders = useMemo(() => new Set(exceptions.map((e) => e.orderId).filter(Boolean) as string[]), [exceptions])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = orders.filter((o) => {
      const band = marginBand(orderMargin(o))
      if (quick.has('loss') && band !== 'loss') return false
      if (quick.has('thin') && band !== 'thin') return false
      if (quick.has('flagged') && o.flags.length === 0) return false
      if (quick.has('exception') && !exceptionOrders.has(o.id)) return false
      if (quick.has('unmatched') && o.clientStatus !== 'NOT_IN_XERO' && o.supplierStatus !== 'NOT_IN_XERO') return false
      if (!needle) return true
      return [o.id, o.customerName, o.clientInvoiceNo, o.supplierInvoiceNo, ...o.flags].some((s) => s.toLowerCase().includes(needle))
    })
    const val = (o: Order): string | number => {
      switch (sort.key) {
        case 'id': return o.id
        case 'date': return o.date + o.id
        case 'customer': return o.customerName
        case 'units': return units.get(o.id) ?? 0
        case 'sales': return o.clientTotalCents
        case 'cost': return o.supplierTotalCents
        case 'profit': return o.grossMarginCents
        case 'margin': return orderMargin(o) ?? -Infinity
      }
    }
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b)
      const c = va < vb ? -1 : va > vb ? 1 : 0
      return sort.dir === 'asc' ? c : -c
    })
  }, [orders, q, quick, sort, units, exceptionOrders])

  const toggle = (f: QuickFilter) => setQuick((s) => { const n = new Set(s); if (n.has(f)) n.delete(f); else n.add(f); return n })
  const filtersActive = q.trim() !== '' || quick.size > 0

  return (
    <section aria-labelledby="orders-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="orders-title" className="text-[15px] font-semibold text-ink">Orders</h2>
          <span className="text-[12.5px] text-ink-2" aria-live="polite">
            Showing {count(rows.length)} of {count(orders.length)} in this period ({count(totalInLedger)} in ledger)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-56 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <label htmlFor="order-search" className="sr-only">Search orders</label>
            <input
              id="order-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Order, invoice no., customer, flag"
              className="h-9 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 hover:border-line-strong"
            />
          </div>
          <label htmlFor="table-customer" className="sr-only">Customer</label>
          <Select id="table-customer" value={customerId} onChange={(e) => onCustomer(e.target.value)} className="basis-44">
            <option value="">All customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick filters">
            {QUICK.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={quick.has(f.id)}
                onClick={() => toggle(f.id)}
                className={cn(
                  'h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                  quick.has(f.id) ? 'border-navy bg-navy text-white' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink',
                )}
              >
                {f.label}
              </button>
            ))}
            {filtersActive && (
              <button type="button" onClick={() => { setQ(''); setQuick(new Set()) }} className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-[12.5px] text-ink-3 hover:text-ink">
                <X className="h-3.5 w-3.5" aria-hidden />Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative max-h-[72vh] overflow-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <caption className="sr-only">Orders in the selected period. Select a row to see both invoices.</caption>
          <thead className="sticky top-0 z-20 bg-subtle text-ink-2 shadow-[0_1px_0_var(--color-line)]">
            <tr>
              <Th sort={sort} setSort={setSort} k="id" className="sticky left-0 z-10 bg-subtle pl-4">Order</Th>
              <Th sort={sort} setSort={setSort} k="date">Date</Th>
              <Th sort={sort} setSort={setSort} k="customer">Customer</Th>
              <th scope="col" className="whitespace-nowrap px-2.5 py-2 text-left font-medium">Invoice / bill</th>
              <Th sort={sort} setSort={setSort} k="units" right className="hidden min-[1500px]:table-cell">Units</Th>
              <Th sort={sort} setSort={setSort} k="sales" right>Sales</Th>
              <Th sort={sort} setSort={setSort} k="cost" right className="hidden min-[1600px]:table-cell">Cost</Th>
              <Th sort={sort} setSort={setSort} k="profit" right>Gross profit</Th>
              <Th sort={sort} setSort={setSort} k="margin" right>Margin</Th>
              <th scope="col" className="px-2.5 py-2 text-left font-medium">Client</th>
              <th scope="col" className="px-2.5 py-2 pr-4 text-left font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const m = orderMargin(o)
              const band = marginBand(m)
              const st = statusLabel(o.clientStatus)
              return (
                <tr
                  key={o.id}
                  tabIndex={0}
                  onClick={() => onOpenOrder(o.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenOrder(o.id) } }}
                  aria-label={`${o.id}, ${o.customerName}, gross profit ${money(o.grossMarginCents)}. Open details`}
                  className={cn(
                    'group cursor-pointer border-t border-line outline-none hover:bg-subtle focus-visible:bg-accent-soft',
                    band === 'loss' && 'bg-loss-soft/50 hover:bg-loss-soft',
                  )}
                >
                  <td className={cn('sticky left-0 z-10 whitespace-nowrap px-2.5 py-2 pl-4 font-medium text-ink group-hover:bg-subtle group-focus-visible:bg-accent-soft', band === 'loss' ? 'bg-loss-soft' : 'bg-surface')}>
                    <span className={cn('mr-2 inline-block h-3.5 w-[3px] translate-y-0.5 rounded-full', band === 'loss' ? 'bg-loss' : band === 'thin' ? 'bg-warn' : 'bg-transparent')} aria-hidden />
                    {o.id}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-ink-2">{formatDate(o.date)}</td>
                  <td className="max-w-[140px] truncate whitespace-nowrap px-2.5 py-2 text-ink" title={o.customerName}>{o.customerName}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 leading-tight">
                    <div className={cn('text-[12.5px]', o.clientStatus === 'NOT_IN_XERO' ? 'text-loss' : 'text-ink')} title={`Client invoice${o.clientStatus === 'NOT_IN_XERO' ? ' (not in Xero)' : ''}`}>{o.clientInvoiceNo || '–'}</div>
                    <div className={cn('text-[12px]', o.supplierStatus === 'NOT_IN_XERO' ? 'text-loss' : 'text-ink-3')} title={`Supplier bill${o.supplierStatus === 'NOT_IN_XERO' ? ' (not in Xero)' : ''}`}>{o.supplierInvoiceNo || '–'}</div>
                  </td>
                  <td className="num hidden px-2.5 py-2 min-[1500px]:table-cell">{count(units.get(o.id) ?? 0)}</td>
                  <td className="num px-2.5 py-2">{money(o.clientTotalCents)}</td>
                  <td className="num hidden px-2.5 py-2 text-ink-2 min-[1600px]:table-cell">{money(o.supplierTotalCents)}</td>
                  <td className={cn('num px-2.5 py-2 font-semibold', o.grossMarginCents < 0 ? 'text-loss' : 'text-ink')}>{money(o.grossMarginCents)}</td>
                  <td className="num px-2.5 py-2">
                    <span className={cn('font-medium', band === 'loss' ? 'text-loss' : band === 'thin' ? 'text-warn' : 'text-ink')}>{pct(m)}</span>
                    {band === 'loss' && <span className="sr-only"> (loss)</span>}
                    {band === 'thin' && <span className="sr-only"> (under 0.5%)</span>}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2">
                    <span className="inline-flex items-center gap-1.5 text-ink-2">
                      <span className={cn('h-2 w-2 rounded-full', st.tone === 'gain' ? 'bg-gain' : st.tone === 'warn' ? 'bg-warn' : st.tone === 'loss' ? 'bg-loss' : 'bg-line-strong')} aria-hidden />
                      {o.clientStatus === 'AUTHORISED' ? 'Unpaid' : st.label}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 pr-4">
                    {o.flags.length > 0 && (
                      <span className="flex items-center gap-1" title={o.flags.join('\n')}>
                        <Badge tone={flagTone(o.flags[0])} className="max-w-[130px]"><span className="truncate">{o.flags[0]}</span></Badge>
                        {o.flags.length > 1 && <Badge tone="outline">+{o.flags.length - 1}</Badge>}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px] text-ink-3">
            {periodEmpty ? 'No orders in this period.' : 'No orders match these filters.'}
          </div>
        )}
      </div>
    </section>
  )
}
