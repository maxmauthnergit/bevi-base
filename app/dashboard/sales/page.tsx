import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { SalesKpiSection } from '@/components/kpi/SalesKpiSection'
import { SalesMonthlyCharts } from '@/components/charts/SalesMonthlyCharts'
import { SalesBreakdownSection } from '@/components/charts/SalesBreakdownSection'
import { SalesPeakTimes } from '@/components/charts/SalesPeakTimes'

export default function SalesPage() {
  return (
    <main className="px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8">
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

      {/* Date-independent: monthly overview */}
      <div style={{ marginBottom: 16 }}>
        <SalesMonthlyCharts />
      </div>

      <DateRangeBar />

      <SalesKpiSection />

      {/* Date-dependent: breakdown by product, bundle, market */}
      <SalesBreakdownSection />

      {/* Date-dependent: peak order times */}
      <div style={{ marginTop: 16 }}>
        <SalesPeakTimes />
      </div>
    </main>
  )
}
