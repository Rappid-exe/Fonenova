import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/session'
import { disconnect } from '@/lib/xero/client'

export const dynamic = 'force-dynamic'

export async function POST() {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  await disconnect()
  return NextResponse.json({ ok: true })
}
