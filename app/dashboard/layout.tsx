import { Sidebar } from '@/components/nav/Sidebar'
import { BottomNav } from '@/components/nav/BottomNav'
import { DateRangeProvider } from '@/components/providers/DateRangeProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right' }}>
              <span
                style={{
                  fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontSize: '0.8125rem', fontWeight: 500, color: '#111110', lineHeight: 1,
                }}
              >
                Max Mauthner
              </span>
              <span className="label" style={{ color: '#9E9D98', fontSize: '0.625rem', lineHeight: 1 }}>
                Co-Founder
              </span>
            </div>
            <div
              style={{
                width: 30, height: 30, borderRadius: '50%',
                backgroundColor: '#E3E2DC',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontSize: '0.625rem', fontWeight: 600, color: '#6B6A64', letterSpacing: '0.02em',
                }}
              >
                MM
              </span>
            </div>
          </div>
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
