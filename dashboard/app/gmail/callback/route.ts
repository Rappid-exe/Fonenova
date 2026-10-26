import { NextResponse, type NextRequest } from 'next/server'
import { finishGmailAuth, gmailConfig } from '@/lib/gmail'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'
const COOKIE = 'fn_gmail_oauth'

export async function GET(req: NextRequest) {
  if ((await currentUser()) === false) return NextResponse.redirect(new URL('/login', req.url))
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/?gmail=${q}#settings`, req.url))
    res.cookies.set(COOKIE, '', { path: '/gmail', maxAge: 0 })
    return res
  }
  const c = gmailConfig()
  if (!c) return back('not-configured')
  let saved: { state?: string; verifier?: string } = {}
  try {
    saved = JSON.parse(req.cookies.get(COOKIE)?.value ?? '{}')
  } catch {}
  const code = req.nextUrl.searchParams.get('code')
  if (req.nextUrl.searchParams.get('error')) return back('declined')
  if (!code || !saved.state || !saved.verifier || req.nextUrl.searchParams.get('state') !== saved.state) return back('state')
  try {
    await finishGmailAuth(c, code, saved.verifier)
  } catch (e) {
    console.error('Gmail sign-in failed:', e instanceof Error ? e.message : e)
    return back(e instanceof Error && e.message.startsWith('Only ') ? 'wrong-account' : 'failed')
  }
  return back('connected')
}
