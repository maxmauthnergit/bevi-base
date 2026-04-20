import { NextResponse } from 'next/server'
import { getWeShipStock } from '@/lib/weship/queries'
import { getInventoryLevels } from '@/lib/shopify/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [weship, shopify] = await Promise.allSettled([
    getWeShipStock(),
    getInventoryLevels(),
  ])

  return NextResponse.json({
    weship_skus: weship.status === 'fulfilled'
      ? weship.value.map(w => ({ sku: w.sku, name: w.name, on_stock: w.on_stock }))
      : { error: (weship.reason as Error).message },
    shopify_skus: shopify.status === 'fulfilled'
      ? shopify.value.map(s => ({ sku: s.sku, product: s.product_name, variant: s.variant }))
      : { error: (shopify.reason as Error).message },
  })
}
