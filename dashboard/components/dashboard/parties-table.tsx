'use client'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { marginBand, type PartyRow } from '@/lib/metrics'
import { count, pct, plural } from '@/lib/format'
import { useMoney } from '@/components/currency'
import { formatDate } from '@/lib/periods'
import { cn } from '@/lib/utils'

/** Customers or suppliers for the selected period: one row each, biggest first. */
export function PartiesTable({ kind, rows, periodLabel, onPick }: {
  kind: 'customer' | 'supplier'
  rows: PartyRow[]
  periodLabel: string
  /** Customers only: show that customer's orders. */
  onPick?: (id: string) => void
}) {
  const { money } = useMoney()
  const customer = kind === 'customer'
  const sales = rows.reduce((n, r) => n + r.salesCents, 0)
  return (
    <section aria-labelledby={`${kind}-title`} className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 id={`${kind}-title`} className="text-[15px] font-semibold text-ink">{customer ? 'Customers' : 'Suppliers'} <span className="ml-1 text-ink-3">{rows.length}</span></h2>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
          {periodLabel}. Credits are this {kind}&apos;s own credit notes dated in the period (credits shared with another {kind} are left out).{' '}
          {customer ? 'Still owed is what clients have not paid yet, as Xero shows it.' : 'We owe is what Fone Nova has not paid yet, as Xero shows it.'}
          {customer && ' Select a customer to see their orders.'}
        </p>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[980px] text-[12.5px]">
          <caption className="sr-only">{customer ? 'Customers' : 'Suppliers'} in the selected period</caption>
          <thead className="bg-subtle text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2 pl-4 text-left font-medium">{customer ? 'Customer' : 'Supplier'}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Orders</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Units</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{customer ? 'Sales' : 'Bought'}</th>
              {customer && <th scope="col" className="px-3 py-2 text-right font-medium">Share</th>}
              <th scope="col" className="px-3 py-2 text-right font-medium">Gross profit</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Margin</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{customer ? 'Credits issued' : 'Credits received'}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{customer ? 'Still owed' : 'We owe'}</th>
              <th scope="col" className="px-3 py-2 pr-4 text-left font-medium">Last order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const band = marginBand(r.marginRatio)
              const pick = onPick ? () => onPick(r.id) : undefined
              return (
                <tr
                  key={r.id}
                  tabIndex={pick ? 0 : undefined}
                  onClick={pick}
                  onKeyDown={pick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } } : undefined}
                  className={cn('border-t border-line', pick && 'group cursor-pointer outline-none hover:bg-subtle focus-visible:bg-accent-soft')}
                >
                  <td className="px-3 py-2 pl-4 font-medium text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      {r.name}
                      {r.lossCount > 0 && <Badge tone="loss">{r.lossCount} loss-making</Badge>}
                      {pick && <ArrowRight className="h-3.5 w-3.5 text-ink-3 opacity-0 group-hover:opacity-100" aria-hidden />}
                    </span>
                  </td>
                  <td className="num px-3 py-2">{count(r.orderCount)}</td>
                  <td className="num px-3 py-2 text-ink-2">{count(r.units)}</td>
                  <td className="num px-3 py-2">{money(customer ? r.salesCents : r.costCents)}</td>
                  {customer && <td className="num px-3 py-2 text-ink-2">{pct(sales ? r.salesCents / sales : null, 1)}</td>}
                  <td className={cn('num px-3 py-2 font-semibold', r.grossProfitCents < 0 ? 'text-loss' : 'text-ink')}>{money(r.grossProfitCents)}</td>
                  <td className={cn('num px-3 py-2', band === 'loss' ? 'text-loss' : band === 'thin' ? 'text-warn' : 'text-ink')}>{pct(r.marginRatio)}</td>
                  <td className="num px-3 py-2 text-ink-2">{r.creditCount ? `${money(r.creditsCents)} (${r.creditCount})` : '–'}</td>
                  <td className="num px-3 py-2">
                    {money(r.openCents)}
                    {r.unknownCount > 0 && <div className="text-[11px] text-warn">+ {plural(r.unknownCount, 'order')} not in Xero</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 pr-4 text-ink-2">{r.lastOrder ? formatDate(r.lastOrder) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-ink-3">No orders in this period.</div>}
      </div>
    </section>
  )
}
