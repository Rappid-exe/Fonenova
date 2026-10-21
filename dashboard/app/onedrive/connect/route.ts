import { NextResponse } from 'next/server'
import { oneDriveConfig, startOneDriveAuth } from '@/lib/onedrive'
import { currentUser } from '@/lib/session'
import { storeWritable } from '@/lib/store'

export const dynamic = 'force-dynamic'
const COOKIE = 'fn_onedrive_oauth'

export async function GET(req: Request) {
  if ((await currentUser()) === false) return NextResponse.redirect(new URL('/login', req.url))
  const c = oneDriveConfig()
  if (!c || !storeWritable()) return NextResponse.redirect(new URL('/?onedrive=not-configured#settings', req.url))
  const { url, state, verifier } = startOneDriveAuth(c)
  const res = NextResponse.redirect(url)
  res.cookies.set(COOKIE, JSON.stringify({ state, verifier }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/onedrive', maxAge: 600 })
  return res
}
