'use client'

export type SalesMetric = 'revenue' | 'orders'

const OPTIONS: { id: SalesMetric; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'orders',  label: 'Orders'  },
]

/**
 * Compact segmented switch that sits in a card's top-right corner and picks
 * which metric drives that card's bars.
 */
export function MetricToggle({
  value,
  onChange,
}: {
  value: SalesMetric
  onChange: (m: SalesMetric) => void
}) {
  return (
    <div
      role="group"
      aria-label="Metric"
      style={{
        display: 'inline-flex',
        padding: 2,
        gap: 2,
        borderRadius: 7,
        backgroundColor: '#F0EFE9',
        border: '1px solid #E3E2DC',
        flexShrink: 0,
      }}
    >
      {OPTIONS.map(opt => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            style={{
              border: 'none',
              cursor: active ? 'default' : 'pointer',
              padding: '3px 8px',
              borderRadius: 5,
              backgroundColor: active ? '#FFFFFF' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize: '0.625rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: active ? '#111110' : '#9E9D98',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
