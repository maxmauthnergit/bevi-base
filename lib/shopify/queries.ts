import { shopifyFetch } from './client'
import type { ShopifyOrder, ShopifyProduct } from './client'
import type { KpiValue, DailySnapshot, StockLevel } from '@/lib/types'
import { getMetric } from '@/lib/metrics-config'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFloat(s: string) {
  return parseFloat(s) || 0
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfPrevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

function endOfPrevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59)
}

// ─── Order fetching ───────────────────────────────────────────────────────────

const ORDER_FIELDS = [
  'id', 'name', 'created_at', 'total_price', 'subtotal_price',
  'total_tax', 'financial_status', 'cancel_reason', 'cancelled_at',
  'refunds', 'line_items', 'billing_address', 'discount_codes',
].join(',')

async function getOrdersInRange(from: Date, to: Date): Promise<ShopifyOrder[]> {
  const params = new URLSearchParams({
    status: 'any',
    created_at_min: from.toISOString(),
    created_at_max: to.toISOString(),
    limit: '250',
    fields: ORDER_FIELDS,
  })

  const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(
    `/orders.json?${params}`,
    { next: { revalidate: 300 } }  // cache 5 min
  )

  return data.orders
}

// ─── KPI computation ──────────────────────────────────────────────────────────

interface OrderMetrics {
  revenue_gross: number
  revenue_net: number
  order_count: number
  unit_count: number
  refund_count: number
}

function computeMetrics(orders: ShopifyOrder[]): OrderMetrics {
  let revenue_gross = 0
  let revenue_net = 0
  let unit_count = 0
  let refund_count = 0

  const validOrders = orders.filter(
    (o) => o.financial_status !== 'voided' && !o.cancelled_at
  )

  for (const order of validOrders) {
    const gross = toFloat(order.total_price)
    const tax   = toFloat(order.total_tax)
    revenue_gross += gross
    revenue_net   += gross - tax
    unit_count    += order.line_items.reduce((s, li) => s + li.quantity, 0)
    if (order.financial_status === 'refunded') refund_count++
  }

  return {
    revenue_gross: Math.round(revenue_gross * 100) / 100,
    revenue_net:   Math.round(revenue_net   * 100) / 100,
    order_count:   validOrders.length,
    unit_count,
    refund_count,
  }
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export interface DashboardKPIs {
  kpis: Record<string, KpiValue>
  month_label: string
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const now   = new Date()
  const mtdFrom  = startOfMonth(now)
  const prevFrom = startOfPrevMonth(now)
  const prevTo   = endOfPrevMonth(now)

  const [currentOrders, prevOrders] = await Promise.all([
    getOrdersInRange(mtdFrom, now),
    getOrdersInRange(prevFrom, prevTo),
  ])

  const curr = computeMetrics(currentOrders)
  const prev = computeMetrics(prevOrders)

  function kpi(
    id: string,
    value: number,
    prevValue: number,
    isPositiveUp: boolean
  ): KpiValue {
    const delta = Math.round((value - prevValue) * 100) / 100
    const deltaPercent =
      prevValue !== 0
        ? Math.round((delta / prevValue) * 1000) / 10
        : 0
    return {
      metricId: id,
      value,
      previousValue: prevValue,
      delta,
      deltaPercent,
      trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      isPositiveUp,
    }
  }

  const aov      = curr.order_count > 0 ? Math.round((curr.revenue_gross / curr.order_count) * 100) / 100 : 0
  const aovPrev  = prev.order_count > 0 ? Math.round((prev.revenue_gross / prev.order_count) * 100) / 100 : 0
  const retRate  = curr.order_count > 0 ? Math.round((curr.refund_count / curr.order_count) * 1000) / 10 : 0
  const retRatePrev = prev.order_count > 0 ? Math.round((prev.refund_count / prev.order_count) * 1000) / 10 : 0

  const month_label = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return {
    month_label,
    kpis: {
      revenue_mtd:  kpi('revenue_mtd',  curr.revenue_gross, prev.revenue_gross, true),
      units_mtd:    kpi('units_mtd',    curr.unit_count,    prev.unit_count,    true),
      orders_mtd:   kpi('orders_mtd',   curr.order_count,   prev.order_count,   true),
      aov_gross:    kpi('aov_gross',    aov,                aovPrev,            true),
      return_rate:  kpi('return_rate',  retRate,            retRatePrev,        false),
    },
  }
}

// ─── 30-day trend data ────────────────────────────────────────────────────────

export async function getTrendData(): Promise<DailySnapshot[]> {
  const now  = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  from.setHours(0, 0, 0, 0)

  const orders = await getOrdersInRange(from, now)

  // Group by calendar date
  const byDate = new Map<string, { gross: number; orders: number; units: number }>()

  // Seed all 30 days with zeros so chart has no gaps
  for (let i = 0; i < 30; i++) {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    byDate.set(isoDate(d), { gross: 0, orders: 0, units: 0 })
  }

  for (const order of orders) {
    if (order.cancelled_at || order.financial_status === 'voided') continue
    const date = order.created_at.split('T')[0]
    const entry = byDate.get(date)
    if (entry) {
      entry.gross  += toFloat(order.total_price)
      entry.orders += 1
      entry.units  += order.line_items.reduce((s, li) => s + li.quantity, 0)
    }
  }

  return Array.from(byDate.entries()).map(([date, d]) => ({
    date,
    shopify_revenue_gross: Math.round(d.gross * 100) / 100,
    shopify_revenue_net:   Math.round(d.gross * 0.84 * 100) / 100,
    shopify_orders:        d.orders,
    shopify_sessions:      d.orders * 18,
    // Meta spend stays mock until Meta API is connected
    meta_spend:   0,
    meta_roas:    0,
    meta_cac:     0,
    weship_costs: 0,
    paypal_balance: 0,
    bank_balance:   null,
  }))
}

// ─── Inventory levels ─────────────────────────────────────────────────────────

// Reorder thresholds per SKU — update as business needs change
const REORDER_THRESHOLDS: Record<string, number> = {
  '9180013220099': 60,  // Bevi Bag Black
  '9180013220129': 60,  // Bevi Bag Beige
  default: 30,
}

export async function getInventoryLevels(): Promise<StockLevel[]> {
  const data = await shopifyFetch<{ products: ShopifyProduct[] }>(
    '/products.json?limit=250&status=active',
    { next: { revalidate: 600 } }  // cache 10 min
  )

  const levels: StockLevel[] = []

  for (const product of data.products) {
    for (const variant of product.variants) {
      // Skip bundle products (no SKU) and very high-inventory accessories
      if (!variant.sku) continue

      const threshold = REORDER_THRESHOLDS[variant.sku] ?? REORDER_THRESHOLDS.default
      const color = variant.title.toLowerCase().includes('beige')
        ? 'beige'
        : variant.title.toLowerCase().includes('black')
        ? 'black'
        : undefined

      levels.push({
        sku:               variant.sku,
        product_name:      product.title,
        variant:           variant.title,
        units:             variant.inventory_quantity,
        reorder_threshold: threshold,
        is_low:            variant.inventory_quantity < threshold,
        color,
      })
    }
  }

  return levels
}
