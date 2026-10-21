'use client'
import { useState } from 'react'
import { AlertTriangle, BarChart3, Building2, FileMinus2, LayoutDashboard, LogOut, Menu, Package, Receipt, Settings, Users } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { useSection, type Section } from '@/lib/sections'
import { cn } from '@/lib/utils'

const NAV: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'suppliers', label: 'Suppliers', icon: Building2 },
  { id: 'credit-notes', label: 'Credit Notes', icon: FileMinus2 },
  { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
        <BarChart3 className="h-4 w-4 text-white" aria-hidden />
      </div>
      <div className="leading-tight">
        <div className="text-[14px] font-semibold tracking-[-0.01em] text-white">Ledgerline</div>
        <div className="text-[11px] text-navy-ink/70">by Fone Nova</div>
      </div>
    </div>
  )
}

function Nav({ onPick }: { onPick?: () => void }) {
  const [section, go] = useSection()
  return (
    <nav aria-label="Main" className="mt-6 space-y-0.5">
      {NAV.map(({ id, label, icon: Icon }) => {
        const active = id === section
        return (
          <a
            key={id}
            href={id === 'overview' ? '#' : `#${id}`}
            onClick={(e) => { e.preventDefault(); go(id); onPick?.() }}
            aria-current={active ? 'page' : undefined}
            className={cn('flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px]', active ? 'bg-white/[0.09] font-medium text-white' : 'text-navy-ink/80 hover:bg-white/[0.05] hover:text-white')}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </a>
        )
      })}
    </nav>
  )
}

function Account({ email }: { email: string | null }) {
  if (!email) return null
  return (
    <form action="/auth/logout" method="post" className="mb-4 border-b border-white/10 pb-4">
      <div className="truncate text-[12px] text-navy-ink/80" title={email}>{email}</div>
      <button type="submit" className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white/90 hover:text-white">
        <LogOut className="h-3.5 w-3.5" aria-hidden />Sign out
      </button>
    </form>
  )
}

export function Shell({ children, footer, email = null }: { children: React.ReactNode; footer?: React.ReactNode; email?: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-dvh lg:pl-[232px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col bg-navy px-4 py-5 lg:flex">
        <Wordmark />
        <Nav />
        <div className="mt-auto">
          <Account email={email} />
          <div className="text-[11.5px] leading-relaxed text-navy-ink/60">{footer}</div>
        </div>
      </aside>
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between bg-navy px-4 lg:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white hover:bg-white/10"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen} side="left" title="Navigation" className={cn('max-w-[280px] bg-navy [&>div:first-child]:bg-navy [&>div:first-child]:border-white/10 [&_h2]:text-white')}>
        <div className="px-4 pb-6">
          <Nav onPick={() => setOpen(false)} />
          <div className="mt-6">
            <Account email={email} />
            <div className="text-[11.5px] leading-relaxed text-navy-ink/60">{footer}</div>
          </div>
        </div>
      </Sheet>
      <main className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
