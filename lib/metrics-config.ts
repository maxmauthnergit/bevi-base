import type { MetricDefinition } from './types'

// ─── Data-driven KPI definitions ─────────────────────────────────────────────
// Adding a new KPI = add one entry here. No UI changes needed.

export const metrics: MetricDefinition[] = [
  {
    id: 'revenue_mtd',
    label: 'Revenue MTD',
    source: 'shopify',
    format: 'currency',
    description: 'Gross revenue month-to-date',
  },
  {
    id: 'units_mtd',
    label: 'Units Sold MTD',
    source: 'shopify',
    format: 'number',
    description: 'Total units sold month-to-date',
  },
  {
    id: 'ad_spend_mtd',
    label: 'Ad Spend MTD',
    source: 'meta',
    format: 'currency',
    description: 'Meta Ads spend month-to-date',
  },
  {
    id: 'roas_mtd',
    label: 'ROAS',
    source: 'meta',
    format: 'number',
    description: 'Return on ad spend (purchase value / spend)',
  },
  {
    id: 'contribution_margin_mtd',
    label: 'Contribution Margin MTD',
    source: 'derived',
    format: 'currency',
    description: 'Net revenue − COGS − CAC − WeShip costs',
  },
  {
    id: 'liquid_position',
    label: 'Liquid Position',
    source: 'derived',
    format: 'currency',
    description: 'Bank balance + PayPal balance',
  },
  {
    id: 'aov_gross',
    label: 'AOV (Gross)',
    source: 'shopify',
    format: 'currency',
    description: 'Average order value (gross)',
  },
  {
    id: 'return_rate',
    label: 'Return Rate',
    source: 'shopify',
    format: 'percent',
    description: 'Refunded orders / total orders',
  },
  {
    id: 'cac_mtd',
    label: 'CAC',
    source: 'derived',
    format: 'currency',
    description: 'Customer acquisition cost (Meta spend / new customers)',
  },
  {
    id: 'weship_costs_mtd',
    label: 'WeShip Costs MTD',
    source: 'weship',
    format: 'currency',
    description: 'Total fulfillment costs month-to-date',
  },
  {
    id: 'orders_mtd',
    label: 'Orders MTD',
    source: 'shopify',
    format: 'number',
    description: 'Total orders month-to-date',
  },
  {
    id: 'paypal_balance',
    label: 'PayPal Balance',
    source: 'paypal',
    format: 'currency',
    description: 'Current PayPal account balance',
  },
]

export function getMetric(id: string): MetricDefinition | undefined {
  return metrics.find((m) => m.id === id)
}

// ─── Dashboard home KPIs — the 6 cards shown on the overview ─────────────────

export const dashboardKpis = [
  'revenue_mtd',
  'units_mtd',
  'ad_spend_mtd',
  'contribution_margin_mtd',
  'liquid_position',
  'roas_mtd',
] as const
