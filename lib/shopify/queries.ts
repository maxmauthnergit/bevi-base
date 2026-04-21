import { shopifyFetch, shopifyFetchAllOrders } from './client'
import type { ShopifyOrder, ShopifyProduct, ShopifyShop } from './client'
import type { KpiValue, DailySnapshot, StockLevel } from '@/lib/types'
import { getMetric } from '@/lib/metrics-config'

// ─── Timezone helpers ─────────────────────────────────────────────────────────

let _cachedTZ: string | null = null

export async function getShopTimezone(): Promise<string> {
  if (_cachedTZ) return _cachedTZ
  try {
    const { shop } = await shopifyFetch<{ shop: ShopifyShop }>(
      '/shop.json',
      { next: { revalidate: 3600 } }
    )
    _cachedTZ = shop.iana_timezone
  } catch {
    _cachedTZ = 'Europe/Berlin'
  }
  return _cachedTZ
}

// Interpret "YYYY-MM-DD" + "HH:MM:SS" as wall-clock time in tz, return UTC Date.
export function parseInTimezone(dateStr: string, timeStr: string, tz: string): Date {
  const approx = new Date(`${dateStr}T${timeStr}Z`)
  const parts  = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(approx)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  const wallClock = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour').replace('24','00')}:${get('minute')}:${get('second')}Z`
  )
  return new Date(approx.getTime() - (wallClock.getTime() - approx.getTime()))
}

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

  return shopifyFetchAllOrders(params, { revalidate: 300 })
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

  // Shopify analytics counts all non-voided orders (including cancelled)
  const countableOrders = orders.filter(o => o.financial_status !== 'voided')
  // Revenue/units only from orders that weren't cancelled
  const revenueOrders   = countableOrders.filter(o => !o.cancelled_at)

  for (const order of revenueOrders) {
    const gross = toFloat(order.total_price)
    const tax   = toFloat(order.total_tax)

    const refundAmt = (order.refunds ?? [])
      .flatMap(r => r.transactions ?? [])
      .filter(t => t.kind === 'refund' && t.status === 'success')
      .reduce((s, t) => s + toFloat(t.amount), 0)

    const effectiveGross = gross - refundAmt
    const effectiveTax   = gross > 0 ? tax * (effectiveGross / gross) : 0

    revenue_gross += effectiveGross
    revenue_net   += effectiveGross - effectiveTax
    unit_count    += order.line_items.reduce((s, li) => s + li.quantity, 0)
    if (order.financial_status === 'refunded' || order.financial_status === 'partially_refunded') refund_count++
  }

  return {
    revenue_gross: Math.round(revenue_gross * 100) / 100,
    revenue_net:   Math.round(revenue_net   * 100) / 100,
    order_count:   countableOrders.length,
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

// ─── Date-range KPIs (used by /api/kpis) ─────────────────────────────────────

export async function getOrderKpisForRange(from: Date, to: Date) {
  const orders = await getOrdersInRange(from, to)
  return computeMetrics(orders)
}

// ─── Per-unit cost rates used for trend COGS ─────────────────────────────────
// manufacturing/ib_shipping are fallbacks — overridden by amountsMap from Supabase config.
// weship/shipping are always used as estimates (no XLSX lookup in trend context).

const PRODUCT_RATES: [string, { manufacturing: number; ib_shipping: number; weship: number; shipping: number }][] = [
  ['squad',         { manufacturing: 27.03, ib_shipping: 11.67, weship: 4.20, shipping: 5.40 }],
  ['bundle l',      { manufacturing: 11.20, ib_shipping:  5.35, weship: 3.89, shipping: 5.40 }],
  ['bundle m',      { manufacturing: 10.76, ib_shipping:  3.89, weship: 3.50, shipping: 5.40 }],
  ['bundle s',      { manufacturing:  9.45, ib_shipping:  3.89, weship: 3.50, shipping: 5.40 }],
  ['full set',      { manufacturing:  9.01, ib_shipping:  3.89, weship: 3.04, shipping: 5.40 }],
  ['water bladder', { manufacturing:  2.53, ib_shipping:  0.40, weship: 3.05, shipping: 2.50 }],
  ['cleaning kit',  { manufacturing:  1.75, ib_shipping:  1.46, weship: 3.05, shipping: 5.40 }],
  ['phone strap',   { manufacturing:  0.33, ib_shipping:  0.11, weship: 3.04, shipping: 2.50 }],
]

function getUnitCostTotal(
  title: string,
  amountsMap: Map<string, { manufacturing: number; ib_shipping: number }>,
): number {
  const t = title.toLowerCase()
  for (const [key, defaults] of PRODUCT_RATES) {
    if (t.includes(key)) {
      const ov  = amountsMap.get(key)
      const mfg = ov?.manufacturing ?? defaults.manufacturing
      const ib  = ov?.ib_shipping   ?? defaults.ib_shipping
      return mfg + ib + defaults.weship + defaults.shipping
    }
  }
  return 0
}

// ─── Daily trend for an arbitrary date range (used by /api/dashboard/trend) ──

export async function getTrendDataForRange(
  from: Date,
  to: Date,
  amountsMap: Map<string, { manufacturing: number; ib_shipping: number }> = new Map(),
): Promise<TrendPoint[]> {
  const orders = await getOrdersInRange(from, to)

  const byDate = new Map<string, { gross: number; tax: number; cogs: number }>()
  const cur = new Date(from); cur.setHours(0, 0, 0, 0)
  const end = new Date(to);   end.setHours(23, 59, 59, 999)
  while (cur <= end) {
    byDate.set(isoDate(cur), { gross: 0, tax: 0, cogs: 0 })
    cur.setDate(cur.getDate() + 1)
  }

  for (const order of orders) {
    if (order.cancelled_at || order.financial_status === 'voided') continue
    const date  = order.created_at.split('T')[0]
    const entry = byDate.get(date)
    if (!entry) continue
    const gross = toFloat(order.total_price)
    entry.gross += gross
    entry.tax   += toFloat(order.total_tax)
    let cogs = 0.02 * gross + 0.25  // payment fee
    for (const li of order.line_items) cogs += getUnitCostTotal(li.title, amountsMap) * li.quantity
    entry.cogs += cogs
  }

  const today = isoDate(new Date())
  return Array.from(byDate.entries())
    .filter(([date]) => date <= today)
    .map(([date, d]) => ({
      date,
      revenue_gross: Math.round(d.gross * 100) / 100,
      revenue_net:   Math.round((d.gross - d.tax) * 100) / 100,
      cogs:          Math.round(d.cogs  * 100) / 100,
      meta_spend:    0,
    }))
}

// ─── Hourly trend for a single day (today / yesterday) ───────────────────────

export async function getTrendDataByHour(
  from: Date,
  to: Date,
  tz: string,
  amountsMap: Map<string, { manufacturing: number; ib_shipping: number }> = new Map(),
): Promise<TrendPoint[]> {
  const orders = await getOrdersInRange(from, to)

  // Seed all 24 hours + a synthetic h=24 endpoint for the axis
  const byHour = new Map<number, { gross: number; tax: number; cogs: number }>()
  for (let h = 0; h <= 24; h++) byHour.set(h, { gross: 0, tax: 0, cogs: 0 })

  const fmt = new Intl.DateTimeFormat('en', { timeZone: tz, hour: 'numeric', hour12: false })

  for (const order of orders) {
    if (order.cancelled_at || order.financial_status === 'voided') continue
    const raw = fmt.format(new Date(order.created_at))
    const h   = parseInt(raw === '24' ? '0' : raw, 10)
    const entry = byHour.get(h)
    if (!entry) continue
    const gross = toFloat(order.total_price)
    entry.gross += gross
    entry.tax   += toFloat(order.total_tax)
    let cogs = 0.02 * gross + 0.25
    for (const li of order.line_items) cogs += getUnitCostTotal(li.title, amountsMap) * li.quantity
    entry.cogs += cogs
  }

  return Array.from(byHour.entries()).map(([h, d]) => ({
    date:          String(h),
    revenue_gross: Math.round(d.gross * 100) / 100,
    revenue_net:   Math.round((d.gross - d.tax) * 100) / 100,
    cogs:          Math.round(d.cogs  * 100) / 100,
    meta_spend:    0,
  }))
}

// ─── Trend data for a specific calendar month ─────────────────────────────────

export interface TrendPoint {
  date: string
  revenue_gross: number
  revenue_net: number
  cogs: number
  meta_spend: number    // merged externally by API route
}

export async function getTrendDataForMonth(
  year: number,
  month: number,
  amountsMap: Map<string, { manufacturing: number; ib_shipping: number }> = new Map(),
): Promise<TrendPoint[]> {
  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 0, 23, 59, 59)

  const orders = await getOrdersInRange(from, to)

  const byDate = new Map<string, { gross: number; tax: number; cogs: number }>()
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    byDate.set(date, { gross: 0, tax: 0, cogs: 0 })
  }

  for (const order of orders) {
    if (order.cancelled_at || order.financial_status === 'voided') continue
    const date  = order.created_at.split('T')[0]
    const entry = byDate.get(date)
    if (!entry) continue
    const gross = toFloat(order.total_price)
    entry.gross += gross
    entry.tax   += toFloat(order.total_tax)
    let cogs = 0.02 * gross + 0.25
    for (const li of order.line_items) cogs += getUnitCostTotal(li.title, amountsMap) * li.quantity
    entry.cogs += cogs
  }

  const today = isoDate(new Date())
  return Array.from(byDate.entries())
    .filter(([date]) => date <= today)
    .map(([date, d]) => ({
      date,
      revenue_gross: Math.round(d.gross * 100) / 100,
      revenue_net:   Math.round((d.gross - d.tax) * 100) / 100,
      cogs:          Math.round(d.cogs  * 100) / 100,
      meta_spend:    0,
    }))
}

// ─── Avg daily sales by SKU (last 30 days) ────────────────────────────────────

export async function getAvgDailySalesBySku(): Promise<Record<string, number>> {
  const now  = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  from.setHours(0, 0, 0, 0)

  const orders = await getOrdersInRange(from, now)
  const totals: Record<string, number> = {}

  for (const order of orders) {
    if (order.cancelled_at || order.financial_status === 'voided') continue
    for (const li of order.line_items) {
      if (!li.sku) continue
      totals[li.sku] = (totals[li.sku] ?? 0) + li.quantity
    }
  }

  // Divide by 30 to get avg per day
  return Object.fromEntries(
    Object.entries(totals).map(([sku, total]) => [sku, total / 30])
  )
}

// ─── Inventory levels ─────────────────────────────────────────────────────────

// Reorder thresholds per SKU — update as business needs change
const REORDER_THRESHOLDS: Record<string, number> = {
  '9180013220099': 250,  // Bevi Bag Black
  '9180013220129': 100,  // Bevi Bag Beige
  default: 100,
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
