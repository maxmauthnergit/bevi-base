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

  // Use pdfjs directly to get x-coordinates of amount items
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise

  type PdfItem = { str: string; x: number; y: number }
  const pdfItems: PdfItem[] = []
  for (let p = 1; p <= Math.min(pdfDoc.numPages, 3); p++) {
    const page = await pdfDoc.getPage(p)
    const tc = await page.getTextContent()
    for (const item of tc.items as any[]) {
      if (item.str) pdfItems.push({ str: item.str, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) })
    }
  }

  // Show all items on the same "line" as known debit (Kontoführung) and credit (Stripe)
  const kontofItem = pdfItems.find(it => it.str.includes('Kontoführ'))
  const stripeItem  = pdfItems.find(it => it.str.includes('Stripe'))

  const lineItems = (anchorY: number | undefined) => anchorY == null ? [] :
    pdfItems.filter(it => Math.abs(it.y - anchorY) < 4).sort((a, b) => a.x - b.x)

  const debit_line_items  = lineItems(kontofItem?.y)
  const credit_line_items = lineItems(stripeItem?.y)

  // Show all €-amount items with x-coordinates (first 40)
  const euro_x_positions = pdfItems
    .filter(it => /€/.test(it.str))
    .slice(0, 40)
    .map(it => ({ str: it.str.trim(), x: it.x, y: it.y }))

  return NextResponse.json({
    statement_month:      result.statement_month,
    closing_balance_eur:  result.closing_balance_eur,
    transaction_count:    result.transactions.length,
    debit_line_items,
    credit_line_items,
    euro_x_positions,
    first_20_transactions: result.transactions.slice(0, 20).map(t => ({
      date:        t.date,
      counterparty: t.counterparty,
      reference:   t.reference,
      amount_eur:  t.amount_eur,
    })),
    raw_text_0_3000:  text.slice(0, 3000),
  })
}
