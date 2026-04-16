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

  // Find "Kontoführung" or similar known-debit keyword and dump char codes
  const debitKeywords = ['Kontoführung', 'Kapitalertragsteuer', 'Sollzinsen']
  let debit_char_probe: Record<string, string> | null = null
  for (const kw of debitKeywords) {
    const idx = text.indexOf(kw)
    if (idx >= 0) {
      const snippet = text.slice(Math.max(0, idx - 5), idx + kw.length + 80)
      debit_char_probe = {
        keyword: kw,
        raw_snippet: snippet,
        char_codes: [...snippet].map(c => `${c === '\n' ? '\\n' : c}(${c.charCodeAt(0)})`).join(' '),
      }
      break
    }
  }

  return NextResponse.json({
    statement_month:      result.statement_month,
    closing_balance_eur:  result.closing_balance_eur,
    transaction_count:    result.transactions.length,
    first_20_transactions: result.transactions.slice(0, 20).map(t => ({
      date:        t.date,
      counterparty: t.counterparty,
      reference:   t.reference,
      amount_eur:  t.amount_eur,
      raw:         t.raw,
    })),
    debit_char_probe,
    raw_text_0_3000:  text.slice(0, 3000),
    raw_text_3000_6000: text.slice(3000, 6000),
  })
}
