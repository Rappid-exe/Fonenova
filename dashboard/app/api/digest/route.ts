import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/session'
import { sendDigest } from '@/lib/weekly'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** "Send test email now" in Settings: sends this week's email straight away, marked as a test. */
export async function POST() {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const s = await sendDigest({ test: true })
  return NextResponse.json(s, { status: s.ok ? 200 : 502 })
}
