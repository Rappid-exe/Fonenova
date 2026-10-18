import { NextResponse, type NextRequest } from 'next/server'
import { authBypassed, authConfig, readSession, SESSION_COOKIE } from '@/lib/auth'

/**
 * Gate every request behind the owner's session. The page re-checks the session itself,
 * so this is the first of two locks, not the only one.
 */
export async function proxy(req: NextRequest) {
  if (authBypassed()) return NextResponse.next()

  const cfg = authConfig()
  const session = cfg.ok ? await readSession(req.cookies.get(SESSION_COOKIE)?.value, cfg.config) : null
  if (session) {
    const res = NextResponse.next()
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  }

  if (req.method === 'GET' && req.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return new NextResponse('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } })
}

export const config = {
  // Everything except the sign-in flow itself, robots.txt and Next's static build assets
  // (hashed JS/CSS with no data in them).
  matcher: ['/((?!login|auth/|robots\\.txt|_next/static|_next/image|favicon\\.ico).*)'],
}
