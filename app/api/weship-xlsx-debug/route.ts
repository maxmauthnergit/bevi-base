// Debug endpoint — visit /api/weship-xlsx-debug?month=2026-03 to inspect
// the column headers and a sample row from the WeShip XLSX for that month.
// Use this to verify the xlsx-parser column-name heuristics are matching
// your actual file format before relying on the parsed data in Orders.

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'Provide ?month=YYYY-MM' }, { status: 400 })

  const client = createServerClient()
  const { data, error } = await client.storage
    .from('weship-invoices')
    .download(`${month}-services.xlsx`)

  if (error || !data) return NextResponse.json({ error: 'File not found', detail: error?.message }, { status: 404 })

  const buffer  = await data.arrayBuffer()
  const wb      = XLSX.read(buffer, { type: 'buffer' })
  const sheetNames = wb.SheetNames
  const ws      = wb.Sheets[sheetNames[0]]
  const rows    = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  return NextResponse.json({
    month,
    sheetNames,
    rowCount:  rows.length,
    headers:   rows.length ? Object.keys(rows[0]) : [],
    sampleRows: rows.slice(0, 3),
  })
}
