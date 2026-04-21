'use client'

import { useState } from 'react'
import type { KpiValue, MetricDefinition, FormatType } from '@/lib/types'

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' €'
}

function formatValue(value: number, format: FormatType): string {
  switch (format) {
    case 'currency':
    case 'euro':
      return fmtEur(value)
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'number':
      if (value % 1 !== 0) return value.toFixed(2)
      return new Intl.NumberFormat('de-DE').format(value)
    default:
      return String(value)
  }
}

function formatDelta(delta: number, format: FormatType): string {
  if (format === 'currency' || format === 'euro') {
    return `${delta >= 0 ? '+' : '−'}${fmtEur(Math.abs(delta))}`
  }
  if (format === 'percent') return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp`
  if (format === 'number') {
    if (delta % 1 !== 0) return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`
    return `${delta >= 0 ? '+' : ''}${new Intl.NumberFormat('de-DE').format(delta)}`
  }
  return `${delta >= 0 ? '+' : ''}${delta}`
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  metric: MetricDefinition
  data: KpiValue
  subtitle?: string
}

const G = "'Gustavo', 'Helvetica Neue', sans-serif"

export function KpiCard({ metric, data, subtitle }: KpiCardProps) {
  const { value, delta, deltaPercent, trend, isPositiveUp, note } = data
  const [hovered, setHovered] = useState(false)

  const isPositive = isPositiveUp ? trend === 'up' : trend === 'down'
  const isNegative = isPositiveUp ? trend === 'down' : trend === 'up'

  const deltaColor = isPositive ? '#0D8585' : isNegative ? '#DC2626' : '#9E9D98'
  const deltaBg    = isPositive
    ? 'rgba(125,239,239,0.18)'
    : isNegative
    ? 'rgba(220,38,38,0.08)'
    : 'rgba(0,0,0,0.04)'

  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'

  return (
    <div
      className="p-6 flex flex-col gap-3"
      style={{ backgroundColor: '#FFFFFF', borderRadius: 16, position: 'relative' }}
      onMouseEnter={() => note && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {note && hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1C1C1A', borderRadius: 8, padding: '7px 12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
          fontFamily: G, fontSize: '0.6875rem', color: '#C7C6C0',
        }}>
          {note}
        </div>
      )}
      <span className="label">{metric.label}</span>

      <div className="flex items-end justify-between gap-2">
        <span
          className="metric"
          style={{ fontSize: '1.75rem', fontWeight: 600, color: '#111110', lineHeight: 1 }}
        >
          {formatValue(value, metric.format)}
        </span>

        {delta !== undefined && deltaPercent !== undefined && (
          <div
            className="flex items-center gap-1 shrink-0 mb-0.5"
            style={{
              backgroundColor: deltaBg,
              borderRadius: 100,
              padding: '3px 8px',
              color: deltaColor,
            }}
          >
            <span style={{ fontSize: '0.6875rem' }}>{trendArrow}</span>
            <span className="metric" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
              {deltaPercent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {delta !== undefined && (
        <div className="flex items-center justify-between">
          <span style={{ fontSize: '0.75rem', color: '#9E9D98', fontFamily: 'inherit' }}>
            {subtitle ?? 'vs. prev. month'}
          </span>
          <span className="metric" style={{ fontSize: '0.75rem', color: deltaColor }}>
            {formatDelta(delta, metric.format)}
          </span>
        </div>
      )}
    </div>
  )
}
