import crypto from 'node:crypto'

/** True only for `Authorization: Bearer <CRON_SECRET>`. With no CRON_SECRET set, nothing passes. */
export function cronAuthorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
