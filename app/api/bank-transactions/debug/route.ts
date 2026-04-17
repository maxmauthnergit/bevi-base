import { NextRequest, NextResponse } from 'next/server'
import { parseSparkasseText } from '@/lib/bank/parser'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js')
  const { text } = await pdfParse(buffer)

  const result = parseSparkasseText(text)

  const balanceLines = text.split('\n')
    .map((l, i) => ({ i, l }))
    .filter(({ l }) => /saldo|kontostand/i.test(l))
    .map(({ i, l }) => `[${i}] ${l}`)

  return NextResponse.json({
    statement_month:       result.statement_month,
    closing_balance_eur:   result.closing_balance_eur,
    transaction_count:     result.transactions.length,
    balance_keyword_lines: balanceLines,
    first_20_transactions: result.transactions.slice(0, 20).map(t => ({
      date:         t.date,
      counterparty: t.counterparty,
      reference:    t.reference,
      amount_eur:   t.amount_eur,
    })),
    raw_text_0_3000: text.slice(0, 3000),
  })
}
