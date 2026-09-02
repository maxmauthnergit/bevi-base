import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { MarketingKpiSection } from '@/components/kpi/MarketingKpiSection'
import { MarketingMonthlySection } from '@/components/charts/MarketingMonthlySection'

export default function MarketingPage() {
  return (
    <main className="px-4 pt-16 pb-5 md:px-6 md:pt-20 md:pb-6 lg:px-10 lg:pt-28 lg:pb-8">
      <div className="mb-4">
        <h1
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.75rem',
            fontWeight: 600,
            color: '#111110',
            margin: 0,
          }}
        >
          Marketing
        </h1>
      </div>

      {/* Date-independent: monthly spend/revenue overview */}
      <div style={{ marginBottom: 16 }}>
        <MarketingMonthlySection />
      </div>

      <DateRangeBar />

      {/* Date-dependent: KPI cards */}
      <MarketingKpiSection />
    </main>
  )
}
