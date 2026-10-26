import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({})) // client.ts is server-only in the app; plain Node here
import { refreshSnapshot, xeroConfig } from '@/lib/xero/client'
import { FileStore } from '@/lib/store'
import type { XeroSnapshot } from '@/lib/types'

const env = { ...process.env }
let store: FileStore
beforeEach(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xero-'))
  Object.assign(process.env, { XERO_CLIENT_ID: 'cid', FN_DATA_DIR: dir })
  delete process.env.KV_REST_API_URL
  delete process.env.UPSTASH_REDIS_REST_URL
  store = new FileStore(dir)
  await store.set('xero:tokens', { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3_600_000, tenantId: 't', tenantName: 'Fonenova Ltd' })
})
afterEach(() => {
  process.env = { ...env }
  vi.unstubAllGlobals()
})

const reply = (routes: Record<string, () => Response>) => vi.fn(async (url: string) => {
  const hit = Object.entries(routes).find(([k]) => url.includes(k))
  return hit ? hit[1]() : new Response('{}', { status: 404 })
})

describe('Xero refresh when part of it fails', () => {
  it('marks credit notes as not read (not as none) when that read is refused', async () => {
    vi.stubGlobal('fetch', reply({
      '/Invoices': () => Response.json({ Invoices: [{ Type: 'ACCREC', InvoiceID: 'i1', InvoiceNumber: '2026050', CurrencyCode: 'EUR', Total: 10 }] }),
      '/CreditNotes': () => new Response('{"Title":"Forbidden"}', { status: 403 }),
      '/Reports/BankSummary': () => new Response('{}', { status: 403 }),
    }))
    const s = await refreshSnapshot(xeroConfig()!)
    expect(s.invoices).toHaveLength(1)
    expect(s.creditNotes).toBeUndefined()
  })

  it('keeps the last good invoices when the invoice read fails', async () => {
    const good = { fetchedAt: '2026-10-26T06:00:00.000Z', tenantName: 'Fonenova Ltd', baseCurrency: 'GBP', invoices: [{ id: 'old' }], creditNotes: [], bankBalances: null, problems: [] } as unknown as XeroSnapshot
    await store.set('xero:snapshot', good)
    vi.stubGlobal('fetch', reply({ '/Invoices': () => new Response('{"Title":"Unauthorized"}', { status: 401 }), '/CreditNotes': () => Response.json({ CreditNotes: [] }), '/Reports': () => new Response('{}', { status: 401 }) }))
    const s = await refreshSnapshot(xeroConfig()!)
    expect(s.invoices).toEqual([{ id: 'old' }])
    expect(s.fetchedAt).toBe(good.fetchedAt)
    expect(s.problems[0]).toContain('the refresh failed')
  })
})
