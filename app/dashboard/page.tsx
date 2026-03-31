import { KpiCard } from '@/components/kpi/KpiCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { TrendChart } from '@/components/charts/TrendChart'
import { InventoryAlert } from '@/components/inventory/InventoryAlert'
import { metrics } from '@/lib/metrics-config'
import { mockKpiValues, mockTrendData, mockUpcomingCosts } from '@/lib/mock/dashboard'
import { mockLowStockItems } from '@/lib/mock/inventory'

function formatEur(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

export default function DashboardPage() {
  // Pick the 6 dashboard KPI metrics
  const dashboardMetricIds = [
    'revenue_mtd',
    'units_mtd',
    'ad_spend_mtd',
    'roas_mtd',
    'contribution_margin_mtd',
    'liquid_position',
  ]
  const dashboardMetrics = dashboardMetricIds
    .map((id) => metrics.find((m) => m.id === id))
    .filter(Boolean) as typeof metrics

  // Current date label
  const today = new Date('2026-03-30')
  const monthLabel = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <main style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="label" style={{ display: 'block', marginBottom: 8 }}>
            Dashboard
          </span>
          <h1
            style={{
              fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize: '1.5rem',
              fontWeight: 500,
              color: '#FFFFFF',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Bevi Base
          </h1>
          <p
            style={{
              fontSize: '0.8125rem',
              color: '#555',
              marginTop: 4,
              fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            {monthLabel} · all data provisional
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#7DEFEF',
              display: 'inline-block',
            }}
          />
          <span className="label" style={{ color: '#7DEFEF' }}>
            Mock Data
          </span>
        </div>
      </div>

      {/* Low stock alert — shown if any priority SKUs are low */}
      {mockLowStockItems.length > 0 && (
        <div className="mb-6">
          <InventoryAlert items={mockLowStockItems} />
        </div>
      )}

      {/* KPI grid — 3 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px',
          backgroundColor: '#222222',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        {dashboardMetrics.map((metric) => {
          const data = mockKpiValues[metric.id]
          if (!data) return null
          return (
            <KpiCard
              key={metric.id}
              metric={metric}
              data={data}
            />
          )
        })}
      </div>

      {/* Main content: chart + upcoming costs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Revenue vs Ad Spend — last 30 days */}
        <Card>
          <CardHeader label="Revenue vs Ad Spend — Last 30 Days" />
          <TrendChart data={mockTrendData} />
        </Card>

        {/* Upcoming costs */}
        <Card>
          <CardHeader label="Upcoming Costs" />
          <div className="flex flex-col gap-3">
            {mockUpcomingCosts.map((cost, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 pb-3"
                style={{
                  borderBottom: i < mockUpcomingCosts.length - 1 ? '1px solid #1C1C1C' : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    style={{
                      fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                      fontSize: '0.8125rem',
                      color: '#CCCCCC',
                    }}
                  >
                    {cost.label}
                  </span>
                  <span
                    className="metric"
                    style={{ fontSize: '0.8125rem', color: '#FF4444', fontWeight: 500 }}
                  >
                    {formatEur(cost.amount)}
                  </span>
                </div>
                <span className="label" style={{ color: '#333' }}>
                  {formatDate(cost.due)}
                </span>
              </div>
            ))}

            {/* Total */}
            <div className="flex items-center justify-between pt-1">
              <span className="label" style={{ color: '#555' }}>
                Total
              </span>
              <span className="metric" style={{ fontSize: '0.875rem', color: '#FFFFFF', fontWeight: 600 }}>
                {formatEur(mockUpcomingCosts.reduce((s, c) => s + c.amount, 0))}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
