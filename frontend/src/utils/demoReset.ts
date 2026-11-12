import type { DemoResetResponse } from '../types'

export interface DemoResetExecutionParams {
  isConfirmed: boolean
  guard: { current: boolean }
  resetFn: () => Promise<DemoResetResponse>
  onAfterSuccess: (response: DemoResetResponse) => Promise<void> | void
}

export type DemoResetOutcome =
  | { status: 'ignored_unconfirmed' }
  | { status: 'ignored_duplicate' }
  | { status: 'success'; response: DemoResetResponse }
  | { status: 'error'; message: string }

/**
 * Execute a guarded demo reset only after explicit confirmation and while no
 * prior reset request is currently in flight.
 */
export async function executeGuardedDemoReset({
  isConfirmed,
  guard,
  resetFn,
  onAfterSuccess,
}: DemoResetExecutionParams): Promise<DemoResetOutcome> {
  if (!isConfirmed) {
    return { status: 'ignored_unconfirmed' }
  }
  if (guard.current) {
    return { status: 'ignored_duplicate' }
  }

  guard.current = true
  try {
    const response = await resetFn()
    await onAfterSuccess(response)
    return { status: 'success', response }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to reset demo data. Please try again.'
    return { status: 'error', message }
  } finally {
    guard.current = false
  }
}

