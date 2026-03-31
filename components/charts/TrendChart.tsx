'use client'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

// ─── Price-change flag ────────────────────────────────────────────────────────
const PRICE_CHANGE_DATE = '2026-03-27'

// ─── Line definitions ─────────────────────────────────────────────────────────
const LINES = [
  { key: 'revenue_gross', label: 'Revenue (Gross)', color: '#7DEFEF', dash: undefined },
  { key: 'revenue_net',   label: 'Revenue (Net)',   color: '#2A9090', dash: '4 3' },
  { key: 'cogs',          label: 'COGS',            color: '#FF8C42', dash: undefined },
  { key: 'meta_spend',    label: 'Ad Spend',        color: '#FF4444', dash: undefined },
] as const

type LineKey = (typeof LINES)[number]['key']

interface TrendPoint {
  date: string
  revenue_gross: number
  revenue_net: number
  cogs: number
  meta_spend: number
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
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
}

function monthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        backgroundColor: '#1A1A1A',
        border: '1px solid #2A2A2A',
        borderRadius: 4,
        padding: '10px 14px',
        fontSize: '0.75rem',
        fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
      }}
    >
      <p style={{ color: '#666', marginBottom: 6, fontSize: '0.6875rem' }}>
        {formatDateLabel(label)}
      </p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color, marginBottom: 2 }}>
          {entry.name}: {formatEur(entry.value)}
        </p>
      ))}
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

  const [visible, setVisible] = useState<Record<LineKey, boolean>>({
    revenue_gross: true,
    revenue_net:   true,
    cogs:          true,
    meta_spend:    true,
  })

  // Fetch when month changes
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

  function toggleLine(key: LineKey) {
    setVisible((v) => ({ ...v, [key]: !v[key] }))
  }

  // ── Y-axis: €500 steps ──────────────────────────────────────────────────────
  const relevantValues = data.flatMap((d) => [
    visible.revenue_gross ? d.revenue_gross : 0,
    visible.revenue_net   ? d.revenue_net   : 0,
    visible.cogs          ? d.cogs          : 0,
    visible.meta_spend    ? d.meta_spend    : 0,
  ])
  const maxVal = Math.max(...relevantValues, 500)
  const yMax   = Math.ceil(maxVal / 500) * 500
  const yTicks = Array.from({ length: yMax / 500 + 1 }, (_, i) => i * 500)

  // ── X-axis: every 5th day ───────────────────────────────────────────────────
  const xTicks = data
    .filter((_, i) => i % 5 === 0 || i === data.length - 1)
    .map((d) => d.date)

  const showPriceFlag = year === 2026 && month === 3

  return (
    <div>
      {/* ── Controls row ────────────────────────────────────────────────────── */}
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
              background: 'none', border: 'none', color: '#555',
              cursor: 'pointer', fontSize: 16, padding: '2px 4px',
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
              color: isCurrentMonth ? '#2A2A2A' : '#555',
              cursor: isCurrentMonth ? 'default' : 'pointer',
              fontSize: 16, padding: '2px 4px',
              fontFamily: 'inherit', lineHeight: 1,
            }}
          >
            ›
          </button>
        </div>

        {/* Line toggles */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {LINES.map((line) => (
            <button
              key={line.key}
              onClick={() => toggleLine(line.key)}
              style={{
                background: 'none',
                border: `1px solid ${visible[line.key] ? line.color : '#2A2A2A'}`,
                borderRadius: 3,
                color: visible[line.key] ? line.color : '#333',
                cursor: 'pointer',
                fontSize: '0.5625rem',
                fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '3px 8px',
              }}
            >
              {line.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            height: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="label"
            style={{ color: '#333' }}
          >
            Loading…
          </span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={data}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#1A1A1A"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              ticks={xTicks}
              tickFormatter={formatDateLabel}
              tick={{
                fill: '#444',
                fontSize: 10,
                fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              ticks={yTicks}
              domain={[0, yMax]}
              tickFormatter={(v) => formatEur(v)}
              tick={{
                fill: '#444',
                fontSize: 10,
                fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
              }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Price-change reference line */}
            {showPriceFlag && (
              <ReferenceLine
                x={PRICE_CHANGE_DATE}
                stroke="#444"
                strokeDasharray="3 3"
                label={{
                  value: 'price ↑',
                  position: 'insideTopRight',
                  fill: '#555',
                  fontSize: 9,
                  fontFamily: "'Gustavo', 'Helvetica Neue', sans-serif",
                }}
              />
            )}

            {visible.revenue_gross && (
              <Line
                type="monotone"
                dataKey="revenue_gross"
                name="Revenue (Gross)"
                stroke="#7DEFEF"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#7DEFEF' }}
              />
            )}
            {visible.revenue_net && (
              <Line
                type="monotone"
                dataKey="revenue_net"
                name="Revenue (Net)"
                stroke="#2A9090"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 3, fill: '#2A9090' }}
              />
            )}
            {visible.cogs && (
              <Line
                type="monotone"
                dataKey="cogs"
                name="COGS"
                stroke="#FF8C42"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#FF8C42' }}
              />
            )}
            {visible.meta_spend && (
              <Line
                type="monotone"
                dataKey="meta_spend"
                name="Ad Spend"
                stroke="#FF4444"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: '#FF4444' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
