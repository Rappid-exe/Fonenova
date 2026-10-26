import { NextResponse } from 'next/server'
import { ask } from '@/lib/ask/run'
import { loadAskData } from '@/lib/ask/data'
import { currentUser } from '@/lib/session'
import { getStore, storeWritable } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** The AI bar. Signed-in only; read-only tools; capped per day (lib/ask/run.ts). */
export async function POST(req: Request) {
  if ((await currentUser()) === false) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, answer: 'The AI bar is not set up: add ANTHROPIC_API_KEY in Vercel and redeploy.' }, { status: 503 })
  if (!storeWritable()) return NextResponse.json({ ok: false, answer: 'The AI bar needs online storage to keep its daily limit.' }, { status: 503 })
  const body = (await req.json().catch(() => null)) as { question?: unknown } | null
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  if (!question || question.length > 500) return NextResponse.json({ ok: false, answer: 'Ask a question of up to 500 characters.' }, { status: 400 })
  const data = await loadAskData()
  if ('error' in data) return NextResponse.json({ ok: false, answer: `The data could not be loaded: ${data.error}` }, { status: 503 })
  const answer = await ask(question, data, { store: getStore() })
  return NextResponse.json(answer, { headers: { 'Cache-Control': 'no-store' } })
}
