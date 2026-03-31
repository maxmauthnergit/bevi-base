import { Card, CardHeader } from '@/components/ui/Card'
import { getInventoryLevels } from '@/lib/shopify/queries'

export const revalidate = 600 // revalidate every 10 minutes

export default async function InventoryPage() {
  const stockLevels = await getInventoryLevels().catch(() => null)
  const levels = stockLevels ?? []
  const lowItems = levels.filter((s) => s.is_low)
  const totalUnits = levels.reduce((s, i) => s + i.units, 0)
  const isLive = !!stockLevels

  return (
    <main style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div className="mb-8">
        <span className="label" style={{ display: 'block', marginBottom: 8 }}>Operations</span>
        <h1
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.5rem',
            fontWeight: 500,
            color: '#FFFFFF',
            margin: 0,
          }}
        >
          Inventory
        </h1>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px',
          backgroundColor: '#222',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Total Units in Stock', value: totalUnits.toString(), sub: 'All SKUs at WeShip' },
          {
            label: 'Low Stock Alerts',
            value: lowItems.length.toString(),
            sub: lowItems.map((i) => i.variant).join(', '),
            danger: lowItems.length > 0,
          },
          {
            label: 'Data Source',
            value: isLive ? 'Shopify' : 'Mock',
            sub: isLive ? 'Live · updates every 10 min' : 'API not connected',
            muted: !isLive,
          },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: '#141414', padding: '20px' }}>
            <span className="label" style={{ display: 'block', marginBottom: 8 }}>{stat.label}</span>
            <span
              className="metric"
              style={{
                display: 'block',
                fontSize: '1.5rem',
                fontWeight: 600,
                color: stat.danger ? '#FF4444' : stat.muted ? '#444' : '#FFFFFF',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {stat.value}
            </span>
            <span className="label" style={{ color: stat.danger ? 'rgba(255,68,68,0.5)' : '#333' }}>
              {stat.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Stock levels */}
      <Card>
        <CardHeader
          label="Current Stock Levels"
          action={
            <span className="label" style={{ color: '#444' }}>
              Updated manually via Settings
            </span>
          }
        />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['SKU', 'Product', 'Variant', 'Units', 'Threshold', 'Status'].map((h) => (
                <th
                  key={h}
                  className="label"
                  style={{
                    textAlign: h === 'Units' || h === 'Threshold' ? 'right' : 'left',
                    paddingBottom: 10,
                    borderBottom: '1px solid #1C1C1C',
                    color: '#333',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((item, i) => (
              <tr
                key={item.sku}
                style={{
                  borderBottom: i < levels.length - 1 ? '1px solid #1A1A1A' : 'none',
                  backgroundColor: item.is_low ? 'rgba(255,68,68,0.03)' : 'transparent',
                }}
              >
                <td
                  className="metric"
                  style={{ padding: '12px 0', fontSize: '0.75rem', color: '#444' }}
                >
                  {item.sku}
                </td>
                <td
                  style={{
                    padding: '12px 0',
                    fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    fontSize: '0.8125rem',
                    color: '#CCC',
                  }}
                >
                  {item.product_name}
                </td>
                <td style={{ padding: '12px 0' }}>
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: item.color === 'beige' ? '#E8DFD0' : '#FFFFFF',
                        border: item.color === 'black' ? '1px solid #444' : 'none',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                        fontSize: '0.8125rem',
                        color: item.color === 'beige' ? '#E8DFD0' : '#FFFFFF',
                      }}
                    >
                      {item.variant}
                    </span>
                  </div>
                </td>
                <td
                  className="metric"
                  style={{
                    textAlign: 'right',
                    padding: '12px 0',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: item.is_low ? '#FF4444' : '#FFFFFF',
                  }}
                >
                  {item.units}
                </td>
                <td
                  className="metric"
                  style={{ textAlign: 'right', padding: '12px 0', fontSize: '0.8125rem', color: '#444' }}
                >
                  {item.reorder_threshold}
                </td>
                <td style={{ padding: '12px 0' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: '2px',
                      backgroundColor: item.is_low ? 'rgba(255,68,68,0.1)' : 'rgba(125,239,239,0.07)',
                      border: `1px solid ${item.is_low ? 'rgba(255,68,68,0.3)' : 'rgba(125,239,239,0.15)'}`,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        backgroundColor: item.is_low ? '#FF4444' : '#7DEFEF',
                        display: 'inline-block',
                      }}
                    />
                    <span
                      className="label"
                      style={{ color: item.is_low ? '#FF4444' : '#7DEFEF' }}
                    >
                      {item.is_low ? 'Reorder' : 'OK'}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Reorder note */}
      <div
        style={{
          marginTop: 16,
          padding: '14px 16px',
          backgroundColor: '#141414',
          border: '1px solid #1C1C1C',
          borderRadius: '4px',
        }}
      >
        <span className="label" style={{ color: '#333', display: 'block', marginBottom: 4 }}>
          Reorder workflow
        </span>
        <p
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '0.8125rem',
            color: '#555',
            margin: 0,
          }}
        >
          Stock levels are updated manually. When a SKU falls below threshold, contact WeShip EU/AT to arrange restock.
          Automated WeShip API sync planned for Phase 2.
        </p>
      </div>
    </main>
  )
}
