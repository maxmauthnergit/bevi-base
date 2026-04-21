'use client'

import { useEffect, useState } from 'react'

interface MonthData {
  month: string
  revenue_gross: number
  orders: number
}

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
  const short  = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
  return m === 1 ? `${short} '${String(y).slice(2)}` : short
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

function MonthCard({
  title,
  data,
  valueKey,
  color,
  fmt,
}: {
  title: string
  data: MonthData[]
  valueKey: keyof MonthData
  color: string
  fmt: (v: number) => string
}) {
  const values  = data.map(d => d[valueKey] as number)
  const maxVal  = Math.max(...values, 1)

  return (
    <div style={CARD}>
      <span className="label" style={{ display: 'block', marginBottom: 16 }}>{title}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map(d => (
          <BarRow
            key={d.month}
            label={monthLabel(d.month)}
            value={d[valueKey] as number}
            formatted={fmt(d[valueKey] as number)}
            maxValue={maxVal}
            color={color}
          />
        ))}
      </div>
    </div>
  )
}

export function SalesMonthlyCharts() {
  const [data,    setData]    = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sales/monthly')
      .then(r => r.json())
      .then(d => { setData(d.months ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[0, 1].map(i => <div key={i} style={{ ...CARD, height: 240, opacity: 0.4 }} />)}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <MonthCard
        title="Revenue Gross / Month"
        data={data}
        valueKey="revenue_gross"
        color="#1FA8A8"
        fmt={fmtEur}
      />
      <MonthCard
        title="Orders / Month"
        data={data}
        valueKey="orders"
        color="#C4973A"
        fmt={v => `${v}`}
      />
    </div>
  )
}
