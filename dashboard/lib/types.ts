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
