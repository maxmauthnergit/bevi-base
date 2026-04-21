'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface MonthData {
  month: string
  revenue_gross: number
  orders: number
}

const F    = "'Gustavo', 'Helvetica Neue', sans-serif"
const TICK = { fill: '#9E9D98', fontSize: 10, fontFamily: F }
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

function fmtK(v: number) {
  if (v >= 1000) return (v / 1000).toFixed(0) + 'k €'
  return v + ' €'
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  const short  = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
  return m === 1 ? `${short} '${String(y).slice(2)}` : short
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RevTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: '#1C1C1A', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#6B6A64', fontSize: '0.625rem', fontFamily: F, marginBottom: 4 }}>
        {monthLabel(String(label))}
      </p>
      <p style={{ color: '#1FA8A8', fontSize: '0.75rem', fontFamily: F, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {fmtEur(payload[0].value as number)}
      </p>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OrdTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: '#1C1C1A', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#6B6A64', fontSize: '0.625rem', fontFamily: F, marginBottom: 4 }}>
        {monthLabel(String(label))}
      </p>
      <p style={{ color: '#C4973A', fontSize: '0.75rem', fontFamily: F, fontWeight: 600 }}>
        {(payload[0].value as number)} orders
      </p>
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
        {[0, 1].map(i => (
          <div key={i} style={{ ...CARD, height: 232, opacity: 0.4 }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Revenue Gross / Month */}
      <div style={CARD}>
        <p style={{ fontFamily: F, fontSize: '0.6875rem', color: '#9E9D98', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Revenue Gross / Month
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#EDECEA" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tick={TICK}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={TICK}
              axisLine={false}
              tickLine={false}
              width={54}
            />
            <Tooltip content={RevTooltip} cursor={{ fill: 'rgba(31,168,168,0.06)' }} />
            <Bar dataKey="revenue_gross" fill="#1FA8A8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Orders / Month */}
      <div style={CARD}>
        <p style={{ fontFamily: F, fontSize: '0.6875rem', color: '#9E9D98', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Orders / Month
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#EDECEA" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tick={TICK}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={TICK}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={OrdTooltip} cursor={{ fill: 'rgba(196,151,58,0.06)' }} />
            <Bar dataKey="orders" fill="#C4973A" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
