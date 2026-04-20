import { NextResponse } from 'next/server'
import { weshipFetch } from '@/lib/weship/client'
import type { WeShipProductsResponse } from '@/lib/weship/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await weshipFetch<WeShipProductsResponse>('/mapi/product/search')
  // Return the full raw object for the first real product so we can see every field
  const sample = data.rows?.find(p => p.sku)
  return NextResponse.json({ sample })
}
