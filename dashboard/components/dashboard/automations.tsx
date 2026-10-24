'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, ExternalLink, Workflow } from 'lucide-react'
import { useMoney } from '@/components/currency'
import { formatDate } from '@/lib/periods'
import { xeroLink } from '@/lib/xero/pairing'
import type { MakeStatus } from '@/lib/make'
import type { XeroInvoice } from '@/lib/types'
import { cn } from '@/lib/utils'

const when = (iso: string) => `${formatDate(iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`

/** Synced invoices and bills still DRAFT in Xero, each one click from approving. */
export function DraftsList({ drafts }: { drafts: XeroInvoice[] }) {
  const { money } = useMoney()
  if (drafts.length === 0) return null
  return (
    <section aria-labelledby="drafts-title" className="rounded-lg border border-warn/30 bg-surface">
      <div className="border-b border-line px-5 py-3">
        <h2 id="drafts-title" className="text-[15px] font-semibold text-ink">Drafts to approve in Xero <span className="ml-1 font-normal text-warn">{drafts.length}</span></h2>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">Created by the Make syncs. Check each against the agreed order, then Approve in Xero (never email it from Xero). They already count on the dashboard, flagged as drafts.</p>
      </div>
      <ul className="divide-y divide-line">
        {drafts.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5">
            <span className="w-16 text-[12px] font-medium uppercase tracking-wide text-ink-3">{d.kind === 'sale' ? 'Invoice' : 'Bill'}</span>
            <span className="min-w-0 flex-1 text-[13.5px] text-ink"><span className="font-medium">{d.number || d.reference}</span> · {d.contactName} · {d.date ? formatDate(d.date) : 'no date'}</span>
            <span className="text-[13.5px] font-semibold text-ink">{d.currency === 'EUR' ? money(d.totalCents) : `${(d.totalCents / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })} ${d.currency}`}</span>
            <a href={xeroLink(d)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">Open in Xero<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Are the Make.com syncs on, did they last run cleanly, and how many free credits are left. */
export function MakeCard({ make }: { make: MakeStatus | null }) {
  return (
    <section aria-labelledby="make-title" className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-5 py-3">
        <h2 id="make-title" className="flex items-center gap-1.5 text-[15px] font-semibold text-ink"><Workflow className="h-4 w-4 text-ink-3" aria-hidden />Automations (Make.com)</h2>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">Invoice2Go invoices and Mobile One bills reach Xero through these two scenarios. A run that stops at a filter is not an error; if a document is missing, check that scenario&apos;s History in Make.</p>
      </div>
      {!make ? (
        <p className="px-5 py-3 text-[13px] text-ink-2">
          Not shown yet: add <code>MAKE_API_TOKEN</code> (Make → Profile → API, read-only scopes), <code>MAKE_ZONE=eu1</code>, <code>MAKE_ORG_ID=9377699</code> and <code>MAKE_SCENARIOS=8112915,8119866</code> to <code>.env.local</code>.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {make.scenarios.map((s) => {
              const bad = !s.active || s.lastRunOk === false
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[13.5px]">
                  {bad ? <CircleAlert className="h-4 w-4 text-loss" aria-hidden /> : <CircleCheck className="h-4 w-4 text-gain" aria-hidden />}
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className={cn(s.active ? 'text-ink-2' : 'font-medium text-loss')}>{s.active ? 'on' : 'OFF'}</span>
                  <span className="text-ink-2">{s.lastRunAt ? `last run ${when(s.lastRunAt)}` : 'no runs yet'}</span>
                  {s.lastError && <span className="basis-full pl-7 text-[13px] text-loss">{s.lastError}</span>}
                </li>
              )
            })}
          </ul>
          <div className="border-t border-line px-5 py-2.5 text-[13px] text-ink-2">
            {make.creditsUsed !== null && make.creditsLimit !== null ? (
              <>Credits this period: <span className={cn('font-semibold', make.creditsUsed >= make.creditsLimit * 0.9 ? 'text-loss' : 'text-ink')}>{make.creditsUsed.toLocaleString('en-GB')} of {make.creditsLimit.toLocaleString('en-GB')}</span> used (about 9 per document).</>
            ) : (
              <>Credits: not reported by Make&apos;s API. Check Make → Organisation → Usage.</>
            )}
            {make.problems.map((p) => <div key={p} className="text-warn">{p}</div>)}
            <div className="text-ink-3">Anthropic credit balance can&apos;t be read through an API; its console emails when it runs low.</div>
          </div>
        </>
      )}
    </section>
  )
}

/** The margin-scheme VAT switch. Off until the accountant confirms it applies. */
export function MarginVatCard({ enabled, writable, vatEurCents }: { enabled: boolean; writable: boolean; vatEurCents: number }) {
  const router = useRouter()
  const { money } = useMoney()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function toggle() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ marginSchemeVat: !enabled }) }).catch(() => null)
    if (!res || !res.ok) setError((await res?.json().catch(() => null))?.error ?? 'Could not save')
    router.refresh()
    setBusy(false)
  }
  return (
    <section aria-labelledby="vat-title" className="rounded-lg border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-80">
          <h2 id="vat-title" className="text-[15px] font-semibold text-ink">Margin-scheme VAT</h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
            Under the margin scheme, VAT is 1/6 of each sale&apos;s margin. When on, net business profit deducts it ({money(vatEurCents)} in the selected period) and shows it on its own line. Estimate: HMRC uses the sterling margin at each sale&apos;s date, and losses are not offset. Confirm with your accountant that it is due on these sales (EU exports may be treated differently).
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!writable || busy}
          onClick={toggle}
          className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', enabled ? 'bg-navy' : 'bg-line-strong')}
        >
          <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', enabled ? 'translate-x-6' : 'translate-x-1')} />
          <span className="sr-only">Deduct margin-scheme VAT</span>
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-loss">{error}</p>}
    </section>
  )
}
