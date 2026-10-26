import { NextResponse } from 'next/server'
import { gmailConfig, startGmailAuth } from '@/lib/gmail'
import { currentUser } from '@/lib/session'
import { storeWritable } from '@/lib/store'

export const dynamic = 'force-dynamic'
const COOKIE = 'fn_gmail_oauth'

export async function GET(req: Request) {
  if ((await currentUser()) === false) return NextResponse.redirect(new URL('/login', req.url))
  const c = gmailConfig()
  if (!c || !storeWritable()) return NextResponse.redirect(new URL('/?gmail=not-configured#settings', req.url))
  const { url, state, verifier } = startGmailAuth(c)
  const res = NextResponse.redirect(url)
  res.cookies.set(COOKIE, JSON.stringify({ state, verifier }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/gmail', maxAge: 600 })
  return res
}
