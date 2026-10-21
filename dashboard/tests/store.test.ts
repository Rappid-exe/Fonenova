import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileStore, RedisStore, getJson, seal, storeKey, unseal } from '@/lib/store'

const KEY = 'a-test-store-key-that-is-long-enough-123'

describe('encryption for online storage', () => {
  const k = storeKey(KEY)
  it('round-trips a value and never stores it in plain text', () => {
    const v = { orders: [{ id: 'FN-ORD-1', clientTotalCents: 123456 }] }
    const sealed = seal(k, 'ledger', v)
    expect(sealed).not.toContain('FN-ORD-1')
    expect(unseal(k, 'ledger', sealed)).toEqual(v)
  })
  it('rejects a tampered value, a value moved to another key, and the wrong key', () => {
    const sealed = seal(k, 'ledger', { n: 1 })
    const raw = Buffer.from(sealed.slice(3), 'base64')
    raw[raw.length - 1] ^= 1
    expect(() => unseal(k, 'ledger', `v1.${raw.toString('base64')}`)).toThrow()
    expect(() => unseal(k, 'overheads', sealed)).toThrow()
    expect(() => unseal(storeKey(KEY + 'x'), 'ledger', sealed)).toThrow()
  })
  it('refuses a short key', () => {
    expect(() => storeKey('short')).toThrow(/32 characters/)
  })
})

describe('FileStore', () => {
  let dir: string
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fn-store-')) })
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })

  it('keeps the existing data/ file names, so data already imported keeps working', async () => {
    await fs.mkdir(path.join(dir, 'generated'))
    await fs.writeFile(path.join(dir, 'generated', 'ledger.json'), '{"meta":{"importedAt":"x"}}')
    const s = new FileStore(dir)
    expect(await getJson(s, 'ledger')).toEqual({ meta: { importedAt: 'x' } })
    await s.set('xero:tokens', { a: 1 })
    expect(JSON.parse(await fs.readFile(path.join(dir, 'xero', 'tokens.json'), 'utf8'))).toEqual({ a: 1 })
    expect((await fs.stat(path.join(dir, 'xero', 'tokens.json'))).mode & 0o777).toBe(0o600)
    await s.del('xero:tokens')
    expect((await s.get('xero:tokens')).kind).toBe('missing')
  })
  it('reports a broken file instead of throwing', async () => {
    await fs.writeFile(path.join(dir, 'overheads.json'), '{nope')
    expect((await new FileStore(dir).get('overheads')).kind).toBe('invalid')
  })
  it('runs locked work one at a time', async () => {
    const s = new FileStore(dir)
    const order: string[] = []
    const job = (n: string) => s.withLock('t', async () => { order.push(`${n}+`); await new Promise((r) => setTimeout(r, 10)); order.push(`${n}-`) })
    await Promise.all([job('a'), job('b')])
    expect(order).toEqual(['a+', 'a-', 'b+', 'b-'])
  })
})

/** A tiny in-memory stand-in for Upstash's REST API. */
function fakeUpstash() {
  const data = new Map<string, string>()
  const calls: unknown[][] = []
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    if ((init.headers as Record<string, string>).authorization !== 'Bearer tok') return new Response('{"error":"WRONGPASS"}', { status: 401 })
    const args = JSON.parse(String(init.body)) as (string | number)[]
    calls.push(args)
    const [cmd, key] = args as string[]
    let result: unknown = null
    if (cmd === 'GET') result = data.get(key) ?? null
    else if (cmd === 'SET') {
      if (args.includes('NX') && data.has(key)) result = null
      else { data.set(key, String(args[2])); result = 'OK' }
    } else if (cmd === 'DEL') result = data.delete(key) ? 1 : 0
    else if (cmd === 'EVAL') {
      const [, , , k, id] = args as string[]
      result = data.get(k) === id ? (data.delete(k), 1) : 0
    }
    return Response.json({ result })
  }) as unknown as typeof fetch
  return { data, calls, fetchImpl }
}

describe('RedisStore (Upstash REST)', () => {
  it('stores only ciphertext, reads it back, and deletes', async () => {
    const up = fakeUpstash()
    const s = new RedisStore('https://example.upstash.io/', 'tok', KEY, up.fetchImpl)
    await s.set('overheads', [{ id: 'office-rent', amountCents: 150000 }])
    expect([...up.data.keys()]).toEqual(['fn:overheads'])
    expect(up.data.get('fn:overheads')).not.toContain('office-rent')
    expect(await getJson(s, 'overheads')).toEqual([{ id: 'office-rent', amountCents: 150000 }])
    await s.del('overheads')
    expect((await s.get('overheads')).kind).toBe('missing')
  })
  it('says so when a value was written with another key', async () => {
    const up = fakeUpstash()
    await new RedisStore('https://x', 'tok', KEY, up.fetchImpl).set('ledger', { n: 1 })
    const r = await new RedisStore('https://x', 'tok', KEY + '-changed', up.fetchImpl).get('ledger')
    expect(r).toMatchObject({ kind: 'invalid', message: expect.stringMatching(/FN_STORE_KEY/) })
  })
  it('surfaces a refused request as an error', async () => {
    const up = fakeUpstash()
    await expect(new RedisStore('https://x', 'bad', KEY, up.fetchImpl).get('ledger')).rejects.toThrow(/401/)
  })
  it('holds the lock while working and releases only its own lock', async () => {
    const up = fakeUpstash()
    const s = new RedisStore('https://x', 'tok', KEY, up.fetchImpl)
    const order: string[] = []
    const job = (n: string) => s.withLock('t', async () => { order.push(`${n}+`); await new Promise((r) => setTimeout(r, 30)); order.push(`${n}-`) })
    await Promise.all([job('a'), job('b')])
    expect(order.slice(0, 2)).toEqual([order[0], order[0].replace('+', '-')])
    expect(up.data.has('fn:lock:t')).toBe(false)
  })
})
