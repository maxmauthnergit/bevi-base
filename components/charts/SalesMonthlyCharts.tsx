'use client'

import { useEffect, useState } from 'react'

interface MonthData {
  month: string        // "YYYY-MM"
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

function buildRows(data: MonthData[]): RowItem[] {
  const rows: RowItem[] = []
  let lastYear: number | null = null
  for (const d of data) {
    const year = parseInt(d.month.slice(0, 4), 10)
    if (year !== lastYear) {
      rows.push({ type: 'year', year })
      lastYear = year
    }
    rows.push({ type: 'data', data: d })
  }
  return rows
}

function YearSeparator({ year }: { year: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 2px' }}>
      <span className="label" style={{ color: '#C7C6C0', flexShrink: 0 }}>{year}</span>
      <div style={{ flex: 1, height: 1, backgroundColor: '#E3E2DC' }} />
    </div>
  )
}

function BarRow({
  label,
  value,
  formatted,
  maxValue,
  color,
}: {
  label: string
  value: number
  formatted: string
  maxValue: number
  color: string
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="label">{label}</span>
        <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600, color }}>
          {formatted}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0,
          height: '100%', width: `${pct}%`,
          backgroundColor: color, borderRadius: 2, opacity: 0.65,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

function Section({
  label,
  rows,
  valueKey,
  maxValue,
  color,
  fmt,
  showAll,
}: {
  label: string
  rows: RowItem[]
  valueKey: 'revenue_gross' | 'orders'
  maxValue: number
  color: string
  fmt: (v: number) => string
  showAll: boolean
}) {
  // Trim to DEFAULT_VISIBLE data rows when collapsed
  let visible: RowItem[]
  if (showAll) {
    visible = rows
  } else {
    let dataCount = 0
    visible = []
    for (const row of rows) {
      if (row.type === 'data') {
        if (dataCount >= DEFAULT_VISIBLE) break
        dataCount++
      }
      visible.push(row)
    }
  }

  return (
    <div>
      <span className="label" style={{ display: 'block', marginBottom: 12 }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((row, i) =>
          row.type === 'year'
            ? <YearSeparator key={`y-${row.year}`} year={row.year} />
            : (
              <BarRow
                key={row.data.month}
                label={monthLabel(row.data.month)}
                value={row.data[valueKey]}
                formatted={fmt(row.data[valueKey])}
                maxValue={maxValue}
                color={color}
              />
            )
        )}
      </div>
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
    return <div style={{ ...CARD, height: 240, opacity: 0.4 }} />
  }

  const rows       = buildRows(data)
  const maxRevenue = Math.max(...data.map(d => d.revenue_gross), 1)
  const maxOrders  = Math.max(...data.map(d => d.orders), 1)
  const hasMore    = data.length > DEFAULT_VISIBLE

  return (
    <div style={CARD}>
      <Section
        label="Revenue Gross / Month"
        rows={rows}
        valueKey="revenue_gross"
        maxValue={maxRevenue}
        color="#1FA8A8"
        fmt={fmtEur}
        showAll={showAll}
      />

      <div style={{ height: 1, backgroundColor: '#E3E2DC', margin: '20px 0' }} />

      <Section
        label="Orders / Month"
        rows={rows}
        valueKey="orders"
        maxValue={maxOrders}
        color="#C4973A"
        fmt={v => String(v)}
        showAll={showAll}
      />

      {hasMore && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            display: 'block',
            marginTop: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
            fontSize: '0.625rem',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#9E9D98',
          }}
        >
          {showAll ? '↑ Show less' : `↓ Show all (${data.length} months)`}
        </button>
      )}
    </div>
  )
}
