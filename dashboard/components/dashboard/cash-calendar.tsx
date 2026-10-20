'use client'
import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Segmented } from '@/components/ui/segmented'
import { useMoney } from '@/components/currency'
import { cashCalendar, type CashEntry } from '@/lib/metrics'
import { money as fmtMoney } from '@/lib/format'
import { formatDate } from '@/lib/periods'
import type { Order, Overhead, XeroSnapshot } from '@/lib/types'
import { cn } from '@/lib/utils'

type Window = '30' | '60' | '90'

export function CashCalendarPanel({ orders, overheads, today, snapshot, onOpenOrder }: {
  orders: Order[]
  overheads: Overhead[]
  today: string
  snapshot: XeroSnapshot | null
  onOpenOrder: (id: string) => void
}) {
  const { money, fx, currency } = useMoney()
  const [win, setWin] = useState<Window>('60')
  const cal = useMemo(
    () => cashCalendar({
      orders, overheads, today, days: Number(win), fx: fx.ok ? fx.fx : null,
      bank: snapshot ? { balances: snapshot.bankBalances, currency: snapshot.baseCurrency } : null,
    }),
    [orders, overheads, today, win, fx, snapshot],
  )
  const base = cal.start?.currency
  const gapDays = cal.days.filter((d) => d.fundingGap).length
  const lowDays = cal.days.filter((d) => d.belowZero).length

  const Entry = ({ e }: { e: CashEntry }) => (
    <li className="flex items-center justify-between gap-3 py-1">
      <span className="flex min-w-0 items-center gap-2">
        {e.kind === 'in' ? <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-gain" aria-label="Money in" /> : <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-label="Money out" />}
        {e.orderId ? (
          <button type="button" onClick={() => onOpenOrder(e.orderId!)} className="truncate text-left text-accent hover:underline">{e.label}</button>
        ) : (
          <span className="truncate text-ink">{e.label}</span>
        )}
        {e.category && <Badge tone={e.category === 'business' ? 'accent' : 'neutral'}>{e.category === 'business' ? 'Business' : 'Personal'}</Badge>}
        {e.fundingGap && <Badge tone="loss">Funding gap</Badge>}
      </span>
      <span className={cn('num shrink-0', e.amountCents > 0 ? 'text-gain' : 'text-ink')}>
        {e.currency === currency ? money(e.amountCents, { sign: true }, e.currency) : <>{fmtMoney(e.amountCents, e.currency, { sign: true })} <span className="text-ink-3">({money(e.amountCents, { sign: true }, e.currency)})</span></>}
      </span>
    </li>
  )

  return (
    <section aria-labelledby="cal-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="cal-title" className="flex items-center gap-1.5 text-[14px] font-semibold text-ink"><CalendarClock className="h-4 w-4 text-ink-3" aria-hidden />Cash calendar</h2>
          <p className="text-[12px] text-ink-3">Open client and supplier balances by due date, plus overheads, from today. Whole business, not filtered.</p>
        </div>
        <Segmented label="Days ahead" value={win} onChange={setWin} options={[{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }]} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line bg-subtle/60 px-4 py-2.5 text-[12.5px]">
        {cal.start && base ? (
          <span>Starting bank balance (Xero, {base}): <span className="font-semibold text-ink">{fmtMoney(cal.start.balanceCents, base)}</span>
            <span className="text-ink-3"> across {cal.start.accounts.length} account{cal.start.accounts.length === 1 ? '' : 's'}</span></span>
        ) : (
          <span className="text-ink-3">No running balance: {cal.noBalanceReason?.charAt(0).toLowerCase()}{cal.noBalanceReason?.slice(1)}.</span>
        )}
        {gapDays > 0 && <span className="text-loss">{gapDays} day{gapDays > 1 ? 's' : ''} where you pay the supplier before the client pays</span>}
        {lowDays > 0 && <span className="flex items-center gap-1 font-medium text-loss"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />Balance goes below zero on {lowDays} day{lowDays > 1 ? 's' : ''}</span>}
      </div>

      {cal.overdue.length > 0 && (
        <div className="border-b border-line px-4 py-2.5">
          <h3 className="text-[12.5px] font-semibold text-loss">Overdue ({cal.overdue.length})</h3>
          <p className="text-[11.5px] text-ink-3">Overdue bills count against the balance from today. Overdue client payments are not counted until they arrive.</p>
          <ul className="mt-1 divide-y divide-line text-[12.5px]">
            {cal.overdue.map((e, i) => (
              <li key={i} className="flex items-center gap-3"><span className="w-16 shrink-0 text-[12px] text-ink-3">{formatDate(e.date!).replace(/ \d{4}$/, '')}</span><ul className="min-w-0 flex-1"><Entry e={e} /></ul></li>
            ))}
          </ul>
        </div>
      )}

      {cal.days.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-ink-3">Nothing dated in the next {win} days.</p>
      ) : (
        <ol className="divide-y divide-line">
          {cal.days.map((d) => (
            <li key={d.date} className={cn('grid grid-cols-[minmax(0,1fr)] gap-x-4 px-4 py-2 sm:grid-cols-[88px_minmax(0,1fr)_140px]', d.belowZero && 'bg-loss-soft/40', !d.belowZero && d.fundingGap && 'bg-warn-soft/40')}>
              <div className="text-[12.5px] font-medium text-ink">{formatDate(d.date).replace(/ \d{4}$/, '')}</div>
              <ul className="min-w-0 text-[12.5px]">{d.entries.map((e, i) => <Entry key={i} e={e} />)}</ul>
              <div className="text-[12px] sm:text-right">
                {d.balanceCents !== null && base ? (
                  <><span className="text-ink-3 sm:block">Balance after</span> <span className={cn('num font-semibold', d.belowZero ? 'text-loss' : 'text-ink')}>{fmtMoney(d.balanceCents, base)}</span></>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {(cal.undated.length > 0 || cal.laterCount > 0) && (
        <div className="border-t border-line px-4 py-2.5 text-[12.5px]">
          {cal.laterCount > 0 && <p className="text-ink-3">{cal.laterCount} more item{cal.laterCount > 1 ? 's' : ''} due after the next {win} days.</p>}
          {cal.undated.length > 0 && (
            <details>
              <summary className="cursor-pointer text-ink-2">
                {cal.undated.length} open balance{cal.undated.length > 1 ? 's' : ''} with no due date yet: due dates come from Xero
              </summary>
              <ul className="mt-1 divide-y divide-line">{cal.undated.map((e, i) => <Entry key={i} e={e} />)}</ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
