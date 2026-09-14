import { Sidebar } from '@/components/nav/Sidebar'
import { BottomNav } from '@/components/nav/BottomNav'
import { DateRangeProvider } from '@/components/providers/DateRangeProvider'
import { createSupabaseServer } from '@/lib/supabase/server'
import { UserIsland, SCROLL_CONTAINER_ID } from '@/components/nav/UserIsland'
import { getLowStockItems } from '@/lib/low-stock'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // Authoritative session check. proxy.ts only inspects the cookie, so a
  // stale or forged one reaches this point — reject it here.
  if (!user) redirect('/login')

  // Not awaited: the island streams the alerts in so the inventory calls
  // never block the page from rendering.
  const lowStock = getLowStockItems().catch(() => [])

  const displayName = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email?.split('@')[0]
    ?? 'User'

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url

  return (
    <div className="flex h-full" style={{ backgroundColor: '#F5F4F0' }}>
      {/* Sidebar — desktop only */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <div id={SCROLL_CONTAINER_ID} className="flex flex-col flex-1 min-w-0 overflow-y-auto pb-16 lg:pb-0">
        <DateRangeProvider>
          {children}
        </DateRangeProvider>
      </div>

      {/* Floating island — user + low stock notification, all breakpoints */}
      <UserIsland
        displayName={displayName}
        initials={initials}
        avatarUrl={avatarUrl}
        lowStock={lowStock}
      />

      {/* Bottom nav — mobile + tablet only */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
