import { Sidebar } from '@/components/nav/Sidebar'
import { DateRangeProvider } from '@/components/providers/DateRangeProvider'
import { DashboardDateBar } from '@/components/ui/DashboardDateBar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full" style={{ backgroundColor: '#F5F4F0' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">

        {/* Top bar — 80px, badge top aligns with logo top (paddingTop 32px matches sidebar) */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: 80,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '32px 40px 0',
            backgroundColor: '#F5F4F0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Name + role — right-aligned text, left of avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'right' }}>
              <span
                style={{
                  fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#111110',
                  lineHeight: 1,
                }}
              >
                Max Mauthner
              </span>
              <span
                className="label"
                style={{ color: '#9E9D98', fontSize: '0.625rem', lineHeight: 1 }}
              >
                Co-Founder
              </span>
            </div>
            {/* Avatar bubble — rightmost, aligned with page right edge */}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                backgroundColor: '#E3E2DC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: '#6B6A64',
                  letterSpacing: '0.02em',
                }}
              >
                MM
              </span>
            </div>
          </div>
        </div>

        <DateRangeProvider>
          <DashboardDateBar />
          {children}
        </DateRangeProvider>
      </div>
    </div>
  )
}
