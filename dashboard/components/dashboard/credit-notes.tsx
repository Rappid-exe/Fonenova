'use client'
import { useMemo, useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import { useMoney } from '@/components/currency'
import { formatDate } from '@/lib/periods'
import type { CreditNote } from '@/lib/types'

type Side = 'all' | 'client' | 'supplier'

/** Every credit note dated in the period, both directions, with the ledger's own Xero check. */
export function CreditNotesTable({ notes, periodLabel, onOpenOrder }: { notes: CreditNote[]; periodLabel: string; onOpenOrder: (id: string) => void }) {
  const { money } = useMoney()
  const [side, setSide] = useState<Side>('all')
  const rows = useMemo(() => [...notes].filter((n) => side === 'all' || n.side === side).sort((a, b) => b.date.localeCompare(a.date)), [notes, side])
  const issued = notes.filter((n) => n.side === 'client').reduce((t, n) => t + n.amountCents, 0)
  const received = notes.filter((n) => n.side === 'supplier').reduce((t, n) => t + n.amountCents, 0)
  return (
    <section aria-labelledby="cn-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="cn-title" className="text-[15px] font-semibold text-ink">Credit notes <span className="ml-1 text-ink-3">{notes.length}</span></h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
            {periodLabel}, by the credit note&apos;s own date. Issued to customers {money(issued)}, received from suppliers {money(received)}, net effect on profit {money(received - issued, { sign: true })}.
          </p>
        </div>
        <Segmented<Side>
          label="Direction"
          value={side}
          onChange={setSide}
          options={[{ value: 'all', label: 'All' }, { value: 'client', label: 'Issued' }, { value: 'supplier', label: 'Received' }]}
        />
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[980px] text-[12.5px]">
          <caption className="sr-only">Credit notes in the selected period</caption>
          <thead className="bg-subtle text-ink-3">
            <tr>
              <th scope="col" className="px-3 py-2 pl-4 text-left font-medium">Credit note</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Date</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Direction</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Orders</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Covers</th>
              <th scope="col" className="px-3 py-2 pr-4 text-left font-medium">Xero shows</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={`${n.side}-${n.number}`} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-3 py-2 pl-4 font-medium text-ink">{n.number}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-2">{formatDate(n.date)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-2">{n.side === 'client' ? 'Issued to customer' : 'From supplier'}</td>
                <td className={`num px-3 py-2 font-semibold ${n.side === 'client' ? 'text-loss' : 'text-gain'}`}>{money(n.side === 'client' ? -n.amountCents : n.amountCents, { sign: true })}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {n.orderIds.length === 0 && <span className="text-ink-3">{n.refersToInvoices || '–'}</span>}
                    {n.orderIds.map((id) => (
                      <button key={id} type="button" onClick={() => onOpenOrder(id)} className="rounded border border-line px-1.5 py-px text-[11.5px] font-medium text-accent hover:border-accent">{id}</button>
                    ))}
                  </div>
                </td>
                <td className="max-w-[260px] px-3 py-2 text-ink-2">{n.covers || '–'}</td>
                <td className="max-w-[260px] px-3 py-2 pr-4 text-ink-2">{[n.xeroShows, n.check].filter(Boolean).join('. ') || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-ink-3">No credit notes in this period.</div>}
      </div>
    </section>
  )
}
