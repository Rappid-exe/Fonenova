'use client'
import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react'
import { change, marginBand, marginChangePts, type CreditTotals, type NetProfit, type Totals } from '@/lib/metrics'
import type { Comparison } from '@/lib/periods'
import { count, pct, plural, pts } from '@/lib/format'
import { useMoney } from '@/components/currency'
import { money as fmtMoney } from '@/lib/format'
import { formatDate } from '@/lib/periods'
import { cn } from '@/lib/utils'

type Prev = { totals: Totals; credits: CreditTotals; afterCreditsCents: number } | null

type Kind = 'money' | 'count'
type Polarity = 'up-good' | 'neutral'

function Delta({ current, previous, kind, polarity = 'up-good', className }: { current: number; previous: number; kind: Kind; polarity?: Polarity; className?: string }) {
  const { money } = useMoney()
  const c = change(current, previous)
  const dir = c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : 'flat'
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus
  const tone = polarity === 'neutral' || dir === 'flat' ? 'text-ink-2' : dir === 'up' ? 'text-gain' : 'text-loss'
  const abs = kind === 'money' ? money(c.delta, { sign: true }) : count(c.delta, { sign: true })
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12px] font-medium', tone, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{abs}</span>
      {c.pct !== null && <span className="font-normal opacity-80">({pct(c.pct, 1, { sign: true })})</span>}
      <span className="sr-only"> vs previous period</span>
    </span>
  )
}

function PtsDelta({ current, previous }: { current: number | null; previous: number | null }) {
  const d = marginChangePts(current, previous)
  if (d === null) return <span className="text-[12px] text-ink-3">No margin in previous period</span>
  const dir = d > 0.0001 ? 'up' : d < -0.0001 ? 'down' : 'flat'
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12px] font-medium', dir === 'up' ? 'text-gain' : dir === 'down' ? 'text-loss' : 'text-ink-2')}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {pts(d)}
      <span className="sr-only"> vs previous period</span>
    </span>
  )
}

function Stat({ label, value, sub, delta, hint }: { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3.5">
      <div className="flex items-center gap-1 text-[12px] font-medium text-ink-3" title={hint}>
        {label}
        {hint && <Info className="h-3 w-3" aria-label={hint} />}
      </div>
      <div className="mt-1 truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>}
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  )
}

function NetRow({ net }: { net: NetProfit | { status: 'filtered' } }) {
  const { currency } = useMoney()
  const wrap = 'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-dashed border-line px-5 py-2.5 text-[12px] text-ink-3'
  if (net.status !== 'ok') {
    const why =
      net.status === 'filtered' ? 'Not shown for one customer: overheads and expenses belong to the whole business.'
      : net.status === 'not-entered' ? 'Not shown yet: enter business overheads in Settings, or import the expense log.'
      : 'Not shown: costs are in GBP and no exchange rate is available to combine them with EUR profit.'
    return <div className={wrap}><span className="font-medium text-ink-2">Net business profit</span><span>{why}</span></div>
  }
  const primary = currency === 'GBP' ? fmtMoney(net.netGbpCents, 'GBP') : fmtMoney(net.netEurCents, 'EUR')
  const other = currency === 'GBP' ? fmtMoney(net.netEurCents, 'EUR') : fmtMoney(net.netGbpCents, 'GBP')
  const negative = (currency === 'GBP' ? net.netGbpCents : net.netEurCents) < 0
  const parts = [
    net.businessOverheads.GBP ? `overheads ${fmtMoney(net.businessOverheads.GBP, 'GBP')}` : '',
    net.businessOverheads.EUR ? `overheads ${fmtMoney(net.businessOverheads.EUR, 'EUR')}` : '',
    net.businessExpensesCents ? `logged business expenses ${fmtMoney(net.businessExpensesCents, 'GBP')}` : '',
  ].filter(Boolean)
  return (
    <div className={wrap}>
      <span className="font-medium text-ink-2">Net business profit</span>
      <span className={cn('text-[14px] font-semibold', negative ? 'text-loss' : 'text-ink')}>{primary}</span>
      <span>({other})</span>
      <span className="basis-full">
        Gross after credit notes, less {parts.length ? parts.join(' and ') : 'no business costs'} up to {formatDate(net.chargedTo)}. Converted at the ECB rate. Personal and unreviewed items are not deducted.
      </span>
      {net.warnings.map((w) => <span key={w} className="basis-full text-warn">{w}.</span>)}
    </div>
  )
}

export function Kpis({
  totals: t,
  credits,
  afterCreditsCents,
  previous,
  comparison,
  previousLabel,
  net,
}: {
  totals: Totals
  credits: CreditTotals
  afterCreditsCents: number
  previous: Prev
  comparison: Comparison
  previousLabel: string | null
  net: NetProfit | { status: 'filtered' }
}) {
  const { money } = useMoney()
  const p = previous?.totals
  const band = marginBand(t.marginRatio)
  const goodsShare = t.grossProfitCents > 0 ? t.goodsMarginCents / t.grossProfitCents : null
  const empty = t.orderCount === 0

  return (
    <section aria-label="Key figures" className="space-y-3">
      <div className="text-[12px] text-ink-3" aria-live="polite">
        {comparison.valid
          ? <>Changes compare with the previous period, {previousLabel}.</>
          : <>No period comparison: {comparison.reason.charAt(0).toLowerCase() + comparison.reason.slice(1)}.</>}
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        {/* Primary: gross profit and margin */}
        <div className="rounded-lg border border-line bg-surface lg:col-span-5">
          <div className="grid grid-cols-[1.4fr_1fr] divide-x divide-line">
            <div className="px-5 pt-4 pb-3">
              <div className="text-[12.5px] font-medium text-ink-2">Gross profit</div>
              <div className={cn('mt-1 text-[30px] font-semibold leading-none tracking-[-0.02em]', t.grossProfitCents < 0 ? 'text-loss' : 'text-ink')}>
                {empty ? '€0.00' : money(t.grossProfitCents)}
              </div>
              <div className="mt-2 min-h-[18px]">{p && <Delta current={t.grossProfitCents} previous={p.grossProfitCents} kind="money" />}</div>
            </div>
            <div className="px-5 pt-4 pb-3">
              <div className="text-[12.5px] font-medium text-ink-2">Gross margin</div>
              <div className={cn('mt-1 text-[30px] font-semibold leading-none tracking-[-0.02em]', band === 'loss' ? 'text-loss' : band === 'thin' ? 'text-warn' : 'text-ink')}>
                {pct(t.marginRatio)}
              </div>
              <div className="mt-2 min-h-[18px]">{p && <PtsDelta current={t.marginRatio} previous={p.marginRatio} />}</div>
            </div>
          </div>

          <div className="border-t border-line px-5 py-3">
            <div className="flex items-baseline justify-between text-[12px] text-ink-3">
              <span>Where the profit came from</span>
              {goodsShare !== null && <span>{pct(1 - goodsShare, 1)} from shipping recharges</span>}
            </div>
            {goodsShare !== null && t.goodsMarginCents >= 0 && t.shippingMarginCents >= 0 ? (
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
                <div className="bg-accent" style={{ width: `${goodsShare * 100}%` }} />
                <div className="ml-[2px] flex-1 bg-accent/35" />
              </div>
            ) : null}
            <dl className="mt-2 grid grid-cols-2 gap-2 text-[12.5px]">
              <div>
                <dt className="flex items-center gap-1.5 text-ink-2"><span className="h-2 w-2 rounded-sm bg-accent" aria-hidden />Goods margin</dt>
                <dd className="mt-0.5 font-semibold text-ink">{money(t.goodsMarginCents)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-ink-2"><span className="h-2 w-2 rounded-sm bg-accent/35" aria-hidden />Shipping &amp; other margin</dt>
                <dd className={cn('mt-0.5 font-semibold', t.shippingMarginCents < 0 ? 'text-loss' : 'text-ink')}>{money(t.shippingMarginCents)}</dd>
              </div>
            </dl>
          </div>

          <NetRow net={net} />
        </div>

        {/* Secondary figures */}
        <div className="rounded-lg border border-line bg-surface lg:col-span-7">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-lg bg-line sm:grid-cols-3">
            <Stat label="Sales" value={money(t.salesCents)} sub="Client invoices" delta={p && <Delta current={t.salesCents} previous={p.salesCents} kind="money" />} />
            <Stat label="Cost of goods" value={money(t.costCents)} sub="Supplier invoices" delta={p && <Delta current={t.costCents} previous={p.costCents} kind="money" polarity="neutral" />} />
            <Stat label="Orders" value={count(t.orderCount)} sub={t.lossMakingCount || t.thinMarginCount ? `${plural(t.lossMakingCount, 'loss-maker')}, ${count(t.thinMarginCount)} under 0.5%` : 'None loss-making'} delta={p && <Delta current={t.orderCount} previous={p.orderCount} kind="count" />} />
            <Stat label="Units sold" value={count(t.units)} sub="Goods lines only" delta={p && <Delta current={t.units} previous={p.units} kind="count" />} />
            <Stat label="Avg profit per order" value={t.avgProfitPerOrderCents === null ? 'n/a' : money(t.avgProfitPerOrderCents)} sub="Gross, before credits" delta={p && p.avgProfitPerOrderCents !== null && t.avgProfitPerOrderCents !== null && <Delta current={t.avgProfitPerOrderCents} previous={p.avgProfitPerOrderCents} kind="money" />} />
            <Stat
              label="Gross profit after credits"
              value={<span className={afterCreditsCents < 0 ? 'text-loss' : undefined}>{money(afterCreditsCents)}</span>}
              sub={`${pct(t.salesCents ? afterCreditsCents / t.salesCents : null)} of sales`}
              hint="Gross profit + supplier credits received − client credits issued, for credit notes dated in the period"
              delta={previous && <Delta current={afterCreditsCents} previous={previous.afterCreditsCents} kind="money" />}
            />
          </div>

          {/* Credit notes: always two separate figures */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-line bg-subtle/60 px-4 py-3 text-[12.5px] sm:grid-cols-3">
            <div className="flex justify-between gap-2 sm:block">
              <div className="text-ink-3">Client credits issued</div>
              <div className="font-semibold text-ink">{money(credits.clientCreditsCents)} <span className="font-normal text-ink-3">· {credits.notes.filter((n) => n.side === 'client').length}</span></div>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <div className="text-ink-3">Supplier credits received</div>
              <div className="font-semibold text-ink">{money(credits.supplierCreditsCents)} <span className="font-normal text-ink-3">· {credits.notes.filter((n) => n.side === 'supplier').length}</span></div>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <div className="text-ink-3">Net effect on profit</div>
              <div className={cn('font-semibold', credits.netEffectCents < 0 ? 'text-loss' : credits.netEffectCents > 0 ? 'text-gain' : 'text-ink')}>{money(credits.netEffectCents, { sign: true })}</div>
            </div>
            <p className="text-[11.5px] text-ink-3 sm:col-span-3">
              Credit notes count in the period of their own date.
              {credits.unallocated.length > 0 && <> {plural(credits.unallocated.length, 'credit')} span{credits.unallocated.length === 1 ? 's' : ''} several orders and {credits.unallocated.length === 1 ? 'is' : 'are'} shown unallocated ({credits.unallocated.map((n) => n.number).join(', ')}).</>}
              {credits.excludedMixedCustomer.length > 0 && <> {plural(credits.excludedMixedCustomer.length, 'credit')} covering other customers too {credits.excludedMixedCustomer.length === 1 ? 'is' : 'are'} left out of this filter.</>}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
