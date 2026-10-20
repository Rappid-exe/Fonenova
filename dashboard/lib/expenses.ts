/**
 * Sort each expense-log row into business, needs review, or personal. Plain keyword rules,
 * so every decision comes with a reason the owner can check and override.
 *
 * Rows for costs the overhead schedule already charges (office rent, housing rent, car
 * finance) are linked to that overhead and never counted a second time.
 */
import type { Expense, ExpenseClass } from './types'

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
  { test: /toyota financial|vehicle finance/i, cls: 'review', category: 'Car finance', reason: 'Car finance: confirm the car is a company vehicle. Charged by the Car payment overhead', overheadId: 'car-payment' },

  // Clear business costs
  { test: /\bdhl\b/i, cls: 'business', category: 'Shipping', reason: 'Shipping goods to customers' },
  { test: /revolut.*(fx|conversion)|fx conversion/i, cls: 'business', category: 'Bank and FX fees', reason: 'Fee for converting business EUR to GBP' },
  { test: /wahidullah ismati.*wage|wage.*xero payroll/i, cls: 'business', category: 'Wages', reason: 'Director salary through Xero payroll' },
  { test: /anthropic|claude subscription|claude pro|\bxero\b(?! payroll)/i, cls: 'business', category: 'Software', reason: 'Business software subscription' },

  // Business purpose not recorded: needs a yes from the owner
  { test: /wages?-paid|hamza.*wage|wage.*hamza/i, cls: 'review', category: 'Wages', reason: 'Wages to a family member: confirm genuine work, rate and payroll' },
  { test: /tesla|supercharger|ev charging|car wash/i, cls: 'review', category: 'Car running', reason: 'Charging or car care: confirm it is the company vehicle' },
  { test: /easyjet|ryanair|flight|stansted|greater anglia|translink|airport|justpark|parking|beryl|hopp|lime|fonacab|taxi|coach|bus fare|train/i, cls: 'review', category: 'Travel and parking', reason: 'Travel: no business purpose recorded' },
  { test: /charity|bmca/i, cls: 'review', category: 'Donations', reason: 'Company donation: deductible only if to a registered charity, no VAT' },

  // Personal
  { test: /dental|invisalign|pharmacy|urgent care|\beuc\b/i, cls: 'personal', category: 'Medical', reason: 'Medical or dental care' },
  { test: /elect|gas ?top|energy|meter top/i, cls: 'personal', category: 'Home energy', reason: 'Home energy top-up' },
  { test: /tesco|lidl|sainsbury|asda|spar|istanbul market|grocer|greggs|boots|meal|dinner|takeaway|food|snack|sushi|uber eats|happy yemen|fallone|erbil|deerah|chick|mr chicken|flipdish|coca|sandals|bath sheets|dehumidifier|household|toothbrush|lebara|chair hire|club24/i, cls: 'personal', category: 'Food, groceries, household', reason: 'Day-to-day personal spending' },
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
