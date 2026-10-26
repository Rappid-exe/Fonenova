import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { ask, ASK_MODEL } from '@/lib/ask/run'
import { runTool, TOOLS, type AskData } from '@/lib/ask/tools'
import { localHits } from '@/components/dashboard/ask-bar'
import { liveView } from '@/lib/live-view'
import { FileStore } from '@/lib/store'
import type { Ledger, Order } from '@/lib/types'

const order = (p: Partial<Order> & Pick<Order, 'id'>): Order => ({
  date: '2026-09-30', customerId: 'wave', customerName: 'Wave Phone B.V.', supplierId: 'mo', supplierName: 'Mobile One Trade B.V.',
  clientInvoiceNo: '2026042', supplierInvoiceNo: '2026090091', clientTotalCents: 326_500_00, supplierTotalCents: 321_000_00, grossMarginCents: 5_500_00,
  goodsMarginCents: 5_500_00, shippingMarginCents: 0, ledgerMarginRatio: null, clientStatus: 'AUTHORISED', clientOwesCents: 0, supplierStatus: 'PAID',
  weOweSupplierCents: 0, clientOwesMinusWeOweCents: 0, flags: [], clientPdf: { fileName: null }, supplierPdf: { fileName: null }, ...p,
})
const ledger = (orders: Order[]) => ({ meta: { snapshotDate: '2026-10-04' }, creditNotes: [], exceptions: [], orders, customers: [{ id: 'wave', name: 'Wave Phone B.V.' }, { id: 'gi', name: 'G & I Global Ltd' }], suppliers: [], lines: [] }) as unknown as Ledger
const data = (orders: Order[]): AskData => ({ view: liveView(ledger(orders), null, [], '2026-10-26'), today: '2026-10-26', expenses: null, expenseOverrides: {}, overheads: [] })
const orders = [
  order({ id: 'FN-ORD-034' }),
  order({ id: 'FN-ORD-016', customerId: 'gi', customerName: 'G & I Global Ltd', clientInvoiceNo: '2026019', date: '2026-06-29', clientTotalCents: 55_290_00, grossMarginCents: 940_00, clientOwesCents: 55_290_00, live: { clientDueDate: '2026-06-29', billDueDate: null, clientPayments: [], billPayments: [] } }),
]
const tmpStore = () => new FileStore(fs.mkdtempSync(path.join(os.tmpdir(), 'ask-')))

describe('AI bar tools', () => {
  it('declares strict schemas the API accepts', () => {
    for (const t of TOOLS) {
      const s = t.input_schema as unknown as { additionalProperties: boolean; required: string[]; properties: object }
      expect([t.name, s.additionalProperties, s.required.sort()]).toEqual([t.name, false, Object.keys(s.properties).sort()])
    }
  })
  it('answers who owes money from the same figures as the dashboard', () => {
    expect(runTool('overdue', {}, data(orders))).toEqual({ total: '€55,290.00', invoices: [{ order: 'FN-ORD-016', customer: 'G & I Global Ltd', invoice: '2026019', owed: '€55,290.00', days_late: 119 }] })
    const f = runTool('find_orders', { customer: 'g&i', from: null, to: null, state: 'client_overdue', limit: 5 }, data(orders)) as { matching: number; orders: { id: string; client_days_late: number }[] }
    expect([f.matching, f.orders[0].id, f.orders[0].client_days_late]).toEqual([1, 'FN-ORD-016', 119])
    expect(runTool('period_totals', { from: '2026-09-01', to: '2026-09-30', customer: null }, data(orders))).toMatchObject({ orders: 1, sales: '€326,500.00', gross_profit: '€5,500.00', margin: '1.68%' })
  })
  it('checks a deal with the same maths as the page', () => {
    expect(runTool('deal_check', { lines: [{ units: 10, buy_eur: 100, sell_eur: 160 }], supplier_shipping_eur: 1300, shipping_recharged_eur: 650, margin_vat: false, supplier_due_days: 7, client_due_days: 7 }, data([]))).toMatchObject({ you_keep: '-€50.00', verdict: 'loss' })
  })
})

describe('AI bar question loop', () => {
  /** A stand-in for the Anthropic client that replays scripted replies and records requests. */
  const fake = (replies: object[]) => {
    const calls: Record<string, unknown>[] = []
    return { calls, client: { messages: { create: async (req: Record<string, unknown>) => (calls.push(structuredClone(req)), replies.shift()) } } as unknown as Anthropic }
  }

  it('runs the tool the model asks for, then returns its answer', async () => {
    const { calls, client } = fake([
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'overdue', input: {} }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'G & I Global Ltd owes €55,290.00 on FN-ORD-016, 119 days late.' }] },
    ])
    const r = await ask('Who owes me most?', data(orders), { store: tmpStore(), client })
    expect(r).toMatchObject({ ok: true, answer: 'G & I Global Ltd owes €55,290.00 on FN-ORD-016, 119 days late.', tools: ['overdue'], usedToday: 1 })
    expect(calls[0]).toMatchObject({ model: ASK_MODEL, output_config: { effort: 'low' } })
    const second = calls[1].messages as { role: string; content: { type: string; content?: string }[] }[]
    expect(second[2].content[0].content).toContain('€55,290.00')
  })

  it('stops at the daily limit without calling the AI', async () => {
    process.env.AI_DAILY_LIMIT = '1'
    const store = tmpStore()
    const { calls, client } = fake([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] }])
    await ask('one', data([]), { store, client })
    const r = await ask('two', data([]), { store, client })
    delete process.env.AI_DAILY_LIMIT
    expect([r.ok, calls.length]).toEqual([false, 1])
    expect(r.answer).toContain('limit of 1')
  })

  it('says plainly when the model declines', async () => {
    const { client } = fake([{ stop_reason: 'refusal', content: [] }])
    expect((await ask('x', data([]), { store: tmpStore(), client })).answer).toContain('declined')
  })
})

describe('instant search', () => {
  it('finds an order by short number, invoice or bill, a customer, and a page', () => {
    const custs = [{ id: 'gi', name: 'G & I Global Ltd' }]
    expect(localHits('34', orders, custs).map((h) => h.label)).toEqual(['FN-ORD-034'])
    expect(localHits('2026019', orders, custs).map((h) => h.label)).toEqual(['FN-ORD-016'])
    expect(localHits('g & i', orders, custs).map((h) => h.kind)).toEqual(['customer'])
    expect(localHits('overdue', orders, custs).map((h) => h.label)).toEqual(['Exceptions'])
  })
})
