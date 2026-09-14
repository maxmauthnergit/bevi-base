import { KpiSection } from '@/components/kpi/KpiSection'
import { Card, CardHeader } from '@/components/ui/Card'
import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { TrendChart } from '@/components/charts/TrendChart'

export const revalidate = 300

export default function DashboardPage() {
  return (
    <main className="px-4 pt-16 pb-5 md:px-6 md:pt-20 md:pb-6 lg:px-10 lg:pt-28 lg:pb-8">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: '1.75rem', fontWeight: 600, color: '#111110', lineHeight: 1.2, margin: 0,
        }}>
          Overview
        </h1>
      </div>

      <DateRangeBar />

      {/* KPI grid — client component, reacts to date range */}
      <KpiSection />

      {/* Performance chart — full width, reacts to date range */}
      <Card>
        <CardHeader label="Performance" />
        <TrendChart />
      </Card>
    </main>
  )
}
