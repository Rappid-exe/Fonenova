'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Link2, RefreshCw, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { XeroState } from '@/lib/data-source'
import type { LiveSummary } from '@/lib/metrics'
import { formatDate } from '@/lib/periods'
import { cn } from '@/lib/utils'

const NOTICE: Record<string, string> = {
  connected: 'Xero connected.',
  declined: 'Xero sign-in was cancelled.',
  state: 'The Xero sign-in expired or was opened in another browser. Try again.',
  failed: 'Xero sign-in failed. Check the client ID and redirect address in your Xero app.',
  'not-configured': 'Xero is not set up on this computer yet.',
}

export function XeroBar({ xero, summary, ledgerImported, ledgerSnapshot, notice }: {
  xero: XeroState
  summary: LiveSummary | null
  ledgerImported: string
  ledgerSnapshot: string
  notice: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'refresh' | 'disconnect' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const snap = xero.snapshot

  async function post(path: string, kind: 'refresh' | 'disconnect') {
    setBusy(kind)
    setError(null)
    try {
      const res = await fetch(path, { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) setError(body.error ?? `Failed (${res.status})`)
      router.refresh()
    } catch {
      setError('Could not reach the dashboard server')
    } finally {
      setBusy(null)
    }
  }

  const refreshed = snap ? `${formatDate(snap.fetchedAt.slice(0, 10))}, ${new Date(snap.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : null
  const problems = snap?.problems ?? []

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px]" role="status">
      <span className="text-ink-3">Ledger imported {ledgerImported} (snapshot {ledgerSnapshot})</span>
      <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
      {!xero.configured ? (
        <span className="text-ink-3">Xero not set up: add <code>XERO_CLIENT_ID</code> to <code>.env.local</code>. Statuses come from the ledger snapshot.</span>
      ) : !xero.connected ? (
        <>
          <span className="text-ink-2">Xero not connected. Statuses come from the ledger snapshot.</span>
          <a href="/xero/connect" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-navy px-2.5 font-medium text-white hover:bg-navy-2">
            <Link2 className="h-4 w-4" aria-hidden />Connect Xero (read-only)
          </a>
        </>
      ) : (
        <>
          <span className={cn('font-medium', problems.length ? 'text-warn' : 'text-gain')}>
            Live from Xero{xero.tenantName ? ` (${xero.tenantName})` : ''}
          </span>
          <span className="text-ink-2">{refreshed ? `last refreshed ${refreshed}` : 'not refreshed yet'}</span>
          {summary && (
            <Popover>
              <PopoverTrigger className="inline-flex items-center gap-1 text-ink-2 underline decoration-line underline-offset-2 hover:text-ink">
                {summary.clientMatched}/{summary.orders} client invoices, {summary.billMatched}/{summary.orders} bills matched
                {problems.length > 0 && `, ${problems.length} problem${problems.length > 1 ? 's' : ''}`}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </PopoverTrigger>
              <PopoverContent className="w-[min(460px,calc(100vw-24px))] p-0">
                <div className="border-b border-line px-3 py-2 text-[12px] text-ink-3">
                  Orders whose invoices were found in Xero use Xero&apos;s live status, balance, due date and payments. The rest keep the ledger snapshot. Sales and costs always come from the ledger.
                </div>
                {problems.length > 0 && (
                  <ul className="border-b border-line px-3 py-2 text-[12px] text-warn">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                )}
                <ul className="relative max-h-64 overflow-y-auto px-3 py-2 text-[12px]">
                  {summary.gaps.length === 0 ? <li className="text-gain">Every order matched.</li> : summary.gaps.map((g) => (
                    <li key={g.orderId} className="py-0.5"><span className="font-medium text-ink">{g.orderId}</span> <span className="text-ink-3">{g.problem}</span></li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
          <Button size="sm" onClick={() => post('/xero/refresh', 'refresh')} disabled={busy !== null}>
            <RefreshCw className={cn('h-3.5 w-3.5', busy === 'refresh' && 'animate-spin')} aria-hidden />{busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => post('/xero/disconnect', 'disconnect')} disabled={busy !== null}>
            <Unlink className="h-3.5 w-3.5" aria-hidden />Disconnect
          </Button>
        </>
      )}
      {(error || (notice && NOTICE[notice])) && <span className={cn(error || notice !== 'connected' ? 'text-loss' : 'text-gain')}>{error ?? NOTICE[notice!]}</span>}
    </div>
  )
}
