import 'server-only'

/**
 * Hardcoded authorization gate.
 *
 * Access is DENIED by default: a session alone is not enough. The user's role
 * (a Better Auth field that defaults to "user" and cannot be set via the API)
 * must exactly equal AUTHORIZED_ROLE. Granting access is a deliberate, manual
 * action — flip the role in MongoDB:
 *
 *   db.user.updateOne({ email: 'you@example.com' }, { $set: { role: 'admin' } })
 */
export const AUTHORIZED_ROLE = 'admin'

export function isAuthorized(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === AUTHORIZED_ROLE
}
