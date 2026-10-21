import { NextResponse } from 'next/server'
import { overheadsWritable, saveExpenseOverrides, validateOverrides } from '@/lib/data-source'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!overheadsWritable()) return NextResponse.json({ error: 'Saving needs online storage: connect Upstash Redis and set FN_STORE_KEY in the Vercel project' }, { status: 501 })
  const body = await req.json().catch(() => null)
  const v = validateOverrides(body)
  if (!v) return NextResponse.json({ error: 'Expected { rowId: "business" | "review" | "personal" }' }, { status: 400 })
  try {
    await saveExpenseOverrides(v)
  } catch (e) {
    return NextResponse.json({ error: `Could not save (${e instanceof Error ? e.message.slice(0, 160) : 'unknown'})` }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
