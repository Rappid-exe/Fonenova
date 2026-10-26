/**
 * The deal checker: what an order would earn before you commit to it. Pure, so the page and the
 * AI bar give the same answer.
 *
 * Margin = what the client pays (goods + shipping recharged) minus what Mobile One charges
 * (goods + their shipping). Then, when switched on, margin-scheme VAT (1/6 of a positive margin)
 * and an optional FX cushion. The verdict uses the dashboard's own bands: a loss below 0, thin
 * under 0.5%.
 */
import { marginBand, type MarginBand } from './metrics'
import type { Cents } from './types'

export interface DealLine {
  description?: string
  units: number
  /** Per unit, EUR cents. */
  buyCents: Cents
  sellCents: Cents
}

export interface DealInput {
  lines: DealLine[]
  supplierShippingCents: Cents
  shippingRechargedCents: Cents
  /** Deduct margin-scheme VAT (follows the Settings switch). */
  marginVat: boolean
  /** Percent of the sale held back for exchange-rate movement, e.g. 0.5. Zero when you hold EUR. */
  fxCushionPct: number
  supplierDueDays: number
  clientDueDays: number
}

export interface DealResult {
  salesCents: Cents
  costCents: Cents
  grossCents: Cents
  goodsMarginCents: Cents
  shippingMarginCents: Cents
  marginVatCents: Cents
  fxCushionCents: Cents
  netCents: Cents
  /** Net as a share of the sale. */
  netRatio: number | null
  verdict: MarginBand
  warnings: string[]
  /** Days you carry the supplier's bill before the client pays (0 when the client pays first). */
  fundedDays: number
  fundedCents: Cents
}

const eur = (c: Cents) => `€${(c / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function checkDeal(d: DealInput): DealResult {
  const lines = d.lines.filter((l) => l.units > 0)
  const goodsSale = lines.reduce((n, l) => n + Math.round(l.units * l.sellCents), 0)
  const goodsCost = lines.reduce((n, l) => n + Math.round(l.units * l.buyCents), 0)
  const salesCents = goodsSale + d.shippingRechargedCents
  const costCents = goodsCost + d.supplierShippingCents
  const grossCents = salesCents - costCents
  const shippingMarginCents = d.shippingRechargedCents - d.supplierShippingCents
  const marginVatCents = d.marginVat && grossCents > 0 ? Math.round(grossCents / 6) : 0
  const fxCushionCents = Math.max(0, Math.round((salesCents * d.fxCushionPct) / 100))
  const netCents = grossCents - marginVatCents - fxCushionCents
  const netRatio = salesCents ? netCents / salesCents : null

  const warnings: string[] = []
  if (shippingMarginCents < 0) warnings.push(`Shipping is recharged at ${eur(d.shippingRechargedCents)} but costs ${eur(d.supplierShippingCents)}: ${eur(-shippingMarginCents)} lost on shipping. FN-ORD-017 lost money this way.`)
  lines.forEach((l, i) => {
    if (l.sellCents < l.buyCents) warnings.push(`Line ${i + 1}${l.description ? ` (${l.description})` : ''} sells at ${eur(l.sellCents)} a unit, below its ${eur(l.buyCents)} cost.`)
  })
  const fundedDays = Math.max(0, d.clientDueDays - d.supplierDueDays)
  if (fundedDays > 0) warnings.push(`You pay Mobile One ${fundedDays} day${fundedDays > 1 ? 's' : ''} before the client is due to pay: ${eur(costCents)} of your own cash is tied up.`)

  return {
    salesCents,
    costCents,
    grossCents,
    goodsMarginCents: goodsSale - goodsCost,
    shippingMarginCents,
    marginVatCents,
    fxCushionCents,
    netCents,
    netRatio,
    verdict: salesCents ? marginBand(netRatio) : 'none',
    warnings,
    fundedDays,
    fundedCents: fundedDays > 0 ? costCents : 0,
  }
}

/** "1,234.50", "€419" or "419,5" (decimal comma) to cents; null when it is not a number. */
export function parseEuro(s: string): Cents | null {
  let t = s.trim().replace(/[€\s]/g, '')
  if (!t) return null
  if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.') // 419,5 is a decimal comma
  t = t.replace(/,/g, '')
  if (!/^-?\d*\.?\d*$/.test(t) || t === '.' || t === '-') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}
