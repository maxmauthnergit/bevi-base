import { KpiSection } from '@/components/kpi/KpiSection'
import { Card, CardHeader } from '@/components/ui/Card'
import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { TrendChart } from '@/components/charts/TrendChart'
import { InventoryAlert } from '@/components/inventory/InventoryAlert'
import { getInventoryLevels, getAvgDailySalesBySku } from '@/lib/shopify/queries'
import { getWeShipStock } from '@/lib/weship/queries'


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
    .filter((item) =>
      item.effectiveUnits < item.reorder_threshold ||
      (item.daysLeft !== null && item.daysLeft < 60)
    )

  return (
    <main className="px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8">
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

      {/* Performance chart — full width, reacts to date range */}
      <Card>
        <CardHeader label="Performance" />
        <TrendChart />
      </Card>
    </main>
  )
}
