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

  return NextResponse.json({
    raw_text_preview: text.slice(0, 3000),
    statement_month: result.statement_month,
    closing_balance_eur: result.closing_balance_eur,
    transaction_count: result.transactions.length,
    first_10: result.transactions.slice(0, 10),
  })
}
