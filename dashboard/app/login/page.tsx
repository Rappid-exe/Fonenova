import { BarChart3, Lock } from 'lucide-react'
import { authConfig } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  denied: 'That Google account does not have access to this dashboard.',
  state: 'The sign-in link expired or was opened in a different browser. Try again.',
  exchange: 'Google did not accept the sign-in. Try again.',
  token: 'Google returned a sign-in that could not be verified. Try again.',
  config: 'Sign-in is not configured on the server yet. No one can get in until it is.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const cfg = authConfig()
  const error = sp.error ? ERRORS[sp.error] ?? 'Sign-in failed. Try again.' : !cfg.ok ? ERRORS.config : null

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy">
            <BarChart3 className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-ink">Ledgerline</div>
            <div className="text-[12px] text-ink-3">by Fone Nova</div>
          </div>
        </div>
        <h1 className="mt-6 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          <Lock className="h-4 w-4 text-ink-3" aria-hidden />Private dashboard
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">Sign in with the Fone Nova Google account to continue.</p>
        {sp.signedout && !error && <p className="mt-4 rounded-md bg-subtle px-3 py-2 text-[12.5px] text-ink-2">You are signed out.</p>}
        {error && <p role="alert" className="mt-4 rounded-md bg-loss-soft px-3 py-2 text-[12.5px] text-loss">{error}</p>}
        {cfg.ok && (
          <a href="/auth/login" className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-navy text-sm font-medium text-white hover:bg-navy-2">
            Sign in with Google
          </a>
        )}
      </div>
    </main>
  )
}
