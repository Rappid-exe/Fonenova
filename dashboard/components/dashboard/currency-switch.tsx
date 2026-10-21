'use client'
import { Segmented } from '@/components/ui/segmented'
import { useMoney } from '@/components/currency'
import { formatDate } from '@/lib/periods'

export function CurrencySwitch() {
  const { currency, setCurrency, fx } = useMoney()
  if (!fx.ok) {
    // Same control, GBP greyed out: the reason sits in the tooltip, not on every page.
    return (
      <div className="inline-flex h-9 items-center rounded-md border border-line bg-subtle p-0.5" title={`GBP unavailable: ${fx.reason}. No rate is guessed.`}>
        <span className="flex h-full items-center rounded bg-surface px-2.5 text-[12.5px] font-medium text-ink shadow-sm">EUR €</span>
        <span aria-disabled="true" className="flex h-full cursor-not-allowed items-center px-2.5 text-[12.5px] text-ink-3/60">GBP £</span>
        <span className="sr-only">GBP unavailable: {fx.reason}</span>
      </div>
    )
  }
  return (
    <Segmented
      label="Display currency"
      value={currency}
      onChange={setCurrency}
      options={[{ value: 'EUR', label: 'EUR €' }, { value: 'GBP', label: 'GBP £' }]}
      className="h-9 items-center"
    />
  )
}

/** Shown in the subtitle only while figures are converted to GBP. */
export function CurrencyNote() {
  const { currency, fx } = useMoney()
  if (!fx.ok || currency === 'EUR') return null
  const r = fx.fx
  return (
    <span title={`${r.source}. Booked figures are EUR; GBP will not match Xero, which converts at each invoice's own date.`}>
      {' · '}in GBP at €1 = £{r.rate.toFixed(4)} (ECB, {formatDate(r.rateDate)})
    </span>
  )
}
