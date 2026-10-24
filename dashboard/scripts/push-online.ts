/**
 * Sends this PC's dashboard data to the online dashboard.
 *
 *   npm run push-online              # copy imports; copy decisions only where online has none
 *   npm run push-online -- --force   # also replace decisions already made online
 *
 * Reads the online store's details from .env.online.local (git-ignored), never from .env.local,
 * so the dashboard on your PC keeps using its own data folder:
 *   KV_REST_API_URL=...      KV_REST_API_TOKEN=...   (Vercel > project > Storage > Upstash)
 *   FN_STORE_KEY=...         (the same value as in Vercel)
 * Run "npm run import" and "npm run import-expenses" first so the local copies are current.
 */
import fs from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { FileStore, RedisStore, dataDir } from '../lib/store'
import { pushOnline } from '../lib/push-online'

loadEnvConfig(process.cwd())

/** KEY=VALUE lines; blank lines, # comments and surrounding quotes ignored. */
function parse(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

async function main() {
  const file = '.env.online.local'
  if (!fs.existsSync(file)) {
    console.error(`${file} not found. Create it with KV_REST_API_URL, KV_REST_API_TOKEN and FN_STORE_KEY (see the top of scripts/push-online.ts).`)
    process.exit(2)
  }
  const env = parse(fs.readFileSync(file, 'utf8'))
  const missing = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'FN_STORE_KEY'].filter((k) => !env[k])
  if (missing.length) {
    console.error(`${file} is missing: ${missing.join(', ')}`)
    process.exit(2)
  }
  const online = new RedisStore(env.KV_REST_API_URL, env.KV_REST_API_TOKEN, env.FN_STORE_KEY)
  const results = await pushOnline(new FileStore(dataDir()), online, { force: process.argv.includes('--force') })
  for (const r of results) console.log(`${r.key.padEnd(18)} ${r.result}`)
  if (results.some((r) => r.result === 'kept online copy')) {
    console.log('\nSome decisions were already made on the website and were kept. Run with --force to replace them with this PC\'s.')
  }
  console.log('\nDone. Reload the online dashboard.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
