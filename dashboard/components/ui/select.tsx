import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Native select, restyled. Keeps platform keyboard and mobile pickers. */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative inline-flex', className)}>
      <select
        className="h-9 w-full appearance-none rounded-md border border-line bg-surface pl-3 pr-8 text-sm font-medium text-ink hover:border-line-strong"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  )
}
