// ─── Production & IB Shipping costs config ───────────────────────────────────
// Single source of truth for per-product cost items.
// Used by: settings page (display + editing), orders API (calculations + hover labels).

export interface CostItem {
  id:       string
  position: string    // display label, e.g. "Production costs (EXW)"
  supplier: string    // display label, e.g. "Quanzhou Pengxin Bags"
  amount:   number    // €
  costType: 'manufacturing' | 'ib_shipping'  // how it maps to COST_MAP calculations
}

export interface ProductCostConfig {
  id:       string    // e.g. 'bevi-bag'
  name:     string    // display name
  titleKey: string    // keyword matched case-insensitively against Shopify line item title
  items:    CostItem[]
}

export const DEFAULT_PRODUCT_COSTS: ProductCostConfig[] = [
  {
    id: 'bevi-bag', name: 'Bevi Bag Full Set', titleKey: 'full set',
    items: [
      { id: 'm1', position: 'Production costs (EXW)',     supplier: 'Quanzhou Pengxin Bags', amount: 9.01, costType: 'manufacturing' },
      { id: 'm2', position: 'Shipping & customs to Graz', supplier: 'Shenzhen Amanda',       amount: 3.89, costType: 'ib_shipping'   },
    ],
  },
  {
    id: 'water-bladder', name: 'Bevi Water Bladder + Tubes', titleKey: 'water bladder',
    items: [
      { id: 'm1', position: 'Production costs (EXW)',     supplier: 'Quanzhou Pengxin Bags', amount: 2.53, costType: 'manufacturing' },
      { id: 'm2', position: 'Shipping & customs to Graz', supplier: 'Shenzhen Amanda',       amount: 0.40, costType: 'ib_shipping'   },
    ],
  },
  {
    id: 'phone-strap', name: 'Bevi Phone Strap', titleKey: 'phone strap',
    items: [
      { id: 'm1', position: 'Production costs (EXW)',     supplier: 'Dongguan Webbing',  amount: 0.33, costType: 'manufacturing' },
      { id: 'm2', position: 'Packaging (EXW)',            supplier: 'Langhai Printing',  amount: 0.11, costType: 'ib_shipping'   },
      { id: 'm3', position: 'Shipping & customs to Graz', supplier: 'Shenzhen Amanda',   amount: 0.00, costType: 'ib_shipping'   },
    ],
  },
  {
    id: 'cleaning-kit', name: 'Bevi Cleaning Kit', titleKey: 'cleaning kit',
    items: [
      { id: 'm1', position: 'Production costs (EXW)',     supplier: 'Licheng Plastic', amount: 1.75, costType: 'manufacturing' },
      { id: 'm2', position: 'Shipping & customs to Graz', supplier: 'Shenzhen Amanda', amount: 1.46, costType: 'ib_shipping'   },
    ],
  },
]

// Merge persisted amount overrides (Record<productId, Record<itemId, amount>>) into defaults.
export function applyOverrides(
  overrides: Record<string, Record<string, number>>,
): ProductCostConfig[] {
  return DEFAULT_PRODUCT_COSTS.map(p => ({
    ...p,
    items: p.items.map(it => ({
      ...it,
      amount: overrides[p.id]?.[it.id] ?? it.amount,
    })),
  }))
}

// Build a lookup map: titleKey → { manufacturing, ib_shipping }
export function buildAmountsMap(
  config: ProductCostConfig[],
): Map<string, { manufacturing: number; ib_shipping: number }> {
  const map = new Map<string, { manufacturing: number; ib_shipping: number }>()
  for (const p of config) {
    map.set(p.titleKey, {
      manufacturing: p.items.filter(i => i.costType === 'manufacturing').reduce((s, i) => s + i.amount, 0),
      ib_shipping:   p.items.filter(i => i.costType === 'ib_shipping'  ).reduce((s, i) => s + i.amount, 0),
    })
  }
  return map
}
