import { NextRequest, NextResponse } from 'next/server'
import { parseSparkasseText } from '@/lib/bank/parser'

export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><title>Bank Parser Debug</title>
<style>body{font-family:monospace;padding:24px;max-width:900px}
textarea{width:100%;height:300px;font-size:11px;margin-top:12px}
pre{background:#f5f5f0;padding:12px;overflow:auto;font-size:11px;white-space:pre-wrap}
</style></head><body>
<h2>Bank Parser Debug</h2>
<form method="POST" enctype="multipart/form-data">
  <input type="file" name="file" accept=".pdf" required />
  <button type="submit" style="margin-left:12px">Parse PDF</button>
</form>
</body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

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

  const html = `<!DOCTYPE html>
<html><head><title>Bank Parser Debug</title>
<style>body{font-family:monospace;padding:24px;max-width:1100px}
pre{background:#f5f5f0;padding:12px;overflow:auto;font-size:11px;white-space:pre-wrap;border:1px solid #ddd}
h3{margin-top:24px}
</style></head><body>
<h2>Bank Parser Debug — ${file.name}</h2>
<p><strong>Statement month:</strong> ${result.statement_month || '(not found)'}</p>
<p><strong>Closing balance:</strong> ${result.closing_balance_eur ?? '(not found)'}</p>
<p><strong>Transactions found:</strong> ${result.transactions.length}</p>

<h3>First 20 transactions</h3>
<pre>${JSON.stringify(result.transactions.slice(0, 20).map(t => ({
  date: t.date,
  counterparty: t.counterparty,
  reference: t.reference,
  amount_eur: t.amount_eur,
})), null, 2)}</pre>

<h3>Raw text (first 4000 chars)</h3>
<pre>${text.slice(0, 4000).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>

<h3>Raw text (chars 4000–8000)</h3>
<pre>${text.slice(4000, 8000).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>

<p><a href="/api/bank-transactions/debug">← Upload another</a></p>
</body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
