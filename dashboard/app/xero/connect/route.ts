import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/session'
import { startAuth, xeroAvailable, xeroConfig } from '@/lib/xero/client'

export const dynamic = 'force-dynamic'
const COOKIE = 'fn_xero_oauth'

export async function GET(req: Request) {
  if ((await currentUser()) === false) return NextResponse.redirect(new URL('/login', req.url))
  const c = xeroConfig()
  if (!c || !xeroAvailable()) return NextResponse.redirect(new URL('/?xero=not-configured', req.url))
  const { url, state, verifier } = startAuth(c)
  const res = NextResponse.redirect(url)
  res.cookies.set(COOKIE, JSON.stringify({ state, verifier }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/xero', maxAge: 600 })
  return res
}
