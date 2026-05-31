'use client'

import { useState } from 'react'
import type { UncategorizedRow, RuleInput } from '@/lib/extractor'
import { RuleForm } from './RuleForm'
import { useUncategorized, useCreateRule } from '@/app/rules/queries'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const eur = (v: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v)

function slugify(s: string | null): string {
  if (!s) return 'new_rule'
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'new_rule'
  )
}

interface Props {
  initialUncategorized: UncategorizedRow[]
}

export function UncategorizedPanel({ initialUncategorized }: Props) {
  const { data: items } = useUncategorized(initialUncategorized)
  const createRule = useCreateRule()
  const [prefillCounterparty, setPrefillCounterparty] = useState<string | null>(null)

  async function handleSave(data: RuleInput) {
    await createRule.mutateAsync(data)
    setPrefillCounterparty(null)
  }

  if (!items.length) {
    return (
      <Card className="text-center">
        <CardContent className="py-8">
          <p className="text-emerald-400 font-medium text-sm">All transactions categorized!</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Run &ldquo;Enrich all&rdquo; to apply any new rules.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">
          Uncategorized transactions
        </CardTitle>
        <CardDescription>
          {items.length} counterpart{items.length !== 1 ? 'ies' : 'y'} · Click &ldquo;Add to
          rule&rdquo; to categorize
        </CardDescription>
      </CardHeader>

      {prefillCounterparty !== null && (
        <CardContent className="border-b border-border bg-muted/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground/80 text-sm font-semibold">
              Add rule for:{' '}
              <span className="font-mono text-indigo-400">{prefillCounterparty || '(no name)'}</span>
            </h3>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPrefillCounterparty(null)}
            >
              ✕
            </Button>
          </div>
          <RuleForm
            key={prefillCounterparty}
            initial={{
              rule_id: slugify(prefillCounterparty),
              counterparty_contains: prefillCounterparty ? [prefillCounterparty] : [],
              indicator: 'DBIT',
              category: 'uncategorized',
            }}
            isPending={createRule.isPending}
            onSave={handleSave}
            onCancel={() => setPrefillCounterparty(null)}
          />
        </CardContent>
      )}

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-6 text-xs text-muted-foreground uppercase tracking-wider">
                Counterparty
              </TableHead>
              <TableHead className="px-4 text-right text-xs text-muted-foreground uppercase tracking-wider">
                Txns
              </TableHead>
              <TableHead className="px-4 text-right text-xs text-muted-foreground uppercase tracking-wider">
                Total
              </TableHead>
              <TableHead className="px-4 text-xs text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                Months
              </TableHead>
              <TableHead className="px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.counterparty ?? 'null'}>
                <TableCell className="px-6 font-mono text-foreground/80 text-xs">
                  {row.counterparty ?? (
                    <span className="text-muted-foreground/60">(no name)</span>
                  )}
                  {row.sample_remittance && (
                    <div className="text-muted-foreground/50 text-xs mt-0.5 truncate max-w-xs">
                      {row.sample_remittance}
                    </div>
                  )}
                </TableCell>
                <TableCell className="px-4 text-muted-foreground tabular-nums text-right">
                  {row.count}
                </TableCell>
                <TableCell className="px-4 text-rose-400 tabular-nums text-right font-medium">
                  {eur(row.total)}
                </TableCell>
                <TableCell className="px-4 text-muted-foreground/60 text-xs hidden sm:table-cell">
                  {row.months.join(', ')}
                </TableCell>
                <TableCell className="px-4 text-right">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setPrefillCounterparty(row.counterparty ?? '')}
                    className="text-indigo-400 border-indigo-500/30 bg-indigo-600/10 hover:bg-indigo-600/20 whitespace-nowrap"
                  >
                    Add to rule
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
