'use client'

import type { LowStockItem } from '@/lib/low-stock'

interface LowStockListProps {
  items: LowStockItem[]
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

/**
 * Low stock rows for the island's notification panel. Days of coverage carry
 * the alert; units and the run-out date sit underneath as the detail.
 */
export function LowStockList({ items }: LowStockListProps) {
  if (items.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => {
        const dot          = variantDot(item.color)
        const variantLabel = !item.variant || item.variant.toLowerCase() === 'default title'
          ? ''
          : item.variant

        return (
          <div
            key={item.sku}
            style={{
              padding: '11px 0',
              borderBottom: i < items.length - 1 ? '1px solid #F0EFE9' : 'none',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            {/* Name + days of coverage */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
                {dot && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: dot.bg, border: dot.border, display: 'inline-block',
                  }} />
                )}
                <span style={{
                  fontFamily: G, fontSize: '0.8125rem', color: '#111110',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.product_name}{variantLabel ? ` · ${variantLabel}` : ''}
                </span>
              </div>
              <span className="metric" style={{
                fontFamily: G, fontSize: '0.875rem', fontWeight: 600,
                color: '#DC2626', lineHeight: 1, flexShrink: 0,
              }}>
                {item.daysLeft}d
              </span>
            </div>

            {/* Units on hand + run-out date */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingLeft: dot ? 16 : 0 }}>
              <span className="label" style={{ fontSize: '0.6875rem', color: '#DC2626' }}>
                {item.effectiveUnits} units
              </span>
              <span style={{ fontFamily: G, fontSize: '0.6875rem', color: '#6B6A64', flexShrink: 0 }}>
                {item.lastUntil ? `until ${formatDate(item.lastUntil)}` : '—'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
