import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { SalesKpiSection } from '@/components/kpi/SalesKpiSection'
import { SalesSummarySection } from '@/components/kpi/SalesSummarySection'

export default function SalesPage() {
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
          Sales
        </h1>
      </div>

      <DateRangeBar />

      <SalesKpiSection />

      <SalesSummarySection />
    </main>
  )
}
