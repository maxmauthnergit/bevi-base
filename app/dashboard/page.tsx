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
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

export const revalidate = 300 // revalidate page every 5 minutes

export default async function DashboardPage() {
  // ── Fetch live data from all sources in parallel ──────────────────────────
  const [shopifyKPIs, stockLevels, metaKPIs] = await Promise.all([
    getDashboardKPIs().catch(() => null),
    getInventoryLevels().catch(() => null),
    getMetaKPIs().catch(() => null),
  ])

  // Merge live KPIs — Shopify + Meta override mocks where available
  const liveKpis = {
    ...(shopifyKPIs?.kpis ?? {}),
    ...(metaKPIs?.kpis   ?? {}),
  }
  const kpiValues = { ...mockKpiValues, ...liveKpis }

  const lowStockItems = stockLevels
    ? stockLevels.filter((s) => s.is_low)
    : []

  const dashboardMetricIds = [
    'revenue_mtd',
    'units_mtd',
    'orders_mtd',
    'aov_gross',
    'ad_spend_mtd',
    'roas_mtd',
  ]

  const dashboardMetrics = dashboardMetricIds
    .map((id) => metrics.find((m) => m.id === id))
    .filter(Boolean) as typeof metrics

  const monthLabel = shopifyKPIs?.month_label ?? new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const isLive      = !!shopifyKPIs
  const isMetaLive  = !!metaKPIs

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

        {/* Live / mock indicator */}
        <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isLive ? '#7DEFEF' : '#888',
              display: 'inline-block',
            }}
          />
          <span className="label" style={{ color: isLive ? '#7DEFEF' : '#888' }}>
            {isLive && isMetaLive ? 'Live · Shopify + Meta' : isLive ? 'Live · Shopify' : 'Mock Data'}
          </span>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="mb-6">
          <InventoryAlert items={lowStockItems} />
        </div>
      )}

      {/* KPI grid */}
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
          const data = kpiValues[metric.id]
          if (!data) return null
          const isLiveMetric = !!liveKpis[metric.id]
          return (
            <div key={metric.id} style={{ position: 'relative' }}>
              <KpiCard metric={metric} data={data} />
              {!isLiveMetric && (
                <span
                  className="label"
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    color: '#333',
                    fontSize: '0.5625rem',
                  }}
                >
                  mock
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Chart + upcoming costs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <Card>
          <CardHeader
            label="Performance"
            action={
              <span className="label" style={{ color: '#333' }}>
                {isLive && isMetaLive ? 'Shopify + Meta · live' : isLive ? 'Shopify · Meta pending' : 'mock data'}
              </span>
            }
          />
          <TrendChart />
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
            <div className="flex items-center justify-between pt-1">
              <span className="label" style={{ color: '#555' }}>Total</span>
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
