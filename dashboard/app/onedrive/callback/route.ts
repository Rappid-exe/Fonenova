import { NextResponse, type NextRequest } from 'next/server'
import { finishOneDriveAuth, oneDriveConfig } from '@/lib/onedrive'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'
const COOKIE = 'fn_onedrive_oauth'

export async function GET(req: NextRequest) {
  if ((await currentUser()) === false) return NextResponse.redirect(new URL('/login', req.url))
  const c = oneDriveConfig()
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/?onedrive=${q}#settings`, req.url))
    res.cookies.set(COOKIE, '', { path: '/onedrive', maxAge: 0 })
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
    await finishOneDriveAuth(c, code, saved.verifier)
  } catch (e) {
    console.error('OneDrive sign-in failed:', e instanceof Error ? e.message : e)
    return back('failed')
  }
  // No import here: the page this redirects to syncs straight away (forced by ?onedrive=), so a
  // slow first import can't time out the sign-in.
  return back('connected')
}
