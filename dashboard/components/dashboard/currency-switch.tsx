'use client'
import { Segmented } from '@/components/ui/segmented'
import { useMoney } from '@/components/currency'
import { formatDate } from '@/lib/periods'

export function CurrencySwitch() {
  const { currency, setCurrency, fx } = useMoney()
  if (!fx.ok) {
    return (
      <span className="inline-flex h-9 items-center rounded-md border border-line px-2.5 text-[12.5px] text-ink-3" title={fx.reason}>
        EUR only: no exchange rate
      </span>
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

/** One line under the page title saying exactly what the figures are. */
export function CurrencyNote() {
  const { currency, fx } = useMoney()
  if (!fx.ok) {
    return <span className="text-warn">GBP unavailable: {fx.reason.charAt(0).toLowerCase() + fx.reason.slice(1)}. No rate is guessed.</span>
  }
  const r = fx.fx
  const fetched = new Date(r.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return currency === 'EUR' ? (
    <>Figures in EUR, as booked.</>
  ) : (
    <>
      <span className="font-medium text-ink">Converted at today&apos;s rate</span>: €1 = £{r.rate.toFixed(5)}, {r.source}, rate for {formatDate(r.rateDate)}, fetched {fetched}. Booked figures are EUR; GBP will not match Xero, which converts at each invoice&apos;s own date.
    </>
  )
}
