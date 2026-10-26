'use client'
import { useMemo, useState } from 'react'
import { AlertTriangle, CircleCheck, OctagonAlert, Plus, Trash2 } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { useMoney } from '@/components/currency'
import { checkDeal, parseEuro } from '@/lib/deal'
import { eur, pct } from '@/lib/format'
import { overdueOrders, type PartyRow } from '@/lib/metrics'
import type { IsoDate, Order } from '@/lib/types'
import { cn } from '@/lib/utils'

type Row = { description: string; units: string; buy: string; sell: string }
const empty = (): Row => ({ description: '', units: '', buy: '', sell: '' })

const input = 'h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[13.5px] text-ink placeholder:text-ink-3 hover:border-line-strong'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[12px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] leading-snug text-ink-3">{hint}</span>}
    </label>
  )
}

/**
 * Check a deal before committing: units, buy and sell prices, shipping both ways and payment
 * terms give the margin after margin-scheme VAT and an optional FX cushion. Nothing is saved.
 */
export function DealChecker({ customers, orders, today, marginVat }: {
  customers: PartyRow[]
  orders: readonly Order[]
  today: IsoDate
  marginVat: boolean
}) {
  const { money } = useMoney()
  const [rows, setRows] = useState<Row[]>([empty()])
  const [customerId, setCustomerId] = useState('')
  const [shipCost, setShipCost] = useState('')
  const [shipCharged, setShipCharged] = useState('')
  const [supplierDays, setSupplierDays] = useState('7')
  const [clientDays, setClientDays] = useState('7')
  const [cushion, setCushion] = useState('0')
  const [vat, setVat] = useState(marginVat)

  const lines = rows.map((r) => ({ description: r.description.trim() || undefined, units: Number(r.units) || 0, buyCents: parseEuro(r.buy) ?? 0, sellCents: parseEuro(r.sell) ?? 0 }))
  const filled = lines.some((l) => l.units > 0 && (l.buyCents || l.sellCents))
  const r = checkDeal({
    lines,
    supplierShippingCents: parseEuro(shipCost) ?? 0,
    shippingRechargedCents: parseEuro(shipCharged) ?? 0,
    marginVat: vat,
    fxCushionPct: Math.max(0, Number(cushion.replace(',', '.')) || 0),
    supplierDueDays: Number(supplierDays) || 0,
    clientDueDays: Number(clientDays) || 0,
  })

  const cust = customers.find((c) => c.id === customerId) ?? null
  const late = useMemo(() => (customerId ? overdueOrders(orders.filter((o) => o.customerId === customerId), today) : []), [orders, customerId, today])
  const lateCents = late.reduce((n, x) => n + x.owedCents, 0)

  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const tone = r.verdict === 'loss' ? 'loss' : r.verdict === 'thin' ? 'warn' : 'gain'
  const Verdict = r.verdict === 'loss' ? OctagonAlert : r.verdict === 'thin' ? AlertTriangle : CircleCheck

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="deal-in" className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-5 py-3">
          <h2 id="deal-in" className="text-[15px] font-semibold text-ink">The deal</h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">Prices per unit in EUR, as on the Mobile One offer and the price you would invoice. Nothing here is saved.</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <Field label="Customer (optional)">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full">
              <option value="">Not chosen</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>

          <div>
            <div className="mb-1 hidden grid-cols-[1.6fr_0.7fr_1fr_1fr_32px] gap-2 text-[12px] font-medium text-ink-2 sm:grid">
              <span>Product</span><span>Units</span><span>Buy €/unit</span><span>Sell €/unit</span><span />
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 sm:grid-cols-[1.6fr_0.7fr_1fr_1fr_32px]">
                  <input aria-label={`Line ${i + 1} product`} placeholder="e.g. iPhone 15 128GB" value={row.description} onChange={(e) => set(i, 'description', e.target.value)} className={cn(input, 'col-span-4 sm:col-span-1')} />
                  <input aria-label={`Line ${i + 1} units`} inputMode="numeric" placeholder="Units" value={row.units} onChange={(e) => set(i, 'units', e.target.value.replace(/[^\d]/g, ''))} className={input} />
                  <input aria-label={`Line ${i + 1} buy price`} inputMode="decimal" placeholder="Buy" value={row.buy} onChange={(e) => set(i, 'buy', e.target.value)} className={input} />
                  <input aria-label={`Line ${i + 1} sell price`} inputMode="decimal" placeholder="Sell" value={row.sell} onChange={(e) => set(i, 'sell', e.target.value)} className={input} />
                  <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [empty()])} className="inline-flex h-9 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-subtle hover:text-ink">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setRows([...rows, empty()])} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"><Plus className="h-3.5 w-3.5" aria-hidden />Add a line</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Shipping Mobile One charges (€)"><input inputMode="decimal" placeholder="0" value={shipCost} onChange={(e) => setShipCost(e.target.value)} className={input} /></Field>
            <Field label="Shipping you recharge the client (€)"><input inputMode="decimal" placeholder="0" value={shipCharged} onChange={(e) => setShipCharged(e.target.value)} className={input} /></Field>
            <Field label="Mobile One wants paying in (days)"><input inputMode="numeric" value={supplierDays} onChange={(e) => setSupplierDays(e.target.value.replace(/[^\d]/g, ''))} className={input} /></Field>
            <Field label="Client pays in (days)"><input inputMode="numeric" value={clientDays} onChange={(e) => setClientDays(e.target.value.replace(/[^\d]/g, ''))} className={input} /></Field>
            <Field label="FX cushion (% of sale)" hint="0 if you hold the euros. About 1% covers a typical two-week move if you convert pounds to pay Mobile One.">
              <input inputMode="decimal" value={cushion} onChange={(e) => setCushion(e.target.value)} className={input} />
            </Field>
            <label className="flex items-center gap-2 self-start pt-6 text-[13.5px] text-ink">
              <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="h-4 w-4 accent-navy" />
              Deduct margin-scheme VAT (1/6 of margin)
            </label>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <section aria-labelledby="deal-out" aria-live="polite" className={cn('rounded-lg border bg-surface', filled ? (tone === 'loss' ? 'border-loss/40' : tone === 'warn' ? 'border-warn/40' : 'border-gain/40') : 'border-line')}>
          <div className="border-b border-line px-5 py-3">
            <h2 id="deal-out" className="text-[15px] font-semibold text-ink">What it earns</h2>
          </div>
          {!filled ? (
            <p className="px-5 py-6 text-[13px] text-ink-2">Enter units and prices to see the margin.</p>
          ) : (
            <div className="px-5 py-4">
              <div className={cn('flex items-center gap-2 text-[15px] font-semibold', tone === 'loss' ? 'text-loss' : tone === 'warn' ? 'text-warn' : 'text-gain')}>
                <Verdict className="h-5 w-5" aria-hidden />
                {r.verdict === 'loss' ? 'Loses money' : r.verdict === 'thin' ? 'Thin: under 0.5%' : 'Worth doing'}
              </div>
              <div className="mt-2 text-[28px] font-bold leading-tight text-ink">{money(r.netCents)} <span className="text-[15px] font-medium text-ink-2">{pct(r.netRatio)}</span></div>
              <dl className="mt-3 space-y-1.5 text-[13.5px]">
                {[
                  ['Client pays', eur(r.salesCents)],
                  ['Mobile One charges', eur(-r.costCents)],
                  ['Gross profit', eur(r.grossCents)],
                  ['  on goods', eur(r.goodsMarginCents)],
                  ['  on shipping', eur(r.shippingMarginCents)],
                  ...(r.marginVatCents ? [['Margin-scheme VAT', eur(-r.marginVatCents)]] : []),
                  ...(r.fxCushionCents ? [['FX cushion', eur(-r.fxCushionCents)]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className={cn('text-ink-2', k.startsWith('  ') && 'pl-3 text-[12.5px] text-ink-3')}>{k.trim()}</dt>
                    <dd className="font-medium text-ink tabular-nums">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-line pt-1.5">
                  <dt className="font-semibold text-ink">You keep</dt>
                  <dd className="font-semibold text-ink tabular-nums">{eur(r.netCents)}</dd>
                </div>
              </dl>
              {r.warnings.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {r.warnings.map((w) => <li key={w} className="flex gap-2 rounded-md bg-warn-soft px-3 py-2 text-[13px] leading-snug text-warn"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{w}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>

        {cust && (
          <section aria-labelledby="deal-cust" className="rounded-lg border border-line bg-surface px-5 py-4 text-[13.5px]">
            <h2 id="deal-cust" className="text-[15px] font-semibold text-ink">{cust.name}</h2>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3"><dt className="text-ink-2">Orders so far</dt><dd className="font-medium text-ink">{cust.orderCount}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-2">Their average margin</dt><dd className="font-medium text-ink">{pct(cust.marginRatio)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-2">Owes you now</dt><dd className="font-medium text-ink">{eur(cust.openCents)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-2">Overdue</dt><dd className={cn('font-medium', lateCents ? 'text-loss' : 'text-ink')}>{lateCents ? `${eur(lateCents)}, oldest ${late[0].days} days` : 'nothing'}</dd></div>
            </dl>
            {lateCents > 0 && <p className="mt-2 rounded-md bg-loss-soft px-3 py-2 text-[13px] text-loss">They are already late paying {eur(lateCents)}. Ask for that before shipping more on credit.</p>}
          </section>
        )}
      </div>
    </div>
  )
}
