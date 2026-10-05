// ─── Unit-economics formulas ─────────────────────────────────────────────────
// The single place every Marketing 2.0 KPI is defined. Pure functions: inputs
// are period totals, outputs the KPIs. A ratio whose denominator is zero is
// null, never Infinity or NaN — the UI shows "—".
//
// Revenue base for every KPI: net_revenue = Net Sales + Shipping, both excl.
// VAT. Net Sales = Gross Sales − Discounts − Returns (actual refunds only).

export interface PeriodInputs {
  netSales:          number   // excl. VAT
  shipping:          number   // shipping charged to customers, excl. VAT
  orders:            number
  adSpend:           number
  metaPurchaseValue: number   // as Meta reports it
  cogs:              number
  fulfillment:       number   // WeShip pick/pack, packaging, outbound shipping, storage
  returnCosts:       number
  paymentFees:       number
  newCustomers:      number   // orders that were a customer's first ever
  firstOrders: {
    netRevenue: number        // net_revenue of those first orders
    cod:        number        // their cost of delivery
  }
}

export interface UnitEconomics {
  net_revenue:      number
  aov:              number | null
  ad_spend:         number
  meta_roas:        number | null
  mer:              number | null
  ncac:             number | null
  cod:              number
  contribution:     number
  contribution_pct: number | null   // % of net_revenue
  first_order_contribution: number | null   // per new customer, before ad spend
  foc_to_ncac:      number | null
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

export function netRevenue(netSales: number, shipping: number): number {
  return netSales + shipping
}

/** Cost of delivery: everything it takes to get an order to the customer. */
export function costOfDelivery(i: Pick<PeriodInputs, 'cogs' | 'fulfillment' | 'returnCosts' | 'paymentFees'>): number {
  return i.cogs + i.fulfillment + i.returnCosts + i.paymentFees
}

export function computeUnitEconomics(i: PeriodInputs): UnitEconomics {
  const net  = netRevenue(i.netSales, i.shipping)
  const cod  = costOfDelivery(i)
  const contribution = net - cod - i.adSpend
  const ncac = ratio(i.adSpend, i.newCustomers)
  const firstOrderContribution = ratio(i.firstOrders.netRevenue - i.firstOrders.cod, i.newCustomers)

  return {
    net_revenue:      net,
    aov:              ratio(net, i.orders),
    ad_spend:         i.adSpend,
    meta_roas:        ratio(i.metaPurchaseValue, i.adSpend),
    mer:              ratio(net, i.adSpend),
    ncac,
    cod,
    contribution,
    contribution_pct: net > 0 ? (contribution / net) * 100 : null,
    first_order_contribution: firstOrderContribution,
    foc_to_ncac:      firstOrderContribution !== null && ncac ? firstOrderContribution / ncac : null,
  }
}

/** Shopify's payment fee estimate: 2 % of the amount paid + €0.25 per order. */
export function estimatePaymentFee(amountPaid: number): number {
  return 0.02 * Math.max(0, amountPaid) + 0.25
}

/** Share of a month's days that fall inside [from, to] (all YYYY-MM-DD). */
export function monthShareInRange(month: string, from: string, to: string): number {
  const [y, m] = month.split('-').map(Number)
  const days   = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const first  = `${month}-01`
  const last   = `${month}-${String(days).padStart(2, '0')}`
  const start  = from > first ? from : first
  const end    = to   < last  ? to   : last
  if (start > end) return 0
  const span = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1
  return span / days
}
