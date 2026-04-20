'use client'

import { useState, useEffect } from 'react'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'

const PRICE_CHANGE_DATE = '2026-03-27'

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  revenueGross: '#111110',
  revenueNet:   '#1FA8A8',
  adSpend:      '#5175B0',
  cogs:         '#BF6035',
  cm:           '#17C9B0',
}

const TOGGLES = [
  { key: 'revenue_gross', label: 'Revenue (Gross)',      color: C.revenueGross },
  { key: 'revenue_net',   label: 'Revenue (Net)',        color: C.revenueNet   },
  { key: 'cm',            label: 'Contribution Margin',  color: C.cm           },
  { key: 'cogs',          label: 'COGS',                 color: C.cogs         },
  { key: 'meta_spend',    label: 'Ad Spend',             color: C.adSpend      },
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
  _ad_spend:  number
  _cogs:      number
  _cm:        number
  _cm_actual: number
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d: ChartPoint = payload[0].payload
  const payloadKeys   = new Set(payload.map((p: { dataKey: string }) => p.dataKey))

  const F = 'Gustavo'
  const row = (lbl: string, val: number, color: string, bold = false, large = false) => (
    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 28, marginBottom: 2 }}>
      <span style={{ fontFamily: `'${F}', sans-serif`, fontSize: large ? '0.8125rem' : '0.72rem', color, fontWeight: bold ? 700 : 400 }}>
        {lbl}
      </span>
      <span style={{ fontFamily: `'${F}', sans-serif`, fontSize: large ? '0.8125rem' : '0.72rem', color, fontWeight: bold ? 700 : 400, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {fmtEur(val)}
      </span>
    </div>
  )
  const sep = (margin = '5px 0') => <div style={{ borderTop: '1px solid #E8E7E2', margin }} />

  return (
    <div style={{
      backgroundColor: '#FAFAF8', border: '1px solid #E3E2DC',
      borderRadius: 10, padding: '10px 14px', minWidth: 210,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <p style={{ color: '#9E9D98', marginBottom: 8, fontSize: '0.6875rem', fontFamily: `'${F}', sans-serif` }}>
        {formatDateLabel(label)}
      </p>

      {/* Revenue lines — top context */}
      {payloadKeys.has('revenue_gross') && row('Revenue (Gross)', d.revenue_gross, C.revenueGross)}
      {payloadKeys.has('revenue_net')   && row('Revenue (Net)',   d.revenue_net,   C.revenueNet)}

      {sep()}

      {/* Costs — bottom to top of stack */}
      {d._ad_spend > 0 && row('Ad Spend', d._ad_spend, C.adSpend)}
      {d._cogs     > 0 && row('COGS',     d._cogs,     C.cogs)}

      {sep('6px 0')}

      {/* CM — always show, emphasized */}
      {row('Contribution Margin', d._cm_actual, C.cm, true, true)}
    </div>
  )
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export function TrendChart() {
  const { range } = useDateRange()
  const [data,    setData]    = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState<Record<ToggleKey, boolean>>({
    revenue_gross: false,
    revenue_net:   true,
    cm:            true,
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
    const adSpend   = visible.meta_spend ? d.meta_spend : 0
    const cogs      = visible.cogs       ? d.cogs       : 0
    const cm        = visible.cm ? Math.max(0, d.revenue_net - adSpend - cogs) : 0
    const cmActual  = d.revenue_net - d.meta_spend - d.cogs
    return { ...d, _ad_spend: adSpend, _cogs: cogs, _cm: cm, _cm_actual: cmActual }
  })

  const maxVal = Math.max(
    ...data.map(d => Math.max(
      visible.revenue_gross ? d.revenue_gross : 0,
      visible.revenue_net   ? d.revenue_net   : 0,
      (visible.meta_spend ? d.meta_spend : 0) + (visible.cogs ? d.cogs : 0),
    )),
    250
  )
  const yMax   = Math.ceil(maxVal / 250) * 250
  const yTicks = Array.from({ length: yMax / 250 + 1 }, (_, i) => i * 250)

  const dayCount  = data.length
  const tickEvery = dayCount <= 14 ? 1 : dayCount <= 31 ? 5 : dayCount <= 90 ? 7 : 14
  const xTicks    = data.filter((_, i) => i % tickEvery === 0 || i === data.length - 1).map(d => d.date)

  const showPriceFlag = data.some(d => d.date === PRICE_CHANGE_DATE)

  return (
    <div>
      {/* Toggles */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 6, flexWrap: 'wrap' }}>
        {TOGGLES.map(t => (
          <button
            key={t.key}
            onClick={() => setVisible(v => ({ ...v, [t.key]: !v[t.key] }))}
            style={{
              background: 'none',
              border: `1px solid ${visible[t.key] ? t.color : '#2E2E2E'}`,
              borderRadius: 3, color: visible[t.key] ? t.color : '#444',
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
                <stop offset="0%" stopColor={C.adSpend} stopOpacity={0.90} />
                <stop offset="100%" stopColor={C.adSpend} stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id="gradCogs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.cogs} stopOpacity={0.88} />
                <stop offset="100%" stopColor={C.cogs} stopOpacity={0.60} />
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
            {/* Stacked areas — bottom to top: ad spend → cogs → CM */}
            <Area type="monotone" dataKey="_ad_spend" stackId="a" fill="url(#gradAdSpend)" stroke="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="_cogs"     stackId="a" fill="url(#gradCogs)"    stroke="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="_cm"       stackId="a"
              fill={C.cm} fillOpacity={0.22} stroke={C.cm} strokeWidth={1} strokeOpacity={0.5}
              isAnimationActive={false} />
            {/* Revenue lines */}
            {visible.revenue_net && (
              <Line type="monotone" dataKey="revenue_net" stroke={C.revenueNet} strokeWidth={1.5}
                dot={false} activeDot={{ r: 3, fill: C.revenueNet }} isAnimationActive={false} />
            )}
            {visible.revenue_gross && (
              <Line type="monotone" dataKey="revenue_gross" stroke={C.revenueGross} strokeWidth={1.5}
                dot={false} activeDot={{ r: 3, fill: C.revenueGross }} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
