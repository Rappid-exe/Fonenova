import { redirect } from 'next/navigation'
import { FileWarning } from 'lucide-react'
import { Dashboard } from '@/components/dashboard/dashboard'
import { Shell } from '@/components/shell'
import { currentUser } from '@/lib/session'
import { syncSources } from '@/lib/sync'
import { getDataSource, loadExpenses, loadFxRate, loadOverheads, loadXeroState, overheadsWritable, toClientLedger } from '@/lib/data-source'
import { todayIso } from '@/lib/periods'

// Read the ledger on every request so a fresh import shows without a rebuild.
export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = (await searchParams).xero ?? null
  // Second lock: proxy.ts already gates this route, but the data never loads without a session here either.
  const user = await currentUser()
  if (user === false) redirect('/login')
  const email = user

  // Pick up any ledger or tracker saved since the last visit, before reading the data.
  const sources = await syncSources()
  const source = getDataSource()
  const [result, fx, oh, xero, exp] = await Promise.all([source.load(), loadFxRate(), loadOverheads(), loadXeroState(), loadExpenses()])

  if (!result.ok) {
    return (
      <Shell email={email}>
        <div className="mx-auto mt-24 max-w-lg rounded-lg border border-line bg-surface p-6" role="alert">
          <div className="flex items-center gap-2 text-loss">
            <FileWarning className="h-5 w-5" aria-hidden />
            <h1 className="text-[15px] font-semibold">{result.title}</h1>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{result.detail}</p>
          <p className="mt-4 text-[13px] text-ink-3">Data source: {source.name}. No figures are shown until the data loads, so nothing on screen is a guess.</p>
        </div>
      </Shell>
    )
  }

  const { ledger } = result
  return (
    <Shell email={email} footer={<>Source: {ledger.meta.sourceFile}<br />Imported {ledger.meta.importedAt.slice(0, 10)}</>}>
      <Dashboard ledger={toClientLedger(ledger)} today={todayIso()} fx={fx} overheads={oh.overheads} overheadsSaved={oh.saved} overheadsError={oh.error ?? null} overheadsWritable={overheadsWritable()} xero={xero} notice={notice} expenses={exp.log} expenseOverrides={exp.overrides} expensesError={exp.error ?? null} sources={sources} />
    </Shell>
  )
}
