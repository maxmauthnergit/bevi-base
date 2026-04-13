import { KpiCard } from '@/components/kpi/KpiCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { TrendChart } from '@/components/charts/TrendChart'
import { InventoryAlert } from '@/components/inventory/InventoryAlert'
import { metrics } from '@/lib/metrics-config'
import { mockKpiValues, mockUpcomingCosts } from '@/lib/mock/dashboard'
import { getDashboardKPIs, getInventoryLevels } from '@/lib/shopify/queries'
import { getMetaKPIs } from '@/lib/meta/queries'

function formatEur(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export const revalidate = 300

export default async function DashboardPage() {
  const [shopifyKPIs, stockLevels, metaKPIs] = await Promise.all([
    getDashboardKPIs().catch(() => null),
    getInventoryLevels().catch(() => null),
    getMetaKPIs().catch(() => null),
  ])

  const liveKpis  = { ...(shopifyKPIs?.kpis ?? {}), ...(metaKPIs?.kpis ?? {}) }
  const kpiValues = { ...mockKpiValues, ...liveKpis }
  const lowStockItems = stockLevels?.filter((s) => s.is_low) ?? []

  const dashboardMetricIds = ['revenue_mtd','units_mtd','orders_mtd','aov_gross','ad_spend_mtd','roas_mtd']
  const dashboardMetrics = dashboardMetricIds
    .map((id) => metrics.find((m) => m.id === id))
    .filter(Boolean) as typeof metrics


  return (
    <main style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div className="mb-5">
        <h1 style={{
          fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: '1.75rem', fontWeight: 600, color: '#111110', lineHeight: 1.2, margin: 0,
        }}>
          Overview
        </h1>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="mb-4"><InventoryAlert items={lowStockItems} /></div>
      )}

      {/* KPI grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 14,
      }}>
        {dashboardMetrics.map((metric) => {
          const data = kpiValues[metric.id]
          if (!data) return null
          const isLiveMetric = !!liveKpis[metric.id]
          return (
            <div key={metric.id} style={{ position: 'relative', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #E3E2DC' }}>
              <KpiCard metric={metric} data={data} />
              {!isLiveMetric && (
                <span className="label" style={{
                  position: 'absolute', top: 12, right: 12,
                  color: '#D0CFC8', fontSize: '0.5625rem',
                }}>
                  mock
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Chart + upcoming costs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        <Card>
          <CardHeader label="Performance" />
          <TrendChart />
        </Card>

        <Card>
          <CardHeader label="Upcoming Costs" />
          <div className="flex flex-col gap-3">
            {mockUpcomingCosts.map((cost, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 pb-3"
                style={{ borderBottom: i < mockUpcomingCosts.length - 1 ? '1px solid #F0EFE9' : 'none' }}
              >
                <div className="flex items-center justify-between">
                  <span style={{
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.8125rem', color: '#111110',
                  }}>
                    {cost.label}
                  </span>
                  <span className="metric" style={{ fontSize: '0.8125rem', color: '#DC2626', fontWeight: 500 }}>
                    {formatEur(cost.amount)}
                  </span>
                </div>
                <span className="label">{formatDate(cost.due)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="label">Total</span>
              <span className="metric" style={{ fontSize: '0.875rem', color: '#111110', fontWeight: 600 }}>
                {formatEur(mockUpcomingCosts.reduce((s, c) => s + c.amount, 0))}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
