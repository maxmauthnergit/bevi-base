'use client'

import { useState, useEffect } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'

const PRICE_CHANGE_DATE = '2026-03-27'

const TOGGLES = [
  { key: 'revenue_gross', label: 'Revenue (Gross)', color: '#7DEFEF' },
  { key: 'revenue_net',   label: 'Revenue (Net)',   color: '#5BBCBC' },
  { key: 'cogs',          label: 'COGS',            color: '#FF8C42' },
  { key: 'meta_spend',    label: 'Ad Spend',        color: '#6B8FD4' },
] as const

type ToggleKey = (typeof TOGGLES)[number]['key']

interface TrendPoint {
  date: string
  revenue_gross: number
  revenue_net: number
  cogs: number
  meta_spend: number
}

interface ChartPoint extends TrendPoint {
  _ad_spend: number
  _cogs: number
  _cm: number
}

function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' €'
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
}

const DATAKEY_LABELS: Record<string, { label: string; color: string }> = {
  revenue_gross: { label: 'Revenue (Gross)', color: '#7DEFEF' },
  revenue_net:   { label: 'Revenue (Net)',   color: '#5BBCBC' },
  _ad_spend:     { label: 'Ad Spend',        color: '#6B8FD4' },
  _cogs:         { label: 'COGS',            color: '#FF8C42' },
  _cm:           { label: 'Contribution Margin', color: '#7DEFEF' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = payload.filter((e: any) => e.value !== 0 && DATAKEY_LABELS[e.dataKey])
  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E3E2DC',
      borderRadius: 10, padding: '10px 14px', fontSize: '0.75rem',
      fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <p style={{ color: '#9E9D98', marginBottom: 6, fontSize: '0.6875rem' }}>{formatDateLabel(label)}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {entries.map((entry: any, i: number) => {
        const def = DATAKEY_LABELS[entry.dataKey]
        return <p key={i} style={{ color: def.color, marginBottom: 2 }}>{def.label}: {fmtEur(entry.value)}</p>
      })}
    </div>
  )
}

export function TrendChart() {
  const { range } = useDateRange()
  const [data,    setData]    = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState<Record<ToggleKey, boolean>>({
    revenue_gross: false,
    revenue_net:   true,
    cogs:          true,
    meta_spend:    true,
  })

  const fromStr = toDateStr(range.from)
  const toStr   = toDateStr(range.to)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/dashboard/trend?from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d.days ?? []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fromStr, toStr])

  const chartData: ChartPoint[] = data.map((d) => {
    const adSpend = visible.meta_spend ? d.meta_spend : 0
    const cogs    = visible.cogs       ? d.cogs       : 0
    const cm      = visible.revenue_net ? Math.max(0, d.revenue_net - adSpend - cogs) : 0
    return { ...d, _ad_spend: adSpend, _cogs: cogs, _cm: cm }
  })

  const maxVal = Math.max(
    ...data.map(d => Math.max(
      visible.revenue_gross ? d.revenue_gross : 0,
      visible.revenue_net   ? d.revenue_net   : 0,
      (visible.meta_spend ? d.meta_spend : 0) + (visible.cogs ? d.cogs : 0),
    )),
    500
  )
  const yMax   = Math.ceil(maxVal / 500) * 500
  const yTicks = Array.from({ length: yMax / 500 + 1 }, (_, i) => i * 500)

  const dayCount  = data.length
  const tickEvery = dayCount <= 14 ? 1 : dayCount <= 31 ? 5 : dayCount <= 90 ? 7 : 14
  const xTicks    = data.filter((_, i) => i % tickEvery === 0 || i === data.length - 1).map(d => d.date)

  const showPriceFlag = data.some(d => d.date === PRICE_CHANGE_DATE)

  return (
    <div>
      {/* Toggles only */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 6, flexWrap: 'wrap' }}>
        {TOGGLES.map(t => (
          <button
            key={t.key}
            onClick={() => setVisible(v => ({ ...v, [t.key]: !v[t.key] }))}
            style={{
              background: 'none',
              border: `1px solid ${visible[t.key] ? t.color : '#252525'}`,
              borderRadius: 3, color: visible[t.key] ? t.color : '#333',
              cursor: 'pointer', fontSize: '0.5625rem',
              fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
              letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="label" style={{ color: '#333' }}>Loading…</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAdSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b5998" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#3b5998" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="gradCogs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF8C42" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#FF8C42" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#EDECEA" vertical={false} />
            <XAxis dataKey="date" ticks={xTicks} tickFormatter={formatDateLabel}
              tick={{ fill: '#9E9D98', fontSize: 10, fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif" }}
              axisLine={false} tickLine={false} />
            <YAxis ticks={yTicks} domain={[0, yMax]} tickFormatter={fmtEur}
              tick={{ fill: '#9E9D98', fontSize: 10, fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif" }}
              axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<CustomTooltip />} />
            {showPriceFlag && (
              <ReferenceLine x={PRICE_CHANGE_DATE} stroke="#3A3A3A" strokeDasharray="3 3"
                label={{ value: 'price ↑', position: 'insideTopRight', fill: '#444', fontSize: 9,
                  fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif" }} />
            )}
            <Area type="monotone" dataKey="_ad_spend" stackId="a" fill="url(#gradAdSpend)" stroke="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="_cogs"     stackId="a" fill="url(#gradCogs)"    stroke="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="_cm"       stackId="a" fill="#7DEFEF" fillOpacity={0.18} stroke="none" isAnimationActive={false} />
            {visible.revenue_net && (
              <Line type="monotone" dataKey="revenue_net" stroke="#7DEFEF" strokeWidth={1.5}
                dot={false} activeDot={{ r: 3, fill: '#7DEFEF' }} isAnimationActive={false} />
            )}
            {visible.revenue_gross && (
              <Line type="monotone" dataKey="revenue_gross" stroke="#7DEFEF" strokeWidth={1}
                strokeDasharray="4 3" strokeOpacity={0.5} dot={false}
                activeDot={{ r: 3, fill: '#7DEFEF' }} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
