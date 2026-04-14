import * as XLSX from 'xlsx'
import { createServerClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeShipOrderCosts {
  weship:   number   // fulfillment variable (Auftragsabwicklung, Kommissionierung, etc.)
  shipping: number   // DHL / Post delivery cost
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

const ORDER_REF_COLS  = ['referenz', 'ihre auftragsnummer', 'bestellnummer', 'auftragsnummer', 'order', 'shopify', 'bestellung', 'ext. referenz', 'externe referenz', 'kundennummer']
const SERVICE_TYPE_COLS = ['leistung', 'leistungsart', 'service', 'beschreibung', 'position', 'art', 'leistungsbeschreibung']
const AMOUNT_COLS     = ['gesamt', 'netto', 'betrag', 'total', 'preis', 'kosten', 'summe', 'einzelpreis', 'gesamtpreis', 'amount']

const SHIPPING_KEYWORDS = ['versand', 'dhl', 'ups', 'dpd', 'hermes', 'post', 'zustellung', 'transport', 'lieferung', 'shipping', 'paketversand']
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
  if (typeof v === 'number') return v
  return parseFloat(String(v ?? '0').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
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
    let downloadResult = await client.storage.from('weship-invoices').download(filename)

    if (downloadResult.error || !downloadResult.data) {
      // Scan bucket for any xlsx mentioning this month
      const { data: listed } = await client.storage.from('weship-invoices').list()
      const candidate = listed?.find(f =>
        f.name.endsWith('.xlsx') && f.name.includes(month)
      )
      if (!candidate) {
        const allNames = listed?.map(f => f.name).join(', ') || 'bucket empty or inaccessible'
        return empty('unknown', `No XLSX for ${month} found. Files in bucket: ${allNames}`)
      }
      filename = candidate.name
      downloadResult = await client.storage.from('weship-invoices').download(filename)
    }

    const { data, error } = downloadResult
    if (error || !data) return empty('unknown', error?.message ?? `Download failed for ${filename}`)

    const buffer = await data.arrayBuffer()
    const wb     = XLSX.read(buffer, { type: 'buffer' })
    const ws     = wb.Sheets[wb.SheetNames[0]]
    const rows   = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    if (!rows.length) return empty()

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
        const ref = String(row[orderCol] ?? '').trim()
        const svc = String(row[serviceCol] ?? '').toLowerCase()
        const amt = parseAmount(row[amountCol])
        if (!amt) continue

        if (matchesAny(svc, STORAGE_KEYWORDS)) {
          lagergebuehr += amt
          continue
        }
        if (!ref) continue

        const key = normaliseOrderRef(ref)
        if (!byOrder.has(key)) byOrder.set(key, { weship: 0, shipping: 0 })
        const entry = byOrder.get(key)!

        if (matchesAny(svc, SHIPPING_KEYWORDS)) entry.shipping += amt
        else entry.weship += amt
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
          byOrder.set(normaliseOrderRef(ref), { weship, shipping })
        }
      }

      return {
        byOrder, lagergebuehr, parsed: byOrder.size > 0,
        debug: { headers, rowCount: rows.length, detectedFormat: 'row-per-order', filename },
      }
    }

    return { byOrder: new Map(), lagergebuehr: 0, parsed: false,
      debug: { headers, rowCount: rows.length, detectedFormat: 'unknown', filename } }

  } catch (e) {
    return empty('unknown', String(e))
  }
}
