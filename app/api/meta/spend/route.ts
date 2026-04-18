import { NextResponse } from 'next/server'
import { getMetaKPIs } from '@/lib/meta/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { kpis } = await getMetaKPIs()
    return NextResponse.json({ spend_mtd: kpis.ad_spend_mtd?.value ?? null })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
