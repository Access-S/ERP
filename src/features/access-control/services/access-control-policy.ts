export const SYSTEM_ADMIN_ROLE_KEY = "SYSTEM_ADMIN"

type LastAdministratorCheck = {
  targetIsActive: boolean
  targetHasSystemAdmin: boolean
  targetWillBeActive: boolean
  targetWillHaveSystemAdmin: boolean
  otherActiveAdministratorCount: number
}

/**
 * A recoverable administrator is an ACTIVE user assigned the active
 * SYSTEM_ADMIN role. Keeping this pure makes the safety rule independently
 * testable while the service owns the transaction and database reads.
 */
export function wouldRemoveLastRecoverableAdministrator({
  targetIsActive,
  targetHasSystemAdmin,
  targetWillBeActive,
  targetWillHaveSystemAdmin,
  otherActiveAdministratorCount,
}: LastAdministratorCheck): boolean {
  const targetIsRecoverable = targetIsActive && targetHasSystemAdmin
  const targetWillBeRecoverable = targetWillBeActive && targetWillHaveSystemAdmin

  return (
    targetIsRecoverable &&
    !targetWillBeRecoverable &&
    otherActiveAdministratorCount === 0
  )
}
