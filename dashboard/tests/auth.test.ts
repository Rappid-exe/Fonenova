import { describe, expect, it } from 'vitest'
import { createSession, finishOAuth, readSession, sign, startOAuth, verify, type AuthConfig } from '@/lib/auth'

const C: AuthConfig = {
  secret: 'x'.repeat(48),
  allowedEmail: 'owner@example.com',
  clientId: 'client-123.apps.googleusercontent.com',
  clientSecret: 'shh',
  origin: 'https://dashboard.example.com',
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const idToken = (claims: object) => `${b64({ alg: 'RS256' })}.${b64(claims)}.sig`

async function begin() {
  const { url, cookie } = await startOAuth(C)
  const u = new URL(url)
  const st = (await verify<{ state: string; nonce: string; exp: number }>(cookie, C.secret))!
  return { u, cookie, st }
}

function tokenFetch(claims: object, ok = true): typeof fetch {
  return (async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: ok ? 200 : 400 })) as typeof fetch
}

const good = (st: { nonce: string }) => ({
  iss: 'https://accounts.google.com', aud: C.clientId, exp: Math.floor(Date.now() / 1000) + 300,
  nonce: st.nonce, email: 'Owner@Example.com', email_verified: true,
})

describe('signed tokens', () => {
  it('round-trips and rejects tampering, foreign keys and expiry', async () => {
    const t = await sign({ a: 1, exp: Math.floor(Date.now() / 1000) + 60 }, C.secret)
    expect(await verify(t, C.secret)).toMatchObject({ a: 1 })
    const [p, s] = t.split('.')
    expect(await verify(`${b64({ a: 2, exp: 9e9 })}.${s}`, C.secret)).toBeNull()
    expect(await verify(`${p}.${s}x`, C.secret)).toBeNull()
    expect(await verify(t, 'y'.repeat(48))).toBeNull()
    expect(await verify(await sign({ exp: 1 }, C.secret), C.secret)).toBeNull()
    expect(await verify(undefined, C.secret)).toBeNull()
  })
  it('sessions are valid only for the allowed email', async () => {
    expect(await readSession(await createSession('owner@example.com', C), C)).toMatchObject({ email: 'owner@example.com' })
    expect(await readSession(await createSession('someone@else.com', C), C)).toBeNull()
  })
})

describe('Google sign-in', () => {
  it('sends PKCE, state and nonce to Google with the fixed redirect URI', async () => {
    const { u, st } = await begin()
    expect(u.origin).toBe('https://accounts.google.com')
    expect(u.searchParams.get('redirect_uri')).toBe('https://dashboard.example.com/auth/callback')
    expect(u.searchParams.get('code_challenge_method')).toBe('S256')
    expect(u.searchParams.get('state')).toBe(st.state)
  })
  it('accepts the allowed, verified email', async () => {
    const { cookie, st } = await begin()
    const r = await finishOAuth(C, new URLSearchParams({ code: 'c', state: st.state }), cookie, tokenFetch(good(st)))
    expect(r).toEqual({ ok: true, email: 'owner@example.com' })
  })
  it('rejects a mismatched state or missing cookie', async () => {
    const { cookie, st } = await begin()
    expect(await finishOAuth(C, new URLSearchParams({ code: 'c', state: 'other' }), cookie, tokenFetch(good(st)))).toEqual({ ok: false, reason: 'state' })
    expect(await finishOAuth(C, new URLSearchParams({ code: 'c', state: st.state }), undefined, tokenFetch(good(st)))).toEqual({ ok: false, reason: 'state' })
  })
  it('rejects other accounts and unverified email', async () => {
    const { cookie, st } = await begin()
    const p = new URLSearchParams({ code: 'c', state: st.state })
    expect(await finishOAuth(C, p, cookie, tokenFetch({ ...good(st), email: 'attacker@gmail.com' }))).toEqual({ ok: false, reason: 'denied' })
    expect(await finishOAuth(C, p, cookie, tokenFetch({ ...good(st), email_verified: false }))).toEqual({ ok: false, reason: 'denied' })
  })
  it('rejects tokens for another client, issuer, nonce, or already expired', async () => {
    const { cookie, st } = await begin()
    const p = new URLSearchParams({ code: 'c', state: st.state })
    for (const bad of [{ aud: 'other' }, { iss: 'https://evil.example' }, { nonce: 'n' }, { exp: 1 }]) {
      expect(await finishOAuth(C, p, cookie, tokenFetch({ ...good(st), ...bad }))).toEqual({ ok: false, reason: 'token' })
    }
    expect(await finishOAuth(C, p, cookie, tokenFetch(good(st), false))).toEqual({ ok: false, reason: 'exchange' })
  })
})
