import { NextResponse } from 'next/server'
import { getInventoryLevels, getAvgDailySalesBySku } from '@/lib/shopify/queries'
import { getWeShipStock } from '@/lib/weship/queries'
import { effectiveUnits, daysOfCover } from '@/lib/inventory'
import { productIdForSku } from '@/lib/inbounds'

export const dynamic = 'force-dynamic'

export interface InventoryRow {
  sku:           string
  product_id:    string | null   // inbound product this SKU belongs to, if any
  product_name:  string
  variant:       string
  color?:        string
  units_weship:  number | null
  units_shopify: number
  units:         number          // the figure the forecast runs on
  avg_daily_sales: number
  days_left:     number | null
}

/**
 * Stock and recent sales rate as JSON. The overview and inventory pages are
 * server components and call the lib functions directly; the inbound calculator
 * is a client component and needs this route.
 *
 * Sources can fail independently (Shopify up, WeShip down), so each is caught on
 * its own and the response says which ones answered instead of failing whole.
 */
export async function GET() {
  const [levels, weship, avgSales] = await Promise.all([
    getInventoryLevels().catch(() => null),
    getWeShipStock().catch(() => null),
    getAvgDailySalesBySku().catch(() => null),
  ])

  if (!levels) {
    return NextResponse.json({ error: 'Could not load stock levels from Shopify' }, { status: 502 })
  }

  const rows: InventoryRow[] = levels.map(item => {
    const ws    = weship?.find(w => w.sku === item.sku) ?? null
    const units = effectiveUnits(ws, item.units)
    const rate  = avgSales?.[item.sku] ?? 0

    return {
      sku:             item.sku,
      product_id:      productIdForSku(item.sku),
      product_name:    item.product_name,
      variant:         item.variant,
      color:           item.color,
      units_weship:    ws != null ? ws.on_stock - ws.outgoing : null,
      units_shopify:   item.units,
      units,
      avg_daily_sales: rate,
      days_left:       daysOfCover(units, rate),
    }
  })

  return NextResponse.json({
    rows,
    // The rate comes from a fixed 30-day window and only counts line items that
    // carry a SKU — bags sold inside a bundle are not attributed to them, so it
    // reads low. Surfaced so the caller can say so rather than implying the
    // number is complete.
    salesWindowDays: 30,
    sources: { shopify: true, weship: weship != null, sales: avgSales != null },
  })
}
