'use client'
import { useState } from 'react'
import { CircleAlert, CircleCheck, SlidersHorizontal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Check } from '@/lib/metrics'
import type { SourceStatus } from '@/lib/sync-core'
import { cn } from '@/lib/utils'

/** Page title, a short subtitle, the data status, and the filters. Filters fold away on a phone. */
export function TopBar({ title, subtitle, status, controls }: { title: string; subtitle?: React.ReactNode; status: React.ReactNode; controls?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-3 pb-5 pt-6">
      <div className="mr-auto min-w-0">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {status}
        {controls && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="page-filters"
            className={cn('inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium sm:hidden', open ? 'border-navy bg-navy text-white' : 'border-line bg-surface text-ink')}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />Filters
          </button>
        )}
      </div>
      {controls && (
        <div id="page-filters" className={cn('basis-full flex-col gap-2 sm:flex sm:basis-auto sm:flex-row sm:items-center', open ? 'flex' : 'hidden')}>
          {controls}
        </div>
      )}
    </header>
  )
}

/**
 * One pill for "can I trust these numbers": every source synced and every reconciliation check
 * passing. The details (and the connect buttons) open from it.
 */
export function StatusPill({ sources, checks, note, children }: { sources: SourceStatus[]; checks: Check[]; note?: string | null; children: React.ReactNode }) {
  const broken = sources.filter((s) => s.configured && !s.ok)
  const failing = checks.filter((c) => !c.ok)
  const ok = broken.length === 0 && failing.length === 0
  const label = ok
    ? 'Data up to date'
    : failing.length
      ? `${failing.length} check${failing.length > 1 ? 's' : ''} failing`
      : `${broken.length} source${broken.length > 1 ? 's' : ''} need${broken.length > 1 ? '' : 's'} attention`
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium',
          ok ? 'border-gain/25 bg-gain-soft text-gain hover:border-gain/50' : 'border-loss/30 bg-loss-soft text-loss hover:border-loss/60',
        )}
      >
        {ok ? <CircleCheck className="h-4 w-4" aria-hidden /> : <CircleAlert className="h-4 w-4" aria-hidden />}
        {label}
        <span className="hidden font-normal opacity-80 md:inline">· {note ?? `${checks.length}/${checks.length} ledger checks`}</span>
      </PopoverTrigger>
      <PopoverContent className="w-[min(620px,calc(100vw-24px))] p-3">
        <p className="mb-2 px-1 text-[12.5px] text-ink-2">
          {failing.length
            ? <span className="text-loss">{failing.length} of {checks.length} reconciliation checks fail. See Settings for the list.</span>
            : <>All {checks.length} ledger checks pass: every total matches the spreadsheet to the cent.{note && <> {note.charAt(0).toUpperCase() + note.slice(1)}.</>}</>}
        </p>
        {children}
      </PopoverContent>
    </Popover>
  )
}
