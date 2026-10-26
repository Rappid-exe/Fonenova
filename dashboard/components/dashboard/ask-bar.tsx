'use client'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Loader2, Search, Sparkles, X } from 'lucide-react'
import type { Section } from '@/lib/sections'
import type { Order } from '@/lib/types'
import { cn } from '@/lib/utils'

type Hit =
  | { kind: 'order'; id: string; label: string; sub: string }
  | { kind: 'customer'; id: string; label: string; sub: string }
  | { kind: 'section'; id: Section; label: string; sub: string }

const SECTION_WORDS: { id: Section; label: string; words: string[] }[] = [
  { id: 'overview', label: 'Overview', words: ['overview', 'home', 'dashboard', 'today'] },
  { id: 'orders', label: 'Orders', words: ['orders', 'sales', 'invoices'] },
  { id: 'deal-check', label: 'Check a deal', words: ['deal', 'check a deal', 'calculator', 'quote', 'price'] },
  { id: 'matching', label: 'Invoice matching', words: ['match', 'matching', 'drafts', 'approve', 'pair'] },
  { id: 'customers', label: 'Customers', words: ['customers', 'clients'] },
  { id: 'suppliers', label: 'Suppliers', words: ['suppliers', 'bills'] },
  { id: 'credit-notes', label: 'Credit notes', words: ['credit', 'credit notes', 'refund'] },
  { id: 'exceptions', label: 'Exceptions', words: ['exceptions', 'problems', 'attention', 'overdue', 'chase', 'xero problems'] },
  { id: 'expenses', label: 'Expenses', words: ['expenses', 'receipts', 'vat', 'costs'] },
  { id: 'settings', label: 'Settings', words: ['settings', 'connect', 'xero', 'onedrive', 'email', 'make', 'gmail'] },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Free, instant matches in the page's own data: order ids, invoice and bill numbers, names, pages. */
export function localHits(q: string, orders: readonly Order[], customers: readonly { id: string; name: string }[]): Hit[] {
  const n = norm(q)
  if (n.length < 2) return []
  const hits: Hit[] = []
  // "34" or "034" finds FN-ORD-034; longer numbers find invoice and bill numbers.
  const short = /^\d{1,3}$/.test(n) ? `fnord${n.padStart(3, '0')}` : null
  for (const o of orders) {
    const id = norm(o.id)
    if ((short && id === short) || id.includes(n) || (n.length >= 4 && (norm(o.clientInvoiceNo).includes(n) || norm(o.supplierInvoiceNo).includes(n)))) {
      hits.push({ kind: 'order', id: o.id, label: o.id, sub: `${o.customerName} · invoice ${o.clientInvoiceNo} · bill ${o.supplierInvoiceNo}` })
    }
  }
  for (const c of customers) if (norm(c.name).includes(n)) hits.push({ kind: 'customer', id: c.id, label: c.name, sub: 'Show their orders' })
  const ql = q.trim().toLowerCase()
  for (const s of SECTION_WORDS) if (s.words.some((w) => w.startsWith(ql) || (ql.length > 3 && ql.includes(w)))) hits.push({ kind: 'section', id: s.id, label: s.label, sub: 'Open page' })
  return hits.slice(0, 6)
}

/** Order ids in an answer become links that open the order. */
function Linked({ text, onOrder }: { text: string; onOrder: (id: string) => void }) {
  const parts = text.split(/(FN-ORD-\d{3,})/g)
  return (
    <>
      {parts.map((p, i) => /^FN-ORD-\d{3,}$/.test(p)
        ? <button key={i} type="button" onClick={() => onOrder(p)} className="font-medium text-accent hover:underline">{p}</button>
        : <Fragment key={i}>{p}</Fragment>)}
    </>
  )
}

/**
 * The bar in the top bar: type to jump straight to an order, invoice, customer or page (free,
 * instant); press Enter on a question to ask the AI (Claude Haiku 5.5, read-only, capped daily).
 */
export function AskBar({ orders, customers, aiReady, onOpenOrder, onPickCustomer, go }: {
  orders: readonly Order[]
  customers: readonly { id: string; name: string }[]
  aiReady: boolean
  onOpenOrder: (id: string) => void
  onPickCustomer: (id: string) => void
  go: (s: Section) => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<{ question: string; text: string; ok: boolean; meta: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => localHits(q, orders, customers), [q, orders, customers])
  const options = q.trim().length > 1 ? hits.length + 1 : 0 // the last option is always "Ask AI"

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  function pick(h: Hit) {
    setOpen(false)
    setQ('')
    if (h.kind === 'order') onOpenOrder(h.id)
    else if (h.kind === 'customer') onPickCustomer(h.id)
    else go(h.id)
  }

  async function askAI() {
    const question = q.trim()
    if (!question || busy) return
    setOpen(false)
    if (!aiReady) {
      setAnswer({ question, ok: false, text: 'The AI bar is not set up yet: add ANTHROPIC_API_KEY in Vercel (see Settings). Searching orders, invoices and customers works without it.', meta: '' })
      return
    }
    setBusy(true)
    setAnswer({ question, ok: true, text: '', meta: '' })
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as { ok?: boolean; answer?: string; usedToday?: number; limit?: number } | null
    setAnswer({ question, ok: !!body?.ok, text: body?.answer ?? 'Could not reach the dashboard. Check your connection.', meta: body?.limit ? `${body.usedToday} of ${body.limit} questions today` : '' })
    setBusy(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setAnswer(null)
      return
    }
    if (!options) {
      if (e.key === 'Enter') askAI()
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + options) % options) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (active < hits.length) pick(hits[active])
      else askAI()
    }
  }

  return (
    <div className="relative w-full sm:w-80">
      <label htmlFor="ask" className="sr-only">Search or ask a question</label>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        ref={input}
        id="ask"
        role="combobox"
        aria-expanded={open && options > 0}
        aria-controls="ask-options"
        aria-activedescendant={open && options ? `ask-opt-${active}` : undefined}
        autoComplete="off"
        value={q}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        placeholder="Search or ask… (Ctrl K)"
        className="h-9 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-[13.5px] text-ink placeholder:text-ink-3 hover:border-line-strong"
      />
      {open && options > 0 && (
        <ul id="ask-options" role="listbox" className="absolute right-0 z-30 mt-1 w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.id}`} id={`ask-opt-${i}`} role="option" aria-selected={active === i}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)} onMouseEnter={() => setActive(i)} className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', active === i && 'bg-subtle')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{h.label}</span>
                  <span className="block truncate text-[12px] text-ink-3">{h.sub}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-ink-3" aria-hidden />
              </button>
            </li>
          ))}
          <li id={`ask-opt-${hits.length}`} role="option" aria-selected={active === hits.length} className="border-t border-line">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={askAI} onMouseEnter={() => setActive(hits.length)} className={cn('flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13.5px]', active === hits.length && 'bg-subtle')}>
              <Sparkles className="h-4 w-4 text-accent" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink">Ask AI: <span className="text-ink-2">“{q.trim()}”</span></span>
            </button>
          </li>
        </ul>
      )}
      {answer && (
        <section aria-live="polite" className="absolute right-0 z-30 mt-1 w-[min(520px,calc(100vw-32px))] rounded-lg border border-line bg-surface p-4 shadow-lg">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <p className="min-w-0 flex-1 text-[13px] font-medium text-ink-2">{answer.question}</p>
            <button type="button" onClick={() => setAnswer(null)} aria-label="Close answer" className="rounded p-0.5 text-ink-3 hover:bg-subtle hover:text-ink"><X className="h-4 w-4" aria-hidden /></button>
          </div>
          <div className={cn('mt-2 whitespace-pre-line text-[13.5px] leading-relaxed', answer.ok ? 'text-ink' : 'text-warn')}>
            {busy ? <span className="inline-flex items-center gap-2 text-ink-3"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Looking it up…</span> : <Linked text={answer.text} onOrder={(id) => { setAnswer(null); onOpenOrder(id) }} />}
          </div>
          {answer.meta && !busy && <p className="mt-2 text-[11.5px] text-ink-3">From your dashboard data, by Claude Haiku · {answer.meta}</p>}
        </section>
      )}
    </div>
  )
}
