import { NextResponse } from 'next/server'
import { weshipFetch } from '@/lib/weship/client'
import type { WeShipProductsResponse } from '@/lib/weship/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await weshipFetch<WeShipProductsResponse>('/mapi/product/search')
  // Return raw on_stock + outgoing_stock entries for the first real product
  const sample = data.rows?.find(p => p.sku)
  return NextResponse.json({
    sample_sku: sample?.sku,
    on_stock_entries:       sample?.on_stock,
    outgoing_stock_entries: sample?.outgoing_stock,
  })
}
