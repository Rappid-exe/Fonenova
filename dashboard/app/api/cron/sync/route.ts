import { NextResponse } from 'next/server'
import { cronAuthorised } from '@/lib/cron'
import { syncSources } from '@/lib/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * The daily scheduled sync (vercel.json). Vercel sends CRON_SECRET as a bearer token; this
 * route is outside the Google sign-in, so that token is its only lock. Returns statuses only,
 * never figures.
 */
export async function GET(req: Request) {
  if (!cronAuthorised(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  const sources = await syncSources({ force: true })
  return NextResponse.json(
    { ok: sources.every((s) => s.ok || !s.configured), sources: sources.map(({ source, ok, changed, message }) => ({ source, ok, changed, message })) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
