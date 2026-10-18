'use client'
import { ArrowRight, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CashPosition } from '@/lib/metrics'
import { eur, plural } from '@/lib/format'
import { formatDate } from '@/lib/periods'
import { cn } from '@/lib/utils'

export function CashPositionPanel({
  cash,
  snapshot,
  supplierName,
  filtered,
  onOpenOrder,
}: {
  cash: CashPosition
  snapshot: string
  supplierName: string
  filtered: boolean
  onOpenOrder: (id: string) => void
}) {
  const gapCount = cash.open.filter((x) => x.fundingGap).length
  return (
    <section aria-labelledby="cash-title" className="flex h-full flex-col rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 id="cash-title" className="text-[14px] font-semibold text-ink">Cash position</h2>
          <p className="text-[12px] text-ink-3">{filtered ? 'Open balances on the orders in the current filter.' : 'Open balances on all matched orders.'}</p>
        </div>
        <Badge tone="outline"><Clock className="h-3 w-3" aria-hidden />As of {snapshot}</Badge>
      </div>

      <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
        <div className="bg-surface px-4 py-3">
          <dt className="text-[12px] font-medium text-ink-3">Clients still owe Fone Nova</dt>
          <dd className="mt-1 text-[17px] font-semibold text-ink">{eur(cash.clientsOweCents)}</dd>
          {cash.unknownClientBalances > 0 && <dd className="mt-0.5 text-[11.5px] text-warn">+ {plural(cash.unknownClientBalances, 'invoice')} not in Xero, balance unknown</dd>}
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="text-[12px] font-medium text-ink-3">Fone Nova still owes {supplierName}</dt>
          <dd className="mt-1 text-[17px] font-semibold text-ink">{eur(cash.weOweSupplierCents)}</dd>
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="text-[12px] font-medium text-ink-3">Difference (owed to us minus we owe)</dt>
          <dd className={cn('mt-1 text-[17px] font-semibold', cash.differenceCents < 0 ? 'text-loss' : 'text-ink')}>{eur(cash.differenceCents, { sign: true })}</dd>
        </div>
      </dl>

      {gapCount > 0 && (
        <div className="border-t border-line bg-loss-soft/60 px-4 py-2 text-[12.5px] text-loss">
          <strong className="font-semibold">Funding gap: {eur(cash.fundingGapCents)}</strong> owed to the supplier on {plural(gapCount, 'order')} where the client has not paid yet.
        </div>
      )}

      {cash.open.length === 0 ? (
        <p className="border-t border-line px-4 py-8 text-center text-[13px] text-ink-3">No open balances on these orders.</p>
      ) : (
        <div className="relative max-h-[300px] flex-1 overflow-y-auto border-t border-line">
          <table className="w-full text-[12.5px]">
            <caption className="sr-only">Open orders with balances as of {snapshot}</caption>
            <thead className="sticky top-0 bg-subtle text-ink-3">
              <tr>
                <th scope="col" className="px-4 py-1.5 text-left font-medium">Order</th>
                <th scope="col" className="hidden px-2 py-1.5 text-left font-medium sm:table-cell">Customer</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Client owes</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">We owe</th>
                <th scope="col" className="hidden px-4 py-1.5 text-right font-medium sm:table-cell"><span className="sr-only">Status</span></th>
              </tr>
            </thead>
            <tbody>
              {cash.open.map(({ order, clientOwesCents, weOweCents, fundingGap }) => (
                <tr key={order.id} className={cn('group border-t border-line', fundingGap && 'bg-loss-soft/30')}>
                  <td className="py-1.5 pl-4 pr-2">
                    <button type="button" onClick={() => onOpenOrder(order.id)} className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-accent hover:underline">
                      {order.id}<ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100" aria-hidden />
                    </button>
                    <div className="text-[11px] text-ink-3 sm:hidden">{order.customerName}</div>
                    {fundingGap && <div className="text-[11px] font-medium text-loss sm:hidden">Funding gap</div>}
                  </td>
                  <td className="hidden max-w-[160px] truncate px-2 py-1.5 text-ink-2 sm:table-cell">{order.customerName}<span className="text-ink-3"> · {formatDate(order.date)}</span></td>
                  <td className="num px-2 py-1.5">{clientOwesCents === null ? <span className="text-warn">Not in Xero</span> : clientOwesCents ? eur(clientOwesCents) : <span className="text-ink-3">Paid</span>}</td>
                  <td className="num py-1.5 pl-2 pr-4 sm:pr-2">{weOweCents ? eur(weOweCents) : <span className="text-ink-3">Paid</span>}</td>
                  <td className="hidden px-4 py-1.5 text-right sm:table-cell">{fundingGap && <Badge tone="loss">Funding gap</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
