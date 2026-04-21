// ─── Shared types for Bevi Mission Control ───────────────────────────────────

export type FormatType = 'currency' | 'number' | 'percent' | 'euro'

export interface MetricDefinition {
  id: string
  label: string
  source: 'shopify' | 'meta' | 'paypal' | 'weship' | 'manual' | 'derived'
  format: FormatType
  description?: string
}

export interface KpiValue {
  metricId: string
  value: number
  previousValue?: number
  delta?: number          // absolute change
  deltaPercent?: number   // % change
  trend?: 'up' | 'down' | 'flat'
  isPositiveUp?: boolean  // true = ↑ is good (revenue), false = ↑ is bad (spend)
  note?: string                                    // simple hover text (fallback)
  noteLines?: { label: string; value: string }[]   // structured tooltip rows
}

// ─── Sync / Integration ───────────────────────────────────────────────────────

export type SyncStatusType = 'idle' | 'syncing' | 'success' | 'error'

export interface SyncStatus {
  source: string
  status: SyncStatusType
  lastSync: Date | null
  error?: string
}

// ─── Dashboard snapshot ───────────────────────────────────────────────────────

export interface DailySnapshot {
  date: string                  // ISO date string
  shopify_revenue_gross: number
  shopify_revenue_net: number
  shopify_orders: number
  shopify_sessions: number
  meta_spend: number
  meta_roas: number
  meta_cac: number
  weship_costs: number
  paypal_balance: number
  bank_balance: number | null   // manual entry
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface OrderRow {
  id:                  number
  name:                string        // "#1234"
  created_at:          string
  financial_status:    string
  fulfillment_status:  string | null
  country_code:        string | null  // shipping address ISO country code
  revenue_gross:       number
  revenue_tax:         number
  revenue_net:         number
  discount:            number        // total discount applied (from Shopify)
  items: {
    title:              string
    qty:                number
    unit_price:         number   // gross price per unit from Shopify
    cost_manufacturing: number   // per unit — manufacturer (e.g. Quanzhou Pengxin)
    cost_ib_shipping:   number   // per unit — IB freight (e.g. Shenzhen Amanda)
    cost_production:    number   // manufacturing + ib_shipping combined
    cost_weship:        number   // per unit (estimated from COGS config)
    cost_shipping:      number   // per unit (estimated from COGS config)
    mfg_position:       string   // e.g. "Production costs (EXW)"
    mfg_supplier:       string   // e.g. "Quanzhou Pengxin Bags"
    ib_position:        string   // e.g. "Shipping & Customs to Graz"
    ib_supplier:        string   // e.g. "Shenzhen Amanda"
  }[]
  cost_production:  number
  cost_weship:      number
  cost_shipping:    number
  cost_payment:     number
  cost_total:       number
  margin:           number        // (netto − total costs) / netto × 100
  weship_source:    'actual' | 'historical' | 'estimated'
  shipping_source:  'actual' | 'historical' | 'estimated'
  weship_items?:   { product: string; amount: number }[]  // line items when source='actual'
  shipping_items?: { product: string; amount: number }[]
}

export interface Order {
  shopify_order_id: string
  date: string
  revenue_gross: number
  revenue_net: number
  country: string
  products: OrderProduct[]
  has_bundle: boolean
  refunded: boolean
}

export interface OrderProduct {
  sku: string
  name: string
  quantity: number
  price: number
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface Product {
  sku: string
  name: string
  variant: string
  price_gross: number
  price_net: number
  cogs: number               // cost of goods sold per unit
  current_stock: number | null
  reorder_threshold: number
}

// ─── Cashflow ────────────────────────────────────────────────────────────────

export interface CashflowForecastMonth {
  month: string              // e.g. "2025-04"
  projected_revenue: number
  projected_ad_spend: number
  projected_weship_cost: number
  projected_fixed_costs: number
  projected_cogs: number
  projected_result: number   // calculated
  actual_revenue?: number
  actual_spend?: number
  is_forecast: boolean       // true = future month
}

export interface LiquidPosition {
  bank_balance: number
  paypal_balance: number
  weship_balance: number
  total: number
  as_of: string
}

export interface Liability {
  id: string
  name: string
  amount: number
  due_date: string | null
  note?: string
}

// ─── Manual entries ───────────────────────────────────────────────────────────

export type ManualEntryType =
  | 'bank_balance'
  | 'inventory'
  | 'liability'
  | 'weship_invoice'

export interface ManualEntry {
  id: string
  date: string
  type: ManualEntryType
  value: number
  note?: string
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface StockLevel {
  sku: string
  product_name: string
  variant: string
  units: number
  reorder_threshold: number
  is_low: boolean
  color?: 'black' | 'beige' | string
}
