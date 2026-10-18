import * as React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'gain' | 'loss' | 'warn' | 'accent' | 'outline'

const tones: Record<Tone, string> = {
  neutral: 'bg-black/[0.05] text-ink-2',
  gain: 'bg-gain-soft text-gain',
  loss: 'bg-loss-soft text-loss',
  warn: 'bg-warn-soft text-warn',
  accent: 'bg-accent-soft text-accent',
  outline: 'border border-line text-ink-2',
}

export function Badge({ tone = 'neutral', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[11.5px] font-medium leading-none', tones[tone], className)}
      {...props}
    />
  )
}
