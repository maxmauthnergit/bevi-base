'use client'

import { useEffect, useState } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface BreakdownData {
  by_product: { title: string; revenue: number }[]
  by_market:  { country: string; revenue: number }[]
  bundle_split: {
    bundle_revenue:     number
    non_bundle_revenue: number
    bundle_orders:      number
    non_bundle_orders:  number
  }
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
  return fmtEur(v)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EurTooltip({ active, payload, label, color }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: '#1C1C1A', borderRadius: 8, padding: '8px 12px' }}>
      {label && <p style={{ color: '#6B6A64', fontSize: '0.625rem', fontFamily: F, marginBottom: 4 }}>{label}</p>}
      <p style={{ color: color ?? '#C7C6C0', fontSize: '0.75rem', fontFamily: F, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {fmtEur(payload[0].value as number)}
      </p>
    </div>
  )
}

const BUNDLE_DATA = (split: BreakdownData['bundle_split']) => [
  { label: 'Bundle orders', revenue: split.bundle_revenue,     orders: split.bundle_orders,     color: '#1FA8A8' },
  { label: 'Single orders', revenue: split.non_bundle_revenue, orders: split.non_bundle_orders, color: '#C7C6C0' },
]

function SkeletonRow({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...style }}>
      <div style={{ ...CARD, height: 300, opacity: 0.4 }} />
      <div style={{ ...CARD, height: 300, opacity: 0.4 }} />
    </div>
  )
}

export function SalesBreakdownSection() {
  const { range } = useDateRange()
  const [data,    setData]    = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)

  const fromStr = toDateStr(range.from)
  const toStr   = toDateStr(range.to)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/sales/breakdown?from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fromStr, toStr])

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        <SkeletonRow />
        <div style={{ ...CARD, height: 260, opacity: 0.4 }} />
      </div>
    )
  }

  const productHeight = Math.max(180, data.by_product.length * 36)
  const marketHeight  = Math.max(180, data.by_market.length  * 36)
  const bundleRows    = BUNDLE_DATA(data.bundle_split)
  const total         = data.bundle_split.bundle_revenue + data.bundle_split.non_bundle_revenue
  const bundlePct     = total > 0 ? (data.bundle_split.bundle_revenue / total * 100).toFixed(1) : '0.0'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Row 1: Product + Bundle */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Revenue by Product */}
        <div style={CARD}>
          <p style={{ fontFamily: F, fontSize: '0.6875rem', color: '#9E9D98', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Revenue by Product
          </p>
          <ResponsiveContainer width="100%" height={productHeight}>
            <BarChart
              data={data.by_product}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#EDECEA" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtK} tick={TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="title" tick={TICK} axisLine={false} tickLine={false} width={130} />
              <Tooltip
                content={(props) => <EurTooltip {...props} color="#1FA8A8" />}
                cursor={{ fill: 'rgba(31,168,168,0.06)' }}
              />
              <Bar dataKey="revenue" fill="#1FA8A8" radius={[0, 3, 3, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Bundle */}
        <div style={CARD}>
          <p style={{ fontFamily: F, fontSize: '0.6875rem', color: '#9E9D98', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Revenue by Bundle
          </p>
          <p style={{ fontFamily: F, fontSize: '1.5rem', fontWeight: 600, color: '#111110', marginBottom: 4, lineHeight: 1 }}>
            {bundlePct} %
          </p>
          <p style={{ fontFamily: F, fontSize: '0.75rem', color: '#9E9D98', marginBottom: 20 }}>
            of revenue from bundle orders
          </p>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart
              data={bundleRows}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis type="number" tickFormatter={fmtK} tick={TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={TICK} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const row = bundleRows.find(r => r.label === label)
                  return (
                    <div style={{ backgroundColor: '#1C1C1A', borderRadius: 8, padding: '8px 12px', minWidth: 140 }}>
                      <p style={{ color: '#6B6A64', fontSize: '0.625rem', fontFamily: F, marginBottom: 4 }}>{label}</p>
                      <p style={{ color: row?.color ?? '#C7C6C0', fontSize: '0.75rem', fontFamily: F, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtEur(payload[0].value as number)}
                      </p>
                      {row && (
                        <p style={{ color: '#6B6A64', fontSize: '0.625rem', fontFamily: F, marginTop: 2 }}>
                          {row.orders} orders
                        </p>
                      )}
                    </div>
                  )
                }}
                cursor={{ fill: 'rgba(31,168,168,0.04)' }}
              />
              <Bar dataKey="revenue" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                {bundleRows.map((row, i) => <Cell key={i} fill={row.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <span style={{ fontFamily: F, fontSize: '0.6875rem', color: '#9E9D98' }}>
              {data.bundle_split.bundle_orders} bundle orders
            </span>
            <span style={{ fontFamily: F, fontSize: '0.6875rem', color: '#9E9D98' }}>
              {data.bundle_split.non_bundle_orders} single orders
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Market (full width) */}
      <div style={CARD}>
        <p style={{ fontFamily: F, fontSize: '0.6875rem', color: '#9E9D98', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Revenue by Market
        </p>
        <ResponsiveContainer width="100%" height={marketHeight}>
          <BarChart
            data={data.by_market}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="#EDECEA" horizontal={false} />
            <XAxis type="number" tickFormatter={fmtK} tick={TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="country" tick={TICK} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              content={(props) => <EurTooltip {...props} color="#5175B0" />}
              cursor={{ fill: 'rgba(81,117,176,0.06)' }}
            />
            <Bar dataKey="revenue" fill="#5175B0" radius={[0, 3, 3, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
