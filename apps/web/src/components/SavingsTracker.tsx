'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface SavingsTrendPoint {
  month: string
  deposits: number
  withdrawals: number
  net_saved: number
  cumulative_deposits: number
  savings_rate: number | null
}

export interface RoundupPoint {
  month: string
  total: number
  count: number
}

export interface SavingsData {
  trend: SavingsTrendPoint[]
  roundups: RoundupPoint[]
  roundup_grand_total: number
  total_deposited: number
  total_withdrawn: number
}

const eur = (v: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)

const pct = (v: number | null) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`

const shortMonth = (iso: string) => {
  const [y, m] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en', {
    month: 'short',
    year: '2-digit',
  })
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm flex flex-col gap-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((e) => (
        <p key={e.name} style={{ color: e.color }}>
          {e.name}: {eur(e.value)}
        </p>
      ))}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string
  value: string
  sub?: string
  valueClassName: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wider">{label}</p>
        <p className={cn('text-2xl font-bold tabular-nums', valueClassName)}>{value}</p>
        {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function SavingsTracker({ data }: { data: SavingsData }) {
  const latestRate = [...data.trend].reverse().find((p) => p.savings_rate != null)?.savings_rate ?? null
  const trendChart = data.trend.map((p) => ({ ...p, month: shortMonth(p.month) }))
  const roundupChart = data.roundups.map((p) => ({ ...p, month: shortMonth(p.month) }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Moved to Savings"
          value={eur(data.total_deposited)}
          sub={data.total_withdrawn > 0 ? `${eur(data.total_withdrawn)} withdrawn` : 'no withdrawals'}
          valueClassName="text-emerald-400"
        />
        <StatCard
          label="Savings Rate"
          value={pct(latestRate)}
          sub="of income sent to savings last month"
          valueClassName={latestRate != null && latestRate >= 0.15 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <StatCard
          label="Round-up Total"
          value={eur(data.roundup_grand_total)}
          sub="saved automatically via Afronding"
          valueClassName="text-indigo-400"
        />
      </div>

      {trendChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
              Savings Growth
            </CardTitle>
            <CardDescription>Total deposited to savings account over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendChart} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#3f3f46' }} />
                <Area
                  type="monotone"
                  dataKey="cumulative_deposits"
                  name="Total Deposited"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#savingsGrad)"
                  dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: '#34d399', r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {roundupChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
              Afronding Round-ups
            </CardTitle>
            <CardDescription>
              Tiny automatic savings that quietly add up — {eur(data.roundup_grand_total)} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={roundupChart} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `€${v.toFixed(0)}`}
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#27272a' }} />
                <Bar
                  dataKey="total"
                  name="Round-ups"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
