import { NextRequest, NextResponse } from 'next/server'
import { getSalesSummary } from '@/lib/shopify/sales-summary'

export const dynamic = 'force-dynamic'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') // YYYY-MM-DD
  const to   = req.nextUrl.searchParams.get('to')   // YYYY-MM-DD

  if (!from || !to || !DAY.test(from) || !DAY.test(to)) {
    return NextResponse.json({ error: 'from and to are required (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const result = await getSalesSummary(from, to)
    return NextResponse.json({ ...result, period: { from, to } })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
