'use client'
import { useMemo, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Select } from '@/components/ui/select'
import {
  allocateCredits, applyLiveStatus, cashPosition, concentration, creditTotals, filterOrders, netBusinessProfit, profitAfterCredits,
  reconcileLedger, timeSeries, totals, unitsByOrder,
} from '@/lib/metrics'
import {
  comparisonFor, coverageFor, formatDate, formatRange, presetRange, PRESETS, type DateRange, type Granularity, type PresetId,
} from '@/lib/periods'
import type { FxResult, Ledger, Overhead } from '@/lib/types'
import { CurrencyProvider, useMoney } from '@/components/currency'
import { OverheadsPanel } from './overheads-panel'
import { CashCalendarPanel } from './cash-calendar'
import { XeroBar } from './xero-bar'
import type { XeroState } from '@/lib/data-source'
import { matchOrders } from '@/lib/xero/map'
import { CurrencyNote, CurrencySwitch } from './currency-switch'
import { CashPositionPanel } from './cash-position'
import { ConcentrationPanel } from './concentration'
import { Kpis } from './kpis'
import { NeedsAttention } from './needs-attention'
import { OrderDrawer } from './order-drawer'
import { OrdersTable } from './orders-table'
import { PeriodControl } from './period-control'
import { ReconcileBadge } from './reconcile-badge'
import { TrendChart } from './trend-chart'

interface Props {
  ledger: Ledger
  today: string
  fx: FxResult
  overheads: Overhead[]
  overheadsSaved: boolean
  overheadsError: string | null
  overheadsWritable: boolean
  xero: XeroState
  notice: string | null
}

export function Dashboard(props: Props) {
  return (
    <CurrencyProvider fx={props.fx}>
      <DashboardBody {...props} />
    </CurrencyProvider>
  )
}

function DashboardBody({ ledger: rawLedger, today, overheads, overheadsSaved, overheadsError, overheadsWritable, xero, notice }: Props) {
  const { fx } = useMoney()
  // Reconcile against the untouched ledger; everything else uses Xero's live statuses where found.
  const checks = useMemo(() => reconcileLedger(rawLedger), [rawLedger])
  const live = useMemo(() => {
    if (!xero.snapshot) return null
    return applyLiveStatus(rawLedger.orders, matchOrders(rawLedger.orders, xero.snapshot.invoices))
  }, [rawLedger, xero.snapshot])
  const ledger = useMemo(() => (live ? { ...rawLedger, orders: live.orders } : rawLedger), [rawLedger, live])
  const coverage = useMemo(() => coverageFor(ledger.orders.map((o) => o.date), ledger.meta.snapshotDate), [ledger])
  const units = useMemo(() => unitsByOrder(ledger.lines), [ledger])
  const allocation = useMemo(() => allocateCredits(ledger.creditNotes), [ledger])

  const [preset, setPreset] = useState<PresetId>('all')
  const [custom, setCustom] = useState<DateRange>({ start: coverage.start, end: coverage.end })
  const [customerId, setCustomerId] = useState<string>('')
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)

  const range: DateRange = useMemo(
    () => (preset === 'custom' ? custom : presetRange(preset, today, coverage)),
    [preset, custom, today, coverage],
  )
  const comparison = useMemo(() => comparisonFor(preset, range, coverage), [preset, range, coverage])
  const customer = customerId || null

  const view = useMemo(() => {
    const current = filterOrders(ledger.orders, { range, customerId: customer })
    const t = totals(current, units)
    const credits = creditTotals(ledger.creditNotes, ledger.orders, { range, customerId: customer })
    let previous = null
    if (comparison.valid) {
      const prevOrders = filterOrders(ledger.orders, { range: comparison.previous, customerId: customer })
      const pt = totals(prevOrders, units)
      const pc = creditTotals(ledger.creditNotes, ledger.orders, { range: comparison.previous, customerId: customer })
      previous = { totals: pt, credits: pc, afterCreditsCents: profitAfterCredits(pt.grossProfitCents, pc) }
    }
    return {
      orders: current,
      totals: t,
      credits,
      afterCreditsCents: profitAfterCredits(t.grossProfitCents, credits),
      previous,
      series: timeSeries(current, range, granularity),
      // Concentration ignores the customer filter: shares only mean something against all customers.
      shares: concentration(filterOrders(ledger.orders, { range })),
      cash: cashPosition(current),
    }
  }, [ledger, units, range, comparison, customer, granularity])

  // Overheads are company-wide, so net profit is only meaningful without a customer filter.
  const net = useMemo(
    () => netBusinessProfit({ grossAfterCreditsEurCents: view.afterCreditsCents, overheads, range, today, fx: fx.ok ? fx.fx : null }),
    [view.afterCreditsCents, overheads, range, today, fx],
  )

  const openOrder = openOrderId ? ledger.orders.find((o) => o.id === openOrderId) ?? null : null
  const presetLabel = PRESETS.find((p) => p.id === preset)?.label ?? ''
  const customerName = ledger.customers.find((c) => c.id === customerId)?.name
  const snapshot = xero.snapshot
    ? `${formatDate(xero.snapshot.fetchedAt.slice(0, 10))} ${new Date(xero.snapshot.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} (live, Xero)`
    : formatDate(ledger.meta.snapshotDate)

  return (
    <>
      {ledger.meta.isSample && (
        <div role="status" className="mt-4 flex items-center gap-2 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-warn">
          <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
          <span><strong className="font-semibold">Sample data.</strong> Every figure on this screen is fake. Import the real ledger with <code>npm run import</code>.</span>
        </div>
      )}

      <div className="pt-5">
        <XeroBar xero={xero} summary={live?.summary ?? null} ledgerImported={formatDate(ledger.meta.importedAt.slice(0, 10))} ledgerSnapshot={formatDate(ledger.meta.snapshotDate)} notice={notice} />
      </div>

      <header className="flex flex-col gap-4 pt-2 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">Profit overview</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            <span className="font-medium text-ink">{presetLabel}</span>
            {', '}{formatRange(range)}{customerName ? `, ${customerName} only` : ', all customers'}.{' '}
            Xero status as of {snapshot}.{' '}
            <CurrencyNote />
          </p>
        </div>
        <div className="grid grid-cols-[auto_1fr] items-center gap-2 sm:flex sm:flex-wrap">
          <ReconcileBadge checks={checks} />
          <CurrencySwitch />
          <label className="sr-only" htmlFor="customer-filter">Customer</label>
          <Select id="customer-filter" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="min-w-0 sm:w-56">
            <option value="">All customers</option>
            {ledger.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <PeriodControl
            preset={preset}
            range={range}
            coverage={coverage}
            onPreset={setPreset}
            onCustom={(r) => { setCustom(r); setPreset('custom') }}
          />
        </div>
      </header>

      <Kpis
        totals={view.totals}
        credits={view.credits}
        afterCreditsCents={view.afterCreditsCents}
        previous={view.previous}
        comparison={comparison}
        previousLabel={comparison.valid ? formatRange(comparison.previous) : null}
        net={customer ? { status: 'filtered' } : net}
      />

      <div className="mt-4">
        <TrendChart
          series={view.series}
          granularity={granularity}
          onGranularity={setGranularity}
          empty={view.orders.length === 0}
          range={range}
          coverageEnd={coverage.end}
          onShowAllTime={() => setPreset('all')}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5">
          <ConcentrationPanel shares={view.shares} highlightId={customer} customerOrder={ledger.customers.map((c) => c.id)} />
        </div>
        <div className="min-w-0 xl:col-span-7">
          <CashPositionPanel cash={view.cash} snapshot={snapshot} supplierName={ledger.suppliers[0]?.name ?? 'supplier'} filtered={preset !== 'all' || !!customer} onOpenOrder={setOpenOrderId} />
        </div>
      </div>

      <div className="mt-4">
        <NeedsAttention ledger={ledger} customerId={customer} allocation={allocation} snapshot={formatDate(ledger.meta.snapshotDate)} onOpenOrder={setOpenOrderId} />
      </div>

      <div className="mt-4">
        <CashCalendarPanel orders={ledger.orders} overheads={overheads} today={today} snapshot={xero.snapshot} onOpenOrder={setOpenOrderId} />
      </div>

      <div className="mt-4">
        <OverheadsPanel overheads={overheads} saved={overheadsSaved} loadError={overheadsError} writable={overheadsWritable} today={today} />
      </div>

      <div className="mt-4">
        <OrdersTable
          orders={view.orders}
          totalInLedger={ledger.orders.length}
          units={units}
          exceptions={ledger.exceptions}
          customers={ledger.customers}
          customerId={customerId}
          onCustomer={setCustomerId}
          onOpenOrder={setOpenOrderId}
          periodEmpty={view.orders.length === 0}
        />
      </div>

      <footer className="mt-8 space-y-1 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-3">
        <p>All trade in this ledger is in EUR. Fone Nova&apos;s books are kept in GBP, so exchange-rate movement between invoice and payment is a real risk that is not measured here.</p>
        <p>Net business profit covers the overheads you enter. Fone Nova&apos;s own shipping beyond the invoices, and bank, FX and payment fees, are not in the data.</p>
      </footer>

      <OrderDrawer
        order={openOrder}
        ledger={ledger}
        units={units}
        allocation={allocation}
        snapshot={snapshot}
        ledgerSnapshot={formatDate(ledger.meta.snapshotDate)}
        onClose={() => setOpenOrderId(null)}
      />
    </>
  )
}
