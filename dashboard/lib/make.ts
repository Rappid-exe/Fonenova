/**
 * Read-only status of the Make.com scenarios that put invoices and bills into Xero: is each one
 * on, when did it last run, did that run fail, and how many monthly credits are used.
 *
 * Settings (.env.local): MAKE_API_TOKEN (a read-only token from Make > Profile > API),
 * MAKE_ZONE (eu1), MAKE_ORG_ID, MAKE_SCENARIOS (comma-separated ids). Any problem becomes a
 * plain message; it never stops the page. Parsing is defensive because Make's API returns more
 * than we use and may rename fields.
 */

type Json = Record<string, unknown>

export interface MakeScenario {
  id: string
  name: string
  active: boolean
  lastRunAt: string | null
  lastRunOk: boolean | null
  lastError: string | null
}

export interface MakeStatus {
  configured: boolean
  scenarios: MakeScenario[]
  /** Credits (operations) used this period and the plan limit, when Make reports them. */
  creditsUsed: number | null
  creditsLimit: number | null
  problems: string[]
  fetchedAt: string
}

export function parseScenario(id: string, j: Json): Omit<MakeScenario, 'lastRunAt' | 'lastRunOk' | 'lastError'> {
  const s = (j.scenario as Json | undefined) ?? j
  return { id, name: String(s.name ?? `Scenario ${id}`), active: s.isActive === true && s.isPaused !== true }
}

/** Make log status: 1 success, 2 warning, 3 error. Newest first. */
export function parseLogs(j: Json): Pick<MakeScenario, 'lastRunAt' | 'lastRunOk' | 'lastError'> {
  const logs = ((j.scenarioLogs ?? j.logs) as Json[] | undefined) ?? []
  const runs = logs
    .filter((l) => typeof l.timestamp === 'string' && l.status !== undefined)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
  const last = runs[0]
  if (!last) return { lastRunAt: null, lastRunOk: null, lastError: null }
  const ok = Number(last.status) !== 3
  const err = ok ? null : String((last.error as Json | undefined)?.message ?? last.message ?? 'Last run failed: open the scenario History in Make')
  return { lastRunAt: String(last.timestamp), lastRunOk: ok, lastError: err }
}

/** Credits: the plan limit from the organisation's licence, usage summed from the usage report. */
export function parseCredits(org: Json | null, usage: Json | null): { used: number | null; limit: number | null } {
  const o = (org?.organization as Json | undefined) ?? org ?? {}
  const lic = (o.license as Json | undefined) ?? {}
  const limit = Number(lic.operations ?? lic.credits ?? NaN)
  const days = ((usage?.data ?? usage?.usage) as Json[] | undefined) ?? null
  const used = days ? days.reduce((n, d) => n + (Number(d.operations ?? d.credits ?? 0) || 0), 0) : Number(o.operations ?? NaN)
  return { used: Number.isFinite(used) ? used : null, limit: Number.isFinite(limit) && limit > 0 ? limit : null }
}

let cache: { at: number; status: MakeStatus } | null = null
const TTL = 10 * 60_000

export async function loadMakeStatus(fetchImpl: typeof fetch = fetch): Promise<MakeStatus | null> {
  const token = process.env.MAKE_API_TOKEN
  const ids = (process.env.MAKE_SCENARIOS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!token || !ids.length) return null
  if (cache && Date.now() - cache.at < TTL) return cache.status
  const base = (process.env.MAKE_API_URL ?? `https://${process.env.MAKE_ZONE ?? 'eu1'}.make.com/api/v2`).replace(/\/$/, '')
  const problems: string[] = []
  const get = async (path: string): Promise<Json | null> => {
    try {
      const res = await fetchImpl(`${base}${path}`, { headers: { authorization: `Token ${token}`, accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (res.ok) return (await res.json()) as Json
      problems.push(res.status === 401 || res.status === 403 ? `Make refused ${path.split('?')[0]} (${res.status}): check the token's read scopes` : `Make ${path.split('?')[0]} answered ${res.status}`)
    } catch {
      problems.push('Make could not be reached')
    }
    return null
  }
  // Every request at once: a page load waits for the slowest one, not for all of them in turn.
  const org = process.env.MAKE_ORG_ID
  const [perScenario, orgJson, usageJson] = await Promise.all([
    Promise.all(ids.map((id) => Promise.all([get(`/scenarios/${id}`), get(`/scenarios/${id}/logs?pg[sortDir]=desc&pg[limit]=10`)]))),
    org ? get(`/organizations/${org}`) : null,
    org ? get(`/organizations/${org}/usage`) : null,
  ])
  const scenarios: MakeScenario[] = []
  perScenario.forEach(([s, l], i) => {
    if (s) scenarios.push({ ...parseScenario(ids[i], s), ...(l ? parseLogs(l) : { lastRunAt: null, lastRunOk: null, lastError: null }) })
  })
  const credits = org ? parseCredits(orgJson, usageJson) : { used: null, limit: null }
  const status: MakeStatus = { configured: true, scenarios, creditsUsed: credits.used, creditsLimit: credits.limit, problems: [...new Set(problems)], fetchedAt: new Date().toISOString() }
  cache = { at: Date.now(), status }
  return status
}

/** True when the owner should look: a scenario is off, the last run failed, or credits are nearly gone. */
export function makeNeedsAttention(m: MakeStatus | null): boolean {
  if (!m) return false
  if (m.scenarios.some((s) => !s.active || s.lastRunOk === false)) return true
  return m.creditsUsed !== null && m.creditsLimit !== null && m.creditsUsed >= m.creditsLimit * 0.9
}
