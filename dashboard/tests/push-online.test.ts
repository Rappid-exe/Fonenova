import { describe, expect, it } from 'vitest'
import { pushOnline } from '@/lib/push-online'
import type { ReadResult, Store, StoreKey } from '@/lib/store'

function mem(init: Partial<Record<StoreKey, unknown>> = {}): Store & { data: Map<StoreKey, unknown> } {
  const data = new Map(Object.entries(init) as [StoreKey, unknown][])
  return {
    name: 'mem',
    data,
    get: async (k): Promise<ReadResult> => (data.has(k) ? { kind: 'ok', value: data.get(k) } : { kind: 'missing' }),
    set: async (k, v) => void data.set(k, v),
    del: async (k) => void data.delete(k),
    withLock: async (_n, fn) => fn(),
  }
}

describe('pushOnline', () => {
  it('copies imports and new decisions, never tokens', async () => {
    const pc = mem({ ledger: { orders: [1] }, 'xero:pairs': [{ orderId: 'FN-ORD-035' }], 'xero:tokens': { refresh: 'x' } })
    const web = mem({ ledger: { orders: ['sample'] } })
    const r = await pushOnline(pc, web)
    expect(web.data.get('ledger')).toEqual({ orders: [1] })
    expect(web.data.get('xero:pairs')).toEqual([{ orderId: 'FN-ORD-035' }])
    expect(web.data.has('xero:tokens')).toBe(false)
    expect(r.find((x) => x.key === 'expenses')?.result).toBe('not on this PC')
  })

  it('keeps a decision already made online unless forced', async () => {
    const pc = mem({ overheads: [{ id: 'a' }] })
    const web = mem({ overheads: [{ id: 'b' }] })
    expect((await pushOnline(pc, web)).find((x) => x.key === 'overheads')?.result).toBe('kept online copy')
    expect(web.data.get('overheads')).toEqual([{ id: 'b' }])
    await pushOnline(pc, web, { force: true })
    expect(web.data.get('overheads')).toEqual([{ id: 'a' }])
  })

  it('reports identical copies as the same', async () => {
    const r = await pushOnline(mem({ settings: { marginSchemeVat: false } }), mem({ settings: { marginSchemeVat: false } }))
    expect(r.find((x) => x.key === 'settings')?.result).toBe('same')
  })
})
