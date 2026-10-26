import { getDataSource, loadExpenses, loadOverheads, loadXeroState } from '../data-source'
import { liveView } from '../live-view'
import { todayIso } from '../periods'
import { getStore } from '../store'
import { dailyLimit, usageToday } from './run'
import type { AskData } from './tools'

/** The same data the page loads, for the AI bar's tools. */
export async function loadAskData(): Promise<AskData | { error: string }> {
  const [result, xero, exp, oh] = await Promise.all([getDataSource().load(), loadXeroState(), loadExpenses(), loadOverheads()])
  if (!result.ok) return { error: `${result.title}: ${result.detail}` }
  const today = todayIso()
  return { view: liveView(result.ledger, xero.snapshot, xero.pairs, today), today, expenses: exp.log, expenseOverrides: exp.overrides, overheads: oh.overheads }
}

export interface AskState {
  configured: boolean
  usedToday: number
  limit: number
}

export async function loadAskState(): Promise<AskState> {
  const configured = !!process.env.ANTHROPIC_API_KEY
  const limit = dailyLimit()
  if (!configured) return { configured, usedToday: 0, limit }
  try {
    return { configured, usedToday: await usageToday(getStore(), todayIso()), limit }
  } catch {
    return { configured, usedToday: 0, limit }
  }
}
