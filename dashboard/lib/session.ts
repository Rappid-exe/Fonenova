import 'server-only'
import { cookies } from 'next/headers'
import { authBypassed, authConfig, readSession, SESSION_COOKIE } from './auth'

/**
 * The signed-in owner's email, `null` when sign-in is bypassed in local dev, or `false` when
 * there is no valid session. Pages and API routes both check this, on top of proxy.ts.
 */
export async function currentUser(): Promise<string | null | false> {
  if (authBypassed()) return null
  const cfg = authConfig()
  const session = cfg.ok ? await readSession((await cookies()).get(SESSION_COOKIE)?.value, cfg.config) : null
  return session ? session.email : false
}
