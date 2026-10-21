'use client'
import { ArrowRight } from 'lucide-react'
import { type CashPosition, type NetProfit, type Overdue, type Totals } from '@/lib/metrics'
import { money as fmtMoney, pct, plural } from '@/lib/format'
import { useMoney } from '@/components/currency'
import { cn } from '@/lib/utils'

function Card({ label, value, sub, tone, action }: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'loss' | 'warn' | 'muted'
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-line bg-surface px-5 py-4">
      <div className="text-[13px] font-medium text-ink-2">{label}</div>
      <div className={cn('mt-1.5 truncate text-[26px] font-semibold leading-tight tracking-[-0.02em]', tone === 'loss' ? 'text-loss' : tone === 'warn' ? 'text-warn' : tone === 'muted' ? 'text-[18px] text-ink-3' : 'text-ink')}>{value}</div>
      {sub && <div className="mt-1 text-[13px] leading-snug text-ink-2">{sub}</div>}
      {action && (
        <button type="button" onClick={action.onClick} className="mt-auto inline-flex items-center gap-1 self-start pt-3 text-[13px] font-medium text-accent hover:underline">
          {action.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}

/** The four numbers a manager checks first. Everything else is one click away. */
export function Headline({ totals: t, afterCreditsCents, net, cash, overdue, snapshot, onSettings, onExceptions }: {
  totals: Totals
  afterCreditsCents: number
  net: NetProfit | { status: 'filtered' }
  cash: CashPosition
  overdue: Overdue
  snapshot: string
  onSettings: () => void
  onExceptions: () => void
}) {
  const { money, currency } = useMoney()

  let netCard: React.ReactNode
  if (net.status === 'ok') {
    const v = currency === 'GBP' ? net.netGbpCents : net.netEurCents
    netCard = (
      <Card
        label="Net business profit"
        value={currency === 'GBP' ? fmtMoney(net.netGbpCents, 'GBP') : fmtMoney(net.netEurCents, 'EUR')}
        tone={v < 0 ? 'loss' : undefined}
        sub={net.warnings.length ? <span className="text-warn">{net.warnings[0]}</span> : 'After overheads and business expenses'}
      />
    )
  } else if (net.status === 'filtered') {
    netCard = <Card label="Net business profit" value="Whole business only" tone="muted" sub="Overheads belong to the whole business, so this hides while one customer is selected." />
  } else if (net.status === 'needs-rate') {
    netCard = <Card label="Net business profit" value="Needs an exchange rate" tone="muted" sub="Costs are in GBP and today's rate could not be fetched. It returns when the rate does." />
  } else {
    netCard = <Card label="Net business profit" value="Not set up yet" tone="muted" sub="Enter your monthly overheads to see profit after costs." action={{ label: 'Add overheads', onClick: onSettings }} />
  }

  return (
    <section aria-label="Headline figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        label="Profit after credits"
        value={money(afterCreditsCents)}
        tone={afterCreditsCents < 0 ? 'loss' : undefined}
        sub={<>{pct(t.salesCents ? afterCreditsCents / t.salesCents : null)} of {money(t.salesCents, { whole: true })} sales · {plural(t.orderCount, 'order')}</>}
      />
      {netCard}
      <Card
        label="Owed to you"
        value={money(cash.clientsOweCents)}
        sub={<>You owe suppliers {money(cash.weOweSupplierCents)}{cash.unknownClientBalances > 0 && <> · {plural(cash.unknownClientBalances, 'invoice')} not in Xero</>}</>}
      />
      <Card
        label="Overdue from clients"
        value={money(overdue.totalCents)}
        tone={overdue.totalCents > 0 ? 'loss' : undefined}
        sub={overdue.oldest
          ? <>{plural(overdue.count, 'invoice')} · oldest {overdue.oldest.days} days, {overdue.oldest.customerName} · as of {snapshot}</>
          : 'Nothing overdue'}
        action={overdue.count ? { label: 'Chase list', onClick: onExceptions } : undefined}
      />
    </section>
  )
}
