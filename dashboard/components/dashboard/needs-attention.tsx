'use client'
import { useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, ArrowRight, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { attentionItems } from '@/lib/attention'
import type { CreditAllocation } from '@/lib/metrics'
import { eur } from '@/lib/format'
import type { Ledger, Priority } from '@/lib/types'
import { cn } from '@/lib/utils'

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
}: {
  ledger: Ledger
  customerId: string | null
  allocation: CreditAllocation
  snapshot: string
  onOpenOrder: (id: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const all = useMemo(() => attentionItems(ledger, allocation), [ledger, allocation])
  const items = useMemo(() => {
    if (!customerId) return all
    const cust = new Map(ledger.orders.map((o) => [o.id, o.customerId]))
    return all.filter((i) => i.orderIds.length === 0 || i.orderIds.some((id) => cust.get(id) === customerId))
  }, [all, customerId, ledger.orders])
  const visible = showAll ? items : items.slice(0, 6)
  const high = items.filter((i) => i.priority === 'HIGH').length

  return (
    <section aria-labelledby="attn-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 id="attn-title" className="text-[14px] font-semibold text-ink">Needs attention <span className="ml-1 text-ink-3">{items.length}</span></h2>
          <p className="text-[12px] text-ink-3">
            From the ledger&apos;s Exceptions tab plus checks on the order data. Open issues as of {snapshot}; not filtered by period{customerId ? '; filtered to the selected customer' : ''}.
          </p>
        </div>
        {high > 0 && <Badge tone="loss"><AlertOctagon className="h-3 w-3" aria-hidden />{high} high priority</Badge>}
      </div>
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
                  <span className="text-[11px] text-ink-3">{i.source}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{i.issue}</p>
                {i.action && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3"><span className="font-medium text-ink-2">Action:</span> {i.action}</p>}
              </div>
              <div className="md:text-right">
                <div className="text-[11px] text-ink-3">{i.impactLabel}</div>
                <div className={cn('text-[13.5px] font-semibold', i.impactCents < 0 ? 'text-loss' : 'text-ink')}>
                  {i.impactCents === 0 ? <span className="font-normal text-ink-3">No direct amount</span> : eur(i.impactCents)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {items.length > 6 && (
        <div className="border-t border-line px-4 py-2">
          <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? 'Show fewer' : `Show all ${items.length}`}
          </Button>
        </div>
      )}
    </section>
  )
}
