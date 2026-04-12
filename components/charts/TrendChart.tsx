'use client'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICE_CHANGE_DATE = '2026-03-27'

const TOGGLES = [
  { key: 'revenue_gross', label: 'Revenue (Gross)', color: '#7DEFEF' },
  { key: 'revenue_net',   label: 'Revenue (Net)',   color: '#5BBCBC' },
  { key: 'cogs',          label: 'COGS',            color: '#FF8C42' },
  { key: 'meta_spend',    label: 'Ad Spend',        color: '#6B8FD4' },
] as const

type ToggleKey = (typeof TOGGLES)[number]['key']

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(v: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
  })
}

function monthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

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

  // filter out zero or hidden entries
  const entries = payload.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => e.value !== 0 && DATAKEY_LABELS[e.dataKey]
  )

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E3E2DC',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: '0.75rem',
        fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ color: '#9E9D98', marginBottom: 6, fontSize: '0.6875rem' }}>
        {formatDateLabel(label)}
      </p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {entries.map((entry: any, i: number) => {
        const def = DATAKEY_LABELS[entry.dataKey]
        return (
          <p key={i} style={{ color: def.color, marginBottom: 2 }}>
            {def.label}: {formatEur(entry.value)}
          </p>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrendChart() {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data,  setData]  = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  const [visible, setVisible] = useState<Record<ToggleKey, boolean>>({
    revenue_gross: false,  // gross line off by default — net/CM area tells the story
    revenue_net:   true,
    cogs:          true,
    meta_spend:    true,
  })

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/trend?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d.days ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, month])

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (isCurrentMonth) return
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }

  // ── Derive stacked chart data ──────────────────────────────────────────────
  // Layer order (bottom → top): Ad Spend → COGS → Contribution Margin
  // CM = Revenue Net − Ad Spend − COGS (clamped to 0)
  const chartData: ChartPoint[] = data.map((d) => {
    const adSpend = visible.meta_spend ? d.meta_spend : 0
    const cogs    = visible.cogs       ? d.cogs       : 0
    const cm      = visible.revenue_net
      ? Math.max(0, d.revenue_net - adSpend - cogs)
      : 0
    return { ...d, _ad_spend: adSpend, _cogs: cogs, _cm: cm }
  })

  // ── Y-axis: €500 steps ──────────────────────────────────────────────────────
  const maxVal = Math.max(
    ...data.map((d) =>
      Math.max(
        visible.revenue_gross ? d.revenue_gross : 0,
        visible.revenue_net   ? d.revenue_net   : 0,
        (visible.meta_spend ? d.meta_spend : 0) +
          (visible.cogs ? d.cogs : 0),
      )
    ),
    500
  )
  const yMax   = Math.ceil(maxVal / 500) * 500
  const yTicks = Array.from({ length: yMax / 500 + 1 }, (_, i) => i * 500)

  // ── X-axis: every 5th day ──────────────────────────────────────────────────
  const xTicks = data
    .filter((_, i) => i % 5 === 0 || i === data.length - 1)
    .map((d) => d.date)

  const showPriceFlag = year === 2026 && month === 3

  return (
    <div>
      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={prevMonth}
            style={{
              background: 'none', border: 'none', color: '#666',
              cursor: 'pointer', fontSize: 18, padding: '0 4px',
              fontFamily: 'inherit', lineHeight: 1,
            }}
          >
            ‹
          </button>
          <span
            style={{
              fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
              fontSize: '0.8125rem',
              color: '#CCC',
              minWidth: 110,
              textAlign: 'center',
            }}
          >
            {monthTitle(year, month)}
          </span>
          <button
            onClick={nextMonth}
            style={{
              background: 'none', border: 'none',
              color: isCurrentMonth ? '#2A2A2A' : '#666',
              cursor: isCurrentMonth ? 'default' : 'pointer',
              fontSize: 18, padding: '0 4px',
              fontFamily: 'inherit', lineHeight: 1,
            }}
          >
            ›
          </button>
        </div>

        {/* Line toggles */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TOGGLES.map((t) => (
            <button
              key={t.key}
              onClick={() =>
                setVisible((v) => ({ ...v, [t.key]: !v[t.key] }))
              }
              style={{
                background: 'none',
                border: `1px solid ${visible[t.key] ? t.color : '#252525'}`,
                borderRadius: 3,
                color: visible[t.key] ? t.color : '#333',
                cursor: 'pointer',
                fontSize: '0.5625rem',
                fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '3px 8px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="label" style={{ color: '#333' }}>Loading…</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
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

            <XAxis
              dataKey="date"
              ticks={xTicks}
              tickFormatter={formatDateLabel}
              tick={{ fill: '#9E9D98', fontSize: 10, fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              ticks={yTicks}
              domain={[0, yMax]}
              tickFormatter={(v) => formatEur(v)}
              tick={{ fill: '#9E9D98', fontSize: 10, fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif" }}
              axisLine={false}
              tickLine={false}
              width={58}
            />

            <Tooltip content={<CustomTooltip />} />

            {showPriceFlag && (
              <ReferenceLine
                x={PRICE_CHANGE_DATE}
                stroke="#3A3A3A"
                strokeDasharray="3 3"
                label={{
                  value: 'price ↑',
                  position: 'insideTopRight',
                  fill: '#444',
                  fontSize: 9,
                  fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
                }}
              />
            )}

            {/* ── Stacked areas (bottom → top) ───────────────────────────── */}
            <Area
              type="monotone"
              dataKey="_ad_spend"
              stackId="a"
              fill="url(#gradAdSpend)"
              stroke="none"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="_cogs"
              stackId="a"
              fill="url(#gradCogs)"
              stroke="none"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="_cm"
              stackId="a"
              fill="#7DEFEF"
              fillOpacity={0.18}
              stroke="none"
              isAnimationActive={false}
            />

            {/* ── Revenue Net — solid top boundary line ──────────────────── */}
            {visible.revenue_net && (
              <Line
                type="monotone"
                dataKey="revenue_net"
                name="Revenue (Net)"
                stroke="#7DEFEF"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#7DEFEF' }}
                isAnimationActive={false}
              />
            )}

            {/* ── Revenue Gross — optional dashed overlay ─────────────────── */}
            {visible.revenue_gross && (
              <Line
                type="monotone"
                dataKey="revenue_gross"
                name="Revenue (Gross)"
                stroke="#7DEFEF"
                strokeWidth={1}
                strokeDasharray="4 3"
                strokeOpacity={0.5}
                dot={false}
                activeDot={{ r: 3, fill: '#7DEFEF' }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
