'use client'

import { Fragment, useEffect, useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import { Card } from '@/components/ui/Card'
import type { SalesSummary, SalesSummarySource } from '@/lib/shopify/sales-summary'

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtEur(value: number) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' €'
}

interface Row {
  key:         keyof SalesSummary
  label:       string
  description: string
  sign:        '' | '−' | '+' | '='
  total?:      boolean
}

// Order and wording mirror the sales waterfall: each subtotal sits under the
// rows that feed it.
const ROWS: Row[] = [
  { key: 'gross_sales', sign: '',  label: 'Gross Sales',   description: 'Preis × Menge, ohne USt', total: true },
  { key: 'discounts',   sign: '−', label: 'Discounts',     description: 'Rabatte auf Artikel, ohne USt' },
  { key: 'returns',     sign: '−', label: 'Returns',       description: 'Erstattete Artikel, ohne USt' },
  { key: 'net_sales',   sign: '=', label: 'Net Sales',     description: 'Gross Sales − Discounts − Returns', total: true },
  { key: 'shipping',    sign: '+', label: 'Shipping',      description: 'Versandkosten abzgl. Erstattungen, ohne USt' },
  { key: 'taxes',       sign: '+', label: 'Taxes',         description: 'USt auf Ware + Versand' },
  { key: 'duties_fees', sign: '+', label: 'Duties / Fees', description: 'Zölle und Zusatzgebühren, falls vorhanden' },
  { key: 'total_sales', sign: '=', label: 'Total Sales',   description: 'Net Sales + Shipping + Taxes + Duties / Fees', total: true },
]

export function SalesSummarySection() {
  const { range } = useDateRange()
  const query = new URLSearchParams({
    from: toDateStr(range.from),
    to:   toDateStr(range.to),
  }).toString()

  // Results are keyed by the query they answer, so a range change shows the
  // previous numbers dimmed until the new ones land.
  const [result, setResult] = useState<{ query: string; data: SalesSummary | null; source?: SalesSummarySource } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/sales/summary?${query}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(json => { if (!cancelled) setResult({ query, data: json.summary, source: json.source }) })
      .catch(()  => { if (!cancelled) setResult({ query, data: null }) })
    return () => { cancelled = true }
  }, [query])

  const loading = result?.query !== query
  const data    = result?.data ?? null
  const error   = !loading && data === null
  const source  = result?.source

  return (
    <Card>
      <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {ROWS.map((row, i) => {
          const value = data?.[row.key]
          const shown = row.sign === '−' && value ? -value : value
          return (
            <Fragment key={row.key}>
              {/* A heavier rule above each subtotal, like the line under a sum */}
              {i > 0 && (
                <div style={{
                  height: 1,
                  backgroundColor: row.total ? '#111110' : '#EEEDE8',
                  opacity: row.total ? 0.15 : 1,
                }} />
              )}
              <div
                className="flex items-start justify-between gap-4"
                style={{ padding: row.total ? '16px 0' : '12px 0' }}
              >
                <div className="flex gap-3 min-w-0">
                  <span style={{
                    width: 12, flexShrink: 0, textAlign: 'center',
                    fontFamily: G, fontSize: row.total ? '1rem' : '0.875rem',
                    color: '#9E9D98', lineHeight: 1.4,
                  }}>
                    {row.sign}
                  </span>
                  <div className="min-w-0">
                    <div style={{
                      fontFamily: G,
                      fontSize:   row.total ? '1rem' : '0.875rem',
                      fontWeight: row.total ? 700 : 400,
                      color:      row.total ? '#111110' : '#3A3A38',
                      lineHeight: 1.4,
                    }}>
                      {row.label}
                    </div>
                    <div style={{ fontFamily: G, fontSize: '0.75rem', color: '#9E9D98', marginTop: 2 }}>
                      {row.description}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontFamily: G,
                  fontSize:   row.total ? '1.125rem' : '0.875rem',
                  fontWeight: row.total ? 700 : 400,
                  color:      row.total ? '#111110' : '#3A3A38',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                }}>
                  {shown !== undefined ? fmtEur(shown) : error ? '—' : (
                    <span style={{
                      display: 'inline-block', width: 80, height: 16,
                      borderRadius: 4, backgroundColor: '#F0EFE9', verticalAlign: 'middle',
                    }} />
                  )}
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>
      {source && (
        <div style={{ fontFamily: G, fontSize: '0.6875rem', color: '#9E9D98', marginTop: 8 }}>
          {source === 'shopifyql'
            ? 'Quelle: Shopify Analytics (ShopifyQL)'
            : 'Quelle: aus Bestellungen berechnet – Shopify Analytics nicht verfügbar'}
        </div>
      )}
    </Card>
  )
}
