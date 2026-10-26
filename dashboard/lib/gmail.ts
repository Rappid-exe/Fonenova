/**
 * Send-only Gmail connection, used for the Friday cash email.
 *
 * Google sign-in with the dashboard's own OAuth client (GOOGLE_CLIENT_ID / SECRET), auth code
 * with PKCE, scope gmail.send only: it can send mail as the signed-in account and can never read
 * the mailbox. Only AUTH_ALLOWED_EMAIL may connect. Tokens live in the store (encrypted online).
 * With the Google consent screen set to Internal (Workspace), the refresh token does not expire.
 */
import crypto from 'node:crypto'
import { getJson, getStore, type Store } from './store'

const AUTH = () => process.env.FN_GOOGLE_AUTH_URL ?? 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = () => process.env.FN_GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token'
const USERINFO = () => process.env.FN_GOOGLE_USERINFO_URL ?? 'https://openidconnect.googleapis.com/v1/userinfo'
const GMAIL = () => (process.env.FN_GMAIL_API_URL ?? 'https://gmail.googleapis.com/gmail/v1').replace(/\/$/, '')
const SCOPES = 'openid email https://www.googleapis.com/auth/gmail.send'

export interface GmailConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  allowedEmail: string | null
  /** Who the Friday email goes to. */
  to: string
}

export function gmailConfig(): GmailConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const allowed = process.env.AUTH_ALLOWED_EMAIL?.trim().toLowerCase() || null
  return {
    clientId,
    clientSecret,
    redirectUri: `${process.env.AUTH_URL?.replace(/\/$/, '') ?? 'http://localhost:3100'}/gmail/callback`,
    allowedEmail: allowed,
    to: process.env.DIGEST_TO?.trim() || allowed || 'info@fonenova.com',
  }
}

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email: string
}

export async function gmailConnected(store: Store = getStore()): Promise<{ connected: boolean; email: string | null }> {
  const t = await getJson<Tokens>(store, 'gmail:tokens')
  return { connected: !!t, email: t?.email ?? null }
}

export async function disconnectGmail(): Promise<void> {
  await getStore().del('gmail:tokens')
}

const b64url = (b: Buffer) => b.toString('base64url')

export function startGmailAuth(c: GmailConfig): { url: string; state: string; verifier: string } {
  const state = b64url(crypto.randomBytes(24))
  const verifier = b64url(crypto.randomBytes(48))
  const q = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: c.redirectUri,
    scope: SCOPES,
    state,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    access_type: 'offline', // a refresh token, so Friday's email sends with nobody signed in
    prompt: 'consent', // Google only returns the refresh token on a consent screen
    ...(c.allowedEmail ? { login_hint: c.allowedEmail } : {}),
  })
  return { url: `${AUTH()}?${q}`, state, verifier }
}

async function tokenRequest(c: GmailConfig, body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(TOKEN(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...body }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Google refused (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function finishGmailAuth(c: GmailConfig, code: string, verifier: string): Promise<string> {
  const t = await tokenRequest(c, { grant_type: 'authorization_code', code, redirect_uri: c.redirectUri, code_verifier: verifier })
  if (!t.refresh_token) throw new Error('Google did not return a refresh token. Remove QuayPilot from your Google account’s third-party access and connect again.')
  const who = await fetch(USERINFO(), { headers: { authorization: `Bearer ${t.access_token}` }, cache: 'no-store' })
  const email = who.ok ? String(((await who.json()) as { email?: string }).email ?? '').toLowerCase() : ''
  if (!email) throw new Error('Could not read which Google account signed in')
  if (c.allowedEmail && email !== c.allowedEmail) throw new Error(`Only ${c.allowedEmail} can send the weekly email (signed in as ${email})`)
  await getStore().set('gmail:tokens', { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000, email } satisfies Tokens)
  return email
}

async function accessToken(c: GmailConfig, store: Store): Promise<Tokens> {
  return store.withLock('gmail:tokens', async () => {
    const t = await getJson<Tokens>(store, 'gmail:tokens')
    if (!t) throw new Error('Gmail is not connected')
    if (t.expiresAt - 60_000 > Date.now()) return t
    const r = await tokenRequest(c, { grant_type: 'refresh_token', refresh_token: t.refreshToken })
    const next = { ...t, accessToken: r.access_token, refreshToken: r.refresh_token ?? t.refreshToken, expiresAt: Date.now() + r.expires_in * 1000 }
    await store.set('gmail:tokens', next)
    return next
  })
}

/** RFC 2822 message with a plain-text and an HTML part. Headers are UTF-8 encoded. */
export function mimeMessage(m: { from: string; to: string; subject: string; text: string; html: string }): string {
  const boundary = `qp_${crypto.randomBytes(9).toString('hex')}`
  const enc = (s: string) => `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`
  const part = (type: string, body: string) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', Buffer.from(body).toString('base64').replace(/(.{76})/g, '$1\r\n')].join('\r\n')
  return [
    `From: ${enc('QuayPilot')} <${m.from}>`,
    `To: ${m.to}`,
    `Subject: ${enc(m.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    part('text/plain', m.text),
    part('text/html', m.html),
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

export async function sendGmail(c: GmailConfig, msg: { subject: string; text: string; html: string; to?: string }, store: Store = getStore()): Promise<{ id: string; to: string; from: string }> {
  const t = await accessToken(c, store)
  const to = msg.to ?? c.to
  const raw = Buffer.from(mimeMessage({ from: t.email, to, subject: msg.subject, text: msg.text, html: msg.html })).toString('base64url')
  const res = await fetch(`${GMAIL()}/users/me/messages/send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${t.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Gmail did not send it (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return { id: String(((await res.json()) as { id?: string }).id ?? ''), to, from: t.email }
}
