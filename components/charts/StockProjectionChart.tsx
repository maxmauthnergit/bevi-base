'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { fmtInt } from '@/components/ui/formStyles'
import { fmtDate } from '@/lib/inbound-calc'
import type { ProjectionResult, Restock } from '@/lib/stock-projection'
import { modeColor, ShipModeIcon } from '@/components/ui/ShipMode'

const F = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

/**
 * The line stock is on today is the reference path, not a fifth series — it is
 * drawn in ink rather than a category hue, solid and heavier, so the four
 * dashed branches read as departures from it.
 */
const BASELINE = '#111110'

export interface ModeBranch {
  mode:    string
  label:   string
  /** Day the goods land; the branch leaves the baseline here. */
  arrival: string
  result:  ProjectionResult
}

export function StockProjectionChart({
  productId,
  baseline,
  branches,
  restocks = [],
  height = 260,
}: {
  productId: string
  baseline:  ProjectionResult
  branches:  ModeBranch[]
  /** Deliveries already inside the baseline, so the tooltip can name a jump. */
  restocks?: Restock[]
  height?:   number
}) {
  const bp       = useBreakpoint()
  const isMobile = bp === 'mobile'

  const data = useMemo(() => baseline.points.map((p, i) => {
    const row: Record<string, string | number | null> = {
      date: p.date,
      baseline: p.byProduct[productId] ?? 0,
    }
    for (const b of branches) {
      const bp2 = b.result.points[i]
      // A branch is drawn from the day before it lands, so it visibly leaves the
      // baseline rather than appearing out of nowhere at its own arrival.
      row[b.mode] = bp2 && p.date >= previousDay(b.arrival)
        ? bp2.byProduct[productId] ?? 0
        : null
    }
    return row
  }), [baseline, branches, productId])

  const runsOut = baseline.runsOutOn[productId] ?? null

  // A step up in the black line is a planned inbound landing. Without a name
  // on it, it reads as a glitch in the data rather than as a delivery.
  const restocksByDate = useMemo(() => {
    const map = new Map<string, Restock[]>()
    for (const r of restocks) {
      if (r.productId !== productId || r.quantity <= 0) continue
      map.set(r.date, [...(map.get(r.date) ?? []), r])
    }
    return map
  }, [restocks, productId])

  // Ticks are placed by hand: left to recharts, a 5,000 domain came out
  // 0 · 1,500 · 3,000 · 4,500 · 5,000 — an uneven last step that reads as an
  // error in the data.
  const { yMax, yTicks } = useMemo(() => {
    const peak = Math.max(
      ...data.map(r => Math.max(...Object.entries(r)
        .filter(([k]) => k !== 'date')
        .map(([, v]) => (typeof v === 'number' ? v : 0)))),
      1,
    )
    const step = peak > 4000 ? 1000 : peak > 1000 ? 500 : peak > 400 ? 100 : 50
    const max  = Math.ceil(peak / step) * step
    const ticks: number[] = []
    for (let v = 0; v <= max; v += step) ticks.push(v)
    return { yMax: max, yTicks: ticks }
  }, [data])

  const xTicks = useMemo(() => {
    const every = data.length <= 40 ? 7 : data.length <= 100 ? 14 : 30
    const ticks = data.filter((_, i) => i % every === 0).map(r => r.date as string)
    const last  = data[data.length - 1]?.date as string
    if (last && ticks[ticks.length - 1] !== last) ticks.push(last)
    return ticks
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#EDECEA" vertical={false} />

        <XAxis
          dataKey="date" type="category" ticks={xTicks}
          tickFormatter={(d: string) => fmtDate(d).slice(0, 6)}
          tick={{ fill: '#9E9D98', fontSize: 10, fontFamily: F }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          domain={[0, yMax]} ticks={yTicks} allowDecimals={false}
          tickFormatter={(v: number) => fmtInt(v)}
          tick={{ fill: '#9E9D98', fontSize: 10, fontFamily: F }}
          axisLine={false} tickLine={false} width={isMobile ? 38 : 56}
        />

        {/* The empty shelf. Drawn as the axis it is — red here would be a warning
            about the coordinate system, and would read as a fifth series besides. */}
        <ReferenceLine y={0} stroke="#C9C8C2" strokeWidth={1} />

        {/* The day the shelf empties. In ink, not red: red is already Road's
            neighbour on this chart, and a marker must not look like a series. */}
        {runsOut && (
          <ReferenceLine
            x={runsOut} stroke="#6B6A64" strokeDasharray="3 3"
            label={{
              value: `sold out ${fmtDate(runsOut).slice(0, 6)}`,
              position: 'insideTopRight', fill: '#6B6A64', fontSize: 9, fontFamily: F,
            }}
          />
        )}

        <Tooltip content={renderTooltip(branches, restocksByDate)} cursor={{ stroke: '#C9C8C2', strokeWidth: 1 }} />

        {branches.map(b => (
          <Line
            key={b.mode} type="linear" dataKey={b.mode}
            stroke={modeColor(b.mode)} strokeWidth={2} strokeDasharray="5 3"
            dot={false} activeDot={{ r: 3 }} connectNulls={false} isAnimationActive={false}
          />
        ))}

        <Line
          type="linear" dataKey="baseline" stroke={BASELINE} strokeWidth={2}
          dot={false} activeDot={{ r: 3, fill: BASELINE }} isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function previousDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10)
}

function renderTooltip(branches: ModeBranch[], restocksByDate: Map<string, Restock[]>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null

    const value = (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hit = payload.find((p: any) => p.dataKey === key)
      return hit && typeof hit.value === 'number' ? hit.value : null
    }
    const base = value('baseline')
    const landed = restocksByDate.get(label as string) ?? []

    return (
      <div style={{
        backgroundColor: '#1C1C1A', borderRadius: 10, padding: '10px 14px',
        minWidth: 190, boxShadow: '0 8px 28px rgba(0,0,0,0.25)', fontFamily: F,
      }}>
        <div style={{ color: '#6B6A64', fontSize: '0.6875rem', marginBottom: 6 }}>
          {fmtDate(label as string)}
        </div>
        <Row swatch={BASELINE} name="No new order" value={base} />
        {landed.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4"
            style={{ marginTop: 2, paddingLeft: 16, color: '#9E9D98', fontSize: '0.6875rem' }}>
            <span>{r.label ? `${r.label} lands` : 'Planned inbound lands'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>+{fmtInt(r.quantity)}</span>
          </div>
        ))}
        {branches.map(b => {
          const v = value(b.mode)
          return v === null ? null : (
            <Row key={b.mode} mode={b.mode} name={b.label} value={v} />
          )
        })}
      </div>
    )
  }
}

function Row({ swatch, mode, name, value }: { swatch?: string; mode?: string; name: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ marginTop: 3 }}>
      <span className="flex items-center gap-2" style={{ color: '#C3C2B7', fontSize: '0.75rem' }}>
        {mode
          ? <span style={{ color: modeColor(mode), display: 'inline-flex' }}><ShipModeIcon mode={mode} size={12} /></span>
          : <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: swatch, display: 'inline-block' }} />}
        {name}
      </span>
      <span style={{ color: '#FFFFFF', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
        {value === null ? '—' : fmtInt(value)}
      </span>
    </div>
  )
}
