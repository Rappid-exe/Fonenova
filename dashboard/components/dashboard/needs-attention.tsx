'use client'
import { useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, ArrowRight, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { attentionItems, type AttentionItem } from '@/lib/attention'
import type { CreditAllocation } from '@/lib/metrics'
import { useMoney } from '@/components/currency'
import type { Ledger, Priority } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'all' | Priority | 'chase'

const P: Record<Priority, { tone: 'loss' | 'warn' | 'neutral'; icon: typeof AlertOctagon; label: string }> = {
  HIGH: { tone: 'loss', icon: AlertOctagon, label: 'High' },
  MEDIUM: { tone: 'warn', icon: AlertTriangle, label: 'Medium' },
  LOW: { tone: 'neutral', icon: Info, label: 'Low' },
}

export function NeedsAttention({
  ledger,
  customerId,
  allocation,
  snapshot,
  onOpenOrder,
  expanded = false,
}: {
  ledger: Ledger
  customerId: string | null
  allocation: CreditAllocation
  snapshot: string
  onOpenOrder: (id: string) => void
  /** Show every item from the start (the Exceptions page). */
  expanded?: boolean
}) {
  const { money } = useMoney()
  const [showAll, setShowAll] = useState(expanded)
  const all = useMemo(() => attentionItems(ledger, allocation), [ledger, allocation])
  const items = useMemo(() => {
    if (!customerId) return all
    const cust = new Map(ledger.orders.map((o) => [o.id, o.customerId]))
    return all.filter((i) => i.orderIds.length === 0 || i.orderIds.some((id) => cust.get(id) === customerId))
  }, [all, customerId, ledger.orders])
  const [filter, setFilter] = useState<Filter>('all')
  const chasing = (i: AttentionItem) => /overdue|still owed/i.test(i.issue)
  const shown = items.filter((i) => filter === 'all' || (filter === 'chase' ? chasing(i) : i.priority === filter))
  const visible = showAll ? shown : shown.slice(0, 6)
  const high = items.filter((i) => i.priority === 'HIGH').length
  const chips: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: items.length },
    { id: 'HIGH', label: 'High', n: high },
    { id: 'MEDIUM', label: 'Medium', n: items.filter((i) => i.priority === 'MEDIUM').length },
    { id: 'LOW', label: 'Low', n: items.filter((i) => i.priority === 'LOW').length },
    { id: 'chase', label: 'Chasing money', n: items.filter(chasing).length },
  ]

  return (
    <section aria-labelledby="attn-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 id="attn-title" className="text-[15px] font-semibold text-ink">Needs attention <span className="ml-1 text-ink-3">{items.length}</span></h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
            From the ledger&apos;s Exceptions tab, plus checks on the order data. Open as of {snapshot}{customerId ? ', selected customer only' : ''}.
          </p>
        </div>
        {high > 0 && <Badge tone="loss"><AlertOctagon className="h-3 w-3" aria-hidden />{high} high priority</Badge>}
      </div>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5" role="group" aria-label="Filter">
          {chips.filter((c) => c.n > 0 || c.id === 'all').map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              onClick={() => setFilter(c.id)}
              className={cn('h-8 rounded-full border px-3 text-[12.5px] font-medium', filter === c.id ? 'border-navy bg-navy text-white' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink')}
            >
              {c.label} <span className="opacity-70">{c.n}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="divide-y divide-line">
        {visible.map((i) => {
          const p = P[i.priority]
          return (
            <li key={i.id} className="grid gap-x-4 gap-y-1.5 px-4 py-3 md:grid-cols-[96px_1fr_150px]">
              <div className="flex items-start gap-2 md:block">
                <Badge tone={p.tone}><p.icon className="h-3 w-3" aria-hidden />{p.label}</Badge>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                  {i.orderId ? (
                    <button type="button" onClick={() => onOpenOrder(i.orderId!)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                      {i.reference}<ArrowRight className="h-3 w-3" aria-hidden />
                    </button>
                  ) : (
                    <span className="font-medium text-ink">{i.reference}</span>
                  )}
                  {i.source !== 'Exceptions tab' && <span className="text-[12px] text-ink-3">{i.source}</span>}
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{i.issue}</p>
                {i.action && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3"><span className="font-medium text-ink-2">Action:</span> {i.action}</p>}
              </div>
              <div className="md:text-right">
                <div className="text-[11px] text-ink-3">{i.impactLabel}</div>
                <div className={cn('text-[15px] font-semibold', i.impactCents < 0 ? 'text-loss' : 'text-ink')}>
                  {i.impactCents === 0 ? <span className="font-normal text-ink-3">No direct amount</span> : money(i.impactCents)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {shown.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-ink-3">Nothing here.</p>}
      {shown.length > 6 && (
        <div className="border-t border-line px-4 py-2">
          <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? 'Show fewer' : `Show all ${shown.length}`}
          </Button>
        </div>
      )}
    </section>
  )
}

/** The three most important open items, for the Overview. */
export function TodayList({ ledger, customerId, allocation, onOpenOrder, onSeeAll }: {
  ledger: Ledger
  customerId: string | null
  allocation: CreditAllocation
  onOpenOrder: (id: string) => void
  onSeeAll: () => void
}) {
  const { money } = useMoney()
  const items = useMemo(() => {
    const all = attentionItems(ledger, allocation)
    if (!customerId) return all
    const cust = new Map(ledger.orders.map((o) => [o.id, o.customerId]))
    return all.filter((i) => i.orderIds.length === 0 || i.orderIds.some((id) => cust.get(id) === customerId))
  }, [ledger, allocation, customerId])
  if (items.length === 0) return null
  return (
    <section aria-labelledby="today-title" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 id="today-title" className="text-[15px] font-semibold text-ink">Needs doing</h2>
        <button type="button" onClick={onSeeAll} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
          See all {items.length}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <ul className="divide-y divide-line">
        {items.slice(0, 3).map((i) => {
          const p = P[i.priority]
          const open = i.orderId ? () => onOpenOrder(i.orderId!) : undefined
          return (
            <li key={i.id}>
              <button type="button" onClick={open} disabled={!open} className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-3 px-5 py-3 text-left enabled:hover:bg-subtle">
                <Badge tone={p.tone} className="mt-0.5"><p.icon className="h-3 w-3" aria-hidden />{p.label}</Badge>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{i.action ?? i.issue}</span>
                  <span className="block truncate text-[12.5px] text-ink-2">{i.reference} · {i.issue}</span>
                </span>
                <span className={cn('text-[14px] font-semibold', i.impactCents < 0 ? 'text-loss' : 'text-ink')}>{i.impactCents ? money(i.impactCents) : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
