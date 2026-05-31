export const CATEGORY_COLORS: Record<string, string> = {
  transfer: '#3f3f46',
  income: '#34d399',
  taxes: '#dc2626',
  education: '#0ea5e9',
  housing: '#6366f1',
  health: '#f43f5e',
  telecom: '#f59e0b',
  lifestyle: '#8b5cf6',
  groceries: '#10b981',
  transport: '#14b8a6',
  travel: '#06b6d4',
  dining: '#f97316',
  entertainment: '#a855f7',
  tech: '#3b82f6',
  fees: '#78716c',
  shopping: '#ec4899',
  credit_card: '#ef4444',
  uncategorized: '#52525b',
}

export const CATEGORY_LABELS: Record<string, string> = {
  transfer: 'Transfer',
  income: 'Income',
  taxes: 'Taxes',
  education: 'Education',
  housing: 'Housing',
  health: 'Health',
  telecom: 'Telecom',
  lifestyle: 'Lifestyle',
  groceries: 'Groceries',
  transport: 'Transport',
  travel: 'Travel',
  dining: 'Dining',
  entertainment: 'Entertainment',
  tech: 'Tech',
  fees: 'Fees',
  shopping: 'Shopping',
  credit_card: 'Credit Card',
  uncategorized: 'Uncategorized',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS)

export function colorFor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#71717a'
}

export function labelFor(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}
