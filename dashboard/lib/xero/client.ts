/**
 * Read-only Xero connection.
 *
 * Uses Xero's OAuth 2.0 flow with PKCE, so only a client ID is needed (no client secret
 * stored anywhere). Tokens and the last fetched snapshot live in the store: data/xero/ on
 * your PC (git-ignored), encrypted online storage when hosted. Refresh tokens rotate, so
 * every refresh saves the new pair at once, under a lock.
 */
import 'server-only'
import crypto from 'node:crypto'
import { getJson, getStore, storeWritable } from '../store'
import { mapBankSummary, mapInvoice } from './map'
import type { XeroInvoice, XeroSnapshot } from '../types'

const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize'
const TOKEN_URL = 'https://identity.xero.com/connect/token'
const CONNECTIONS_URL = 'https://api.xero.com/connections'
const API = 'https://api.xero.com/api.xro/2.0'

// Read-only scopes for apps created after 2 March 2026 (granular scopes). Override with
// XERO_SCOPES if Xero's app settings list different names.
const DEFAULT_SCOPES = 'offline_access accounting.invoices.read accounting.payments.read accounting.reports.banksummary.read'

export interface XeroConfig {
  clientId: string
  redirectUri: string
  scopes: string
  baseCurrency: string
}

export function xeroConfig(): XeroConfig | null {
  const clientId = process.env.XERO_CLIENT_ID
  if (!clientId) return null
  return {
    clientId,
    redirectUri: process.env.XERO_REDIRECT_URI ?? `${process.env.AUTH_URL?.replace(/\/$/, '') ?? 'http://localhost:3100'}/xero/callback`,
    scopes: process.env.XERO_SCOPES ?? DEFAULT_SCOPES,
    // Fone Nova keeps its books in GBP. Xero's Bank Summary reports in this base currency.
    baseCurrency: process.env.XERO_BASE_CURRENCY ?? 'GBP',
  }
}

/** Tokens must survive a restart: always true on your PC, and hosted once online storage is set up. */
export function xeroAvailable(): boolean {
  return storeWritable()
}

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tenantId: string
  tenantName: string
}

export async function xeroConnected(): Promise<{ connected: boolean; tenantName: string | null }> {
  const t = await getJson<Tokens>(getStore(), 'xero:tokens')
  return { connected: !!t, tenantName: t?.tenantName ?? null }
}

export async function loadSnapshot(): Promise<XeroSnapshot | null> {
  return getJson<XeroSnapshot>(getStore(), 'xero:snapshot')
}

export async function disconnect(): Promise<void> {
  const store = getStore()
  await store.del('xero:tokens')
  await store.del('xero:snapshot')
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

const b64url = (b: Buffer) => b.toString('base64url')

export function startAuth(c: XeroConfig): { url: string; state: string; verifier: string } {
  const state = b64url(crypto.randomBytes(24))
  const verifier = b64url(crypto.randomBytes(48))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    scope: c.scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return { url: `${AUTHORIZE_URL}?${q}`, state, verifier }
}

async function tokenRequest(body: Record<string, string>): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Xero refused the sign-in (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function finishAuth(c: XeroConfig, code: string, verifier: string): Promise<string> {
  const t = await tokenRequest({ grant_type: 'authorization_code', client_id: c.clientId, code, redirect_uri: c.redirectUri, code_verifier: verifier })
  const conns = await fetch(CONNECTIONS_URL, { headers: { authorization: `Bearer ${t.access_token}` }, cache: 'no-store' })
  if (!conns.ok) throw new Error(`Could not list Xero organisations (${conns.status})`)
  const list = (await conns.json()) as { tenantId: string; tenantName: string; tenantType: string }[]
  const org = list.find((x) => x.tenantType === 'ORGANISATION') ?? list[0]
  if (!org) throw new Error('This Xero login has no organisation connected')
  await getStore().set('xero:tokens', {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + t.expires_in * 1000,
    tenantId: org.tenantId,
    tenantName: org.tenantName,
  } satisfies Tokens)
  return org.tenantName
}

async function validTokens(c: XeroConfig): Promise<Tokens> {
  const store = getStore()
  // Locked and re-read inside the lock: a page load and the hourly run must not both spend
  // the same single-use refresh token.
  return store.withLock('xero:tokens', async () => {
    const t = await getJson<Tokens>(store, 'xero:tokens')
    if (!t) throw new Error('Xero is not connected')
    if (t.expiresAt - 60_000 > Date.now()) return t
    const r = await tokenRequest({ grant_type: 'refresh_token', client_id: c.clientId, refresh_token: t.refreshToken })
    const next: Tokens = { ...t, accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: Date.now() + r.expires_in * 1000 }
    await store.set('xero:tokens', next) // refresh tokens are single-use: save the new one immediately
    return next
  })
}

// ---------------------------------------------------------------------------
// Refresh: read invoices, bills, payments and bank balances
// ---------------------------------------------------------------------------

async function get(t: Tokens, pathAndQuery: string): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; problem: string }> {
  const res = await fetch(`${API}${pathAndQuery}`, {
    headers: { authorization: `Bearer ${t.accessToken}`, 'xero-tenant-id': t.tenantId, accept: 'application/json' },
    cache: 'no-store',
  })
  if (res.ok) return { ok: true, json: await res.json() }
  const text = (await res.text()).slice(0, 300)
  if (res.status === 401 || res.status === 403) return { ok: false, problem: `Xero refused ${pathAndQuery.split('?')[0]} (${res.status}); the app may be missing a permission. ${text}` }
  if (res.status === 429) return { ok: false, problem: 'Xero rate limit reached; try again in a minute' }
  return { ok: false, problem: `Xero ${pathAndQuery.split('?')[0]} failed (${res.status})` }
}

export async function refreshSnapshot(c: XeroConfig, sinceIso = '2026-01-01'): Promise<XeroSnapshot> {
  const t = await validTokens(c)
  const problems: string[] = []
  const invoices: XeroInvoice[] = []
  const [y, m, d] = sinceIso.split('-').map(Number)
  const where = encodeURIComponent(`Date>=DateTime(${y},${m},${d})`)
  for (let page = 1; page <= 50; page++) {
    const r = await get(t, `/Invoices?where=${where}&page=${page}&pageSize=100`)
    if (!r.ok) {
      problems.push(r.problem)
      break
    }
    const batch = (r.json.Invoices as Record<string, unknown>[] | undefined) ?? []
    for (const j of batch) {
      const inv = mapInvoice(j)
      if (inv) invoices.push(inv)
    }
    if (batch.length < 100) break
  }

  let bankBalances: XeroSnapshot['bankBalances'] = null
  const today = new Date().toISOString().slice(0, 10)
  const b = await get(t, `/Reports/BankSummary?toDate=${today}`)
  if (b.ok) {
    const report = (b.json.Reports as Record<string, unknown>[] | undefined)?.[0]
    bankBalances = report ? mapBankSummary(report) : null
    if (!bankBalances) problems.push('Xero Bank Summary came back in an unexpected layout, so bank balances are not shown')
  } else {
    problems.push(b.problem)
  }

  const snapshot: XeroSnapshot = { fetchedAt: new Date().toISOString(), tenantName: t.tenantName, baseCurrency: c.baseCurrency, invoices, bankBalances, problems }
  await getStore().set('xero:snapshot', snapshot)
  return snapshot
}
