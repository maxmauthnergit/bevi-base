import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeShipOrderCosts {
  weship:        number   // fulfillment variable total
  shipping:      number   // DHL / Post delivery total
  weshipItems:   { product: string; amount: number }[]
  shippingItems: { product: string; amount: number }[]
}

export interface WeShipMonthData {
  byOrder:      Map<string, WeShipOrderCosts>  // key = Shopify order name e.g. "#1234"
  lagergebuehr: number                         // monthly storage fee (not per order)
  parsed:       boolean                        // false → file missing or unreadable
  debug: {
    headers:    string[]                       // all column headers found in the sheet
    rowCount:   number
    detectedFormat: 'row-per-service' | 'row-per-order' | 'unknown'
    filename?:  string                         // actual file used
    error?:     string                         // Supabase / parse error message if any
  }
}

// ─── Column-name heuristics ───────────────────────────────────────────────────
// Adjust these lists if your WeShip file uses different column names.

const ORDER_REF_COLS  = ['reference', 'referenz', 'ihre auftragsnummer', 'bestellnummer', 'auftragsnummer', 'order', 'shopify', 'bestellung', 'ext. referenz', 'externe referenz', 'kundennummer']
const SERVICE_TYPE_COLS = ['product', 'leistung', 'leistungsart', 'service', 'beschreibung', 'position', 'art', 'leistungsbeschreibung']
const AMOUNT_COLS     = ['total price', 'gesamt', 'netto', 'betrag', 'total', 'preis', 'kosten', 'summe', 'einzelpreis', 'gesamtpreis', 'amount']

// "Versand" is the exact WeShip line-item name for end-customer delivery.
// Carrier names (DHL, UPS…) are kept as fallback for column-header Format B.
// Intentionally narrow — "post", "transport", "lieferung" are excluded to
// avoid misclassifying WeShip internal service lines.
const SHIPPING_KEYWORDS = ['versand', 'dhl', 'ups', 'dpd', 'hermes', 'shipping']
const STORAGE_KEYWORDS  = ['lager', 'storage', 'lagergebühr', 'lagerkosten', 'einlagerung', 'auslagerung']

function matchesAny(str: string, keywords: string[]): boolean {
  const s = str.toLowerCase()
  return keywords.some(k => s.includes(k))
}

function findHeader(headers: string[], candidates: string[]): string | null {
  for (const h of headers) {
    if (matchesAny(h, candidates)) return h
  }
  return null
}

function parseAmount(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  const s = String(v ?? '').trim()
  // Reject date-like strings (YYYY-MM-DD) before parseFloat sees them
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 0
  return parseFloat(s.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
}

function normaliseOrderRef(raw: string): string {
  const s = raw.trim()
  // Handle numeric-only refs (WeShip may strip the #)
  return /^\d+$/.test(s) ? `#${s}` : s.startsWith('#') ? s : `#${s}`
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export async function getWeShipMonthData(month: string): Promise<WeShipMonthData> {
  const empty = (detectedFormat: WeShipMonthData['debug']['detectedFormat'] = 'unknown', error?: string): WeShipMonthData => ({
    byOrder: new Map(), lagergebuehr: 0, parsed: false,
    debug: { headers: [], rowCount: 0, detectedFormat, error },
  })

  try {
    const client = createServerClient()

    // ── Find the file: try canonical name first, then scan the bucket ─────────
    // Users may upload files directly to Supabase with arbitrary names.
    // We look for any .xlsx whose name contains the month string (e.g. "2026-03").
    let filename = `${month}-services.xlsx`

    // Check if canonical name exists by trying to sign it; fall back to scanning
    const { data: signedCheck, error: signedCheckErr } = await client.storage
      .from('weship-invoices')
      .createSignedUrl(filename, 60)

    if (signedCheckErr || !signedCheck) {
      // Scan bucket for any xlsx mentioning this month
      const { data: listed } = await client.storage.from('weship-invoices').list()
      const candidate = listed?.find(f =>
        f.name.endsWith('.xlsx') && f.name.includes(month)
      )
      if (!candidate) {
        const allNames = listed?.map(f => f.name).join(', ') || 'bucket empty or inaccessible'
        return empty('unknown', `No XLSX for ${month} found. Files: ${allNames}`)
      }
      filename = candidate.name
    }

    // Download via signed URL (same approach as the working Settings download endpoint)
    const { data: signed, error: signErr } = await client.storage
      .from('weship-invoices')
      .createSignedUrl(filename, 60)

    if (signErr || !signed) return empty('unknown', signErr?.message ?? `Could not sign URL for ${filename}`)

    const fetchRes = await fetch(signed.signedUrl)
    if (!fetchRes.ok) return empty('unknown', `HTTP ${fetchRes.status} fetching ${filename}`)

    // Convert to Node.js Buffer — SheetJS type:'buffer' requires this, not ArrayBuffer
    const buffer = Buffer.from(await fetchRes.arrayBuffer())
    let wb: XLSX.WorkBook, rows: Record<string, unknown>[]
    try {
      wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]

      // WeShip files often have metadata rows at the top (invoice number, date range, etc.)
      // Scan all rows as raw arrays to find the row that contains real column headers.
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
      const ALL_COL_KEYWORDS = [...ORDER_REF_COLS, ...SERVICE_TYPE_COLS, ...AMOUNT_COLS]
      let headerRowIdx = 0
      for (let i = 0; i < Math.min(raw.length, 30); i++) {
        const cells = (raw[i] as unknown[]).map(c => String(c ?? '').toLowerCase())
        if (cells.some(c => ALL_COL_KEYWORDS.some(k => c === k || c.includes(k)))) {
          headerRowIdx = i
          break
        }
      }

      // Re-parse starting from the detected header row
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', range: headerRowIdx })
    } catch (parseErr) {
      return empty('unknown', `XLSX parse error: ${String(parseErr)}`)
    }

    if (!rows.length) {
      return empty('unknown', `File ${filename} has no data rows (sheet: ${wb!.SheetNames[0]})`)
    }

    const headers    = Object.keys(rows[0])
    const orderCol   = findHeader(headers, ORDER_REF_COLS)
    const serviceCol = findHeader(headers, SERVICE_TYPE_COLS)
    const amountCol  = findHeader(headers, AMOUNT_COLS)

    // ── Format A: one row per service line  ───────────────────────────────────
    // Columns: [order-ref] [service-type] [amount]
    if (orderCol && serviceCol && amountCol) {
      const byOrder = new Map<string, WeShipOrderCosts>()
      let lagergebuehr = 0

      for (const row of rows) {
        const ref     = String(row[orderCol] ?? '').trim()
        const svc     = String(row[serviceCol] ?? '').trim()
        const svcLow  = svc.toLowerCase()
        const amt     = parseAmount(row[amountCol])
        if (!amt) continue

        // Storage fees are not per-order — accumulate separately
        if (matchesAny(svcLow, STORAGE_KEYWORDS)) {
          lagergebuehr += amt
          continue
        }
        if (!ref) continue

        const key = normaliseOrderRef(ref)
        if (!byOrder.has(key)) byOrder.set(key, { weship: 0, shipping: 0, weshipItems: [], shippingItems: [] })
        const entry = byOrder.get(key)!

        // "Versand" (and carrier names) → shipping; everything else → weship
        if (matchesAny(svcLow, SHIPPING_KEYWORDS)) {
          entry.shipping += amt
          entry.shippingItems.push({ product: svc, amount: amt })
        } else {
          entry.weship += amt
          entry.weshipItems.push({ product: svc, amount: amt })
        }
      }

      return {
        byOrder, lagergebuehr, parsed: byOrder.size > 0,
        debug: { headers, rowCount: rows.length, detectedFormat: 'row-per-service', filename },
      }
    }

    // ── Format B: one row per order, cost columns per service type ────────────
    if (orderCol) {
      const byOrder = new Map<string, WeShipOrderCosts>()
      let lagergebuehr = 0

      for (const row of rows) {
        const ref = String(row[orderCol] ?? '').trim()
        let weship = 0, shipping = 0

        for (const h of headers) {
          if (h === orderCol) continue
          const amt  = parseAmount(row[h])
          if (!amt) continue
          const hLow = h.toLowerCase()
          if (matchesAny(hLow, STORAGE_KEYWORDS)) { if (!ref) lagergebuehr += amt; continue }
          if (matchesAny(hLow, SHIPPING_KEYWORDS)) shipping += amt
          else weship += amt
        }

        if (ref && (weship + shipping > 0)) {
          byOrder.set(normaliseOrderRef(ref), { weship, shipping, weshipItems: [], shippingItems: [] })
        }
      }

      return {
        byOrder, lagergebuehr, parsed: byOrder.size > 0,
        debug: { headers, rowCount: rows.length, detectedFormat: 'row-per-order', filename },
      }
    }

    return { byOrder: new Map(), lagergebuehr: 0, parsed: false,
      debug: { headers, rowCount: rows.length, detectedFormat: 'unknown', filename,
               error: `No order-ref column found. Headers: ${headers.join(', ')}` } }

  } catch (e) {
    return empty('unknown', String(e))
  }
}
