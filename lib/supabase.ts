import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Browser client — lazy singleton, only initialized when first accessed
let _browser: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_browser) {
    _browser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _browser
}

// Proxy so existing `supabase.from(...)` call sites keep working unchanged
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    return (getSupabase() as any)[prop]
  },
})

// Server client factory — creates a fresh client per call using the service role
// key (bypasses RLS). Falls back to the anon key if the service key is absent.
export function createServerClient(): SupabaseClient {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return createClient(url, anonKey)
}
