/**
 * Answers one question from the AI bar with Claude Haiku 5.5 and the read-only tools in
 * ./tools.ts. Costs are capped three ways: a daily question limit kept in the store, at most
 * four tool rounds per question, and short answers. The Anthropic key should sit in its own
 * workspace with a monthly spend limit set in the Anthropic console.
 */
import Anthropic from '@anthropic-ai/sdk'
import { getJson, type Store } from '../store'
import { runTool, TOOLS, type AskData } from './tools'

export const ASK_MODEL = 'claude-haiku-5-5'
const MAX_ROUNDS = 4
export const DEFAULT_DAILY_LIMIT = 50

export interface AskAnswer {
  ok: boolean
  answer: string
  tools: string[]
  usedToday: number
  limit: number
}

export interface AskUsage {
  date: string
  count: number
}

export function dailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DAILY_LIMIT
}

export async function usageToday(store: Store, today: string): Promise<number> {
  const u = await getJson<AskUsage>(store, 'ai:usage')
  return u?.date === today ? u.count : 0
}

/** Count the question before asking, under a lock, so two tabs can't both slip past the cap. */
async function takeOne(store: Store, today: string, limit: number): Promise<number | null> {
  return store.withLock('ai:usage', async () => {
    const used = await usageToday(store, today)
    if (used >= limit) return null
    await store.set('ai:usage', { date: today, count: used + 1 } satisfies AskUsage)
    return used + 1
  })
}

function system(today: string): string {
  return [
    'You answer questions from the owner of Fone Nova Ltd about the company, inside its private dashboard, QuayPilot.',
    'Fone Nova buys phones from Mobile One Trade B.V. and resells them to a few trade customers at a thin margin, in EUR; its books are in GBP.',
    'Get every figure from the tools. Never estimate or invent a number, an order, or a date. If the tools do not cover the question, say so in one line.',
    'Answer in at most 120 words, plain sentences or a short list. Copy amounts as the tools give them. Name orders by their id (e.g. FN-ORD-034) so the dashboard can link them.',
    'For tax, VAT or legal questions give the figures and say an accountant should confirm.',
    `Today is ${today}.`,
  ].join('\n')
}

export async function ask(question: string, data: AskData, opts: { store: Store; client?: Anthropic }): Promise<AskAnswer> {
  const limit = dailyLimit()
  const used = await takeOne(opts.store, data.today, limit)
  if (used === null) return { ok: false, answer: `Today's limit of ${limit} questions is used up. It resets at midnight (UTC).`, tools: [], usedToday: limit, limit }
  const client = opts.client ?? new Anthropic()
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }]
  const toolsUsed: string[] = []
  try {
    for (let round = 0; round <= MAX_ROUNDS; round++) {
      const res = await client.messages.create({
        model: ASK_MODEL,
        max_tokens: 4096,
        output_config: { effort: 'low' },
        system: system(data.today),
        tools: TOOLS,
        // On the last round, no more lookups: it must answer with what it has.
        ...(round === MAX_ROUNDS ? { tool_choice: { type: 'none' } } : {}),
        messages,
      })
      if (res.stop_reason === 'refusal') return { ok: false, answer: 'The AI declined to answer that one. Try asking it differently.', tools: toolsUsed, usedToday: used, limit }
      const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (res.stop_reason !== 'tool_use' || !calls.length) {
        const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim()
        return { ok: !!text, answer: text || 'No answer came back. Try again.', tools: toolsUsed, usedToday: used, limit }
      }
      messages.push({ role: 'assistant', content: res.content })
      const results: Anthropic.ToolResultBlockParam[] = calls.map((c) => {
        toolsUsed.push(c.name)
        try {
          return { type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(runTool(c.name, (c.input ?? {}) as Record<string, unknown>, data)) }
        } catch (e) {
          return { type: 'tool_result', tool_use_id: c.id, content: `Lookup failed: ${e instanceof Error ? e.message : String(e)}`, is_error: true }
        }
      })
      messages.push({ role: 'user', content: results })
    }
    return { ok: false, answer: 'That needed too many lookups. Try a narrower question.', tools: toolsUsed, usedToday: used, limit }
  } catch (e) {
    const answer =
      e instanceof Anthropic.AuthenticationError ? 'The Anthropic API key was refused. Check ANTHROPIC_API_KEY in Vercel.'
      : e instanceof Anthropic.RateLimitError ? 'The AI is busy or the monthly spend limit is reached. Try again later.'
      : e instanceof Anthropic.APIError ? `The AI service answered ${e.status}. Try again in a minute.`
      : 'Could not reach the AI service.'
    return { ok: false, answer, tools: toolsUsed, usedToday: used, limit }
  }
}
