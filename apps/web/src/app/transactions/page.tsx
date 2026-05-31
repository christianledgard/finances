import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { isAuthorized } from '@/lib/authz'
import { getTransactionDetail } from '@/lib/extractor'
import { AppNav } from '@/components/AppNav'
import { Button } from '@/components/ui/button'
import { TransactionsView } from './TransactionsView'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; month?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const { user } = session
  if (!isAuthorized(user)) {
    redirect('/')
  }

  const { category: initialCategory, month: filterMonth } = await searchParams

  if (!filterMonth) {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const params = new URLSearchParams({ month: currentMonth })
    if (initialCategory) params.set('category', initialCategory)
    redirect(`/transactions?${params}`)
  }

  const allTransactions = await getTransactionDetail(filterMonth)

  return (
    <div className="min-h-screen bg-background">
      <AppNav
        user={user}
        breadcrumb={
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/" />}
              className="text-muted-foreground"
            >
              Dashboard
            </Button>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-medium">Transactions</span>
          </div>
        }
      />

      <TransactionsView
        transactions={allTransactions}
        month={filterMonth}
        initialCategory={initialCategory}
      />
    </div>
  )
}
