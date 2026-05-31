import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { isAuthorized } from '@/lib/authz'
import { getRules, getUncategorized } from '@/lib/extractor'
import { QueryProvider } from '@/components/QueryProvider'
import { RulesAdmin } from '@/components/RulesAdmin'
import { AppNav } from '@/components/AppNav'
import { SignOutButton } from '@/components/SignOutButton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

function AccessDenied({ email }: { email: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            {email} isn&apos;t authorized to view this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function RulesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const { user } = session
  if (!isAuthorized(user)) return <AccessDenied email={user.email} />

  const [rules, uncategorized] = await Promise.all([getRules(), getUncategorized()])

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
            <span className="font-medium">Rules</span>
          </div>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Enrichment Rules</h1>
        <p className="text-muted-foreground text-sm mt-1">
          First-match-wins — order matters.
        </p>
      </div>

      <Separator />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <QueryProvider>
          <RulesAdmin initialRules={rules} initialUncategorized={uncategorized} />
        </QueryProvider>
      </main>
    </div>
  )
}
