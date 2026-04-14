// Debug endpoint — visit /api/weship-xlsx-debug?month=2026-03 to inspect
// the column headers and sample rows from the WeShip XLSX for that month.

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'Provide ?month=YYYY-MM' }, { status: 400 })

  const client = createServerClient()
  const filename = `${month}-services.xlsx`

  const { data: signed, error: signErr } = await client.storage
    .from('weship-invoices')
    .createSignedUrl(filename, 60)

  if (signErr || !signed) {
    return NextResponse.json({ error: 'Could not sign URL', detail: signErr?.message }, { status: 404 })
  }

  const fetchRes = await fetch(signed.signedUrl)
  if (!fetchRes.ok) {
    return NextResponse.json({ error: `HTTP ${fetchRes.status} fetching file` }, { status: 404 })
  }

  const buffer    = Buffer.from(await fetchRes.arrayBuffer())
  const wb        = XLSX.read(buffer, { type: 'buffer' })
  const sheetNames = wb.SheetNames
  const ws        = wb.Sheets[sheetNames[0]]

  // Raw rows (all rows as arrays, so we can see the metadata header too)
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  // Also parse with default settings (first row as headers)
  const defaultRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  return NextResponse.json({
    month,
    sheetNames,
    // First 10 raw rows so you can see the full file structure including metadata
    rawRows: rawRows.slice(0, 10),
    // Default parse headers (first row treated as header)
    defaultHeaders: defaultRows.length ? Object.keys(defaultRows[0]) : [],
    defaultSampleRows: defaultRows.slice(0, 5),
  })
}
