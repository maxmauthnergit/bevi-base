/**
 * Days a Supabase free-plan project may sit without activity before it is
 * paused. Any request against the project — including the status probe in
 * app/api/database/status — resets the clock.
 *
 * Verify this against the current terms of your plan before relying on it;
 * Supabase has changed the window in the past, and paid plans do not pause at
 * all. It is a single constant so there is one place to correct.
 */
export const FREE_PLAN_PAUSE_DAYS = 7

export interface DatabaseStatus {
  connected: boolean
  latency_ms: number
  row_count?: number | null
  error?: string
  checked_at: string
  pause_after_days: number
}

/** Date the project would be paused if nothing touches it from `checkedAt` on. */
export function pauseDeadline(checkedAt: string, days: number): Date {
  return new Date(new Date(checkedAt).getTime() + days * 86_400_000)
}
