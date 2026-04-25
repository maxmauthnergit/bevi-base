import { Sidebar } from '@/components/nav/Sidebar'
import { BottomNav } from '@/components/nav/BottomNav'
import { DateRangeProvider } from '@/components/providers/DateRangeProvider'
import { createSupabaseServer } from '@/lib/supabase/server'
import { TopBarUser } from '@/components/nav/TopBarUser'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

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

      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto pb-16 lg:pb-0">
        {/* Top bar — desktop only */}
        <div
          className="hidden lg:flex"
          style={{
            position: 'sticky', top: 0, zIndex: 10,
            height: 80, flexShrink: 0,
            alignItems: 'flex-start', justifyContent: 'flex-end',
            padding: '32px 40px 0',
            backgroundColor: '#F5F4F0',
          }}
        >
          <TopBarUser displayName={displayName} initials={initials} avatarUrl={avatarUrl} />
        </div>

        <DateRangeProvider>
          {children}
        </DateRangeProvider>
      </div>

      {/* Bottom nav — mobile + tablet only */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
