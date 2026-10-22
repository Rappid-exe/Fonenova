import { NextResponse } from 'next/server'
import { getDataSource, loadXeroPairs, overheadsWritable, saveXeroPairs } from '@/lib/data-source'
import { currentUser } from '@/lib/session'
import { getStore } from '@/lib/store'
import { loadSnapshot } from '@/lib/xero/client'
import { matchInvoices, nextOrderId } from '@/lib/xero/pairing'

export const dynamic = 'force-dynamic'

/**
 * Confirm a Xero invoice and bill as one order, or undo it. Both documents are checked against
 * the latest Xero snapshot and must still be free, so a pair can never be made twice.
 */
export async function PUT(req: Request) {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!overheadsWritable()) return NextResponse.json({ error: 'Saving needs online storage: connect Upstash Redis and set FN_STORE_KEY in the Vercel project' }, { status: 501 })
  const body = (await req.json().catch(() => null)) as { action?: string; invoiceId?: string; billId?: string; orderId?: string } | null
  if (!body || (body.action !== 'confirm' && body.action !== 'unpair')) return NextResponse.json({ error: 'Expected { action: "confirm", invoiceId, billId } or { action: "unpair", orderId }' }, { status: 400 })

  try {
    return await getStore().withLock('xero:pairs', async () => {
      const pairs = await loadXeroPairs()
      if (body.action === 'unpair') {
        const next = pairs.filter((p) => p.orderId !== body.orderId)
        if (next.length === pairs.length) return NextResponse.json({ error: 'That order was not made on the Matching page' }, { status: 404 })
        await saveXeroPairs(next)
        return NextResponse.json({ ok: true })
      }

      const [snapshot, loaded] = await Promise.all([loadSnapshot(), getDataSource().load()])
      if (!snapshot) return NextResponse.json({ error: 'No Xero data yet: connect and refresh Xero first' }, { status: 409 })
      const ledgerOrders = loaded.ok ? loaded.ledger.orders : []
      const m = matchInvoices({ invoices: snapshot.invoices, ledgerOrders, pairs })
      const invoiceFree = m.suggestions.some((s) => s.invoice.id === body.invoiceId)
      const billFree = m.freeBills.some((b) => b.id === body.billId)
      if (!invoiceFree || !billFree) return NextResponse.json({ error: 'One of these is already part of an order, or no longer in Xero. Refresh and try again.' }, { status: 409 })

      const orderId = nextOrderId([...ledgerOrders.map((o) => o.id), ...pairs.map((p) => p.orderId), ...m.auto.map((p) => p.orderId)])
      await saveXeroPairs([...pairs, { orderId, invoiceId: body.invoiceId!, billId: body.billId!, confirmedAt: new Date().toISOString() }])
      return NextResponse.json({ ok: true, orderId })
    })
  } catch (e) {
    return NextResponse.json({ error: `Could not save (${e instanceof Error ? e.message.slice(0, 160) : 'unknown'})` }, { status: 502 })
  }
}
