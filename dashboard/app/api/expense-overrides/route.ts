import { NextResponse } from 'next/server'
import { overheadsWritable, saveExpenseOverrides, validateOverrides } from '@/lib/data-source'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!overheadsWritable()) return NextResponse.json({ error: 'Saving is not available on the hosted version yet' }, { status: 501 })
  const body = await req.json().catch(() => null)
  const v = validateOverrides(body)
  if (!v) return NextResponse.json({ error: 'Expected { rowId: "business" | "review" | "personal" }' }, { status: 400 })
  await saveExpenseOverrides(v)
  return NextResponse.json({ ok: true })
}
