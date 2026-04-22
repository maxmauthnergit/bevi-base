import { NextResponse } from 'next/server'
import { shopifyFetchAllOrders } from '@/lib/shopify/client'
import { getShopTimezone } from '@/lib/shopify/queries'
import { getMonthlyMetaInsights } from '@/lib/meta/queries'

export const dynamic = 'force-dynamic'

function toFloat(s: string) { return parseFloat(s) || 0 }

export async function GET() {
  const tz = await getShopTimezone()

  const from = new Date('2024-11-01T00:00:00Z')
  const to   = new Date()

  // Fetch Shopify orders and Meta monthly insights in parallel
  const shopifyParams = new URLSearchParams({
    status:         'any',
    created_at_min: from.toISOString(),
    created_at_max: to.toISOString(),
    limit:          '250',
    fields:         'id,created_at,total_price,financial_status,cancelled_at,refunds',
  })

  const [orders, metaRows] = await Promise.all([
    shopifyFetchAllOrders(shopifyParams, { revalidate: 3600 }),
    getMonthlyMetaInsights(),
  ])

  // Aggregate Shopify data by month
  const byMonth = new Map<string, { revenue: number; orders: number }>()

  for (const order of orders) {
    if (order.financial_status === 'voided') continue

    const monthKey = new Date(order.created_at)
      .toLocaleDateString('sv', { timeZone: tz })
      .slice(0, 7)

    if (!byMonth.has(monthKey)) byMonth.set(monthKey, { revenue: 0, orders: 0 })
    const entry = byMonth.get(monthKey)!

    entry.orders++

    if (!order.cancelled_at) {
      const gross     = toFloat(order.total_price)
      const refundAmt = (order.refunds ?? [])
        .flatMap(r => r.transactions ?? [])
        .filter(t => t.kind === 'refund' && t.status === 'success')
        .reduce((s, t) => s + toFloat(t.amount), 0)
      entry.revenue += gross - refundAmt
    }
  }

  // Build Meta map: month key → insights
  const metaByMonth = new Map<string, {
    spend: number; impressions: number; clicks: number; meta_roas: number
  }>()

  for (const row of metaRows) {
    const monthKey = row.date_start.slice(0, 7)
    const spend    = toFloat(row.spend)
    const impr     = toFloat(row.impressions)
    const clicks   = toFloat(row.clicks)
    const roas     = row.purchase_roas?.length ? toFloat(row.purchase_roas[0].value) : 0
    metaByMonth.set(monthKey, { spend, impressions: impr, clicks, meta_roas: roas })
  }

  // Collect all month keys from both sources
  const allMonths = new Set([...byMonth.keys(), ...metaByMonth.keys()])

  const months = Array.from(allMonths)
    .sort()
    .map(month => {
      const shop = byMonth.get(month) ?? { revenue: 0, orders: 0 }
      const meta = metaByMonth.get(month) ?? { spend: 0, impressions: 0, clicks: 0, meta_roas: 0 }
      const blended_roas = meta.spend > 0 ? shop.revenue / meta.spend : 0
      const cac          = shop.orders > 0 ? meta.spend / shop.orders : 0
      const ctr          = meta.impressions > 0 ? (meta.clicks / meta.impressions) * 100 : 0
      const cpm          = meta.impressions > 0 ? (meta.spend / meta.impressions) * 1000 : 0
      return {
        month,
        spend:        Math.round(meta.spend),
        revenue:      Math.round(shop.revenue),
        orders:       shop.orders,
        blended_roas: Math.round(blended_roas * 100) / 100,
        meta_roas:    Math.round(meta.meta_roas * 100) / 100,
        cac:          Math.round(cac * 100) / 100,
        impressions:  Math.round(meta.impressions),
        ctr:          Math.round(ctr * 100) / 100,
        cpm:          Math.round(cpm * 100) / 100,
      }
    })

  return NextResponse.json({ months })
}
