'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { SavingsFlowMonth } from '@/lib/extractor'
import { SAVINGS_TARGET } from '@/lib/config'

const eur = (v: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)

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
          {e.name}: {eur(e.name === 'Money Out' ? Math.abs(e.value) : e.value)}
        </p>
      ))}
    </div>
  )
}

export function SavingsFlow({ data }: { data: SavingsFlowMonth[] }) {
  if (!data.length) return null

  const chartData = data.map((m) => ({
    month: shortMonth(m.month),
    'Money In': m.money_in,
    'Money Out': -m.money_out,
    'Net': m.money_in - m.money_out,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
          Oranje Spaarrekening
        </CardTitle>
        <CardDescription>Money in and out per month</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
            barGap={4}
            barCategoryGap="28%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-muted)' }} />
            <Legend
              wrapperStyle={{ color: 'var(--color-muted-foreground)', fontSize: '12px', paddingTop: '16px' }}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="Money In" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Money Out" fill="#f43f5e" radius={[0, 0, 4, 4]} maxBarSize={28} />
            <Line
              type="monotone"
              dataKey="Net"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <ReferenceLine
              y={SAVINGS_TARGET}
              stroke="#6366f1"
              strokeWidth={1}
              strokeDasharray="6 3"
              strokeOpacity={0.5}
              label={{
                value: `20% target`,
                position: 'insideTopRight',
                fill: '#6366f1',
                fontSize: 11,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
