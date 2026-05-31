'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TransactionDetail } from '@/lib/extractor'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const eur = (v: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)

const CATEGORY_COLORS: Record<string, string> = {
  housing: '#6366f1',
  groceries: '#10b981',
  health: '#f43f5e',
  telecom: '#f59e0b',
  lifestyle: '#8b5cf6',
  credit_card: '#ef4444',
  income: '#34d399',
  uncategorized: '#52525b',
}

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Housing',
  groceries: 'Groceries',
  health: 'Health',
  telecom: 'Telecom',
  lifestyle: 'Lifestyle',
  credit_card: 'Credit Card',
  income: 'Income',
  uncategorized: 'Uncategorized',
}

function colorFor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#71717a'
}

function labelFor(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

interface CategoryGroup {
  category: string
  total: number
  transactions: TransactionDetail[]
}

function groupByCategory(txns: TransactionDetail[]): CategoryGroup[] {
  const map = new Map<string, TransactionDetail[]>()
  for (const t of txns) {
    if (!map.has(t.category)) map.set(t.category, [])
    map.get(t.category)!.push(t)
  }
  return Array.from(map.entries())
    .map(([category, transactions]) => ({
      category,
      total: transactions.reduce((s, t) => s + t.amount, 0),
      transactions: [...transactions].sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.total - a.total)
}

function formatMonthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en', {
    month: 'long',
    year: 'numeric',
  })
}

function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentYYYYMM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function TransactionsView({
  transactions,
  month,
  initialCategory,
}: {
  transactions: TransactionDetail[]
  month: string
  initialCategory?: string
}) {
  const router = useRouter()
  const [filterCategory, setFilterCategory] = useState<string | null>(initialCategory ?? null)

  const prevMonth = shiftMonth(month, -1)
  const nextMonth = shiftMonth(month, +1)
  const isCurrentMonth = month === currentYYYYMM()

  function goToMonth(yyyymm: string) {
    const params = new URLSearchParams({ month: yyyymm })
    if (filterCategory) params.set('category', filterCategory)
    router.push(`/transactions?${params.toString()}`)
  }

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('month', month)
    if (filterCategory) params.set('category', filterCategory)
    window.history.replaceState(null, '', `?${params.toString()}`)
  }, [filterCategory, month])

  const allGroups = useMemo(() => groupByCategory(transactions), [transactions])
  const visibleGroups = filterCategory
    ? allGroups.filter((g) => g.category === filterCategory)
    : allGroups

  const totalCount = visibleGroups.reduce((s, g) => s + g.transactions.length, 0)

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        {/* Title row: title left, month picker right */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {filterCategory ? labelFor(filterCategory) : 'All Transactions'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {totalCount} transaction{totalCount !== 1 ? 's' : ''}
              {!filterCategory &&
                `, ${visibleGroups.length} ${visibleGroups.length !== 1 ? 'categories' : 'category'}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => goToMonth(prevMonth)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium text-foreground min-w-[110px] text-center">
              {formatMonthLabel(month)}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => goToMonth(nextMonth)}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Category filter pills */}
        {allGroups.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {allGroups.map((g) => {
              const active = filterCategory === g.category
              return (
                <button
                  key={g.category}
                  type="button"
                  onClick={() =>
                    setFilterCategory((prev) => (prev === g.category ? null : g.category))
                  }
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors',
                    active
                      ? 'border-border text-foreground bg-muted'
                      : 'border-border/60 hover:border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: colorFor(g.category) }}
                  />
                  {labelFor(g.category)}
                </button>
              )
            })}
            {filterCategory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterCategory(null)}
                className="text-muted-foreground whitespace-nowrap"
              >
                Clear filters ×
              </Button>
            )}
          </div>
        )}
      </div>

      {visibleGroups.length === 0 ? (
        <Card className="text-center">
          <CardContent className="py-16">
            <p className="text-muted-foreground text-lg font-medium">No transactions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleGroups.map((group) => (
            <Card key={group.category}>
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ background: colorFor(group.category) }}
                    />
                    <span className="font-semibold text-foreground/90 text-sm">
                      {labelFor(group.category)}
                    </span>
                    <span className="text-muted-foreground/60 text-xs">
                      {group.transactions.length} txn{group.transactions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="font-semibold text-foreground/90 text-sm tabular-nums">
                    {eur(group.total)}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-border/60">
                {group.transactions.map((txn) => (
                  <div key={txn.transaction_id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-muted-foreground text-xs w-20 shrink-0 tabular-nums">
                      {formatDate(txn.date)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <span className="text-foreground/80 text-sm truncate block">
                        {txn.counterparty ?? txn.description ?? '—'}
                      </span>
                      {txn.counterparty && txn.description && (
                        <span className="text-muted-foreground/60 text-xs truncate block">
                          {txn.description}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {txn.is_recurring && (
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                          recurring
                        </Badge>
                      )}
                      {txn.is_transfer && (
                        <Badge variant="secondary">
                          transfer
                        </Badge>
                      )}
                    </div>

                    <span
                      className={cn(
                        'text-sm font-semibold tabular-nums shrink-0',
                        txn.direction === 'in' ? 'text-emerald-400' : 'text-foreground/80'
                      )}
                    >
                      {txn.direction === 'in' ? '+' : '−'}
                      {eur(txn.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
