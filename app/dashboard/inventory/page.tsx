import { Card, CardHeader } from '@/components/ui/Card'
import { getInventoryLevels, getAvgDailySalesBySku } from '@/lib/shopify/queries'
import { getWeShipStock } from '@/lib/weship/queries'

export const revalidate = 600

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

// Dot colour per variant colour label
function variantDot(color: string | undefined) {
  if (color === 'black') return { bg: '#1C1C1C', border: '1px solid #606060' }
  if (color === 'beige') return { bg: '#C8A882', border: 'none' }
  return null
}

export default async function InventoryPage() {
  const [shopifyLevels, weshipStock, avgDailySales] = await Promise.all([
    getInventoryLevels().catch(() => null),
    getWeShipStock().catch(() => null),
    getAvgDailySalesBySku().catch(() => null),
  ])

  const levels = shopifyLevels ?? []

  // Build enriched rows: merge WeShip stock + avg daily sales
  const rows = levels.map((item) => {
    const ws          = weshipStock?.find((w) => w.sku === item.sku)
    const unitsWeship = ws?.on_stock ?? null
    const unitsShopify = item.units

    // "Will last until" — based on WeShip units (primary) or Shopify as fallback
    const stockForForecast = unitsWeship ?? unitsShopify
    const avgSales = avgDailySales?.[item.sku] ?? 0
    const daysLeft = avgSales > 0 ? Math.floor(stockForForecast / avgSales) : null
    const lastUntil = daysLeft !== null
      ? new Date(Date.now() + daysLeft * 86_400_000)
      : null

    // Low-stock is against WeShip units when available
    const effectiveUnits = unitsWeship ?? unitsShopify
    const isLow = effectiveUnits < item.reorder_threshold

    return { ...item, unitsWeship, unitsShopify, daysLeft, lastUntil, isLow }
  })

  const isWeShipLive  = !!weshipStock
  const isShopifyLive = !!shopifyLevels

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

      {/* Stock table */}
      <Card>
        <CardHeader
          label="Current Stock Levels"
          action={
            <span className="label" style={{ color: '#333' }}>
              {isWeShipLive ? 'WeShip · live' : 'WeShip · offline'}
              {' · '}
              {isShopifyLive ? 'Shopify · live' : 'Shopify · offline'}
            </span>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {[
                  { label: 'SKU',              align: 'left'  },
                  { label: 'Product',          align: 'left'  },
                  { label: 'Variant',          align: 'left'  },
                  { label: 'Units WeShip',     align: 'right' },
                  { label: 'Units Shopify',    align: 'right' },
                  { label: 'Stock lasts until',align: 'left'  },
                  { label: 'Threshold',        align: 'right' },
                  { label: 'Status',           align: 'left'  },
                ].map(({ label, align }) => (
                  <th
                    key={label}
                    className="label"
                    style={{
                      textAlign: align as 'left' | 'right',
                      paddingBottom: 10,
                      paddingRight: label === 'Threshold' ? 32 : 0,
                      borderBottom: '1px solid #1C1C1C',
                      color: '#333',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, i) => {
                const dot = variantDot(item.color)
                // Variant cell: show "Default Title" as empty
                const variantLabel =
                  !item.variant || item.variant.toLowerCase() === 'default title'
                    ? ''
                    : item.variant

                return (
                  <tr
                    key={item.sku}
                    style={{
                      borderBottom: i < rows.length - 1 ? '1px solid #1A1A1A' : 'none',
                    }}
                  >
                    {/* SKU */}
                    <td
                      className="metric"
                      style={{ padding: '12px 0', fontSize: '0.75rem', color: '#444', paddingRight: 16 }}
                    >
                      {item.sku}
                    </td>

                    {/* Product */}
                    <td
                      style={{
                        padding: '12px 0',
                        paddingRight: 16,
                        fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                        color: '#CCC',
                      }}
                    >
                      {item.product_name}
                    </td>

                    {/* Variant */}
                    <td style={{ padding: '12px 0', paddingRight: 16 }}>
                      {variantLabel ? (
                        <div className="flex items-center gap-2">
                          {dot && (
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: dot.bg,
                                border: dot.border,
                                display: 'inline-block',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                              color: item.color === 'beige' ? '#C8A882' : '#FFFFFF',
                            }}
                          >
                            {variantLabel}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#333' }}>—</span>
                      )}
                    </td>

                    {/* Units WeShip */}
                    <td
                      className="metric"
                      style={{
                        textAlign: 'right',
                        padding: '12px 0',
                        paddingRight: 16,
                        fontWeight: 600,
                        color: item.isLow ? '#FF4444' : '#FFFFFF',
                      }}
                    >
                      {item.unitsWeship !== null ? item.unitsWeship : (
                        <span style={{ color: '#333' }}>—</span>
                      )}
                    </td>

                    {/* Units Shopify */}
                    <td
                      className="metric"
                      style={{
                        textAlign: 'right',
                        padding: '12px 0',
                        paddingRight: 24,
                        color: '#444',
                        fontSize: '0.75rem',
                      }}
                    >
                      {item.unitsShopify}
                    </td>

                    {/* Stock lasts until */}
                    <td style={{ padding: '12px 0', paddingRight: 16 }}>
                      {item.lastUntil ? (
                        <span
                          style={{
                            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                            color: item.daysLeft !== null && item.daysLeft < 14
                              ? '#FF8C42'
                              : '#888',
                          }}
                        >
                          {formatDate(item.lastUntil)}
                          <span style={{ color: '#333', marginLeft: 6, fontSize: '0.6875rem' }}>
                            ({item.daysLeft}d)
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: '#333' }}>—</span>
                      )}
                    </td>

                    {/* Threshold */}
                    <td
                      className="metric"
                      style={{
                        textAlign: 'right',
                        padding: '12px 0',
                        paddingRight: 32,
                        fontSize: '0.8125rem',
                        color: '#333',
                      }}
                    >
                      {item.reorder_threshold}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 0' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 2,
                          backgroundColor: item.isLow
                            ? 'rgba(255,68,68,0.1)'
                            : 'rgba(125,239,239,0.07)',
                          border: `1px solid ${item.isLow ? 'rgba(255,68,68,0.3)' : 'rgba(125,239,239,0.15)'}`,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            backgroundColor: item.isLow ? '#FF4444' : '#7DEFEF',
                            display: 'inline-block',
                          }}
                        />
                        <span
                          className="label"
                          style={{ color: item.isLow ? '#FF4444' : '#7DEFEF' }}
                        >
                          {item.isLow ? 'Reorder' : 'OK'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  )
}
