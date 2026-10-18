'use client'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarX2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { THIN_MARGIN, type SeriesPoint } from '@/lib/metrics'
import { formatDate, formatDay, type DateRange, type Granularity } from '@/lib/periods'
import { eur, eurCompact, pct, plural } from '@/lib/format'
import { cn } from '@/lib/utils'

type Lower = 'profit' | 'margin'

const C = {
  sales: '#2b5fc7',
  gain: '#17734a',
  loss: '#b8322a',
  margin: '#15181d',
  grid: '#ece9e3',
  axis: '#7a7e86',
}

type Row = SeriesPoint & { sales: number; profit: number; margin: number | null }

function TooltipBody({ active, payload, granularity }: { active?: boolean; payload?: { payload: Row }[]; granularity: Granularity }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const title = granularity === 'month' ? p.label : `Week of ${formatDay(p.start)}`
  return (
    <div className="min-w-[200px] rounded-md border border-line bg-surface px-3 py-2 text-[12.5px] shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)]">
      <div className="mb-1.5 flex justify-between gap-3 font-semibold text-ink">
        <span>{title}</span>
        <span className="font-normal text-ink-3">{plural(p.orderCount, 'order')}</span>
      </div>
      {p.orderCount === 0 ? (
        <div className="text-ink-3">No orders</div>
      ) : (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
          <dt className="text-ink-2">Sales</dt><dd className="num text-ink">{eur(p.salesCents)}</dd>
          <dt className="text-ink-2">Cost</dt><dd className="num text-ink">{eur(p.costCents)}</dd>
          <dt className="text-ink-2">Gross profit</dt><dd className={cn('num font-semibold', p.grossProfitCents < 0 ? 'text-loss' : 'text-gain')}>{eur(p.grossProfitCents, { sign: true })}</dd>
          <dt className="text-ink-2">Gross margin</dt><dd className="num text-ink">{pct(p.marginRatio)}</dd>
        </dl>
      )}
    </div>
  )
}

const axisProps = { tick: { fontSize: 11, fill: C.axis }, tickLine: false, axisLine: false } as const

export function TrendChart({
  series,
  granularity,
  onGranularity,
  empty,
  range,
  coverageEnd,
  onShowAllTime,
}: {
  series: SeriesPoint[]
  granularity: Granularity
  onGranularity: (g: Granularity) => void
  empty: boolean
  range: DateRange
  coverageEnd: string
  onShowAllTime: () => void
}) {
  const [lower, setLower] = useState<Lower>('profit')
  const [asTable, setAsTable] = useState(false)
  const rows: Row[] = series.map((p) => ({ ...p, sales: p.salesCents / 100, profit: p.grossProfitCents / 100, margin: p.marginRatio === null ? null : p.marginRatio * 100 }))
  const dense = rows.length > 16
  // Recharts passes the tick's index among visible ticks, not the data index, so look labels up by key.
  const labelOf = new Map(rows.map((r) => [r.key, r.label]))
  // Margin axis on clean 0.5-point steps, always including 0 so a loss sits visibly below it.
  const ms = rows.map((r) => r.margin).filter((v): v is number => v !== null)
  const lo = Math.min(0, Math.floor(Math.min(...ms, 0) * 2) / 2)
  const hi = Math.max(1, Math.ceil(Math.max(...ms, 0) * 2) / 2)
  const step = hi - lo > 4 ? 1 : 0.5
  const marginTicks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) marginTicks.push(Math.round(v * 10) / 10)
  const tooltip = <Tooltip cursor={{ fill: 'rgba(17,27,43,0.05)' }} content={<TooltipBody granularity={granularity} />} isAnimationActive={false} />

  return (
    <section aria-labelledby="trend-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="trend-title" className="text-[14px] font-semibold text-ink">Sales and gross profit over time</h2>
          <p className="text-[12px] text-ink-3">Separate scales: profit is about 1% of sales and would be invisible on the sales axis.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Lower panel" value={lower} onChange={setLower} options={[{ value: 'profit', label: 'Gross profit' }, { value: 'margin', label: 'Margin %' }]} />
          <Segmented label="Granularity" value={granularity} onChange={onGranularity} options={[{ value: 'month', label: 'Monthly' }, { value: 'week', label: 'Weekly' }]} />
          <Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>{asTable ? 'Chart' : 'Table'}</Button>
        </div>
      </div>

      {empty ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <CalendarX2 className="h-6 w-6 text-ink-3" aria-hidden />
          <p className="mt-3 text-[14px] font-medium text-ink">No orders between {formatDate(range.start)} and {formatDate(range.end)}</p>
          <p className="mt-1 max-w-md text-[12.5px] text-ink-3">
            {range.end > coverageEnd ? `The ledger was last updated ${formatDate(coverageEnd)}. Orders after that date are not in it yet.` : 'Nothing was invoiced in this period.'}
          </p>
          <Button className="mt-4" size="sm" onClick={onShowAllTime}>Show all time</Button>
        </div>
      ) : asTable ? (
        <div className="relative overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <caption className="sr-only">Sales, cost and gross profit by {granularity}</caption>
            <thead className="bg-subtle text-ink-3">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">{granularity === 'month' ? 'Month' : 'Week of'}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Orders</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Sales</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Cost</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Gross profit</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.key} className={cn('border-t border-line', p.orderCount === 0 && 'text-ink-3')}>
                  <td className="px-4 py-1.5">{granularity === 'month' ? p.label : formatDay(p.start)}</td>
                  <td className="num px-4 py-1.5">{p.orderCount}</td>
                  <td className="num px-4 py-1.5">{p.orderCount ? eur(p.salesCents) : 'none'}</td>
                  <td className="num px-4 py-1.5">{p.orderCount ? eur(p.costCents) : ''}</td>
                  <td className={cn('num px-4 py-1.5 font-medium', p.grossProfitCents < 0 && 'text-loss')}>{p.orderCount ? eur(p.grossProfitCents) : ''}</td>
                  <td className="num px-4 py-1.5">{p.orderCount ? pct(p.marginRatio) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-2 pt-3 pb-2 sm:px-3" role="img" aria-label={`Bar charts of sales and ${lower === 'profit' ? 'gross profit' : 'gross margin'} by ${granularity}. Use the Table button for exact figures.`}>
          <div className="flex items-center gap-2 px-2 text-[12px] font-medium text-ink-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.sales }} aria-hidden />Sales
          </div>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} syncId="trend" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={dense ? '18%' : '28%'}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="key" hide />
                <YAxis {...axisProps} width={56} tickFormatter={(v: number) => eurCompact(v * 100)} />
                {tooltip}
                <Bar dataKey="sales" fill={C.sales} radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center gap-3 border-t border-line px-2 pt-3 text-[12px] font-medium text-ink-2">
            {lower === 'profit' ? (
              <>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.gain }} aria-hidden />Gross profit (+)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.loss }} aria-hidden />Loss (−)</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3" style={{ background: C.margin }} aria-hidden />Gross margin %</span>
                <span className="flex items-center gap-1.5 text-ink-3"><span className="w-3 border-t border-dashed border-warn" aria-hidden />0.5% thin-margin line</span>
              </>
            )}
          </div>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              {lower === 'profit' ? (
                <BarChart data={rows} syncId="trend" margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={dense ? '18%' : '28%'}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="key" {...axisProps} tickFormatter={(key: string) => labelOf.get(key) ?? ''} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis {...axisProps} width={56} tickFormatter={(v: number) => eurCompact(v * 100)} />
                  <ReferenceLine y={0} stroke="#c9c5bc" />
                  {tooltip}
                  <Bar dataKey="profit" radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                    {rows.map((r) => <Cell key={r.key} fill={r.profit < 0 ? C.loss : C.gain} />)}
                  </Bar>
                </BarChart>
              ) : (
                <LineChart data={rows} syncId="trend" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="key" {...axisProps} tickFormatter={(key: string) => labelOf.get(key) ?? ''} interval="preserveStartEnd" minTickGap={14} padding={{ left: 16, right: 16 }} />
                  <YAxis {...axisProps} width={56} domain={[marginTicks[0], marginTicks.at(-1)!]} ticks={marginTicks} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                  <ReferenceLine y={THIN_MARGIN * 100} stroke="#9a5b00" strokeDasharray="4 3" />
                  <Tooltip cursor={{ stroke: '#c9c5bc' }} content={<TooltipBody granularity={granularity} />} isAnimationActive={false} />
                  <Line dataKey="margin" stroke={C.margin} strokeWidth={2} dot={{ r: 3.5, fill: C.margin, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          {lower === 'margin' && <p className="px-2 pt-1 text-[11.5px] text-ink-3">Periods without orders have no margin and are left as gaps.</p>}
        </div>
      )}
    </section>
  )
}
