import { NextResponse } from 'next/server'
import { getDailySpend } from '@/lib/meta/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await getDailySpend()
    return NextResponse.json({
      ok: true,
      count: rows.length,
      first: rows[0],
      last: rows[rows.length - 1],
      rows,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
