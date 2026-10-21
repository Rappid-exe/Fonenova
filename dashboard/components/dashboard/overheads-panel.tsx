'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMoney } from '@/components/currency'
import { toCents } from '@/lib/money'
import { monthlyOverheads, overheadCharges, overheadReady } from '@/lib/metrics'
import { money as fmtMoney } from '@/lib/format'
import { addDays, formatDate } from '@/lib/periods'
import type { Overhead } from '@/lib/types'
import { cn } from '@/lib/utils'

type Draft = Omit<Overhead, 'amountCents'> & { amountText: string }

const toDraft = (o: Overhead): Draft => ({ ...o, amountText: o.amountCents === null ? '' : (o.amountCents / 100).toFixed(2) })

function parseAmount(text: string): number | null | 'invalid' {
  const t = text.trim()
  if (!t) return null
  try {
    const c = toCents(t.replace(/[£€]/g, ''))
    return c < 0 ? 'invalid' : c
  } catch {
    return 'invalid'
  }
}

const input = 'h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px] text-ink'

export function OverheadsPanel({
  overheads,
  saved,
  loadError,
  writable,
  today,
}: {
  overheads: Overhead[]
  saved: boolean
  loadError: string | null
  writable: boolean
  today: string
}) {
  const router = useRouter()
  const { currency, toDisplay } = useMoney()
  const [rows, setRows] = useState<Draft[]>(() => overheads.map(toDraft))
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ kind: 'idle' })

  const parsed = rows.map((r) => ({ r, amount: parseAmount(r.amountText) }))
  const invalid = parsed.find((p) => p.amount === 'invalid')
  const current: Overhead[] = parsed.map(({ r, amount }) => {
    const { amountText: _, ...rest } = r
    return { ...rest, amountCents: amount === 'invalid' ? null : amount }
  })
  const dirty = JSON.stringify(current) !== JSON.stringify(overheads) || !saved

  // Totals and the next 30 days use what is saved, so they match the profit figures above.
  const upcoming = useMemo(() => overheadCharges(overheads, { start: today, end: addDays(today, 29) }), [overheads, today])
  const biz = monthlyOverheads(overheads, today, 'business')
  const personal = monthlyOverheads(overheads, today, 'personal')

  const update = (i: number, patch: Partial<Draft>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function save() {
    if (invalid) return
    setStatus({ kind: 'saving' })
    try {
      const res = await fetch('/api/overheads', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(current) })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) return setStatus({ kind: 'error', text: body.error ?? `Save failed (${res.status})` })
      setStatus({ kind: 'saved' })
      router.refresh()
    } catch {
      setStatus({ kind: 'error', text: 'Could not reach the dashboard server' })
    }
  }

  const both = (cents: number, from: 'GBP' | 'EUR') => {
    const shown = fmtMoney(cents, from)
    if (currency === from) return shown
    const v = toDisplay(cents, from)
    return v === null ? shown : `${shown} (${fmtMoney(v, currency)})`
  }
  const total = (t: { GBP: number; EUR: number }) =>
    [t.GBP ? both(t.GBP, 'GBP') : '', t.EUR ? both(t.EUR, 'EUR') : ''].filter(Boolean).join(' + ') || 'none entered'

  return (
    <section aria-labelledby="oh-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 id="oh-title" className="text-[14px] font-semibold text-ink">Overheads</h2>
          <p className="text-[12px] text-ink-3">Monthly costs you enter. Business items come off net business profit; personal items only show in the cash calendar.</p>
        </div>
        <div className="text-right text-[12px] text-ink-3">
          <div>Business per month: <span className="font-semibold text-ink">{total(biz)}</span></div>
          <div>Personal per month: <span className="font-medium text-ink-2">{total(personal)}</span></div>
        </div>
      </div>

      {loadError && <p role="alert" className="border-b border-line bg-loss-soft px-4 py-2 text-[12.5px] text-loss">{loadError}. Showing the starting list instead.</p>}
      {!writable && <p className="border-b border-line bg-warn-soft px-4 py-2 text-[12.5px] text-warn">Saving overheads needs online storage: connect Upstash Redis and set FN_STORE_KEY in the Vercel project.</p>}

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[860px] text-[12.5px]">
          <caption className="sr-only">Overheads</caption>
          <thead className="bg-subtle text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">Name</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Amount</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Currency</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Day taken</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Type</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">First payment</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Last payment</th>
              <th scope="col" className="px-4 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const bad = parsed[i].amount === 'invalid'
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="min-w-[160px] px-4 py-1.5"><input aria-label="Name" className={input} value={r.name} onChange={(e) => update(i, { name: e.target.value })} /></td>
                  <td className="px-2 py-1.5 w-32">
                    <input aria-label={`${r.name} amount`} inputMode="decimal" placeholder="Not entered" className={cn(input, 'text-right', bad && 'border-loss')} value={r.amountText} onChange={(e) => update(i, { amountText: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5 w-24">
                    <select aria-label={`${r.name} currency`} className={input} value={r.currency} onChange={(e) => update(i, { currency: e.target.value as 'GBP' | 'EUR' })}>
                      <option value="GBP">GBP £</option><option value="EUR">EUR €</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 w-24">
                    <input aria-label={`${r.name} day of month`} type="number" min={1} max={31} className={input} value={r.dayOfMonth} onChange={(e) => update(i, { dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
                  </td>
                  <td className="px-2 py-1.5 w-28">
                    <select aria-label={`${r.name} type`} className={input} value={r.category} onChange={(e) => update(i, { category: e.target.value as Overhead['category'] })}>
                      <option value="business">Business</option><option value="personal">Personal</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 w-36"><input aria-label={`${r.name} first payment`} type="date" className={input} value={r.startDate ?? ''} onChange={(e) => update(i, { startDate: e.target.value || null })} /></td>
                  <td className="px-2 py-1.5 w-36"><input aria-label={`${r.name} last payment`} type="date" className={input} value={r.endDate ?? ''} onChange={(e) => update(i, { endDate: e.target.value || null })} /></td>
                  <td className="px-4 py-1.5 text-right">
                    <Button size="icon" variant="ghost" aria-label={`Remove ${r.name}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <Button size="sm" variant="ghost" onClick={() => setRows((rs) => [...rs, { id: `oh-${Date.now().toString(36)}`, name: 'New overhead', amountText: '', currency: 'GBP', dayOfMonth: 1, category: 'business', startDate: null, endDate: null }])}>
          <Plus className="h-4 w-4" aria-hidden />Add overhead
        </Button>
        <div className="flex items-center gap-2 text-[12.5px]" aria-live="polite">
          {invalid && <span className="text-loss">Amount for {invalid.r.name} is not a number.</span>}
          {status.kind === 'error' && <span className="text-loss">{status.text}</span>}
          {status.kind === 'saved' && !dirty && <span className="text-gain">Saved.</span>}
          {!saved && status.kind !== 'saved' && <span className="text-ink-3">Starting list, not saved yet.</span>}
          <Button size="sm" variant="primary" onClick={save} disabled={!writable || !!invalid || status.kind === 'saving' || !dirty}>
            <Save className="h-4 w-4" aria-hidden />{status.kind === 'saving' ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="border-t border-line px-4 py-3">
        <h3 className="text-[12.5px] font-semibold text-ink">Next 30 days</h3>
        {upcoming.length === 0 ? (
          <p className="mt-1 text-[12.5px] text-ink-3">
            {overheads.some(overheadReady) ? 'Nothing due in the next 30 days.' : 'Enter an amount and first payment date to see upcoming payments.'}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-line text-[12.5px]">
            {upcoming.map((c) => (
              <li key={`${c.overhead.id}-${c.date}`} className="flex items-center justify-between gap-3 py-1.5">
                <span className="flex items-center gap-2">
                  <span className="w-16 text-ink-3">{formatDate(c.date).replace(/ \d{4}$/, '')}</span>
                  <span className="text-ink">{c.overhead.name}</span>
                  <Badge tone={c.overhead.category === 'business' ? 'accent' : 'neutral'}>{c.overhead.category === 'business' ? 'Business' : 'Personal'}</Badge>
                </span>
                <span className="num text-ink">{both(c.amountCents, c.overhead.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
