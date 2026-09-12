/**
 * Brand lockup, drawn inline rather than shipped as a bitmap.
 *
 * The mark is a handset in brand blue holding a four-point nova spark. Both
 * fills read straight from the theme tokens, so the mark inverts with the rest
 * of the page instead of needing a second light/dark asset.
 *
 * Everything inside scales from the root font-size: set `text-[20px]` (or any
 * font-size) on the wrapper and the mark, wordmark and subline all follow.
 */

type LogoProps = {
  className?: string
  /** The subline is unreadable below roughly 16px of root size; drop it there. */
  withSubline?: boolean
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect x="26" y="10" width="48" height="80" rx="13" fill="var(--primary)" />
      <path d="M50 28 L57 45 L74 50 L57 55 L50 72 L43 55 L26 50 L43 45 Z" fill="var(--background)" />
    </svg>
  )
}

export function Logo({ className = "", withSubline = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-[0.5em] ${className}`}>
      <LogoMark className="h-[1.9em] w-auto shrink-0" />
      <span className="inline-flex flex-col items-center leading-none">
        <span className="font-mono font-bold tracking-[-0.025em] text-foreground">
          FONE<span className="text-primary">NOVA</span>
        </span>
        {withSubline && (
          /* The trailing letter-space sits after the final N, which throws the
             block off-centre under the wordmark; the negative margin cancels it. */
          <span
            className="mt-[0.42em] font-mono font-medium text-[0.24em] tracking-[0.34em] text-foreground/55"
            style={{ marginRight: "-0.34em" }}
          >
            WHOLESALE DISTRIBUTION
          </span>
        )}
      </span>
    </span>
  )
}
