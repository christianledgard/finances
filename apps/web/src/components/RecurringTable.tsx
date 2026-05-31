'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface SubscriptionRow {
  counterparty: string
  category: string
  avg_amount: number
  months_seen: number
  last_date: string
  last_amount: number
  total: number
}

export interface SubscriptionsData {
  items: SubscriptionRow[]
  monthly_total: number
  annualized_total: number
}

const eur = (v: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Housing',
  groceries: 'Groceries',
  health: 'Health',
  telecom: 'Telecom',
  lifestyle: 'Lifestyle',
  credit_card: 'Credit Card',
  income: 'Income',
  uncategorized: '—',
}

function labelFor(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat
}

export function RecurringTable({ data }: { data: SubscriptionsData }) {
  if (!data.items.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
          Recurring Payments
        </CardTitle>
        <CardDescription>
          Subscriptions and regular bills seen in ≥ 3 months
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-6 text-xs text-muted-foreground uppercase tracking-wider">
                Payee
              </TableHead>
              <TableHead className="px-3 text-xs text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                Category
              </TableHead>
              <TableHead className="px-3 text-right text-xs text-muted-foreground uppercase tracking-wider">
                Avg / mo
              </TableHead>
              <TableHead className="px-3 text-right text-xs text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Months
              </TableHead>
              <TableHead className="px-6 text-right text-xs text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => (
              <TableRow key={row.counterparty}>
                <TableCell className="px-6 font-medium capitalize text-foreground max-w-[160px] sm:max-w-[280px]">
                  <span className="block truncate">{row.counterparty}</span>
                </TableCell>
                <TableCell className="px-3 text-muted-foreground hidden sm:table-cell">
                  {labelFor(row.category)}
                </TableCell>
                <TableCell className="px-3 text-right tabular-nums text-foreground/80">
                  {eur(row.avg_amount)}
                </TableCell>
                <TableCell className="px-3 text-right text-muted-foreground hidden md:table-cell">
                  {row.months_seen}
                </TableCell>
                <TableCell className="px-6 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                  {eur(row.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="px-6 text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">
                Monthly total
              </TableCell>
              <TableCell className="px-6 text-muted-foreground text-xs uppercase tracking-wider sm:hidden">
                Monthly total
              </TableCell>
              <TableCell className="px-3 text-right text-emerald-400 font-bold tabular-nums">
                {eur(data.monthly_total)}
              </TableCell>
              <TableCell className="px-3 text-right text-muted-foreground text-xs hidden md:table-cell">
                /mo
              </TableCell>
              <TableCell className="px-6 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                {eur(data.annualized_total)}/yr
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
