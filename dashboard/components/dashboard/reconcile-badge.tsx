'use client'
import { CircleAlert, ShieldCheck } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Check } from '@/lib/metrics'
import { cn } from '@/lib/utils'

export function ReconcileBadge({ checks }: { checks: Check[] }) {
  const failed = checks.filter((c) => !c.ok)
  const ok = failed.length === 0
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium',
          ok ? 'border-gain/25 bg-gain-soft text-gain hover:border-gain/50' : 'border-loss/30 bg-loss-soft text-loss',
        )}
      >
        {ok ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <CircleAlert className="h-4 w-4" aria-hidden />}
        {ok ? `Reconciled ${checks.length}/${checks.length}` : `${failed.length} check${failed.length > 1 ? 's' : ''} failing`}
      </PopoverTrigger>
      <PopoverContent className="w-[min(440px,calc(100vw-24px))] p-0">
        <div className="border-b border-line px-3 py-2.5">
          <div className="text-[13px] font-semibold text-ink">All-time figures vs the ledger</div>
          <p className="mt-0.5 text-[12.5px] text-ink-2">Recalculated from the order rows and checked to the cent against the Summary tab, the Orders TOTAL row and the Lines tab.</p>
        </div>
        <ul className="relative max-h-80 overflow-y-auto py-1">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 px-3 py-1.5 text-[12.5px]">
              <span className={cn('mt-0.5 font-semibold', c.ok ? 'text-gain' : 'text-loss')} aria-label={c.ok ? 'Pass' : 'Fail'}>{c.ok ? '✓' : '✕'}</span>
              <span className="flex-1 text-ink-2">{c.label}</span>
              <span className="num max-w-[45%] whitespace-normal text-ink">{c.detail}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** The same checks as a full list, for the Settings page. */
export function ChecksList({ checks }: { checks: Check[] }) {
  const failed = checks.filter((c) => !c.ok).length
  return (
    <section aria-labelledby="checks-title" className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 id="checks-title" className="text-[15px] font-semibold text-ink">Data checks <span className={cn('ml-1', failed ? 'text-loss' : 'text-gain')}>{failed ? `${failed} failing` : `${checks.length}/${checks.length} pass`}</span></h2>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">All-time figures recalculated from the order rows and checked to the cent against the ledger&apos;s Summary tab, Orders TOTAL row and Lines tab.</p>
      </div>
      <ul className="divide-y divide-line">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 px-4 py-2 text-[12.5px]">
            <span className={cn('mt-0.5 font-semibold', c.ok ? 'text-gain' : 'text-loss')} aria-label={c.ok ? 'Pass' : 'Fail'}>{c.ok ? '✓' : '✕'}</span>
            <span className="flex-1 text-ink-2">{c.label}</span>
            <span className="num max-w-[50%] text-ink">{c.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
