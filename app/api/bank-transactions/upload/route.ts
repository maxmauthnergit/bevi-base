import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { parseSparkasseText } from '@/lib/bank/parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let rawText: string
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      rawText = result.text
      await parser.destroy()
    } catch (e) {
      return NextResponse.json({ error: `PDF parse failed: ${(e as Error).message}` }, { status: 422 })
    }

    const { statement_month, closing_balance_eur, transactions } = parseSparkasseText(rawText)

    const db = createServerClient()

    if (transactions.length) {
      const rows = transactions.map(t => ({
        id:           t.id,
        date:         t.date,
        counterparty: t.counterparty,
        reference:    t.reference,
        amount_eur:   t.amount_eur,
        raw:          t.raw,
      }))
      const { error } = await db
        .from('bank_transactions')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (statement_month && closing_balance_eur !== null) {
      const { error } = await db
        .from('bank_balance_snapshots')
        .upsert(
          { statement_month, closing_balance_eur },
          { onConflict: 'statement_month' },
        )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      statement_month,
      closing_balance_eur,
      transactions_parsed: transactions.length,
      transactions_new: transactions.length,
    })
  } catch (e) {
    return NextResponse.json({ error: `Unexpected error: ${(e as Error).message}` }, { status: 500 })
  }
}
