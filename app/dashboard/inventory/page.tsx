import { Card, CardHeader } from '@/components/ui/Card'
import { getInventoryLevels, getAvgDailySalesBySku } from '@/lib/shopify/queries'
import { getWeShipStock } from '@/lib/weship/queries'

export const revalidate = 600

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

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

  const rows = levels.map((item) => {
    const ws           = weshipStock?.find((w) => w.sku === item.sku)
    const unitsWeship  = ws?.on_stock ?? null
    const unitsShopify = item.units
    const avgSales     = avgDailySales?.[item.sku] ?? 0

    const stockForForecast = unitsWeship ?? unitsShopify
    const daysLeft  = avgSales > 0 ? Math.floor(stockForForecast / avgSales) : null
    const lastUntil = daysLeft !== null ? new Date(Date.now() + daysLeft * 86_400_000) : null

    const effectiveUnits = unitsWeship ?? unitsShopify
    const isLow = effectiveUnits < item.reorder_threshold

    return { ...item, unitsWeship, unitsShopify, avgSales, daysLeft, lastUntil, isLow, effectiveUnits }
  })

  return (
    <main style={{ padding: '32px 40px', maxWidth: 1280 }}>
      {/* Header */}
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.75rem',
            fontWeight: 600,
            color: '#111110',
            margin: 0,
          }}
        >
          Inventory
        </h1>
      </div>

      {/* Stock table */}
      <Card>
        <CardHeader label="Current Stock Levels" />
        <div style={{ height: 12 }} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {[
                  { label: 'Product',           align: 'left',  pl: 0,  pr: 24 },
                  { label: 'Variant',            align: 'left',  pl: 0,  pr: 24 },
                  { label: 'Units WeShip',       align: 'right', pl: 0,  pr: 16 },
                  { label: 'Units Shopify',      align: 'right', pl: 0,  pr: 40 },
                  { label: 'Avg Sales/Day',      align: 'right', pl: 0,  pr: 32 },
                  { label: 'Stock Lasts Until',  align: 'left',  pl: 0,  pr: 32 },
                  { label: 'Stock Level',        align: 'left',  pl: 0,  pr: 0  },
                ].map(({ label, align, pr }) => (
                  <th
                    key={label}
                    className="label"
                    style={{
                      textAlign: align as 'left' | 'right',
                      paddingBottom: 10,
                      paddingRight: pr,
                      borderBottom: '1px solid #E3E2DC',
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
                const dot          = variantDot(item.color)
                const variantLabel = !item.variant || item.variant.toLowerCase() === 'default title'
                  ? ''
                  : item.variant

                // Stock bar geometry
                const barMax  = Math.max(item.effectiveUnits, item.reorder_threshold) * 1.4
                const barFill = Math.min(100, (item.effectiveUnits / barMax) * 100)
                const barMark = (item.reorder_threshold / barMax) * 100
                const barColor = item.isLow ? '#DC2626' : '#0D8585'

                return (
                  <tr
                    key={item.sku}
                    style={{ borderBottom: i < rows.length - 1 ? '1px solid #F0EFE9' : 'none' }}
                  >
                    {/* Product + SKU subtitle */}
                    <td style={{ padding: '12px 0', paddingRight: 24 }}>
                      <span
                        style={{
                          display: 'block',
                          fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                          color: '#111110',
                        }}
                      >
                        {item.product_name}
                      </span>
                      <span className="metric" style={{ fontSize: '0.6875rem', color: '#9E9D98' }}>
                        {item.sku}
                      </span>
                    </td>

                    {/* Variant */}
                    <td style={{ padding: '12px 0', paddingRight: 24 }}>
                      {variantLabel ? (
                        <div className="flex items-center gap-2">
                          {dot && (
                            <span
                              style={{
                                width: 8, height: 8, borderRadius: '50%',
                                backgroundColor: dot.bg, border: dot.border,
                                display: 'inline-block', flexShrink: 0,
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                              color: item.color === 'beige' ? '#9A7A5A' : '#111110',
                            }}
                          >
                            {variantLabel}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#9E9D98' }}>—</span>
                      )}
                    </td>

                    {/* Units WeShip */}
                    <td
                      className="metric"
                      style={{
                        textAlign: 'right', padding: '12px 0', paddingRight: 16,
                        fontWeight: 600,
                        color: item.isLow ? '#DC2626' : '#111110',
                      }}
                    >
                      {item.unitsWeship !== null ? item.unitsWeship : (
                        <span style={{ color: '#9E9D98' }}>—</span>
                      )}
                    </td>

                    {/* Units Shopify */}
                    <td
                      className="metric"
                      style={{
                        textAlign: 'right', padding: '12px 0', paddingRight: 40,
                        color: '#9E9D98', fontSize: '0.75rem',
                      }}
                    >
                      {item.unitsShopify}
                    </td>

                    {/* Avg Sales/Day */}
                    <td
                      className="metric"
                      style={{
                        textAlign: 'right', padding: '12px 0', paddingRight: 32,
                        color: '#6B6A64', fontSize: '0.8125rem',
                      }}
                    >
                      {item.avgSales > 0 ? item.avgSales.toFixed(1) : (
                        <span style={{ color: '#9E9D98' }}>—</span>
                      )}
                    </td>

                    {/* Stock Lasts Until */}
                    <td style={{ padding: '12px 0', paddingRight: 32 }}>
                      {item.lastUntil ? (
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span
                            style={{
                              fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                              color: '#6B6A64',
                            }}
                          >
                            {formatDate(item.lastUntil)}
                          </span>
                          <span
                            className="label"
                            style={{
                              fontSize: '0.6875rem',
                              color: item.daysLeft !== null && item.daysLeft < 60 ? '#DC2626' : '#0D8585',
                            }}
                          >
                            {item.daysLeft}d
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: '#9E9D98' }}>—</span>
                      )}
                    </td>

                    {/* Stock Level — inline bar */}
                    <td style={{ padding: '12px 0', paddingRight: 24 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
                        {/* Bar */}
                        <div
                          style={{
                            position: 'relative', height: 5,
                            backgroundColor: '#E3E2DC', borderRadius: 3,
                          }}
                        >
                          {/* Fill */}
                          <div
                            style={{
                              position: 'absolute', left: 0, top: 0,
                              width: `${barFill}%`, height: '100%',
                              backgroundColor: barColor,
                              borderRadius: 3,
                              opacity: item.isLow ? 0.8 : 0.6,
                            }}
                          />
                          {/* Threshold marker */}
                          <div
                            style={{
                              position: 'absolute', top: -2, bottom: -2,
                              left: `${barMark}%`,
                              width: 1.5,
                              backgroundColor: '#9E9D98',
                              borderRadius: 1,
                            }}
                          />
                        </div>
                        {/* Numbers */}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="metric" style={{ fontSize: '0.625rem', color: item.isLow ? '#DC2626' : '#6B6A64' }}>
                            {item.effectiveUnits}
                          </span>
                          <span className="label" style={{ fontSize: '0.625rem', color: '#9E9D98' }}>
                            min {item.reorder_threshold}
                          </span>
                        </div>
                      </div>
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Methodology footnote */}
      <div
        style={{
          marginTop: 12,
          padding: '20px 20px',
          backgroundColor: '#EDECEA',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {[
          {
            term: 'Avg Sales/Day',
            desc: 'Based on Shopify orders placed within the last 30 days',
          },
          {
            term: 'Stock Lasts Until',
            desc: 'Projected date at current avg sales/day from WeShip stock',
          },
          {
            term: 'Stock Level Min',
            desc: (
              <>
                Reorder threshold per product — configure in{' '}
                <a
                  href="/dashboard/settings"
                  style={{ color: '#6B6A64', textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                  Settings
                </a>
              </>
            ),
          },
        ].map(({ term, desc }) => (
          <div key={term} style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
            <span
              className="label"
              style={{ color: '#9E9D98', whiteSpace: 'nowrap', letterSpacing: '0.06em', minWidth: 140 }}
            >
              {term}
            </span>
            <span
              style={{
                fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: '0.75rem',
                color: '#9E9D98',
              }}
            >
              {desc}
            </span>
          </div>
        ))}
      </div>
    </main>
  )
}
