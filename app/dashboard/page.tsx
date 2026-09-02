import { KpiSection } from '@/components/kpi/KpiSection'
import { Card, CardHeader } from '@/components/ui/Card'
import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { TrendChart } from '@/components/charts/TrendChart'
import { InventoryAlert } from '@/components/inventory/InventoryAlert'
import { getInventoryLevels, getAvgDailySalesBySku } from '@/lib/shopify/queries'
import { isLowStock, effectiveUnits, daysOfCover, stockLastsUntil } from '@/lib/inventory'
import { getWeShipStock } from '@/lib/weship/queries'


export const revalidate = 300

export default async function DashboardPage() {
  const [stockLevels, weshipStock, avgDailySales] = await Promise.all([
    getInventoryLevels().catch(() => null),
    getWeShipStock().catch(() => null),
    getAvgDailySalesBySku().catch(() => null),
  ])

  const lowStockItems = (stockLevels ?? [])
    .map((item) => {
      const ws        = weshipStock?.find((w) => w.sku === item.sku)
      const units     = effectiveUnits(ws, item.units)
      const avgSales  = avgDailySales?.[item.sku] ?? 0
      const daysLeft  = daysOfCover(units, avgSales)
      const lastUntil = stockLastsUntil(units, avgSales)
      return { ...item, effectiveUnits: units, daysLeft, lastUntil }
    })
    // Coverage is the only criterion — the absolute reorder_threshold is
    // ignored on purpose (see lib/inventory.ts).
    .filter((item) => isLowStock(item.daysLeft))

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
