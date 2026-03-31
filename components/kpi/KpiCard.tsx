import { clsx } from 'clsx'
import type { KpiValue, MetricDefinition, FormatType } from '@/lib/types'

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatValue(value: number, format: FormatType): string {
  switch (format) {
    case 'currency':
    case 'euro':
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'number':
      if (value % 1 !== 0) return value.toFixed(2)
      return new Intl.NumberFormat('en-GB').format(value)
    default:
      return String(value)
  }
}

function formatDelta(delta: number, format: FormatType): string {
  if (format === 'currency' || format === 'euro') {
    const abs = Math.abs(delta)
    return `${delta >= 0 ? '+' : '−'}${new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(abs)}`
  }
  if (format === 'percent') return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp`
  if (format === 'number') {
    if (delta % 1 !== 0) return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`
    return `${delta >= 0 ? '+' : ''}${new Intl.NumberFormat('en-GB').format(delta)}`
  }
  return `${delta >= 0 ? '+' : ''}${delta}`
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  metric: MetricDefinition
  data: KpiValue
  /** Show a secondary line of text below the value */
  subtitle?: string
}

export function KpiCard({ metric, data, subtitle }: KpiCardProps) {
  const { value, delta, deltaPercent, trend, isPositiveUp } = data

  const isPositive = isPositiveUp ? trend === 'up' : trend === 'down'
  const isNegative = isPositiveUp ? trend === 'down' : trend === 'up'

  const deltaColor = isPositive
    ? '#7DEFEF'
    : isNegative
    ? '#FF4444'
    : '#888888'

  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'

  return (
    <div
      className="p-5 flex flex-col gap-3"
      style={{
        backgroundColor: '#141414',
        border: '1px solid #222222',
        borderRadius: '4px',
      }}
    >
      {/* Label */}
      <span className="label">{metric.label}</span>

      {/* Value */}
      <div className="flex items-end justify-between gap-2">
        <span
          className="metric"
          style={{ fontSize: '1.625rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1 }}
        >
          {formatValue(value, metric.format)}
        </span>

        {/* Delta badge */}
        {delta !== undefined && deltaPercent !== undefined && (
          <div
            className="flex items-center gap-1 shrink-0 mb-0.5"
            style={{ color: deltaColor }}
          >
            <span style={{ fontSize: '0.75rem', fontFamily: 'inherit' }}>
              {trendArrow}
            </span>
            <span className="metric" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
              {deltaPercent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Delta vs previous period */}
      {delta !== undefined && (
        <div className="flex items-center justify-between">
          <span style={{ fontSize: '0.75rem', color: '#888888' }}>
            {subtitle ?? 'vs. prev. month'}
          </span>
          <span
            className="metric"
            style={{ fontSize: '0.75rem', color: deltaColor }}
          >
            {formatDelta(delta, metric.format)}
          </span>
        </div>
      )}
    </div>
  )
}
