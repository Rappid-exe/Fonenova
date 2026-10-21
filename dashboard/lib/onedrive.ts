/**
 * Read-only OneDrive connection for the hosted dashboard, so it reads the same ledger and
 * VAT tracker you save on your PC.
 *
 * Microsoft sign-in for personal accounts (the "consumers" endpoint), auth code with PKCE
 * and a client secret, scope Files.Read only. Tokens live in the store (encrypted online
 * when hosted). Refresh tokens rotate, so every refresh saves the new pair at once, under
 * a lock. Only the two configured paths are ever opened.
 */
import crypto from 'node:crypto'
import { getJson, getStore, type Store } from './store'
import { isTrackerName, skipFolder, type FileSource } from './sync-core'

const LOGIN = () => (process.env.FN_MS_LOGIN_URL ?? 'https://login.microsoftonline.com/consumers/oauth2/v2.0').replace(/\/$/, '')
const GRAPH = () => (process.env.FN_GRAPH_URL ?? 'https://graph.microsoft.com/v1.0').replace(/\/$/, '')
const SCOPES = 'Files.Read offline_access'

export interface OneDriveConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  /** OneDrive-relative paths, e.g. "Desktop/Ledger/FoneNova_Order_Ledger.xlsx". */
  ledgerPath: string | null
  expensesPath: string | null
  expensesDir: string | null
}

/**
 * Accepts a OneDrive-relative path or one pasted from Windows
 * ("C:\Users\fonen\OneDrive\Desktop\x.xlsx" becomes "Desktop/x.xlsx").
 */
export function normalisePath(p: string | undefined): string | null {
  if (!p?.trim()) return null
  let s = p.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/')
  const i = s.search(/\/OneDrive[^/]*\//i)
  if (i !== -1) s = s.slice(s.indexOf('/', i + 1) + 1)
  return s.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/') || null
}

export function oneDriveConfig(): OneDriveConfig | null {
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.MS_REDIRECT_URI ?? `${process.env.AUTH_URL?.replace(/\/$/, '') ?? 'http://localhost:3100'}/onedrive/callback`,
    ledgerPath: normalisePath(process.env.FN_ONEDRIVE_LEDGER),
    expensesPath: normalisePath(process.env.FN_ONEDRIVE_EXPENSES),
    expensesDir: normalisePath(process.env.FN_ONEDRIVE_EXPENSES_DIR),
  }
}

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  accountName: string | null
}

export async function oneDriveConnected(store: Store = getStore()): Promise<{ connected: boolean; accountName: string | null }> {
  const t = await getJson<Tokens>(store, 'onedrive:tokens')
  return { connected: !!t, accountName: t?.accountName ?? null }
}

export async function disconnectOneDrive(): Promise<void> {
  await getStore().del('onedrive:tokens')
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

const b64url = (b: Buffer) => b.toString('base64url')

export function startOneDriveAuth(c: OneDriveConfig): { url: string; state: string; verifier: string } {
  const state = b64url(crypto.randomBytes(24))
  const verifier = b64url(crypto.randomBytes(48))
  const q = new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    redirect_uri: c.redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return { url: `${LOGIN()}/authorize?${q}`, state, verifier }
}

async function tokenRequest(c: OneDriveConfig, body: Record<string, string>): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(`${LOGIN()}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, scope: SCOPES, ...body }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Microsoft refused the sign-in (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function finishOneDriveAuth(c: OneDriveConfig, code: string, verifier: string): Promise<string | null> {
  const t = await tokenRequest(c, { grant_type: 'authorization_code', code, redirect_uri: c.redirectUri, code_verifier: verifier })
  // The drive's owner name, so the bar can say whose OneDrive is connected. Files.Read allows this.
  const drive = await fetch(`${GRAPH()}/me/drive?$select=owner`, { headers: { authorization: `Bearer ${t.access_token}` }, cache: 'no-store' })
  if (!drive.ok) throw new Error(`Could not open the OneDrive (${drive.status})`)
  const accountName = ((await drive.json()) as { owner?: { user?: { displayName?: string } } }).owner?.user?.displayName ?? null
  await getStore().set('onedrive:tokens', { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000, accountName } satisfies Tokens)
  return accountName
}

async function accessToken(c: OneDriveConfig, store: Store): Promise<string> {
  return store.withLock('onedrive:tokens', async () => {
    const t = await getJson<Tokens>(store, 'onedrive:tokens')
    if (!t) throw new Error('OneDrive is not connected')
    if (t.expiresAt - 60_000 > Date.now()) return t.accessToken
    const r = await tokenRequest(c, { grant_type: 'refresh_token', refresh_token: t.refreshToken })
    await store.set('onedrive:tokens', { ...t, accessToken: r.access_token, refreshToken: r.refresh_token ?? t.refreshToken, expiresAt: Date.now() + r.expires_in * 1000 })
    return r.access_token
  })
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export interface DriveItem {
  id: string
  name: string
  lastModifiedDateTime: string
  folder?: unknown
  file?: unknown
}

type Graph = (pathAndQuery: string) => Promise<Response>

function graph(token: () => Promise<string>): Graph {
  return async (pathAndQuery) => fetch(`${GRAPH()}${pathAndQuery}`, { headers: { authorization: `Bearer ${await token()}` }, cache: 'no-store', signal: AbortSignal.timeout(20_000) })
}

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

async function itemByPath(g: Graph, p: string): Promise<DriveItem | null> {
  const res = await g(`/me/drive/root:/${encodePath(p)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`OneDrive answered ${res.status} for ${p.split('/').pop()}`)
  return res.json()
}

async function children(g: Graph, id: string): Promise<DriveItem[]> {
  const out: DriveItem[] = []
  let next: string | null = `/me/drive/items/${id}/children?$top=200&$select=id,name,lastModifiedDateTime,folder,file`
  for (let i = 0; next && i < 20; i++) {
    const res = await g(next)
    if (!res.ok) throw new Error(`OneDrive answered ${res.status} listing a folder`)
    const body = (await res.json()) as { value: DriveItem[]; '@odata.nextLink'?: string }
    out.push(...body.value)
    next = body['@odata.nextLink'] ? body['@odata.nextLink'].replace(GRAPH(), '') : null
  }
  return out
}

/** Newest tracker in a folder tree, by the same rules as on your PC (backups and lock files skipped). */
export async function newestDriveTracker(list: (id: string) => Promise<DriveItem[]>, rootId: string, depth = 3): Promise<DriveItem | null> {
  let best: DriveItem | null = null
  async function walk(id: string, level: number) {
    for (const item of await list(id)) {
      if (item.folder) {
        if (!skipFolder(item.name) && level < depth) await walk(item.id, level + 1)
      } else if (item.file && isTrackerName(item.name)) {
        if (!best || Date.parse(item.lastModifiedDateTime) > Date.parse(best.lastModifiedDateTime)) best = item
      }
    }
  }
  await walk(rootId, 0)
  return best
}

function driveFile(g: Graph, fileName: string, find: () => Promise<DriveItem | null>): FileSource {
  let item: DriveItem | null | undefined
  return {
    fileName,
    savedAt: async () => {
      item = await find()
      return item ? Date.parse(item.lastModifiedDateTime) : null
    },
    read: async () => {
      if (!item) throw new Error('File not found')
      // /content answers with a redirect to a short-lived, pre-signed download address.
      const res = await g(`/me/drive/items/${item.id}/content`)
      if (!res.ok) throw new Error(`OneDrive download failed (${res.status})`)
      return Buffer.from(await res.arrayBuffer())
    },
  }
}

/**
 * The ledger and tracker as sync sources, or null for each that is not configured.
 * The tracker's file name is only known after a look in the folder, so it is resolved here.
 */
export async function oneDriveSources(c: OneDriveConfig, store: Store = getStore()): Promise<{ ledger: FileSource | null; expenses: FileSource | null; expensesNote: string | null }> {
  let token: Promise<string> | null = null // one token lookup per sync, not one per request
  const g = graph(() => (token ??= accessToken(c, store)))
  const ledger = c.ledgerPath ? driveFile(g, c.ledgerPath.split('/').pop()!, () => itemByPath(g, c.ledgerPath!)) : null

  if (c.expensesPath) return { ledger, expenses: driveFile(g, c.expensesPath.split('/').pop()!, () => itemByPath(g, c.expensesPath!)), expensesNote: null }
  if (!c.expensesDir) return { ledger, expenses: null, expensesNote: null }
  const folder = await itemByPath(g, c.expensesDir)
  if (!folder?.folder) return { ledger, expenses: null, expensesNote: 'The VAT returns folder was not found in OneDrive.' }
  const found = await newestDriveTracker((id) => children(g, id), folder.id)
  if (!found) return { ledger, expenses: null, expensesNote: 'No "VAT Return From…xlsx" found in that OneDrive folder (backups are skipped).' }
  return { ledger, expenses: driveFile(g, found.name, async () => found), expensesNote: null }
}
