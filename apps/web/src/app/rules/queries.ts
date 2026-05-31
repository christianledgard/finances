'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { RuleDoc, RuleInput, UncategorizedRow } from '@/lib/extractor'
import {
  listRulesAction,
  listUncategorizedAction,
  createRuleAction,
  updateRuleAction,
  deleteRuleAction,
  reorderRulesAction,
  enrichAllAction,
} from './actions'

export const RULES_KEY = ['rules'] as const
export const UNCATEGORIZED_KEY = ['uncategorized'] as const

export function useRules(initialData: RuleDoc[]) {
  return useQuery({
    queryKey: RULES_KEY,
    queryFn: () => listRulesAction(),
    initialData,
  })
}

export function useUncategorized(initialData: UncategorizedRow[]) {
  return useQuery({
    queryKey: UNCATEGORIZED_KEY,
    queryFn: () => listUncategorizedAction(),
    initialData,
  })
}

export function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RuleInput) => createRuleAction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY })
      qc.invalidateQueries({ queryKey: UNCATEGORIZED_KEY })
    },
  })
}

export function useUpdateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ruleId, patch }: { ruleId: string; patch: RuleInput }) =>
      updateRuleAction(ruleId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY })
    },
  })
}

export function useDeleteRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ruleId: string) => deleteRuleAction(ruleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY })
      qc.invalidateQueries({ queryKey: UNCATEGORIZED_KEY })
    },
  })
}

export function useToggleRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rule, enabled }: { rule: RuleDoc; enabled: boolean }) =>
      updateRuleAction(rule.rule_id, { enabled }),
    onMutate: async ({ rule, enabled }) => {
      await qc.cancelQueries({ queryKey: RULES_KEY })
      const previous = qc.getQueryData<RuleDoc[]>(RULES_KEY)
      qc.setQueryData<RuleDoc[]>(RULES_KEY, (old) =>
        old?.map((r) => (r.rule_id === rule.rule_id ? { ...r, enabled } : r)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(RULES_KEY, ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY })
    },
  })
}

export function useReorderRules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderRulesAction(orderedIds),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: RULES_KEY })
      const previous = qc.getQueryData<RuleDoc[]>(RULES_KEY)
      qc.setQueryData<RuleDoc[]>(RULES_KEY, (old) => {
        if (!old) return old
        const map = new Map(old.map((r) => [r.rule_id, r]))
        return orderedIds.flatMap((id) => (map.has(id) ? [map.get(id)!] : []))
      })
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(RULES_KEY, ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: RULES_KEY })
    },
  })
}

export function useEnrichAll() {
  return useMutation({
    mutationFn: () => enrichAllAction(),
  })
}
