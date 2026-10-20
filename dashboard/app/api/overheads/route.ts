import { NextResponse } from 'next/server'
import { overheadsWritable, saveOverheads } from '@/lib/data-source'
import { validateOverheads } from '@/lib/overheads'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!overheadsWritable()) return NextResponse.json({ error: 'Saving overheads is not available on the hosted version yet' }, { status: 501 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Not valid JSON' }, { status: 400 })
  }
  const v = validateOverheads(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  await saveOverheads(v.overheads)
  return NextResponse.json({ ok: true, overheads: v.overheads })
}
