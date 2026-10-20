import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/session'
import { refreshSnapshot, xeroConfig } from '@/lib/xero/client'

export const dynamic = 'force-dynamic'

export async function POST() {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const c = xeroConfig()
  if (!c) return NextResponse.json({ error: 'Xero is not set up: add XERO_CLIENT_ID to .env.local' }, { status: 400 })
  try {
    const s = await refreshSnapshot(c)
    return NextResponse.json({ ok: true, fetchedAt: s.fetchedAt, invoices: s.invoices.length, problems: s.problems })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Refresh failed' }, { status: 502 })
  }
}
