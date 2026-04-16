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

  // Find all U+E09E occurrences and show context (first 40)
  const SOLL_CHAR = '\uE09E'
  const soll_occurrences: string[] = []
  let si = 0
  while (soll_occurrences.length < 40) {
    const idx = text.indexOf(SOLL_CHAR, si)
    if (idx < 0) break
    const ctx = text.slice(Math.max(0, idx - 40), idx + 20).replace(/\n/g, '↵')
    soll_occurrences.push(ctx)
    si = idx + 1
  }

  // Show char codes for a wider window around "Kontoführung"
  const kwIdx = text.indexOf('Kontoführung')
  const char_probe_wide = kwIdx >= 0
    ? [...text.slice(Math.max(0, kwIdx - 5), kwIdx + 150)]
        .map(c => `${c === '\n' ? '\\n' : c.replace(/\uE09E/, '[E09E]')}(${c.charCodeAt(0)})`).join(' ')
    : null

  return NextResponse.json({
    statement_month:      result.statement_month,
    closing_balance_eur:  result.closing_balance_eur,
    transaction_count:    result.transactions.length,
    soll_char_count:      soll_occurrences.length,
    soll_occurrences,
    first_20_transactions: result.transactions.slice(0, 20).map(t => ({
      date:        t.date,
      counterparty: t.counterparty,
      reference:   t.reference,
      amount_eur:  t.amount_eur,
      raw:         t.raw,
    })),
    char_probe_wide,
    raw_text_0_3000:  text.slice(0, 3000),
    raw_text_3000_6000: text.slice(3000, 6000),
  })
}
