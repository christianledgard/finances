// Poison-pill: importing this into any client bundle is a build error, so the
// M2M API key below can never be shipped to the browser.
import 'server-only'
import type { MonthData } from '@/components/MonthlyChart'
import type { CategoryRow } from '@/components/CategoryBreakdown'
import type { SubscriptionsData } from '@/components/RecurringTable'

const EXTRACTOR_URL = process.env.EXTRACTOR_URL ?? 'http://localhost:8000'
const EXTRACTOR_API_KEY = process.env.EXTRACTOR_API_KEY ?? ''

const headers = { 'X-API-Key': EXTRACTOR_API_KEY }
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${EXTRACTOR_URL}${path}`, {
    headers,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Extractor ${path} responded with ${res.status}`)
  return res.json() as Promise<T>
}

async function mutator<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${EXTRACTOR_URL}${path}`, {
    method,
    headers: jsonHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => String(res.status))
    throw new Error(`Extractor ${method} ${path} → ${res.status}: ${detail}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface TransactionDetail {
  transaction_id: string
  date: string
  amount: number
  direction: 'in' | 'out'
  category: string
  counterparty: string | null
  is_transfer: boolean
  is_recurring: boolean
  description: string | null
}

/** Monthly income/expense aggregates (cleaned: transfers excluded, housing netted). */
export async function getMonthlySummary(): Promise<MonthData[]> {
  const data = await fetcher<{ months: MonthData[] }>('/transactions/monthly')
  return data.months
}

/** Per-category breakdown, optionally filtered to a YYYY-MM month. */
export async function getCategoryBreakdown(month?: string): Promise<CategoryRow[]> {
  const qs = month ? `?month=${month}` : ''
  const data = await fetcher<{ categories: CategoryRow[] }>(`/transactions/categories${qs}`)
  return data.categories
}

/** Recurring subscriptions table. */
export async function getSubscriptionsData(): Promise<SubscriptionsData> {
  return fetcher<SubscriptionsData>('/subscriptions')
}

/** All transactions with enrichment, sorted by amount desc, for the detail view. month=YYYY-MM is required. */
export async function getTransactionDetail(month: string): Promise<TransactionDetail[]> {
  const data = await fetcher<{ transactions: TransactionDetail[] }>(`/transactions/detail?month=${month}`)
  return data.transactions
}

export interface SavingsFlowMonth {
  month: string
  money_in: number
  money_out: number
  net: number
}

/** Monthly money-in / money-out for the Oranje Spaarrekening (from transfer transactions). */
export async function getSavingsFlow(): Promise<SavingsFlowMonth[]> {
  const data = await fetcher<{ trend: { month: string; deposits: number; withdrawals: number; net_saved: number }[] }>('/savings')
  return data.trend.map((m) => ({
    month: m.month,
    money_in: m.deposits,
    money_out: m.withdrawals,
    net: m.net_saved,
  }))
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export interface RuleDoc {
  rule_id: string
  order: number
  enabled: boolean
  category: string
  subcategory: string | null
  is_transfer: boolean
  is_roundup: boolean
  offsets: string | null
  counterparty_contains: string[]
  remittance_contains: string[]
  btc_contains: string[]
  indicator: 'CRDT' | 'DBIT' | null
  created_at: string | null
  updated_at: string | null
}

export interface RuleInput {
  rule_id?: string
  category?: string
  subcategory?: string | null
  is_transfer?: boolean
  is_roundup?: boolean
  offsets?: string | null
  counterparty_contains?: string[]
  remittance_contains?: string[]
  btc_contains?: string[]
  indicator?: 'CRDT' | 'DBIT' | null
  enabled?: boolean
  order?: number | null
}

export interface UncategorizedRow {
  counterparty: string | null
  total: number
  count: number
  months: string[]
  sample_remittance: string | null
}

export async function getRules(): Promise<RuleDoc[]> {
  const data = await fetcher<{ rules: RuleDoc[] }>('/rules')
  return data.rules
}

export async function getUncategorized(): Promise<UncategorizedRow[]> {
  const data = await fetcher<{ items: UncategorizedRow[] }>('/transactions/uncategorized')
  return data.items
}

export async function createRule(body: RuleInput): Promise<RuleDoc> {
  const data = await mutator<{ rule: RuleDoc }>('/rules', 'POST', body)
  return data.rule
}

export async function updateRule(ruleId: string, patch: RuleInput): Promise<RuleDoc> {
  const data = await mutator<{ rule: RuleDoc }>(`/rules/${ruleId}`, 'PUT', patch)
  return data.rule
}

export async function deleteRule(ruleId: string): Promise<void> {
  await mutator<void>(`/rules/${ruleId}`, 'DELETE')
}

export async function reorderRules(orderedRuleIds: string[]): Promise<void> {
  await mutator<void>('/rules/reorder', 'POST', { ordered_rule_ids: orderedRuleIds })
}

export async function runEnrich(): Promise<{ processed: number; enriched: number }> {
  return mutator<{ processed: number; enriched: number }>('/enrich', 'POST')
}
