/**
 * "All time" figures must match the ledger to the cent. Runs against the real import when it
 * exists on this machine (data/ is git-ignored), and always against the fake sample.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cashPosition, creditTotals, profitAfterCredits, reconcileLedger, totals, unitsByOrder } from '@/lib/metrics'
import type { Ledger } from '@/lib/types'

const REAL = path.join(__dirname, '..', 'data', 'generated', 'ledger.json')
const SAMPLE = path.join(__dirname, '..', 'data', 'sample', 'ledger.json')
const load = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8')) as Ledger
const hasReal = fs.existsSync(REAL) && !load(REAL).meta.isSample

describe.skipIf(!hasReal)('real ledger reconciles to the cent', () => {
  const ledger = hasReal ? load(REAL) : (null as unknown as Ledger)

  it('matches the figures verified on 18 Oct 2026', () => {
    const t = totals(ledger.orders, unitsByOrder(ledger.lines))
    const c = creditTotals(ledger.creditNotes, ledger.orders, {})
    const cash = cashPosition(ledger.orders)
    expect(t.orderCount).toBe(34)
    expect(t.salesCents).toBe(311921969)
    expect(t.costCents).toBe(307661333)
    expect(t.grossProfitCents).toBe(4260636)
    expect(t.goodsMarginCents).toBe(3832500)
    expect(t.shippingMarginCents).toBe(428136)
    expect(c.clientCreditsCents).toBe(10449411)
    expect(c.supplierCreditsCents).toBe(10236268)
    expect(profitAfterCredits(t.grossProfitCents, c)).toBe(4047493)
    expect(cash.clientsOweCents).toBe(48283090)
    expect(cash.weOweSupplierCents).toBe(42542608)
    expect(t.units).toBe(6759)
  })

  it('passes every check against the Summary tab, TOTAL row and Lines', () => {
    const failed = reconcileLedger(ledger).filter((c) => !c.ok)
    expect(failed.map((c) => `${c.label}: ${c.detail}`)).toEqual([])
  })

  it('imports the expected row counts and excludes the TOTAL row', () => {
    expect(ledger.orders.some((o) => o.id === 'TOTAL')).toBe(false)
    expect(ledger.lines.length).toBe(132)
    expect(ledger.lines.filter((l) => l.type === 'goods').length).toBe(98)
    expect(ledger.creditNotes.length).toBe(8)
    expect(ledger.exceptions.length).toBe(11)
    expect(ledger.meta.snapshotDate).toBe('2026-10-04')
  })
})

describe('sample ledger is internally consistent', () => {
  it('passes every reconciliation check', () => {
    const failed = reconcileLedger(load(SAMPLE)).filter((c) => !c.ok)
    expect(failed).toEqual([])
    expect(load(SAMPLE).meta.isSample).toBe(true)
  })
})
