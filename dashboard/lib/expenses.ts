/**
 * Sort each expense-log row into business, needs review, or personal. Plain keyword rules,
 * so every decision comes with a reason the owner can check and override.
 *
 * Rows for costs the overhead schedule already charges (office rent, housing rent, car
 * finance) are linked to that overhead and never counted a second time.
 */
import type { Expense, ExpenseClass, ExpenseLog, FxConversion } from './types'

export interface Classified {
  cls: ExpenseClass
  category: string
  reason: string
  /** Set when an overhead already charges this cost. */
  overheadId: string | null
}

type Rule = { test: RegExp; cls: ExpenseClass; category: string; reason: string; overheadId?: string }

const RULES: Rule[] = [
  // Already charged by the overhead schedule
  { test: /\b(hq|iwg)\b.*office|office rent/i, cls: 'business', category: 'Office rent', reason: 'Office at Weavers Court; charged by the Office rent overhead', overheadId: 'office-rent' },
  { test: /property people|rent\b.*cliftonpark/i, cls: 'personal', category: 'Housing rent', reason: 'Home rent invoiced to you personally; charged by the Housing rent overhead', overheadId: 'housing-rent' },
  { test: /toyota financ|vehicle finance|car finance/i, cls: 'review', category: 'Car finance', reason: 'Car finance: confirm the car is a company vehicle. Charged by the Car payment overhead', overheadId: 'car-payment' },

  // Money moving, not a cost: never reduces profit unless you say so
  { test: /loan paid|loan repay/i, cls: 'review', category: 'Loan repayment', reason: 'Repaying a loan moves money, it is not a cost (only interest is). Mark personal to leave it out' },
  { test: /exp-repaym|expenses? repayment|paid back/i, cls: 'review', category: 'Expense repayment', reason: 'Paying back someone for expenses: a cost only if those expenses are not already logged here' },
  { test: /mobile one|wavephone|phone-zone/i, cls: 'review', category: 'Stock supplier', reason: 'Stock supplier: stock costs come from the order ledger, so counting this too would double count' },

  // Clear business costs
  { test: /\bdhl\b/i, cls: 'business', category: 'Shipping', reason: 'Shipping goods to customers' },
  { test: /revolut.*(fx|conversion)|fx conversion/i, cls: 'business', category: 'Bank and FX fees', reason: 'Fee for converting business EUR to GBP' },
  { test: /wahidullah ismati.*wage|wage.*xero payroll/i, cls: 'business', category: 'Wages', reason: 'Director salary through Xero payroll' },
  { test: /wages?-paid\s+wahidullah/i, cls: 'business', category: 'Wages', reason: 'Director salary' },
  { test: /anthropic|claude subscription|claude pro|\bxero\b(?! payroll)|invoice2go|icon office/i, cls: 'business', category: 'Software', reason: 'Business software subscription' },
  { test: /accountant|abn invest/i, cls: 'business', category: 'Accountancy', reason: 'Accountant fees' },
  { test: /simply business|b\.?insurance|business insurance/i, cls: 'business', category: 'Insurance', reason: 'Business insurance' },
  { test: /revolut b(usiness)? fee|basic plan fee|business fee|expenses app fee|exp app charge/i, cls: 'business', category: 'Bank and FX fees', reason: 'Business bank account fee' },
  { test: /post ?office|postal|postage|royal mail/i, cls: 'business', category: 'Postage', reason: 'Postage' },
  { test: /printer|toner|stationer|office stamp|desk ?top|currys/i, cls: 'business', category: 'Office equipment', reason: 'Office equipment and supplies' },

  // Business purpose not recorded: needs a yes from the owner
  { test: /wages?-paid|hamza.*wage|wage.*hamza/i, cls: 'review', category: 'Wages', reason: 'Wages to a family member: confirm genuine work, rate and payroll' },
  { test: /advance pay|salary/i, cls: 'review', category: 'Wages', reason: 'Salary paid by bank transfer: confirm it went through payroll' },
  { test: /rent 4 room|room-rent|rent\+depo/i, cls: 'review', category: 'Accommodation', reason: 'Room or flat rent: business only if it is staff or work accommodation' },
  { test: /\bee mobile|mob-bill/i, cls: 'review', category: 'Phone', reason: 'Phone bill: business if the contract is in the company name' },
  { test: /tesla|supercharger|ev charging|ev-power|car wash|washing car|gridserve|maxol|weev|zest eco|planmyservice|car service|m6 toll|\btoll\b/i, cls: 'review', category: 'Car running', reason: 'Charging or car care: confirm it is the company vehicle' },
  { test: /easyjet|ryanair|flight|stansted|greater anglia|translink|airport|justpark|parking|beryl|\bhopp\b|\blime\b|fonacab|taxi|\bcab\b|coach|bus fare|train|booking\.com|hotel|stena|ferry|opodo|kiwi\.com|national express|flixbus|go to gate|eta-fee|eta\/service|transport/i, cls: 'review', category: 'Travel and parking', reason: 'Travel: no business purpose recorded' },
  { test: /charity|bmca/i, cls: 'review', category: 'Donations', reason: 'Company donation: deductible only if to a registered charity, no VAT' },

  // Personal
  { test: /dental|invisalign|pharmacy|urgent care|\beuc\b/i, cls: 'personal', category: 'Medical', reason: 'Medical or dental care' },
  { test: /elect|gas ?top|energy|meter top/i, cls: 'personal', category: 'Home energy', reason: 'Home energy top-up' },
  { test: /b\\?&m|argos|ikea|home bargains|savers|furniture|\bbed\b|essentials/i, cls: 'review', category: 'Supplies', reason: 'Household or office supplies: no business purpose recorded' },
  { test: /tesco|lidl|sainsbury|asda|spar|istanbul market|grocer|greggs|boots|meal|dinner|takeaway|food|snack|sushi|uber eats|happy yemen|fallone|erbil|deerah|chick|mr chicken|flipdish|coca|sandals?\b|bath sheets|dehumidifier|household|toothbrush|lebara|chair hire|club24|fitness|wal-mart|walmart|roshan|fruit|\bmace\b|duunes|iceland|centra|vending|co-op|pizza|restaurant|\bbfc\b|pepe|bagel|wh smith|drink|refreshment|nuts/i, cls: 'personal', category: 'Food, groceries, household', reason: 'Day-to-day personal spending' },
]

export function classifyExpense(e: Pick<Expense, 'payee' | 'description'>): Classified {
  const text = `${e.payee} ${e.description}`
  for (const r of RULES) {
    if (r.test.test(text)) return { cls: r.cls, category: r.category, reason: r.reason, overheadId: r.overheadId ?? null }
  }
  return { cls: 'review', category: 'Other', reason: 'No rule matched: please classify', overheadId: null }
}

export const CLASS_LABEL: Record<ExpenseClass, string> = {
  business: 'Business',
  review: 'Needs review',
  personal: 'Personal',
}

/**
 * Join the May to Aug tracker with the current one. The current tracker wins from its first
 * date on, so a row both files hold (e.g. 1 Sept) is counted once. FX conversions are joined
 * the same way, without duplicates.
 */
export function mergeExpenseLogs(current: ExpenseLog | null, archive: ExpenseLog | null): ExpenseLog | null {
  if (!archive) return current
  if (!current) return archive
  const span = (l: ExpenseLog) => {
    const d = l.expenses.map((e) => e.date).sort()
    return { sourceFile: l.meta.sourceFile, rows: l.expenses.length, from: d[0] ?? null, to: d.at(-1) ?? null }
  }
  const cutOver = span(current).from
  const ids = new Set(current.expenses.map((e) => e.id))
  const keep = archive.expenses.filter((e) => (!cutOver || e.date < cutOver) && !ids.has(e.id))
  const fxKey = (f: FxConversion) => `${f.date}|${f.eurCents}|${f.gbpCents}`
  const fxSeen = new Set(current.fxConversions.map(fxKey))
  return {
    meta: {
      ...current.meta,
      parts: [span(archive), span(current)],
      overlapDropped: archive.expenses.length - keep.length,
    },
    expenses: [...keep, ...current.expenses],
    fxConversions: [...archive.fxConversions.filter((f) => !fxSeen.has(fxKey(f))), ...current.fxConversions].sort((a, b) => a.date.localeCompare(b.date)),
  }
}
