'use client'
import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Sheet } from '@/components/ui/sheet'
import { linesFor, marginBand, orderMargin, type CreditAllocation } from '@/lib/metrics'
import { sumCents } from '@/lib/money'
import { count, pct } from '@/lib/format'
import { useMoney } from '@/components/currency'
import { formatDate } from '@/lib/periods'
import type { CreditNote, Ledger, Order } from '@/lib/types'
import { cn } from '@/lib/utils'
import { flagTone, statusLabel } from './orders-table'

function InvoiceCard({ side, title, party, number, totalCents, status, owedLabel, owedCents, file }: {
  side: string; title: string; party: string; number: string; totalCents: number; status: Order['clientStatus']; owedLabel: string; owedCents: number | null; file: string | null
}) {
  const { money } = useMoney()
  const st = statusLabel(status)
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-3">{side}</div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="mt-1 text-[15px] font-semibold text-ink">{title} {number}</div>
      <div className="text-[12.5px] text-ink-2">{party}</div>
      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-[12.5px]">
        <dt className="text-ink-3">Invoice total</dt><dd className="num font-semibold text-ink">{money(totalCents)}</dd>
        <dt className="text-ink-3">{owedLabel}</dt>
        <dd className="num text-ink">{owedCents === null ? <span className="text-warn">Unknown (not in Xero)</span> : owedCents === 0 ? <span className="text-ink-3">Nothing</span> : money(owedCents)}</dd>
      </dl>
      {file && (
        <div className="mt-3 flex items-center gap-1.5 truncate text-[12.5px] text-ink-2" title={file}>
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />{file}
        </div>
      )}
    </div>
  )
}

function CreditRow({ n }: { n: CreditNote }) {
  const { money } = useMoney()
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
        <span className="font-medium text-ink">
          {n.side === 'client' ? 'Client credit memo' : 'Supplier credit note'} {n.number}
          <span className="ml-2 font-normal text-ink-3">{formatDate(n.date)}</span>
        </span>
        <span className={cn('num font-semibold', n.side === 'client' ? 'text-loss' : 'text-gain')}>
          {n.side === 'client' ? money(-n.amountCents) : money(n.amountCents, { sign: true })}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{n.covers}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2"><span className="font-medium">Xero shows:</span> {n.xeroShows}. {n.check}</p>
    </li>
  )
}

export function OrderDrawer({ order, ledger, units, allocation, snapshot, ledgerSnapshot, onClose }: {
  order: Order | null
  ledger: Ledger
  units: Map<string, number>
  allocation: CreditAllocation
  snapshot: string
  ledgerSnapshot: string
  onClose: () => void
}) {
  return (
    <Sheet
      open={!!order}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={order ? <span className="flex items-center gap-2">{order.id}<span className="font-normal text-ink-3">{order.customerName}</span></span> : ''}
      description={order ? `Ordered ${formatDate(order.date)}. Xero status as of ${snapshot}.` : undefined}
      className="max-w-[920px]"
    >
      {order && <DrawerBody order={order} ledger={ledger} units={units} allocation={allocation} snapshot={snapshot} ledgerSnapshot={ledgerSnapshot} />}
    </Sheet>
  )
}

function DrawerBody({ order: o, ledger, units, allocation, snapshot, ledgerSnapshot }: { order: Order; ledger: Ledger; units: Map<string, number>; allocation: CreditAllocation; snapshot: string; ledgerSnapshot: string }) {
  const { money } = useMoney()
  const lines = linesFor(ledger.lines, o.id)
  const goods = lines.filter((l) => l.type === 'goods')
  const ship = lines.filter((l) => l.type === 'shipping')
  const m = orderMargin(o)
  const band = marginBand(m)
  const credits = allocation.byOrder.get(o.id) ?? []
  const shared = allocation.unallocated.filter((n) => n.orderIds.includes(o.id))
  const clientCr = sumCents(credits.filter((n) => n.side === 'client'), (n) => n.amountCents)
  const supplierCr = sumCents(credits.filter((n) => n.side === 'supplier'), (n) => n.amountCents)
  const exceptions = ledger.exceptions.filter((e) => e.orderId === o.id)

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
        {[
          ['Sales', money(o.clientTotalCents), ''],
          ['Cost', money(o.supplierTotalCents), ''],
          ['Gross profit', money(o.grossMarginCents), o.grossMarginCents < 0 ? 'text-loss' : ''],
          ['Margin', pct(m), band === 'loss' ? 'text-loss' : band === 'thin' ? 'text-warn' : ''],
          ['Units', count(units.get(o.id) ?? 0), ''],
        ].map(([k, v, c]) => (
          <div key={k} className="bg-surface px-3 py-2.5 last:col-span-2 sm:last:col-span-1">
            <dt className="text-[12px] text-ink-3">{k}</dt>
            <dd className={cn('mt-0.5 text-[15px] font-semibold text-ink', c)}>{v}</dd>
          </div>
        ))}
      </dl>

      {(band === 'loss' || band === 'thin') && (
        <p className={cn('rounded-md px-3 py-2 text-[12.5px]', band === 'loss' ? 'bg-loss-soft text-loss' : 'bg-warn-soft text-warn')}>
          {band === 'loss' ? 'Loss-making order: the supplier invoice is larger than the client invoice.' : 'Margin under 0.5%, the ledger’s thin-margin threshold.'}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <InvoiceCard side="Client invoice" title="Invoice" party={o.customerName} number={o.clientInvoiceNo} totalCents={o.clientTotalCents} status={o.clientStatus} owedLabel={`Client still owes (${snapshot})`} owedCents={o.clientOwesCents} file={o.clientPdf.fileName} />
        <InvoiceCard side="Supplier invoice" title="Bill" party={o.supplierName} number={o.supplierInvoiceNo} totalCents={o.supplierTotalCents} status={o.supplierStatus} owedLabel={`We still owe (${snapshot})`} owedCents={o.weOweSupplierCents} file={o.supplierPdf.fileName} />
      </div>

      <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby="lines-title">
        <h3 id="lines-title" className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Line items, matched</h3>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead className="bg-subtle text-ink-3">
              <tr>
                <th scope="col" rowSpan={2} className="px-4 py-1.5 text-left align-bottom font-medium">Description (client invoice)</th>
                <th scope="col" rowSpan={2} className="px-2 py-1.5 text-right align-bottom font-medium">Qty</th>
                <th scope="colgroup" colSpan={2} className="border-l border-line px-2 pt-1.5 text-center font-medium text-ink-2">Supplier</th>
                <th scope="colgroup" colSpan={2} className="border-l border-line px-2 pt-1.5 text-center font-medium text-ink-2">Client</th>
                <th scope="colgroup" colSpan={2} className="border-l border-line px-2 pt-1.5 text-center font-medium text-ink-2">Profit</th>
              </tr>
              <tr>
                <th scope="col" className="border-l border-line px-2 pb-1.5 text-right font-medium">Unit</th>
                <th scope="col" className="px-2 pb-1.5 text-right font-medium">Amount</th>
                <th scope="col" className="border-l border-line px-2 pb-1.5 text-right font-medium">Unit</th>
                <th scope="col" className="px-2 pb-1.5 text-right font-medium">Amount</th>
                <th scope="col" className="border-l border-line px-2 pb-1.5 text-right font-medium">Per unit</th>
                <th scope="col" className="px-4 pb-1.5 text-right font-medium">Line</th>
              </tr>
            </thead>
            <tbody>
              {goods.map((l) => (
                <tr key={l.lineNo} className="border-t border-line align-top">
                  <td className="px-4 py-2 text-ink">
                    {l.description}
                    {l.note && <div className="mt-0.5 text-[12px] text-ink-3">{l.note}</div>}
                  </td>
                  <td className="num px-2 py-2">{count(l.qty)}</td>
                  <td className="num border-l border-line px-2 py-2 text-ink-2">{money(l.supplierUnitCents)}</td>
                  <td className="num px-2 py-2 text-ink-2">{money(l.supplierAmountCents)}</td>
                  <td className="num border-l border-line px-2 py-2">{money(l.clientUnitCents)}</td>
                  <td className="num px-2 py-2">{money(l.clientAmountCents)}</td>
                  <td className={cn('num border-l border-line px-2 py-2', l.marginPerUnitCents < 0 && 'text-loss')}>{money(l.marginPerUnitCents)}</td>
                  <td className={cn('num px-4 py-2 font-medium', l.marginCents < 0 ? 'text-loss' : 'text-ink')}>{money(l.marginCents)}</td>
                </tr>
              ))}
              {ship.map((l) => (
                <tr key={l.lineNo} className="border-t border-dashed border-line bg-subtle/50 align-top">
                  <td className="px-4 py-2 text-ink-2">
                    Shipping &amp; discounts <span className="text-ink-3">(net)</span>
                    {l.note && <div className={cn('mt-0.5 text-[11.5px]', /below/.test(l.note) ? 'text-warn' : 'text-ink-3')}>{l.note}</div>}
                  </td>
                  <td className="num px-2 py-2 text-ink-3" />
                  <td className="border-l border-line px-2 py-2" />
                  <td className="num px-2 py-2 text-ink-2">{money(l.supplierAmountCents)}</td>
                  <td className="border-l border-line px-2 py-2" />
                  <td className="num px-2 py-2">{money(l.clientAmountCents)}</td>
                  <td className="border-l border-line px-2 py-2" />
                  <td className={cn('num px-4 py-2 font-medium', l.marginCents < 0 ? 'text-loss' : 'text-ink')}>{money(l.marginCents)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-line-strong font-semibold">
                <td className="px-4 py-2 text-ink">Invoice totals</td>
                <td className="num px-2 py-2">{count(units.get(o.id) ?? 0)}</td>
                <td className="border-l border-line" />
                <td className="num px-2 py-2">{money(sumCents(lines, (l) => l.supplierAmountCents))}</td>
                <td className="border-l border-line" />
                <td className="num px-2 py-2">{money(sumCents(lines, (l) => l.clientAmountCents))}</td>
                <td className="border-l border-line" />
                <td className={cn('num px-4 py-2', o.grossMarginCents < 0 && 'text-loss')}>{money(sumCents(lines, (l) => l.marginCents))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby="cr-title">
        <h3 id="cr-title" className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Credit notes and payments</h3>
        {credits.length === 0 && shared.length === 0 ? (
          <p className="px-4 py-3 text-[12.5px] text-ink-3">No credit notes reference this order.</p>
        ) : (
          <ul className="divide-y divide-line">
            {credits.map((n) => <CreditRow key={n.number} n={n} />)}
          </ul>
        )}
        {credits.length > 0 && (
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 border-t border-line bg-subtle/60 px-4 py-2.5 text-[12.5px]">
            <dt className="text-ink-2">Gross profit before credits</dt><dd className="num">{money(o.grossMarginCents)}</dd>
            <dt className="text-ink-2">+ Supplier credits received</dt><dd className="num">{money(supplierCr)}</dd>
            <dt className="text-ink-2">− Client credits issued</dt><dd className="num">{money(-clientCr)}</dd>
            <dt className="font-semibold text-ink">Gross profit after credits</dt>
            <dd className={cn('num font-semibold', o.grossMarginCents + supplierCr - clientCr < 0 ? 'text-loss' : 'text-ink')}>{money(o.grossMarginCents + supplierCr - clientCr)}</dd>
          </dl>
        )}
        {shared.length > 0 && (
          <div className="border-t border-line px-4 py-2.5">
            <div className="text-[12px] font-medium text-ink-2">Also referenced by multi-order credits (not allocated to this order)</div>
            <ul className="mt-1 space-y-0.5 text-[12.5px] text-ink-2">
              {shared.map((n) => <li key={n.number}>{n.side === 'client' ? 'Client' : 'Supplier'} credit note {n.number}, {formatDate(n.date)}: {money(n.amountCents)} across {n.orderIds.join(', ')}</li>)}
            </ul>
          </div>
        )}
        {o.live ? (
          <div className="border-t border-line px-4 py-2.5 text-[12.5px]">
            <div className="text-[12px] font-medium text-ink-2">Payments recorded in Xero, each as its own line</div>
            <div className="mt-1 text-[12.5px] text-ink-2">
              Client invoice due {o.live.clientDueDate ? formatDate(o.live.clientDueDate) : 'date not in Xero'} · Supplier bill due {o.live.billDueDate ? formatDate(o.live.billDueDate) : 'date not in Xero'}
            </div>
            {o.live.clientPayments.length + o.live.billPayments.length === 0 ? (
              <p className="mt-1 text-ink-3">No payments recorded yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-line">
                {o.live.clientPayments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-1"><span className="text-ink-2">Received from {o.customerName}{p.date ? `, ${formatDate(p.date)}` : ''}</span><span className="num text-gain">{money(p.amountCents, { sign: true })}</span></li>
                ))}
                {o.live.billPayments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-1"><span className="text-ink-2">Paid to {o.supplierName}{p.date ? `, ${formatDate(p.date)}` : ''}</span><span className="num text-ink">{money(-p.amountCents)}</span></li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="border-t border-line px-4 py-2.5 text-[12.5px] text-ink-2">
            Individual payment records are not in the ledger. Only the outstanding balance as of {snapshot} is known; each payment will show as its own line once Xero is connected.
          </p>
        )}
      </section>

      {(o.flags.length > 0 || exceptions.length > 0) && (
        <section className="rounded-lg border border-line bg-surface" aria-labelledby="flags-title">
          <h3 id="flags-title" className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Flags and exceptions</h3>
          {o.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {o.flags.map((f) => <Badge key={f} tone={flagTone(f)}>{f}</Badge>)}
            </div>
          )}
          {exceptions.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {exceptions.map((e) => (
                <li key={e.id} className="px-4 py-2.5 text-[12.5px]">
                  <Badge tone={e.priority === 'HIGH' ? 'loss' : e.priority === 'MEDIUM' ? 'warn' : 'neutral'}>{e.priority}</Badge>
                  <p className="mt-1 leading-relaxed text-ink-2">{e.issue}</p>
                  <p className="mt-0.5 leading-relaxed text-ink-3"><span className="font-medium text-ink-2">Action:</span> {e.suggestedAction}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line px-4 py-2 text-[12px] text-ink-3">Flags and overdue days are as recorded in the ledger on {ledgerSnapshot} and are not recalculated.</p>
        </section>
      )}
    </div>
  )
}
