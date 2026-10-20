'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Segmented } from '@/components/ui/segmented'
import { useMoney } from '@/components/currency'
import { CLASS_LABEL } from '@/lib/expenses'
import { expenseSummary, fxSummary } from '@/lib/metrics'
import { money as fmtMoney, pct } from '@/lib/format'
import { formatDate, type DateRange } from '@/lib/periods'
import type { ExpenseClass, ExpenseLog, ExpenseOverrides, Overhead } from '@/lib/types'
import { cn } from '@/lib/utils'

type Tab = ExpenseClass | 'all'

const TONE: Record<ExpenseClass, 'gain' | 'warn' | 'neutral'> = { business: 'gain', review: 'warn', personal: 'neutral' }

export function ExpensesPanel({ log, overrides, overheads, range, error, writable }: {
  log: ExpenseLog | null
  overrides: ExpenseOverrides
  overheads: Overhead[]
  range: DateRange
  error: string | null
  writable: boolean
}) {
  const router = useRouter()
  const { currency, toDisplay, fx } = useMoney()
  const [tab, setTab] = useState<Tab>('review')
  const [local, setLocal] = useState<ExpenseOverrides>(overrides)
  const [saveError, setSaveError] = useState<string | null>(null)
  const s = useMemo(() => expenseSummary(log, local, overheads, range), [log, local, overheads, range])
  const f = useMemo(() => fxSummary(log?.fxConversions ?? [], range), [log, range])

  const gbp = (c: number) => {
    const shown = fmtMoney(c, 'GBP')
    if (currency === 'GBP') return shown
    const v = toDisplay(c, 'GBP')
    return v === null ? shown : `${shown} (${fmtMoney(v, currency)})`
  }

  async function setClass(id: string, autoCls: ExpenseClass, cls: ExpenseClass) {
    const next = { ...local }
    if (cls === autoCls) delete next[id]
    else next[id] = cls
    setLocal(next)
    setSaveError(null)
    const res = await fetch('/api/expense-overrides', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }).catch(() => null)
    if (!res || !res.ok) {
      setSaveError((await res?.json().catch(() => null))?.error ?? 'Could not save the change')
      return
    }
    router.refresh()
  }

  if (!log) {
    return (
      <section aria-labelledby="exp-title" className="rounded-lg border border-line bg-surface px-4 py-3">
        <h2 id="exp-title" className="flex items-center gap-1.5 text-[14px] font-semibold text-ink"><Receipt className="h-4 w-4 text-ink-3" aria-hidden />Expenses</h2>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {error ?? 'No expense log imported yet.'} Run <code>npm.cmd run import-expenses -- &quot;path\to\VAT Return From Sept-Dec, 2026.xlsx&quot;</code>.
        </p>
      </section>
    )
  }

  const rows = tab === 'all' ? s.rows : s.rows.filter((r) => r.cls === tab)
  const count = (c: ExpenseClass) => s.rows.filter((r) => r.cls === c).length

  return (
    <section aria-labelledby="exp-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 id="exp-title" className="flex items-center gap-1.5 text-[14px] font-semibold text-ink"><Receipt className="h-4 w-4 text-ink-3" aria-hidden />Expenses</h2>
          <p className="text-[12px] text-ink-3">
            From {log.meta.sourceFile}{s.coverage ? `, ${formatDate(s.coverage.start)} to ${formatDate(s.coverage.end)}` : ''}, imported {formatDate(log.meta.importedAt.slice(0, 10))}. Only Business rows come off net profit. Change any row with its dropdown.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {[
          ['Counted as business', s.businessCents, 'text-ink'],
          ['Needs review', s.reviewCents, 'text-warn'],
          ['Personal', s.personalCents, 'text-ink-2'],
          ['Already in overheads', s.coveredByOverheadCents, 'text-ink-3'],
        ].map(([k, v, c]) => (
          <div key={k as string} className="bg-surface px-4 py-2.5">
            <dt className="text-[11.5px] text-ink-3">{k}</dt>
            <dd className={cn('mt-0.5 text-[15px] font-semibold', c as string)}>{gbp(v as number)}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-1.5 border-t border-line px-4 py-2.5 text-[12.5px]">
        {s.vatAtRiskCents > 0 && (
          <p className="flex gap-1.5 text-loss"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span><strong className="font-semibold">VAT at risk: {fmtMoney(s.vatAtRiskCents, 'GBP')}</strong> is reclaimed on rows not confirmed as business. VAT on personal costs cannot be reclaimed; confirm or remove these before filing.</span>
          </p>
        )}
        {s.personalCents > 0 && (
          <p className="text-ink-2">
            <strong className="font-semibold">Personal spending paid from the company: {fmtMoney(s.personalCents, 'GBP')}.</strong> Not a business cost; your accountant will normally record it against your director&apos;s loan account.
          </p>
        )}
        {f.count > 0 && f.effectiveRate !== null && (
          <p className="text-ink-3">
            Actual EUR to GBP conversions: {f.count}, {fmtMoney(f.eurCents, 'EUR', { whole: true })} for {fmtMoney(f.gbpCents, 'GBP')} at an average £{f.effectiveRate.toFixed(4)} per €, plus fees of {fmtMoney(f.feeCents, 'GBP')} ({pct(f.feeShare)}).
            {fx.ok && <> Today&apos;s ECB rate is £{fx.fx.rate.toFixed(4)}.</>}
          </p>
        )}
        {saveError && <p role="alert" className="text-loss">{saveError}</p>}
        {!writable && <p className="text-warn">Changing rows is not available on the hosted version yet.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        <Segmented label="Show" value={tab} onChange={setTab} options={[
          { value: 'review', label: `Needs review (${count('review')})` },
          { value: 'business', label: `Business (${count('business')})` },
          { value: 'personal', label: `Personal (${count('personal')})` },
          { value: 'all', label: `All (${s.rows.length})` },
        ]} />
      </div>

      <div className="relative max-h-[520px] overflow-auto border-t border-line">
        <table className="w-full min-w-[860px] text-[12.5px]">
          <caption className="sr-only">Expense rows in the selected period</caption>
          <thead className="sticky top-0 z-10 bg-subtle text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">Date</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Payee and description</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Amount</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">VAT claimed</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Why</th>
              <th scope="col" className="px-4 py-2 text-left font-medium">Treat as</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-3">No rows here for this period.</td></tr>}
            {rows.map((r) => (
              <tr key={r.expense.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-1.5 text-ink-2">{formatDate(r.expense.date)}</td>
                <td className="max-w-[300px] px-2 py-1.5">
                  <div className="font-medium text-ink">{r.expense.payee}</div>
                  <div className="text-ink-3">{r.expense.description}</div>
                </td>
                <td className="num px-2 py-1.5 text-ink">{gbp(r.expense.amountCents)}</td>
                <td className={cn('num px-2 py-1.5', r.expense.vatCents && r.cls !== 'business' ? 'font-medium text-loss' : 'text-ink-3')}>{r.expense.vatCents ? fmtMoney(r.expense.vatCents, 'GBP') : ''}</td>
                <td className="max-w-[260px] px-2 py-1.5 text-ink-3">
                  <span className="text-ink-2">{r.auto.category}.</span> {r.overridden ? 'Changed by you.' : r.auto.reason}
                  {r.coveredBy && <div className="mt-0.5"><Badge tone="outline">In overheads: {r.coveredBy}</Badge></div>}
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label={`Treat ${r.expense.payee} ${formatDate(r.expense.date)} as`}
                      className="h-8 rounded-md border border-line bg-surface px-2 text-[12.5px] text-ink"
                      value={r.cls}
                      disabled={!writable}
                      onChange={(e) => setClass(r.expense.id, r.auto.cls, e.target.value as ExpenseClass)}
                    >
                      {(['business', 'review', 'personal'] as ExpenseClass[]).map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
                    </select>
                    <Badge tone={TONE[r.cls]} className="hidden sm:inline-flex">{CLASS_LABEL[r.cls]}</Badge>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
