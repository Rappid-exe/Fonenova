import { NextResponse } from 'next/server'
import { cookieOptions, SESSION_COOKIE } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST only, so a link on another site cannot sign the owner out.
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/login?signedout=1', req.url), 303)
  res.cookies.set(SESSION_COOKIE, '', cookieOptions(0))
  return res
}
