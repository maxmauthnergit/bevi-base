// ─── DHDL order planning ──────────────────────────────────────────────────────
// Temporary decision support for the big pre-DHDL order.
// Pure functions only — data fetching lives in lib/shopify + lib/weship.

export const DHDL_AIRING_RTL_PLUS = '2027-02-15'
export const DHDL_AIRING_VOX      = '2027-02-22'

// Early summer 2026: everything was in stock. Overridable via ?from=&to=
export const DEFAULT_RATIO_FROM = '2026-05-01'
export const DEFAULT_RATIO_TO   = '2026-06-30'

export const DEFAULT_EXTRA_BAGS = 5000

// Garment holder is new — no sales history, so its ratio per bag is set.
export const GARMENT_HOLDER_RATIO = 0.15

// ─── Product categories ───────────────────────────────────────────────────────

export type MainCategory  = 'bag_black' | 'bag_beige'
export type AddOnCategory = 'cleaning_kit' | 'phone_strap' | 'water_bladder' | 'garment_holder'
export type Category      = MainCategory | AddOnCategory | 'bundle_unresolved' | 'other'

export const MAIN_CATEGORIES:   MainCategory[]  = ['bag_black', 'bag_beige']
export const ADD_ON_CATEGORIES: AddOnCategory[] = ['cleaning_kit', 'phone_strap', 'water_bladder', 'garment_holder']

export const CATEGORY_LABEL: Record<Category, string> = {
  bag_black:         'Bevi Bag Black',
  bag_beige:         'Bevi Bag Beige',
  cleaning_kit:      'Cleaning Kit',
  phone_strap:       'Phone Strap',
  water_bladder:     'Water Bladder',
  garment_holder:    'Garment Holder',
  bundle_unresolved: 'Bundle (nicht aufgelöst)',
  other:             'Sonstiges',
}

// Planning stock, set manually from the WeShip portal (Oct 2026).
// Black counts the 1452 units WeShip lists as "nicht verfügbar";
// Cleaning Kit includes 500 extra units on top of 251 in stock.
export const MANUAL_STOCK: Record<MainCategory | AddOnCategory, number> = {
  bag_beige:      481,
  bag_black:      1452,
  cleaning_kit:   251 + 500,
  phone_strap:    770,
  water_bladder:  676,
  garment_holder: 0,
}

const SKU_BLACK = '9180013220099'
const SKU_BEIGE = '9180013220129'

const SKU_CATEGORY: Record<string, Category> = {
  [SKU_BLACK]:     'bag_black',
  [SKU_BEIGE]:     'bag_beige',
  '9180013220105': 'cleaning_kit',
  '9180013220136': 'phone_strap',
  '9180013220112': 'water_bladder',
}

const BUNDLE_KEYWORDS   = ['bundle', 'full set', 'squad']
const EXCLUDED_KEYWORDS = ['sticker', 'beilagenkärtchen', 'beilage']

export function classifyProduct(title: string, variant: string | null | undefined, sku: string | null | undefined): Category {
  if (sku && SKU_CATEGORY[sku]) return SKU_CATEGORY[sku]

  const t = title.toLowerCase()
  const v = (variant ?? '').toLowerCase()

  // Packaging extras that mention product names (e.g. "Sticker für Bevi Phone Straps")
  if (EXCLUDED_KEYWORDS.some(k => t.includes(k))) return 'other'

  if (t.includes('cleaning kit'))   return 'cleaning_kit'
  if (t.includes('phone strap'))    return 'phone_strap'
  if (t.includes('water bladder'))  return 'water_bladder'
  if (t.includes('garment holder')) return 'garment_holder'
  if (BUNDLE_KEYWORDS.some(k => t.includes(k))) return 'bundle_unresolved'

  if (t.includes('bag')) {
    const s = `${t} ${v}`
    if (s.includes('black')) return 'bag_black'
    if (s.includes('beige')) return 'bag_beige'
  }
  return 'other'
}

// ─── Sales ratio ──────────────────────────────────────────────────────────────

export interface RatioLineItem {
  title: string
  variant: string | null
  sku: string | null
  quantity: number
  bundleTitle: string | null   // set when the line item is a component of a native bundle
}

export interface RatioOrder {
  createdAt: string
  lineItems: RatioLineItem[]
}

export interface ProductRow {
  key: string
  title: string
  variant: string | null
  category: Category
  units: number
  unitsInBundles: number
}

export interface RatioResult {
  orderCount: number
  bundleOrderCount: number
  unitsByCategory: Record<Category, number>
  bundleUnitsByCategory: Record<Category, number>
  mainUnits: number
  blackShare: number | null
  ratios: Record<AddOnCategory, number | null>   // add-on units per main bag
  products: ProductRow[]
  weekly: { week: string; units: Record<Category, number> }[]
}

function emptyCounts(): Record<Category, number> {
  return {
    bag_black: 0, bag_beige: 0,
    cleaning_kit: 0, phone_strap: 0, water_bladder: 0, garment_holder: 0,
    bundle_unresolved: 0, other: 0,
  }
}

// Monday of the ISO week, as YYYY-MM-DD
function weekStart(iso: string) {
  const d   = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

export function computeRatios(orders: RatioOrder[]): RatioResult {
  const unitsByCategory       = emptyCounts()
  const bundleUnitsByCategory = emptyCounts()
  const products = new Map<string, ProductRow>()
  const weekly   = new Map<string, Record<Category, number>>()
  let bundleOrderCount = 0

  for (const order of orders) {
    if (order.lineItems.some(li => li.bundleTitle)) bundleOrderCount++
    const wk = weekStart(order.createdAt)
    if (!weekly.has(wk)) weekly.set(wk, emptyCounts())
    const wkCounts = weekly.get(wk)!

    for (const li of order.lineItems) {
      if (li.quantity <= 0) continue
      const category = classifyProduct(li.title, li.variant, li.sku)
      unitsByCategory[category] += li.quantity
      wkCounts[category]        += li.quantity
      if (li.bundleTitle) bundleUnitsByCategory[category] += li.quantity

      const key = `${li.title}|||${li.variant ?? ''}`
      const row = products.get(key) ?? { key, title: li.title, variant: li.variant, category, units: 0, unitsInBundles: 0 }
      row.units += li.quantity
      if (li.bundleTitle) row.unitsInBundles += li.quantity
      products.set(key, row)
    }
  }

  const mainUnits = unitsByCategory.bag_black + unitsByCategory.bag_beige
  const ratios = Object.fromEntries(
    ADD_ON_CATEGORIES.map(c => [c, mainUnits > 0 && unitsByCategory[c] > 0 ? unitsByCategory[c] / mainUnits : null])
  ) as Record<AddOnCategory, number | null>

  return {
    orderCount: orders.length,
    bundleOrderCount,
    unitsByCategory,
    bundleUnitsByCategory,
    mainUnits,
    blackShare: mainUnits > 0 ? unitsByCategory.bag_black / mainUnits : null,
    ratios,
    products: [...products.values()].sort((a, b) => b.units - a.units),
    weekly: [...weekly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, units]) => ({ week, units })),
  }
}

// ─── Recommendation ───────────────────────────────────────────────────────────

export interface RecommendationRow {
  category: MainCategory | AddOnCategory
  stock: number
  ratio: number | null          // add-on per bag; for bags: colour share
  ratioIsAssumption: boolean
  target: number | null         // stock needed after the order
  order: number | null          // units to order
}

export interface Recommendation {
  bagStock: number
  bagsAfterOrder: number
  rows: RecommendationRow[]
}

// Round order quantities up to full hundreds — a supplier MOQ-friendly number.
export function roundUp100(n: number) {
  return Math.ceil(n / 100) * 100
}

export function computeRecommendation(
  stock: Record<MainCategory | AddOnCategory, number>,
  ratio: RatioResult,
  extraBags: number,
  assumedRatios: Partial<Record<AddOnCategory, number>> = {},
): Recommendation {
  const bagStock       = stock.bag_black + stock.bag_beige
  const bagsAfterOrder = bagStock + extraBags

  // Split the extra bags by historical colour share, so that stock after the
  // order mirrors demand. Clamp to [0, extraBags] when existing stock is skewed.
  const blackShare  = ratio.blackShare
  let blackOrder: number | null = null
  if (blackShare !== null) {
    const raw  = Math.round(bagsAfterOrder * blackShare - stock.bag_black)
    blackOrder = Math.min(extraBags, Math.max(0, raw))
  }
  const beigeOrder = blackOrder !== null ? extraBags - blackOrder : null

  const rows: RecommendationRow[] = [
    {
      category: 'bag_black', stock: stock.bag_black, ratio: blackShare, ratioIsAssumption: false,
      target: blackOrder !== null ? stock.bag_black + blackOrder : null, order: blackOrder,
    },
    {
      category: 'bag_beige', stock: stock.bag_beige, ratio: blackShare !== null ? 1 - blackShare : null, ratioIsAssumption: false,
      target: beigeOrder !== null ? stock.bag_beige + beigeOrder : null, order: beigeOrder,
    },
  ]

  for (const c of ADD_ON_CATEGORIES) {
    const assumed  = assumedRatios[c]
    const measured = ratio.ratios[c]
    const r        = measured ?? assumed ?? null
    const target   = r !== null ? Math.round(bagsAfterOrder * r) : null
    rows.push({
      category: c,
      stock: stock[c],
      ratio: r,
      ratioIsAssumption: measured === null && assumed !== undefined,
      target,
      order: target !== null ? roundUp100(Math.max(0, target - stock[c])) : null,
    })
  }

  return { bagStock, bagsAfterOrder, rows }
}
