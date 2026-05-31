'use client'

import type { ComponentProps } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

type ButtonProps = ComponentProps<typeof Button>

export function SignOutButton({
  variant = 'ghost',
  size = 'sm',
  className,
  children = 'Sign out',
}: {
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={async () => {
        await authClient.signOut()
        window.location.href = '/login'
      }}
    >
      {children}
    </Button>
  )
}
