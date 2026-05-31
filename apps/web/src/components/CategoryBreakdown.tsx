'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { colorFor, labelFor } from '@/lib/categories'
import { SALARY_CAP } from '@/lib/config'

export interface CategoryRow {
  month: string
  category: string
  debit: number
  credit: number
  offset_credit: number
  net: number
  count: number
}

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
  const sorted = [...payload].sort((a, b) => b.value - a.value)
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm">
      <p className="text-muted-foreground mb-2 font-medium">{label}</p>
      {sorted.map((e) => (
        <p key={e.name} style={{ color: e.color }}>
          {e.name}: {eur(e.value)}
        </p>
      ))}
    </div>
  )
}

export function CategoryBreakdown({ data }: { data: CategoryRow[] }) {
  if (!data.length) return null

  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme !== 'light'
  const chart = {
    grid:   dark ? '#27272a' : '#e4e4e7',
    tick:   dark ? '#71717a' : '#6b7280',
    cursor: dark ? '#27272a' : '#f4f4f5',
    legend: dark ? '#a1a1aa' : '#52525b',
  }
  const months = [...new Set(data.map((r) => r.month))].sort()

  const expenseCategories = [
    ...new Set(
      data
        .filter((r) => (r.net > 0 || r.debit > 0) && r.category !== 'income')
        .map((r) => r.category)
    ),
  ]

  const chartData = months.map((m) => {
    const row: Record<string, string | number> = { month: shortMonth(m), monthKey: m }
    const incomeRow = data.find((r) => r.month === m && r.category === 'income')
    row['income'] = incomeRow ? incomeRow.credit : 0
    for (const cat of expenseCategories) {
      const match = data.find((r) => r.month === m && r.category === cat)
      row[cat] = match ? match.net : 0
    }
    return row
  })

  const expenseTotals = expenseCategories
    .map((cat) => ({
      category: cat,
      total: data.filter((r) => r.category === cat).reduce((s, r) => s + r.net, 0),
    }))
    .sort((a, b) => b.total - a.total)

  const totalIncome = data
    .filter((r) => r.category === 'income')
    .reduce((s, r) => s + r.credit, 0)

  const totalExpenses = expenseTotals.reduce((s, r) => s + r.total, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
          Income vs Expenses by Category
        </CardTitle>
        <CardDescription>
          Housing shown net of roommate contribution
        </CardDescription>
        <CardAction>
          <Link
            href="/transactions"
            className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors flex items-center gap-1"
          >
            View transactions
            <span aria-hidden>→</span>
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className="relative cursor-pointer"
          title="Click a month to view its transactions"
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
              barGap={6}
              barCategoryGap="20%"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                const key = e?.activePayload?.[0]?.payload?.monthKey as string | undefined
                if (key) router.push(`/transactions?month=${key}`)
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: chart.tick, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
                tick={{ fill: chart.tick, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursor }} />
              <Legend
                wrapperStyle={{ color: chart.legend, fontSize: '12px', paddingTop: '16px' }}
                formatter={(value) => labelFor(value)}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              {expenseCategories.map((cat, i) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  name={labelFor(cat)}
                  stackId="expenses"
                  fill={colorFor(cat)}
                  radius={i === expenseCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={32}
                />
              ))}
              <ReferenceLine
                y={SALARY_CAP}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                label={{
                  value: `Salary cap €${SALARY_CAP.toLocaleString('nl-NL')}`,
                  position: 'insideTopRight',
                  fill: '#ef4444',
                  fontSize: 11,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="flex items-center gap-2 col-span-2 sm:col-span-3 mb-1">
            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-muted-foreground text-xs">Income</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold tabular-nums ml-auto">
              {eur(totalIncome)}
            </span>
            <span className="text-muted-foreground/40 text-xs mx-2">vs</span>
            <span className="text-muted-foreground text-xs">Total Expenses</span>
            <span className="text-rose-600 dark:text-rose-400 text-xs font-semibold tabular-nums ml-auto">
              {eur(totalExpenses)}
            </span>
          </div>
          {expenseTotals.map(({ category, total }) => (
            <Link
              key={category}
              href={`/transactions?category=${category}`}
              className="flex items-center gap-2 rounded hover:bg-muted/60 px-1 -mx-1 transition-colors"
            >
              <span
                className="size-2 rounded-full shrink-0"
                style={{ background: colorFor(category) }}
              />
              <span className="text-muted-foreground text-xs">{labelFor(category)}</span>
              <span className="text-foreground/70 text-xs font-medium tabular-nums ml-auto">
                {eur(total)}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
