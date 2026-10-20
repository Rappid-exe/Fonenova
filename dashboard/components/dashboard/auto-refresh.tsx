'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Re-render the page from the server every minute while the tab is visible, and as soon as it
 * becomes visible again. The server side then syncs any file saved since. Form edits survive,
 * because client state is kept across a refresh.
 */
export function AutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') router.refresh() }
    const id = window.setInterval(tick, everyMs)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [router, everyMs])
  return null
}
