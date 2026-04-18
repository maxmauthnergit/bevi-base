import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function DELETE(req: NextRequest) {
  const from           = req.nextUrl.searchParams.get('from')
  const to             = req.nextUrl.searchParams.get('to')
  const statementMonth = req.nextUrl.searchParams.get('statement_month')

  const db = createServerClient()

  let txQuery = db.from('bank_transactions').delete()
  if (from && to)   txQuery = txQuery.gte('date', from).lte('date', to)
  else if (from)    txQuery = txQuery.gte('date', from)
  else if (to)      txQuery = txQuery.lte('date', to)
  else              txQuery = txQuery.not('id', 'is', null)

  const { error: txErr } = await txQuery
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  if (statementMonth) {
    await db.from('bank_balance_snapshots').delete().eq('statement_month', statementMonth)
  }

  return NextResponse.json({ ok: true })
}

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
