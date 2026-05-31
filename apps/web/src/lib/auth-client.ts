import { createAuthClient } from 'better-auth/react'

// Same-origin in the browser, so no baseURL needed.
export const authClient = createAuthClient()
