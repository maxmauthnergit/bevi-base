import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot write cookies — only Server Actions and
            // Route Handlers can. Swallowing this is safe: a refreshed token is
            // persisted by app/auth/callback/route.ts, and the read path still
            // sees the current cookies. Without the guard a token refresh
            // during render throws and takes the whole page down.
          }
        },
      },
    },
  )
}
