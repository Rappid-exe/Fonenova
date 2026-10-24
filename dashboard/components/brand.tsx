import { cn } from '@/lib/utils'

/** The QuayPilot mark: a blue rounded tile with a white four-point star. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="5.5" fill="#0a72df" />
      <path d="M12 4.6c.55 3.9 2.9 6.45 7.4 7.4-4.5.95-6.85 3.5-7.4 7.4-.55-3.9-2.9-6.45-7.4-7.4 4.5-.95 6.85-3.5 7.4-7.4Z" fill="#fff" />
    </svg>
  )
}

/** "Quay" in the ink colour, "Pilot" in brand blue. `dark` for the navy sidebar. */
export function BrandName({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cn('font-bold tracking-[-0.02em]', className)}>
      <span className={dark ? 'text-white' : 'text-[#0b2350]'}>Quay</span>
      <span className={dark ? 'text-[#4d9bf0]' : 'text-[#0a72df]'}>Pilot</span>
    </span>
  )
}
