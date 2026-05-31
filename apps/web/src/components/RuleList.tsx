'use client'

import { useState } from 'react'
import { colorFor, labelFor } from '@/lib/categories'
import { RuleForm } from './RuleForm'
import type { RuleDoc, RuleInput } from '@/lib/extractor'
import {
  useRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
  useReorderRules,
} from '@/app/rules/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  initialRules: RuleDoc[]
}

export function RuleList({ initialRules }: Props) {
  const { data: rules } = useRules(initialRules)
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()
  const toggleRule = useToggleRule()
  const reorderRules = useReorderRules()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function move(idx: number, direction: -1 | 1) {
    const newRules = [...rules]
    const target = idx + direction
    if (target < 0 || target >= newRules.length) return
    ;[newRules[idx], newRules[target]] = [newRules[target], newRules[idx]]
    reorderRules.mutate(newRules.map((r) => r.rule_id))
  }

  async function handleCreate(data: RuleInput) {
    await createRule.mutateAsync(data)
    setShowCreate(false)
  }

  async function handleUpdate(ruleId: string, data: RuleInput) {
    await updateRule.mutateAsync({ ruleId, patch: data })
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-2">
      {showCreate && (
        <Card className="mb-2">
          <CardContent>
            <h3 className="text-foreground/80 font-semibold text-sm mb-4">New rule</h3>
            <RuleForm
              isPending={createRule.isPending}
              onSave={handleCreate}
              onCancel={() => setShowCreate(false)}
            />
          </CardContent>
        </Card>
      )}

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-2 border border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-border/80 text-sm transition-colors"
        >
          + New rule
        </button>
      )}

      {rules.map((rule, idx) => {
        const isToggling =
          toggleRule.isPending && toggleRule.variables?.rule.rule_id === rule.rule_id
        const isDeleting =
          deleteRule.isPending && deleteRule.variables === rule.rule_id

        return (
          <div
            key={rule.rule_id}
            className={cn(
              'rounded-xl border transition-colors',
              rule.enabled
                ? 'border-border bg-card/60'
                : 'border-border/50 bg-card/30 opacity-60'
            )}
          >
            {editingId === rule.rule_id ? (
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground text-sm font-mono">{rule.rule_id}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setEditingId(null)}
                  >
                    ✕
                  </Button>
                </div>
                <RuleForm
                  key={rule.rule_id}
                  initial={rule}
                  isPending={updateRule.isPending}
                  onSave={(data) => handleUpdate(rule.rule_id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="shrink-0 w-8 text-right text-muted-foreground/60 text-xs tabular-nums mt-0.5 pt-0.5">
                  {idx + 1}
                </span>

                <span
                  className="shrink-0 size-2 rounded-full mt-1.5"
                  style={{ background: colorFor(rule.category) }}
                  title={labelFor(rule.category)}
                />

                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground/80 text-sm font-medium">{rule.rule_id}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: `${colorFor(rule.category)}22`,
                        color: colorFor(rule.category),
                      }}
                    >
                      {labelFor(rule.category)}
                      {rule.subcategory ? ` / ${rule.subcategory}` : ''}
                    </span>
                    {rule.indicator && (
                      <Badge variant="secondary">{rule.indicator === 'DBIT' ? 'out' : 'in'}</Badge>
                    )}
                    {rule.is_transfer && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                        transfer
                      </Badge>
                    )}
                    {rule.is_roundup && <Badge variant="secondary">roundup</Badge>}
                    {rule.offsets && (
                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                        offsets {rule.offsets}
                      </Badge>
                    )}
                    {!rule.enabled && <Badge variant="destructive">disabled</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rule.counterparty_contains.map((s) => (
                      <Badge key={s} variant="outline" className="font-mono">
                        {s}
                      </Badge>
                    ))}
                    {rule.remittance_contains.map((s) => (
                      <Badge key={`r:${s}`} variant="outline" className="font-mono">
                        rem: {s}
                      </Badge>
                    ))}
                    {rule.btc_contains.map((s) => (
                      <Badge key={`b:${s}`} variant="outline" className="font-mono">
                        btc: {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || reorderRules.isPending}
                    title="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(idx, 1)}
                    disabled={idx === rules.length - 1 || reorderRules.isPending}
                    title="Move down"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggleRule.mutate({ rule, enabled: !rule.enabled })}
                    disabled={isToggling}
                    title={rule.enabled ? 'Disable' : 'Enable'}
                  >
                    {isToggling ? (
                      <span className="inline-block size-3 border border-border border-t-foreground rounded-full animate-spin" />
                    ) : rule.enabled ? (
                      '⏸'
                    ) : (
                      '▶'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setEditingId(rule.rule_id)}
                    className="hover:text-indigo-400"
                    title="Edit"
                  >
                    ✎
                  </Button>
                  {deletingId === rule.rule_id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          deleteRule.mutate(rule.rule_id, {
                            onSuccess: () => setDeletingId(null),
                          })
                        }}
                        disabled={isDeleting}
                        className="text-rose-400 hover:text-rose-300 px-1"
                      >
                        {isDeleting ? '…' : '✓ confirm'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setDeletingId(null)}
                        className="text-muted-foreground px-1"
                      >
                        ✕
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeletingId(rule.rule_id)}
                      className="hover:text-rose-400"
                      title="Delete"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {rules.length === 0 && !showCreate && (
        <div className="text-center py-12 text-muted-foreground/60 text-sm">
          No rules yet. Click &ldquo;New rule&rdquo; above to create one.
        </div>
      )}
    </div>
  )
}
