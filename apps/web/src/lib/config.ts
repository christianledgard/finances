/** Shared app config from environment variables (safe for client + server). */

export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME ?? process.env.APP_NAME ?? 'Finances'

export const SALARY_CAP =
  Number(process.env.NEXT_PUBLIC_SALARY_CAP) || 5000

export const SAVINGS_TARGET = SALARY_CAP * 0.2
