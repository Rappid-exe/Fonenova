import { NextResponse } from 'next/server'
import { disconnectOneDrive } from '@/lib/onedrive'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

/** Forgets the OneDrive sign-in. Data already imported stays until the next import replaces it. */
export async function POST() {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  await disconnectOneDrive()
  return NextResponse.json({ ok: true })
}
