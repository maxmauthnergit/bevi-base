import { NextResponse } from 'next/server'
import { getWeShipStock } from '@/lib/weship/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stock = await getWeShipStock()
    return NextResponse.json({
      ok: true,
      count: stock.length,
      stock,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
