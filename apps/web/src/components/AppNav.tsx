import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ThemeToggle'
import { APP_NAME } from '@/lib/config'

interface AppNavProps {
  user: { email: string }
  breadcrumb?: React.ReactNode
}

export function AppNav({ user, breadcrumb }: AppNavProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {breadcrumb ?? (
          <div className="flex items-center gap-3">
            <svg
              className="size-5 text-primary shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
            <span className="font-semibold text-sm">{APP_NAME}</span>
          </div>
        )}

        <nav className="flex items-center gap-1 ml-auto">
          {!breadcrumb && (
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/rules" />}
              nativeButton={false}
              className="hidden sm:inline-flex text-muted-foreground"
            >
              Rules
            </Button>
          )}
          <Separator orientation="vertical" className="h-4 hidden sm:block mx-1" />
          <span className="text-muted-foreground text-xs hidden sm:block px-1 truncate max-w-[180px]">
            {user.email}
          </span>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
