'use client'
import { useState } from 'react'
import { CalendarRange, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate, PRESETS, type Coverage, type DateRange, type PresetId } from '@/lib/periods'
import { cn } from '@/lib/utils'

export function PeriodControl({
  preset,
  range,
  coverage,
  onPreset,
  onCustom,
}: {
  preset: PresetId
  range: DateRange
  coverage: Coverage
  onPreset: (p: PresetId) => void
  onCustom: (r: DateRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange>(range)
  const invalid = !draft.start || !draft.end || draft.end < draft.start
  const label = PRESETS.find((p) => p.id === preset)?.label

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(range) }}>
      <PopoverTrigger asChild>
        <Button aria-label={`Reporting period: ${label}, ${formatDate(range.start)} to ${formatDate(range.end)}`} className="col-span-2 justify-between sm:col-span-1">
          <CalendarRange className="h-4 w-4 text-ink-3" aria-hidden />
          <span className="mr-auto sm:mr-0">{label}</span>
          <span className="hidden text-ink-3 sm:inline">{formatDate(range.start)} to {formatDate(range.end)}</span>
          <ChevronDown className="h-4 w-4 text-ink-3" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <div role="listbox" aria-label="Period presets" className="p-1.5">
          {PRESETS.filter((p) => p.id !== 'custom').map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={preset === p.id}
              onClick={() => { onPreset(p.id); setOpen(false) }}
              className={cn('flex h-8 w-full items-center justify-between rounded-md px-2.5 text-left text-[13px] hover:bg-subtle', preset === p.id ? 'font-medium text-ink' : 'text-ink-2')}
            >
              {p.label}
              {preset === p.id && <Check className="h-4 w-4 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
        <form
          className="border-t border-line p-3"
          onSubmit={(e) => { e.preventDefault(); if (!invalid) { onCustom(draft); setOpen(false) } }}
        >
          <div className="mb-2 flex items-center justify-between text-[12px] font-medium text-ink-2">
            Custom range
            {preset === 'custom' && <Check className="h-4 w-4 text-accent" aria-hidden />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11.5px] text-ink-3">
              From
              <input type="date" required value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="mt-1 h-8 w-full rounded-md border border-line px-2 text-[13px] text-ink" />
            </label>
            <label className="text-[11.5px] text-ink-3">
              To
              <input type="date" required value={draft.end} min={draft.start} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="mt-1 h-8 w-full rounded-md border border-line px-2 text-[13px] text-ink" />
            </label>
          </div>
          {draft.end && draft.start && draft.end < draft.start && <p className="mt-2 text-[12px] text-loss">End date is before the start date.</p>}
          <p className="mt-2 text-[11.5px] leading-snug text-ink-3">Ledger covers {formatDate(coverage.start)} to {formatDate(coverage.end)}.</p>
          <Button type="submit" variant="primary" size="sm" className="mt-3 w-full justify-center" disabled={invalid}>Apply range</Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
