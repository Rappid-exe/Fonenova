import { NextResponse, type NextRequest } from 'next/server'
import { currentUser } from '@/lib/session'
import { finishAuth, refreshSnapshot, xeroConfig } from '@/lib/xero/client'

export const dynamic = 'force-dynamic'
const COOKIE = 'fn_xero_oauth'

export async function GET(req: NextRequest) {
  if ((await currentUser()) === false) return NextResponse.redirect(new URL('/login', req.url))
  const c = xeroConfig()
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/?xero=${q}#settings`, req.url))
    res.cookies.set(COOKIE, '', { path: '/xero', maxAge: 0 })
    return res
  }
  if (!c) return back('not-configured')
  let saved: { state?: string; verifier?: string } = {}
  try {
    saved = JSON.parse(req.cookies.get(COOKIE)?.value ?? '{}')
  } catch {}
  const code = req.nextUrl.searchParams.get('code')
  if (req.nextUrl.searchParams.get('error')) return back('declined')
  if (!code || !saved.state || !saved.verifier || req.nextUrl.searchParams.get('state') !== saved.state) return back('state')
  try {
    await finishAuth(c, code, saved.verifier)
    await refreshSnapshot(c)
    return back('connected')
  } catch (e) {
    console.error('Xero sign-in failed:', e instanceof Error ? e.message : e)
    return back('failed')
  }
}
