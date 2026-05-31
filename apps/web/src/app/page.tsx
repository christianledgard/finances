import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAuthorized } from '@/lib/authz'
import {
  getCategoryBreakdown,
  getMonthlySummary,
  getSavingsFlow,
  getSubscriptionsData,
} from '@/lib/extractor'
import { MonthlyChart } from '@/components/MonthlyChart'
import { CategoryBreakdown } from '@/components/CategoryBreakdown'
import { RecurringTable } from '@/components/RecurringTable'
import { SavingsFlow } from '@/components/SavingsFlow'
import { AppNav } from '@/components/AppNav'
import { SignOutButton } from '@/components/SignOutButton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default async function Dashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const { user } = session

  if (!isAuthorized(user)) return <AccessDenied email={user.email} />

  const [months, categories, subscriptions, savingsFlow] = await Promise.all([
    getMonthlySummary(),
    getCategoryBreakdown(),
    getSubscriptionsData(),
    getSavingsFlow(),
  ])

  const hasData = months.length > 0

  return (
    <div className="min-h-screen bg-background">
      <AppNav user={user} />

      {/* Page header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {months.length} month{months.length !== 1 ? 's' : ''} of transaction data
        </p>
      </div>

      <Separator />

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            <MonthlyChart data={months} />

            {categories.length > 0 && (
              <CategoryBreakdown data={categories} />
            )}

            {savingsFlow.length > 0 && (
              <SavingsFlow data={savingsFlow} />
            )}

            {subscriptions.items.length > 0 && (
              <RecurringTable data={subscriptions} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function AccessDenied({ email }: { email: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-destructive/10 border border-destructive/20 mb-2 mx-auto">
            <svg
              className="size-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            {email} isn&apos;t authorized to view this data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-20">
        <p className="font-medium text-foreground">No transaction data yet</p>
        <p className="text-muted-foreground text-sm text-center max-w-xs">
          Run a sync from the extractor to pull your bank transactions.
        </p>
      </CardContent>
    </Card>
  )
}
