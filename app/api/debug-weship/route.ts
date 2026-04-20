import { NextResponse } from 'next/server'
import { weshipFetch } from '@/lib/weship/client'
import type { WeShipProductsResponse } from '@/lib/weship/client'

export const dynamic = 'force-dynamic'

async function tryEndpoint(path: string, body?: object) {
  try {
    const data = await weshipFetch<unknown>(path, body ? { body: JSON.stringify(body) } : {})
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function GET() {
  // Find the Black bag product id first
  const products = await weshipFetch<WeShipProductsResponse>('/mapi/product/search')
  const black = products.rows?.find(p => p.sku === '9180013220099')

  const [
    stockSearch,
    lotSearch,
    quantSearch,
    stockByProduct,
    inventorySearch,
  ] = await Promise.all([
    tryEndpoint('/mapi/stock/search'),
    tryEndpoint('/mapi/lot/search'),
    tryEndpoint('/mapi/quant/search'),
    black ? tryEndpoint('/mapi/stock/search', { product_id: black.id }) : Promise.resolve({ ok: false, error: 'no product' }),
    tryEndpoint('/mapi/inventory/search'),
  ])

  return NextResponse.json({
    product_id: black?.id,
    stock_search:      stockSearch,
    lot_search:        lotSearch,
    quant_search:      quantSearch,
    stock_by_product:  stockByProduct,
    inventory_search:  inventorySearch,
  })
}
