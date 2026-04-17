import { NextRequest, NextResponse } from 'next/server'
import { parseSparkasseText } from '@/lib/bank/parser'

export function GET() {
  const html = `<!DOCTYPE html><html><body style="font-family:monospace;padding:24px">
<h2>Bank PDF Debug</h2>
<form method="POST" enctype="multipart/form-data">
  <input type="file" name="file" accept=".pdf" required>
  <button type="submit" style="margin-left:12px">Analyse</button>
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
  const txns = result.transactions

  // ── Per-month breakdown of parsed transactions ────────────────────────────
  const byMonth: Record<string, { count: number; credits: number; debits: number; net: number }> = {}
  for (const t of txns) {
    const mo = t.date.slice(0, 7)
    if (!byMonth[mo]) byMonth[mo] = { count: 0, credits: 0, debits: 0, net: 0 }
    byMonth[mo].count++
    if (t.amount_eur >= 0) byMonth[mo].credits += t.amount_eur
    else                   byMonth[mo].debits  += t.amount_eur
    byMonth[mo].net += t.amount_eur
  }

  // ── PDF-stated totals per month (Kontoeingänge / Kontoausgänge) ───────────
  const pdfTotals: Array<{ label: string; amount: number }> = []
  const totRe = /(\d+\s+Konto(?:eingänge|ausgänge)[^\n€]*€[\d.]+,\d{2})/g
  let tm
  while ((tm = totRe.exec(text)) !== null)
    pdfTotals.push({ label: tm[1].replace(/\s+/g, ' ').trim(), amount: 0 })

  // Simpler: just extract the numbers
  const credLines: number[] = []
  const debLines:  number[] = []
  const crRe = /Kontoeingänge[^€]*€([\d.]+,\d{2})/g
  const drRe = /Kontoausgänge[^€]*€([\d.]+,\d{2})/g
  let m
  while ((m = crRe.exec(text)) !== null)
    credLines.push(parseFloat(m[1].replace(/\./g, '').replace(',', '.')))
  while ((m = drRe.exec(text)) !== null)
    debLines.push(parseFloat(m[1].replace(/\./g, '').replace(',', '.')))

  // ── Transaction totals ────────────────────────────────────────────────────
  const txnSum     = txns.reduce((s, t) => s + t.amount_eur, 0)
  const txnCredits = txns.filter(t => t.amount_eur > 0).reduce((s, t) => s + t.amount_eur, 0)
  const txnDebits  = txns.filter(t => t.amount_eur < 0).reduce((s, t) => s + t.amount_eur, 0)

  // ── Large transactions (|amount| ≥ 1 000) ────────────────────────────────
  const largeTxns = txns
    .filter(t => Math.abs(t.amount_eur) >= 1000)
    .sort((a, b) => b.amount_eur - a.amount_eur)
    .map(t => ({ date: t.date, counterparty: t.counterparty, amount_eur: t.amount_eur }))

  return NextResponse.json({
    transaction_count:  txns.length,
    txn_sum:            Math.round(txnSum * 100) / 100,
    txn_credits:        Math.round(txnCredits * 100) / 100,
    txn_debits:         Math.round(txnDebits * 100) / 100,
    pdf_credit_totals:  credLines,
    pdf_debit_totals:   debLines,
    pdf_net_per_period: Math.round((credLines.reduce((s,x)=>s+x,0) - debLines.reduce((s,x)=>s+x,0)) * 100) / 100,
    by_month:           Object.fromEntries(
      Object.entries(byMonth)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([mo, v]) => [mo, {
          count:   v.count,
          credits: Math.round(v.credits * 100) / 100,
          debits:  Math.round(v.debits  * 100) / 100,
          net:     Math.round(v.net     * 100) / 100,
        }])
    ),
    large_transactions: largeTxns,
    raw_text_0_2000:    text.slice(0, 2000),
    raw_text_end_2000:  text.slice(-2000),
  })
}
