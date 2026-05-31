'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { isAuthorized } from '@/lib/authz'
import {
  getRules,
  getUncategorized,
  createRule,
  updateRule,
  deleteRule,
  reorderRules,
  runEnrich,
  type RuleInput,
  type RuleDoc,
  type UncategorizedRow,
} from '@/lib/extractor'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || !isAuthorized(session.user)) {
    throw new Error('Unauthorized')
  }
}

// Read actions (for TanStack Query's queryFn)
export async function listRulesAction(): Promise<RuleDoc[]> {
  await requireAdmin()
  return getRules()
}

export async function listUncategorizedAction(): Promise<UncategorizedRow[]> {
  await requireAdmin()
  return getUncategorized()
}

// Mutation actions (Query handles cache; only revalidate external pages on enrich)
export async function createRuleAction(input: RuleInput): Promise<RuleDoc> {
  await requireAdmin()
  return createRule(input)
}

export async function updateRuleAction(ruleId: string, patch: RuleInput): Promise<RuleDoc> {
  await requireAdmin()
  return updateRule(ruleId, patch)
}

export async function deleteRuleAction(ruleId: string): Promise<void> {
  await requireAdmin()
  await deleteRule(ruleId)
}

export async function reorderRulesAction(orderedIds: string[]): Promise<void> {
  await requireAdmin()
  await reorderRules(orderedIds)
}

export async function enrichAllAction(): Promise<{ processed: number; enriched: number }> {
  await requireAdmin()
  const result = await runEnrich()
  revalidatePath('/transactions')
  revalidatePath('/')
  return result
}
