'use client'

import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface MonthData {
  month: string
  credit: number
  debit: number
  net: number
  count: number
}

const eur = (v: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)

export function MonthlyChart({ data }: { data: MonthData[] }) {
  const totalCredit = data.reduce((s, d) => s + d.credit, 0)
  const totalDebit = data.reduce((s, d) => s + d.debit, 0)
  const totalNet = totalCredit - totalDebit
  const savingsRate = totalCredit > 0 ? totalNet / totalCredit : 0
  const onTrack = savingsRate >= 0.2

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <StatCard label="Total Income" value={eur(totalCredit)} valueClassName="text-emerald-600 dark:text-emerald-400" />
      <StatCard label="Total Expenses" value={eur(totalDebit)} valueClassName="text-rose-600 dark:text-rose-400" />
      <Card className="col-span-2 sm:col-span-1">
        <CardHeader className="pb-1">
          <CardDescription>Savings Rate</CardDescription>
        </CardHeader>
        <CardContent>
          <p className={cn('text-2xl font-bold tabular-nums', onTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
            {(savingsRate * 100).toFixed(1)}%
          </p>
          <p className={cn('text-xs mt-1', onTrack ? 'text-emerald-600/80 dark:text-emerald-500/80' : 'text-amber-600/80 dark:text-amber-500/80')}>
            {onTrack ? '≥ 20% — on track' : '< 20% — off track'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName: string
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={cn('text-2xl font-bold tabular-nums', valueClassName)}>{value}</p>
      </CardContent>
    </Card>
  )
}
