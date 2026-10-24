import { describe, expect, it } from 'vitest'
import { loadMakeStatus, makeNeedsAttention, parseCredits, parseLogs, parseScenario } from '@/lib/make'

describe('Make status', () => {
  it('reads whether a scenario is on', () => {
    expect(parseScenario('8112915', { scenario: { name: 'Integration Webhooks', isActive: true, isPaused: false } })).toEqual({ id: '8112915', name: 'Integration Webhooks', active: true })
    expect(parseScenario('1', { scenario: { name: 'x', isActive: true, isPaused: true } }).active).toBe(false)
  })
  it('takes the newest run, and its error when it failed', () => {
    expect(parseLogs({ scenarioLogs: [{ status: 1, timestamp: '2026-10-22T09:00:00Z' }, { status: 3, timestamp: '2026-10-23T09:00:00Z', error: { message: 'Xero 400' } }] }))
      .toEqual({ lastRunAt: '2026-10-23T09:00:00Z', lastRunOk: false, lastError: 'Xero 400' })
    expect(parseLogs({ scenarioLogs: [] })).toEqual({ lastRunAt: null, lastRunOk: null, lastError: null })
  })
  it('reads credits used against the limit, or says nothing when Make does not report them', () => {
    expect(parseCredits({ organization: { license: { operations: 1000 } } }, { data: [{ operations: 20 }, { operations: 13 }] })).toEqual({ used: 33, limit: 1000 })
    expect(parseCredits({ organization: {} }, null)).toEqual({ used: null, limit: null })
  })
  it('asks for attention when a scenario is off, failed, or credits are nearly gone', () => {
    const base = { configured: true, problems: [], fetchedAt: 't', creditsUsed: 33, creditsLimit: 1000 }
    const ok = { id: '1', name: 'a', active: true, lastRunAt: 't', lastRunOk: true, lastError: null }
    expect(makeNeedsAttention({ ...base, scenarios: [ok] })).toBe(false)
    expect(makeNeedsAttention({ ...base, scenarios: [{ ...ok, active: false }] })).toBe(true)
    expect(makeNeedsAttention({ ...base, scenarios: [{ ...ok, lastRunOk: false }] })).toBe(true)
    expect(makeNeedsAttention({ ...base, creditsUsed: 950, scenarios: [ok] })).toBe(true)
    expect(makeNeedsAttention(null)).toBe(false)
  })
  it('turns a refused token into a message instead of failing', async () => {
    process.env.MAKE_API_TOKEN = 't'
    process.env.MAKE_SCENARIOS = '8112915'
    process.env.MAKE_ORG_ID = '9377699'
    const s = await loadMakeStatus((async () => new Response('{}', { status: 403 })) as unknown as typeof fetch)
    expect(s).toMatchObject({ scenarios: [], creditsUsed: null })
    expect(s!.problems[0]).toMatch(/403.*read scopes/)
    delete process.env.MAKE_API_TOKEN
  })
})
