import type { ShopifyOrder } from '@/lib/shopify/client'
import { createServerClient } from '@/lib/supabase'
import { DEFAULT_PRODUCT_COSTS, applyOverrides, buildAmountsMap } from '@/lib/costs-config'
import { getWeShipMonthData, type WeShipMonthData } from '@/lib/weship/xlsx-parser'
import { offsetYM } from '@/lib/date-range'

// ─── Per-product cost profiles (last-resort fallback) ────────────────────────
// Fixed per-unit rates used when no WeShip invoice and no historical reference
// exists. Manufacturing / IB shipping can be overridden from Settings.

export type AmountsMap = Map<string, { manufacturing: number; ib_shipping: number }>

export interface CostProfile {
  manufacturing: number
  ib_shipping:   number
  weship:        number
  shipping:      number
  mfg_position:  string   // e.g. "Production costs (EXW)"
  mfg_supplier:  string   // e.g. "Quanzhou Pengxin Bags"
  ib_position:   string   // e.g. "Shipping & Customs to Graz"
  ib_supplier:   string   // e.g. "Shenzhen Amanda"
}

// Shared position/supplier label sets
const QP_SA = { mfg_position: 'Production costs (EXW)', mfg_supplier: 'Quanzhou Pengxin Bags', ib_position: 'Shipping & Customs to Graz', ib_supplier: 'Shenzhen Amanda' }
const LC_SA = { mfg_position: 'Production costs (EXW)', mfg_supplier: 'Licheng Plastic',        ib_position: 'Shipping & Customs to Graz', ib_supplier: 'Shenzhen Amanda' }
const DW_LP = { mfg_position: 'Production costs (EXW)', mfg_supplier: 'Dongguan Webbing',       ib_position: 'Packaging (EXW)',            ib_supplier: 'Langhai Printing' }

export const COST_MAP: [string, CostProfile][] = [
  ['squad',         { manufacturing: 27.03, ib_shipping: 11.67, weship: 4.20, shipping: 5.40, ...QP_SA }],
  ['bundle l',      { manufacturing: 11.20, ib_shipping:  5.35, weship: 3.89, shipping: 5.40, ...QP_SA }],
  ['bundle m',      { manufacturing: 10.76, ib_shipping:  3.89, weship: 3.50, shipping: 5.40, ...QP_SA }],
  ['bundle s',      { manufacturing:  9.45, ib_shipping:  3.89, weship: 3.50, shipping: 5.40, ...QP_SA }],
  ['full set',      { manufacturing:  9.01, ib_shipping:  3.89, weship: 3.04, shipping: 5.40, ...QP_SA }],
  ['water bladder', { manufacturing:  2.53, ib_shipping:  0.40, weship: 3.05, shipping: 2.50, ...QP_SA }],
  ['cleaning kit',  { manufacturing:  1.75, ib_shipping:  1.46, weship: 3.05, shipping: 5.40, ...LC_SA }],
  ['phone strap',   { manufacturing:  0.33, ib_shipping:  0.11, weship: 3.04, shipping: 2.50, ...DW_LP }],
]

export function getCosts(title: string, amountsMap: AmountsMap): CostProfile {
  const t = title.toLowerCase()
  for (const [key, profile] of COST_MAP) {
    if (t.includes(key)) {
      const ov = amountsMap.get(key)
      return ov ? { ...profile, manufacturing: ov.manufacturing, ib_shipping: ov.ib_shipping } : profile
    }
  }
  return { manufacturing: 0, ib_shipping: 0, weship: 0, shipping: 0, ...QP_SA }
}

/** Production + IB amounts from Settings (Supabase), falling back to the defaults. */
export async function loadAmountsMap(): Promise<AmountsMap> {
  try {
    const { data } = await createServerClient().storage
      .from('weship-invoices')
      .download('config/production-costs.json')
    if (data) {
      const overrides = JSON.parse(await data.text()) as Record<string, Record<string, number>>
      return buildAmountsMap(applyOverrides(overrides))
    }
  } catch { /* fall through */ }
  return buildAmountsMap(DEFAULT_PRODUCT_COSTS)
}

// Canonical product key for composition matching
function getProductKey(title: string): string {
  const t = title.toLowerCase()
  for (const [key] of COST_MAP) {
    if (t.includes(key)) return key
  }
  return t.replace(/\s+/g, '-').slice(0, 40)
}

// Stable key representing a basket's product composition (order-insensitive)
export function compositionKey(lineItems: ShopifyOrder['line_items']): string {
  return lineItems
    .map(li => `${getProductKey(li.title)}:${li.quantity}`)
    .sort()
    .join('|')
}

// ─── WeShip fulfillment / shipping / return costs per order ──────────────────

type Item = { product: string; amount: number }
export type CostSource = 'actual' | 'historical' | 'estimated'

export interface OrderWeShipCosts {
  weship:          number   // fulfillment (pick/pack, packaging, …)
  shipping:        number   // outbound delivery
  returns:         number   // return handling; only known from an actual invoice
  weship_source:   CostSource
  shipping_source: CostSource
  weship_items?:   Item[]
  shipping_items?: Item[]
  returns_items?:  Item[]
}

export interface WeShipCosts {
  /** Priority: 1) actual invoice  2) 3-month average by basket  3) nothing found (0). */
  forOrder(o: ShopifyOrder): OrderWeShipCosts
  /** Monthly storage fee per invoice month ('YYYY-MM'); 0 where no invoice. */
  storageFee(month: string): number
  anyParsed: boolean
  debug:     WeShipMonthData['debug'] | undefined
}

export const WESHIP_LOOKBACK = 3   // months of history used to build reference averages

interface HistRef { sum: number; count: number; positions: Map<string, number> }

function addRef(map: Map<string, HistRef>, key: string, total: number, items: Item[]) {
  const ref = map.get(key) ?? { sum: 0, count: 0, positions: new Map<string, number>() }
  ref.sum   += total
  ref.count += 1
  for (const { product, amount } of items) {
    ref.positions.set(product, (ref.positions.get(product) ?? 0) + amount)
  }
  map.set(key, ref)
}

function refToItems(ref: HistRef): Item[] {
  return Array.from(ref.positions.entries())
    .map(([product, sum]) => ({ product, amount: Math.round(sum / ref.count * 100) / 100 }))
    .filter(it => it.amount > 0)
}

const r2 = (n: number) => Math.round(n * 100) / 100
const countryOf = (o: ShopifyOrder) => o.shipping_address?.country_code ?? o.billing_address?.country_code ?? 'XX'

/**
 * Loads the WeShip invoices for the range months (± one month, since an order
 * placed on the 31st is invoiced the month after) and builds the historical
 * references from the WESHIP_LOOKBACK months before the range.
 */
export async function loadWeShipCosts(
  rangeMonths: string[],
  ordersForMonth: (month: string) => Promise<ShopifyOrder[]>,
): Promise<WeShipCosts> {
  const xlsxMonths   = [offsetYM(rangeMonths[0], -1), ...rangeMonths, offsetYM(rangeMonths[rangeMonths.length - 1], +1)]
  const lookbackKeys = Array.from({ length: WESHIP_LOOKBACK }, (_, i) => offsetYM(rangeMonths[0], -(i + 1)))

  const [xlsxResults, lookbackOrders, lookbackXlsx] = await Promise.all([
    Promise.all(xlsxMonths.map(getWeShipMonthData)),
    Promise.all(lookbackKeys.map(m => ordersForMonth(m).catch((): ShopifyOrder[] => []))),
    Promise.all(lookbackKeys.map(getWeShipMonthData)),
  ])

  const anyParsed     = xlsxResults.some(r => r.parsed)
  const mergedByOrder = new Map(xlsxResults.flatMap(r => [...r.byOrder]))
  const storageByMonth = new Map(xlsxMonths.map((m, i) => [m, xlsxResults[i].lagergebuehr]))

  // weshipRef:       compositionKey               → ref  (position-agnostic match)
  // shippingRef:     compositionKey@countryCode   → ref  (preferred)
  // shippingRefAny:  compositionKey               → ref  (country-agnostic fallback)
  // Return handling stays inside the fulfillment average, as before the
  // returns category existed.
  const weshipRef      = new Map<string, HistRef>()
  const shippingRef    = new Map<string, HistRef>()
  const shippingRefAny = new Map<string, HistRef>()

  for (let i = 0; i < WESHIP_LOOKBACK; i++) {
    const histXlsx = lookbackXlsx[i]
    if (!histXlsx.parsed) continue
    for (const o of lookbackOrders[i]) {
      if (o.cancelled_at || o.financial_status === 'voided') continue
      const entry = histXlsx.byOrder.get(o.name)
      if (!entry) continue
      const ck = compositionKey(o.line_items)
      addRef(weshipRef,      ck,                      entry.weship + entry.returns, [...entry.weshipItems, ...entry.returnsItems])
      addRef(shippingRef,    `${ck}@${countryOf(o)}`, entry.shipping, entry.shippingItems)
      addRef(shippingRefAny, ck,                      entry.shipping, entry.shippingItems)
    }
  }

  function forOrder(o: ShopifyOrder): OrderWeShipCosts {
    const xlsxEntry = mergedByOrder.get(o.name)
    if (anyParsed && xlsxEntry !== undefined) {
      return {
        weship:          r2(xlsxEntry.weship),
        shipping:        r2(xlsxEntry.shipping),
        returns:         r2(xlsxEntry.returns),
        weship_source:   'actual',
        shipping_source: 'actual',
        weship_items:    xlsxEntry.weshipItems,
        shipping_items:  xlsxEntry.shippingItems,
        returns_items:   xlsxEntry.returnsItems,
      }
    }

    const ck   = compositionKey(o.line_items)
    const wRef = weshipRef.get(ck)
    const sRef = shippingRef.get(`${ck}@${countryOf(o)}`) ?? shippingRefAny.get(ck)
    return {
      weship:          wRef?.count ? r2(wRef.sum / wRef.count) : 0,
      shipping:        sRef?.count ? r2(sRef.sum / sRef.count) : 0,
      returns:         0,
      weship_source:   wRef?.count ? 'historical' : 'estimated',
      shipping_source: sRef?.count ? 'historical' : 'estimated',
      weship_items:    wRef?.count ? refToItems(wRef) : undefined,
      shipping_items:  sRef?.count ? refToItems(sRef) : undefined,
    }
  }

  return {
    forOrder,
    storageFee: m => storageByMonth.get(m) ?? 0,
    anyParsed,
    debug: (xlsxResults.find(r => r.parsed) ?? xlsxResults[1])?.debug,
  }
}
