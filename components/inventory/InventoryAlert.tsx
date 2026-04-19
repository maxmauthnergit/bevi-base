import type { StockLevel } from '@/lib/types'

interface InventoryAlertProps {
  items: StockLevel[]
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
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: '#FF4444', fontSize: '0.7rem' }}>⬤</span>
        <span className="label" style={{ color: '#FF4444' }}>
          Low Stock Alert
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.sku} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Color swatch */}
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: item.color === 'beige' ? '#E8DFD0' : '#FFFFFF',
                  border: item.color === 'black' ? '1px solid #444' : undefined,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontSize: '0.8125rem',
                  color: '#111110',
                }}
              >
                {item.product_name} {item.variant}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="metric"
                style={{ fontSize: '0.8125rem', color: '#FF4444', fontWeight: 600 }}
              >
                {item.units} units
              </span>
              <span
                className="label"
                style={{ color: '#555', fontSize: '0.625rem' }}
              >
                min. {item.reorder_threshold}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
