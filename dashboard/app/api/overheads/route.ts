import { NextResponse } from 'next/server'
import { overheadsWritable, saveOverheads } from '@/lib/data-source'
import { validateOverheads } from '@/lib/overheads'
import { currentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request) {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!overheadsWritable()) return NextResponse.json({ error: 'Saving overheads needs online storage: connect Upstash Redis and set FN_STORE_KEY in the Vercel project' }, { status: 501 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Not valid JSON' }, { status: 400 })
  }
  const v = validateOverheads(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    await saveOverheads(v.overheads)
  } catch (e) {
    return NextResponse.json({ error: `Could not save (${e instanceof Error ? e.message.slice(0, 160) : 'unknown'})` }, { status: 502 })
  }
  return NextResponse.json({ ok: true, overheads: v.overheads })
}
