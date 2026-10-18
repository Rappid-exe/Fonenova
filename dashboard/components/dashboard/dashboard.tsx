'use client'
import { useMemo, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Select } from '@/components/ui/select'
import {
  allocateCredits, cashPosition, concentration, creditTotals, filterOrders, profitAfterCredits,
  reconcileLedger, timeSeries, totals, unitsByOrder,
} from '@/lib/metrics'
import {
  comparisonFor, coverageFor, formatDate, formatRange, presetRange, PRESETS, type DateRange, type Granularity, type PresetId,
} from '@/lib/periods'
import type { Ledger } from '@/lib/types'
import { CashPositionPanel } from './cash-position'
import { ConcentrationPanel } from './concentration'
import { Kpis } from './kpis'
import { NeedsAttention } from './needs-attention'
import { OrderDrawer } from './order-drawer'
import { OrdersTable } from './orders-table'
import { PeriodControl } from './period-control'
import { ReconcileBadge } from './reconcile-badge'
import { TrendChart } from './trend-chart'

export function Dashboard({ ledger, today }: { ledger: Ledger; today: string }) {
  const coverage = useMemo(() => coverageFor(ledger.orders.map((o) => o.date), ledger.meta.snapshotDate), [ledger])
  const units = useMemo(() => unitsByOrder(ledger.lines), [ledger])
  const allocation = useMemo(() => allocateCredits(ledger.creditNotes), [ledger])
  const checks = useMemo(() => reconcileLedger(ledger), [ledger])

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

  const openOrder = openOrderId ? ledger.orders.find((o) => o.id === openOrderId) ?? null : null
  const presetLabel = PRESETS.find((p) => p.id === preset)?.label ?? ''
  const customerName = ledger.customers.find((c) => c.id === customerId)?.name
  const snapshot = formatDate(ledger.meta.snapshotDate)

  return (
    <>
      {ledger.meta.isSample && (
        <div role="status" className="mt-4 flex items-center gap-2 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-warn">
          <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
          <span><strong className="font-semibold">Sample data.</strong> Every figure on this screen is fake. Import the real ledger with <code>npm run import</code>.</span>
        </div>
      )}

      <header className="flex flex-col gap-4 pt-6 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">Profit overview</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            <span className="font-medium text-ink">{presetLabel}</span>
            {', '}{formatRange(range)}{customerName ? `, ${customerName} only` : ', all customers'}.{' '}
            Gross figures in EUR. Xero status as of {snapshot}.
          </p>
        </div>
        <div className="grid grid-cols-[auto_1fr] items-center gap-2 sm:flex sm:flex-wrap">
          <ReconcileBadge checks={checks} />
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
        <NeedsAttention ledger={ledger} customerId={customer} allocation={allocation} snapshot={snapshot} onOpenOrder={setOpenOrderId} />
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
        <p>Gross profit only. Fone Nova&apos;s own shipping costs beyond the invoices, bank, FX and payment fees, and overheads are not in the data, so net profit is not shown.</p>
      </footer>

      <OrderDrawer
        order={openOrder}
        ledger={ledger}
        units={units}
        allocation={allocation}
        snapshot={snapshot}
        onClose={() => setOpenOrderId(null)}
      />
    </>
  )
}
