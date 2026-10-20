/**
 * Domain types for the profit dashboard.
 *
 * Money is always integer euro cents (`*Cents`). Never store or sum floats.
 * Dates are ISO calendar dates, `YYYY-MM-DD`, with no time or timezone.
 *
 * These types describe the data source contract, not the xlsx layout. A future
 * Xero adapter must produce the same shapes.
 */

export type Cents = number
export type IsoDate = string

export type Currency = 'EUR'

export interface Customer {
  id: string
  name: string
}

export interface Supplier {
  id: string
  name: string
}

/** Xero invoice status as recorded in the ledger snapshot. */
export type InvoiceStatus = 'PAID' | 'AUTHORISED' | 'NOT_IN_XERO' | 'UNKNOWN'

export interface DocumentRef {
  /** File name only. Safe to show in the UI. */
  fileName: string | null
  /** Full local path. Server side only, stripped before data reaches the browser. */
  path?: string | null
}

/** One customer invoice paired with one supplier invoice. */
export interface Order {
  id: string
  date: IsoDate
  customerId: string
  customerName: string
  supplierId: string
  supplierName: string
  clientInvoiceNo: string
  supplierInvoiceNo: string
  clientTotalCents: Cents
  supplierTotalCents: Cents
  grossMarginCents: Cents
  goodsMarginCents: Cents
  shippingMarginCents: Cents
  /** Margin as the ledger states it (decimal, 0.0137 = 1.37%). Kept for cross-checking only. */
  ledgerMarginRatio: number | null
  clientStatus: InvoiceStatus
  /** Null when the client invoice is not in Xero, so the balance is unknown. */
  clientOwesCents: Cents | null
  supplierStatus: InvoiceStatus
  weOweSupplierCents: Cents | null
  clientOwesMinusWeOweCents: Cents
  flags: string[]
  clientPdf: DocumentRef
  supplierPdf: DocumentRef
  /** Present when the statuses above come live from Xero rather than the ledger snapshot. */
  live?: LiveOrderFields
}

export interface LiveOrderFields {
  clientDueDate: IsoDate | null
  billDueDate: IsoDate | null
  clientPayments: XeroPayment[]
  billPayments: XeroPayment[]
}

export type LineType = 'goods' | 'shipping'

export interface OrderLine {
  orderId: string
  lineNo: number
  type: LineType
  description: string
  qty: number
  clientUnitCents: Cents
  supplierUnitCents: Cents
  clientAmountCents: Cents
  supplierAmountCents: Cents
  marginCents: Cents
  marginPerUnitCents: Cents
  note: string | null
}

export type CreditSide = 'client' | 'supplier'

export interface CreditNote {
  side: CreditSide
  number: string
  date: IsoDate
  amountCents: Cents
  refersToInvoices: string
  orderIds: string[]
  covers: string
  xeroShows: string
  check: string
}

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface LedgerException {
  id: string
  priority: Priority
  reference: string
  /** Resolved order, from an FN-ORD reference or a matching client invoice number. */
  orderId: string | null
  issue: string
  impactCents: Cents
  suggestedAction: string
}

/** Figures from the ledger's own Summary tab. Used only to reconcile. */
export interface LedgerSummary {
  ordersMatched: number
  clientTotalCents: Cents
  supplierTotalCents: Cents
  grossMarginCents: Cents
  clientCreditsCents: Cents
  supplierCreditsCents: Cents
  marginAfterCreditsCents: Cents
  clientsOweCents: Cents
  weOweSupplierCents: Cents
  ordersWithFlag: number
  byCustomer: {
    customerName: string
    orders: number
    clientTotalCents: Cents
    grossMarginCents: Cents
  }[]
}

/** The Orders tab TOTAL row. Used only to reconcile. */
export interface LedgerTotalRow {
  clientTotalCents: Cents
  supplierTotalCents: Cents
  grossMarginCents: Cents
  goodsMarginCents: Cents
  shippingMarginCents: Cents
  clientOwesCents: Cents
  weOweSupplierCents: Cents
}

export interface LedgerMeta {
  sourceFile: string
  importedAt: string
  /** Date the Xero statuses and balances were taken. Never recalculate overdue days from today. */
  snapshotDate: IsoDate
  currency: Currency
  isSample: boolean
}

export interface Ledger {
  meta: LedgerMeta
  summary: LedgerSummary
  totalRow: LedgerTotalRow
  customers: Customer[]
  suppliers: Supplier[]
  orders: Order[]
  lines: OrderLine[]
  creditNotes: CreditNote[]
  exceptions: LedgerException[]
}

/** EUR to GBP reference rate. 1 EUR = `rate` GBP. */
export interface FxRate {
  base: 'EUR'
  quote: 'GBP'
  rate: number
  /** The ECB publication date the rate belongs to (not when we fetched it). */
  rateDate: IsoDate
  source: string
  fetchedAt: string
}

export type FxResult = { ok: true; fx: FxRate } | { ok: false; reason: string }

/** A recurring monthly cost, entered by the owner. */
export interface Overhead {
  id: string
  name: string
  /** Null until the owner enters it. Never assumed. */
  amountCents: Cents | null
  currency: 'GBP' | 'EUR'
  /** Day of the month it is taken. 29 to 31 fall on the last day in shorter months. */
  dayOfMonth: number
  category: 'business' | 'personal'
  /** First payment date. Null until entered, so no cost is charged to months before it began. */
  startDate: IsoDate | null
  endDate: IsoDate | null
}

// ---------------------------------------------------------------------------
// Xero (read-only). Amounts are in the invoice's own currency, in cents.
// ---------------------------------------------------------------------------

export interface XeroPayment {
  id: string
  date: IsoDate | null
  amountCents: Cents
}

export interface XeroInvoice {
  id: string
  number: string
  reference: string
  kind: 'sale' | 'bill'
  /** Xero status: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED, DELETED. */
  status: string
  contactName: string
  currency: string
  date: IsoDate | null
  dueDate: IsoDate | null
  totalCents: Cents
  amountDueCents: Cents
  amountPaidCents: Cents
  payments: XeroPayment[]
}

export interface XeroBankBalance {
  accountName: string
  /** Closing balance as Xero's Bank Summary reports it, in the organisation's base currency. */
  closingCents: Cents
}

export interface XeroSnapshot {
  fetchedAt: string
  tenantName: string
  baseCurrency: string
  invoices: XeroInvoice[]
  bankBalances: XeroBankBalance[] | null
  /** Parts of the refresh that failed, in plain words (e.g. a missing permission). */
  problems: string[]
}

/** What Xero says right now about one order's two invoices. */
export interface LiveOrderStatus {
  client: XeroInvoice | null
  bill: XeroInvoice | null
}
