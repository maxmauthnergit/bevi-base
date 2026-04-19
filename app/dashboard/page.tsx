import { KpiSection } from '@/components/kpi/KpiSection'
import { Card, CardHeader } from '@/components/ui/Card'
import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { TrendChart } from '@/components/charts/TrendChart'
import { InventoryAlert } from '@/components/inventory/InventoryAlert'
import { mockUpcomingCosts } from '@/lib/mock/dashboard'
import { getInventoryLevels, getAvgDailySalesBySku } from '@/lib/shopify/queries'
import { getWeShipStock } from '@/lib/weship/queries'

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
  const [stockLevels, weshipStock, avgDailySales] = await Promise.all([
    getInventoryLevels().catch(() => null),
    getWeShipStock().catch(() => null),
    getAvgDailySalesBySku().catch(() => null),
  ])

  const lowStockItems = (stockLevels ?? [])
    .filter((s) => s.is_low)
    .map((item) => {
      const ws             = weshipStock?.find((w) => w.sku === item.sku)
      const effectiveUnits = ws?.on_stock ?? item.units
      const avgSales       = avgDailySales?.[item.sku] ?? 0
      const daysLeft       = avgSales > 0 ? Math.floor(effectiveUnits / avgSales) : null
      const lastUntil      = daysLeft !== null ? new Date(Date.now() + daysLeft * 86_400_000) : null
      return { ...item, effectiveUnits, daysLeft, lastUntil }
    })

  return (
    <main style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: '1.75rem', fontWeight: 600, color: '#111110', lineHeight: 1.2, margin: 0,
        }}>
          Overview
        </h1>
      </div>

      {/* Low stock alert — always first */}
      {lowStockItems.length > 0 && (
        <div style={{ marginBottom: 16 }}><InventoryAlert items={lowStockItems} /></div>
      )}

      <DateRangeBar />

      {/* KPI grid — client component, reacts to date range */}
      <KpiSection />

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
