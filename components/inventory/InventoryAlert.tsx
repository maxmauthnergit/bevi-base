import type { StockLevel } from '@/lib/types'

interface AlertItem extends StockLevel {
  effectiveUnits: number
  daysLeft: number | null
  lastUntil: Date | null
}

interface InventoryAlertProps {
  items: AlertItem[]
}

const G = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function variantDot(color: string | undefined) {
  if (color === 'black') return { bg: '#1C1C1C', border: '1px solid #606060' }
  if (color === 'beige') return { bg: '#C8A882', border: 'none' }
  return null
}

export function InventoryAlert({ items }: InventoryAlertProps) {
  if (items.length === 0) return null

  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 68, 68, 0.06)',
        border: '1px solid rgba(255, 68, 68, 0.25)',
        borderRadius: 16,
        padding: '16px 20px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <span className="label" style={{ color: '#FF4444' }}>
          Low Stock Alert
        </span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {items.map((item, i) => {
          const dot          = variantDot(item.color)
          const variantLabel = !item.variant || item.variant.toLowerCase() === 'default title'
            ? ''
            : item.variant

          const barMax   = Math.max(item.effectiveUnits, item.reorder_threshold) * 1.4
          const barFill  = Math.min(100, (item.effectiveUnits / barMax) * 100)
          const barMark  = (item.reorder_threshold / barMax) * 100

          return (
            <div
              key={item.sku}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 130px 120px',
                alignItems: 'center',
                gap: 16,
                padding: '10px 0',
                borderBottom: i < items.length - 1 ? '1px solid rgba(255,68,68,0.12)' : 'none',
              }}
            >
              {/* Name + variant */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                {dot && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: dot.bg, border: dot.border, display: 'inline-block',
                  }} />
                )}
                <div style={{ overflow: 'hidden' }}>
                  <span style={{
                    fontFamily: G, fontSize: '0.8125rem', color: '#111110',
                    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.product_name}{variantLabel ? ` · ${variantLabel}` : ''}
                  </span>
                </div>
              </div>

              {/* Stock Lasts Until */}
              <div>
                {item.lastUntil ? (
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#6B6A64' }}>
                      {formatDate(item.lastUntil)}
                    </span>
                    <span className="label" style={{
                      fontSize: '0.6875rem',
                      color: item.daysLeft !== null && item.daysLeft < 60 ? '#DC2626' : '#0D8585',
                    }}>
                      {item.daysLeft}d
                    </span>
                  </span>
                ) : (
                  <span style={{ fontFamily: G, fontSize: '0.8125rem', color: '#9E9D98' }}>—</span>
                )}
              </div>

              {/* Stock Level bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ position: 'relative', height: 5, backgroundColor: '#F0C0C0', borderRadius: 3 }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0,
                    width: `${barFill}%`, height: '100%',
                    backgroundColor: '#DC2626', borderRadius: 3, opacity: 0.8,
                  }} />
                  <div style={{
                    position: 'absolute', top: -2, bottom: -2,
                    left: `${barMark}%`, width: 1.5,
                    backgroundColor: '#9E9D98', borderRadius: 1,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="metric" style={{ fontSize: '0.625rem', color: '#DC2626' }}>
                    {item.effectiveUnits}
                  </span>
                  <span className="label" style={{ fontSize: '0.625rem', color: '#9E9D98' }}>
                    min {item.reorder_threshold}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
