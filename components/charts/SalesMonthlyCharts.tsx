'use client'

import { useEffect, useState } from 'react'

interface MonthData {
  month: string
  revenue_gross: number
  orders: number
}

type RowItem =
  | { type: 'year'; year: number }
  | { type: 'data'; data: MonthData }

const DEFAULT_VISIBLE = 5

const CARD = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  border: '1px solid #E3E2DC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: 24,
}

function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' €'
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
}

// Newest first; year separator before the first month of each older year
function buildRows(data: MonthData[]): RowItem[] {
  const reversed = [...data].reverse()
  const rows: RowItem[] = []
  let lastYear: number | null = null
  for (const d of reversed) {
    const year = parseInt(d.month.slice(0, 4), 10)
    if (year !== lastYear) {
      if (lastYear !== null) rows.push({ type: 'year', year })
      lastYear = year
    }
    rows.push({ type: 'data', data: d })
  }
  return rows
}

function trimRows(rows: RowItem[], max: number): RowItem[] {
  const result: RowItem[] = []
  let dataCount = 0
  for (const row of rows) {
    if (row.type === 'data') {
      if (dataCount >= max) break
      dataCount++
    }
    result.push(row)
  }
  return result
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, height: '100%',
        width: `${pct}%`, backgroundColor: color, borderRadius: 2, opacity: 0.65,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

export function SalesMonthlyCharts() {
  const [data,    setData]    = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch('/api/sales/monthly')
      .then(r => r.json())
      .then(d => { setData(d.months ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ ...CARD, height: 200, opacity: 0.4 }} />
  }

  const allRows    = buildRows(data)
  const rows       = showAll ? allRows : trimRows(allRows, DEFAULT_VISIBLE)
  const maxRevenue = Math.max(...data.map(d => d.revenue_gross), 1)
  const maxOrders  = Math.max(...data.map(d => d.orders), 1)
  const hasMore    = data.length > DEFAULT_VISIBLE

  return (
    <div style={CARD}>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 20 }}>
        <span className="label">Revenue Gross / Month</span>
        <span className="label">Orders / Month</span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row, i) => {
          if (row.type === 'year') {
            return (
              <div key={`y-${row.year}`} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
                <span className="label" style={{ color: '#C7C6C0', flexShrink: 0 }}>{row.year}</span>
                <div style={{ flex: 1, height: 1, backgroundColor: '#E3E2DC' }} />
              </div>
            )
          }

          const d      = row.data
          const revPct = (d.revenue_gross / maxRevenue) * 100
          const ordPct = (d.orders / maxOrders) * 100
          const label  = monthLabel(d.month)

          return (
            <div key={d.month} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
              {/* Revenue */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">{label}</span>
                  <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#1FA8A8' }}>
                    {fmtEur(d.revenue_gross)}
                  </span>
                </div>
                <Bar pct={revPct} color="#1FA8A8" />
              </div>

              {/* Orders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">{label}</span>
                  <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#C4973A' }}>
                    {d.orders}
                  </span>
                </div>
                <Bar pct={ordPct} color="#C4973A" />
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            display: 'block', marginTop: 16,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
            fontSize: '0.625rem', fontWeight: 500,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#9E9D98',
          }}
        >
          {showAll ? '↑ Show less' : `↓ Show all (${data.length} months)`}
        </button>
      )}
    </div>
  )
}
