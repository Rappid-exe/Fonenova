'use client'
/**
 * Display currency for the whole dashboard. Booked figures are EUR (trade) or GBP (overheads);
 * this only changes how they are shown, converting each figure once at the ECB reference rate.
 */
import { createContext, useContext, useMemo, useState } from 'react'
import { convertCents, type Currency } from '@/lib/metrics'
import { money as fmt, moneyCompact } from '@/lib/format'
import type { Cents, FxResult } from '@/lib/types'

type Opts = { sign?: boolean; whole?: boolean }

interface MoneyCtx {
  currency: Currency
  setCurrency: (c: Currency) => void
  fx: FxResult
  /** Format a booked amount (EUR unless `from` says otherwise) in the display currency. */
  money: (cents: Cents, opts?: Opts, from?: Currency) => string
  compact: (cents: Cents, from?: Currency) => string
  /** Convert a booked amount to the display currency, or null if no rate is available. */
  toDisplay: (cents: Cents, from?: Currency) => Cents | null
  converted: boolean
}

const Ctx = createContext<MoneyCtx | null>(null)

export function CurrencyProvider({ fx, children }: { fx: FxResult; children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('EUR')
  const value = useMemo<MoneyCtx>(() => {
    const rate = fx.ok ? fx.fx : null
    // Without a rate GBP cannot be shown at all: the switch is disabled and EUR stays.
    const display: Currency = currency === 'GBP' && !rate ? 'EUR' : currency
    const toDisplay = (cents: Cents, from: Currency = 'EUR') => convertCents(cents, from, display, rate)
    return {
      currency: display,
      setCurrency,
      fx,
      toDisplay,
      money: (cents, opts = {}, from = 'EUR') => {
        const v = toDisplay(cents, from)
        return v === null ? 'rate unavailable' : fmt(v, display, opts)
      },
      compact: (cents, from = 'EUR') => {
        const v = toDisplay(cents, from)
        return v === null ? '' : moneyCompact(v, display)
      },
      converted: display === 'GBP',
    }
  }, [currency, fx])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMoney(): MoneyCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMoney must be used inside CurrencyProvider')
  return v
}
