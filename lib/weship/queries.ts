import { weshipFetch } from './client'
import type { WeShipProduct, WeShipProductsResponse } from './client'

// ─── Stock levels from WeShip ─────────────────────────────────────────────────

export interface WeShipStockLevel {
  sku: string
  name: string
  on_stock: number        // sum of all on_stock[].quantity
  outgoing: number        // sum of all outgoing_stock[].quantity (in transit)
}

export async function getWeShipStock(): Promise<WeShipStockLevel[]> {
  const data = await weshipFetch<WeShipProductsResponse>(
    '/mapi/product/search',
    { next: { revalidate: 0 } }
  )

  return (data.rows ?? []).map((p: WeShipProduct) => ({
    sku:      p.sku,
    name:     p.name,
    on_stock: (p.on_stock ?? []).reduce((s, e) => s + (e.quantity ?? 0), 0),
    outgoing: (p.outgoing_stock ?? []).reduce((s, e) => s + (e.quantity ?? 0), 0),
  }))
}
