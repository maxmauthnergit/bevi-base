import { getInventoryLevels, getAvgDailySalesBySku } from '@/lib/shopify/queries'
import { getWeShipStock } from '@/lib/weship/queries'
import { isLowStock, effectiveUnits, daysOfCover, stockLastsUntil } from '@/lib/inventory'
import type { StockLevel } from '@/lib/types'

export interface LowStockItem extends StockLevel {
  effectiveUnits: number
  daysLeft: number | null
  lastUntil: Date | null
}

/**
 * SKUs whose coverage runs out inside the warning window, most urgent first.
 * Coverage is the only criterion — the absolute reorder_threshold is ignored
 * on purpose (see lib/inventory.ts), and the stock and forecast helpers there
 * are shared with the overview and inventory pages.
 *
 * Lives outside lib/inventory.ts so that the rule module stays free of server
 * imports and can be pulled into client components.
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {
  const [stockLevels, weshipStock, avgDailySales] = await Promise.all([
    getInventoryLevels().catch(() => null),
    getWeShipStock().catch(() => null),
    getAvgDailySalesBySku().catch(() => null),
  ])

  return (stockLevels ?? [])
    .map((item) => {
      const ws        = weshipStock?.find((w) => w.sku === item.sku)
      const units     = effectiveUnits(ws, item.units)
      const avgSales  = avgDailySales?.[item.sku] ?? 0
      const daysLeft  = daysOfCover(units, avgSales)
      const lastUntil = stockLastsUntil(units, avgSales)
      return { ...item, effectiveUnits: units, daysLeft, lastUntil }
    })
    .filter((item) => isLowStock(item.daysLeft))
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
}
