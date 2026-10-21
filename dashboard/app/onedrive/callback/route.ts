import { NextResponse, type NextRequest } from 'next/server'
import { finishOneDriveAuth, oneDriveConfig } from '@/lib/onedrive'
import { currentUser } from '@/lib/session'
import { syncSources } from '@/lib/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const COOKIE = 'fn_onedrive_oauth'

export async function GET(req: NextRequest) {
  if ((await currentUser()) === false) return NextResponse.redirect(new URL('/login', req.url))
  const c = oneDriveConfig()
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/?onedrive=${q}`, req.url))
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
  await syncSources({ force: true }) // first import straight away; problems show in the status bar
  return back('connected')
}
