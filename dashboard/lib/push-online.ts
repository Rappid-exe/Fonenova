/**
 * Copies what the local dashboard holds into the online store, so the hosted dashboard shows the
 * real ledger, expenses and your saved decisions without OneDrive being connected online.
 *
 * Imports (ledger, expenses) are always replaced. Your decisions (overheads, row overrides,
 * confirmed Xero pairs, settings) are only written when the online copy is empty or identical,
 * so a decision made on the website is never silently overwritten; `force` overrides that.
 * Tokens are never copied: each place has its own Xero and OneDrive sign-in, and their refresh
 * tokens are single-use, so a copy would break one of the two.
 */
import type { Store, StoreKey } from './store'

export const IMPORTS: StoreKey[] = ['ledger', 'expenses', 'expenses-archive']
export const DECISIONS: StoreKey[] = ['overheads', 'expense-overrides', 'xero:pairs', 'settings']

export type PushOutcome = { key: StoreKey; result: 'copied' | 'same' | 'not on this PC' | 'kept online copy' }

export async function pushOnline(from: Store, to: Store, opts: { force?: boolean } = {}): Promise<PushOutcome[]> {
  const out: PushOutcome[] = []
  for (const key of [...IMPORTS, ...DECISIONS]) {
    const local = await from.get(key)
    if (local.kind === 'invalid') throw new Error(`Local ${key} is unreadable: ${local.message}`)
    if (local.kind === 'missing') {
      out.push({ key, result: 'not on this PC' })
      continue
    }
    const online = await to.get(key)
    const same = online.kind === 'ok' && JSON.stringify(online.value) === JSON.stringify(local.value)
    if (same) {
      out.push({ key, result: 'same' })
      continue
    }
    if (DECISIONS.includes(key) && online.kind === 'ok' && !opts.force) {
      out.push({ key, result: 'kept online copy' })
      continue
    }
    await to.set(key, local.value)
    out.push({ key, result: 'copied' })
  }
  return out
}
