import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getShopTimezone } from '@/lib/shopify/queries'
import { syncOrderFacts } from '@/lib/kpis/order-facts'
import { requireUser } from '@/lib/supabase/require-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/order-facts/sync          → orders changed since the last sync
// POST /api/order-facts/sync?full=1   → rebuild every row, e.g. after the
//                                       product mapping changed
export async function POST(req: NextRequest) {
  const denied = await requireUser()
  if (denied) return denied

  const full = req.nextUrl.searchParams.get('full') === '1'
  try {
    const synced = await syncOrderFacts(createServerClient(), await getShopTimezone(), { full })
    return NextResponse.json({ ok: true, full, synced })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
