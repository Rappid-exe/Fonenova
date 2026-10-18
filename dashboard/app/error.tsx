'use client'
import { AlertOctagon } from 'lucide-react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-24 max-w-lg rounded-lg border border-line bg-surface p-6" role="alert">
      <div className="flex items-center gap-2 text-loss">
        <AlertOctagon className="h-5 w-5" aria-hidden />
        <h1 className="text-[15px] font-semibold">The dashboard hit an error</h1>
      </div>
      <p className="mt-2 text-sm text-ink-2">{error.message || 'Unknown error.'} No figures are shown rather than partial ones.</p>
      <button type="button" onClick={reset} className="mt-4 h-9 rounded-md bg-navy px-3 text-sm font-medium text-white">Try again</button>
    </div>
  )
}
