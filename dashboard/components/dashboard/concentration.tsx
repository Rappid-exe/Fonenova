'use client'
import { AlertTriangle } from 'lucide-react'
import type { CustomerShare } from '@/lib/metrics'
import { pct, plural } from '@/lib/format'
import { useMoney } from '@/components/currency'
import { cn } from '@/lib/utils'

const COLORS = ['var(--color-cat-1)', 'var(--color-cat-2)', 'var(--color-cat-3)']

export function ConcentrationPanel({ shares, highlightId, customerOrder }: { shares: CustomerShare[]; highlightId: string | null; customerOrder: string[] }) {
  const { money } = useMoney()
  const top = shares[0]
  // Colour follows the customer (its position in the ledger), never its rank in this period.
  const colorOf = (id: string) => COLORS[Math.max(0, customerOrder.indexOf(id)) % COLORS.length]

  return (
    <section aria-labelledby="conc-title" className="h-full rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 id="conc-title" className="text-[14px] font-semibold text-ink">Customer concentration</h2>
        <p className="text-[12px] text-ink-3">Share of sales and gross profit in the period, across all customers.</p>
      </div>
      {!top ? (
        <p className="px-4 py-10 text-center text-[13px] text-ink-3">No orders in this period.</p>
      ) : (
        <div className="px-4 py-3">
          {top.salesShare !== null && top.salesShare >= 0.5 && shares.length > 0 ? (
            <div className="flex gap-2 rounded-md bg-warn-soft px-3 py-2 text-[12.5px] leading-snug text-warn">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                <strong className="font-semibold">{top.customerName}</strong> is {pct(top.salesShare, 1)} of sales
                {top.profitShare !== null && <> and {pct(top.profitShare, 1)} of gross profit</>}. Losing or delaying this one customer would hit most of the business.
              </p>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-2">Largest customer: <strong className="font-semibold">{top.customerName}</strong>, {pct(top.salesShare, 1)} of sales.</p>
          )}

          <ul className="mt-3 space-y-3">
            {shares.map((s) => (
              <li key={s.customerId} className={cn('rounded-md p-2 -mx-2', highlightId === s.customerId && 'bg-accent-soft ring-1 ring-accent/25')}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf(s.customerId) }} aria-hidden />
                    <span className="truncate">{s.customerName}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-3">{plural(s.orderCount, 'order')} · margin {pct(s.marginRatio)}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-[44px_1fr_auto] items-center gap-x-2 gap-y-1 text-[12px]">
                  <span className="text-ink-3">Sales</span>
                  <div className="h-2 rounded-full bg-subtle"><div className="h-2 rounded-full" style={{ width: `${(s.salesShare ?? 0) * 100}%`, background: colorOf(s.customerId) }} /></div>
                  <span className="num min-w-[88px] text-ink sm:min-w-[150px]"><span className="font-semibold">{pct(s.salesShare, 1)}</span> <span className="hidden text-ink-3 sm:inline">{money(s.salesCents, { whole: true })}</span></span>
                  <span className="text-ink-3">Profit</span>
                  <div className="h-2 rounded-full bg-subtle"><div className="h-2 rounded-full opacity-60" style={{ width: `${Math.max(0, s.profitShare ?? 0) * 100}%`, background: colorOf(s.customerId) }} /></div>
                  <span className="num min-w-[88px] text-ink sm:min-w-[150px]"><span className="font-semibold">{pct(s.profitShare, 1)}</span> <span className={cn('hidden sm:inline', s.grossProfitCents < 0 ? 'text-loss' : 'text-ink-3')}>{money(s.grossProfitCents, { whole: true })}</span></span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
