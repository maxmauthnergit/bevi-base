import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { balance_eur, statement_month } = await req.json()
  if (typeof balance_eur !== 'number' || isNaN(balance_eur))
    return NextResponse.json({ error: 'balance_eur must be a number' }, { status: 400 })
  if (!statement_month || !/^\d{4}-\d{2}$/.test(statement_month))
    return NextResponse.json({ error: 'statement_month must be YYYY-MM' }, { status: 400 })

  const db = createServerClient()
  const { error } = await db
    .from('bank_balance_snapshots')
    .upsert({ statement_month, closing_balance_eur: balance_eur }, { onConflict: 'statement_month' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
