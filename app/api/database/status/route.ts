import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { FREE_PLAN_PAUSE_DAYS } from '@/lib/database-status'

export const dynamic = 'force-dynamic'

/**
 * Liveness probe for the Supabase project.
 *
 * A paused project does not refuse connections — it stalls — so the request is
 * raced against a timeout. Without it this route would hang the same way the
 * auth gate used to (see proxy.ts).
 */
const PROBE_TIMEOUT_MS = 5_000

export async function GET() {
  const startedAt = Date.now()

  try {
    const supabase = createServerClient()

    const probe = supabase
      .from('bank_transactions')
      .select('id', { count: 'exact', head: true })

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS),
    )

    const { error, count } = await Promise.race([probe, timeout])
    const latencyMs = Date.now() - startedAt

    if (error) {
      return NextResponse.json({
        connected: false,
        latency_ms: latencyMs,
        error: error.message,
        checked_at: new Date().toISOString(),
        pause_after_days: FREE_PLAN_PAUSE_DAYS,
      })
    }

    return NextResponse.json({
      connected: true,
      latency_ms: latencyMs,
      row_count: count ?? null,
      // This very query counts as project activity, so the pause window
      // restarts from now.
      checked_at: new Date().toISOString(),
      pause_after_days: FREE_PLAN_PAUSE_DAYS,
    })
  } catch (e) {
    const latencyMs = Date.now() - startedAt
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({
      connected: false,
      latency_ms: latencyMs,
      error: msg === 'timeout'
        ? `No response within ${PROBE_TIMEOUT_MS / 1000}s — the project may be paused`
        : msg,
      checked_at: new Date().toISOString(),
      pause_after_days: FREE_PLAN_PAUSE_DAYS,
    })
  }
}
