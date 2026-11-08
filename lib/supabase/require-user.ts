import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

/**
 * Verifies the session for an API route. proxy.ts only guards /dashboard, so a
 * route handler that reads or writes business data checks for itself.
 * Returns a 401 response to send back, or null when the caller is signed in.
 */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
