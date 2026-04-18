import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const db = createServerClient()

  const [{ data: txns, error: txErr }, { data: snap, error: snapErr }] = await Promise.all([
    db.from('bank_transactions')
      .select('id, date, counterparty, reference, amount_eur')
      .order('date', { ascending: false })
      .limit(2000),
    db.from('bank_balance_snapshots')
      .select('statement_month, closing_balance_eur')
      .order('statement_month', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (txErr)   return NextResponse.json({ error: txErr.message },   { status: 500 })
  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 })

  return NextResponse.json({
    transactions:          txns ?? [],
    current_balance_eur:   snap?.closing_balance_eur ?? null,
    balance_as_of_month:   snap?.statement_month ?? null,
  })
}
