'use client'
import { cn } from '@/lib/utils'

/** Small single-choice toggle. A radio group under the hood, so arrow keys work. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-md border border-line bg-subtle p-0.5', className)}>
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              e.preventDefault()
              const next = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length]
              onChange(next.value)
              const parent = e.currentTarget.parentElement
              requestAnimationFrame(() => (parent?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus())
            }}
            className={cn(
              'h-7 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors',
              selected ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-line' : 'text-ink-3 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
