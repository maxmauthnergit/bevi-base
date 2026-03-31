import { Card, CardHeader } from '@/components/ui/Card'
import { mockMonthlyRevenue, mockUnitsBySku, mockRevenueByCountry, mockReturnRate, mockBundleAttachRate } from '@/lib/mock/sales'

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function SalesPage() {
  const totalRevenue = mockMonthlyRevenue.reduce((s, m) => s + m.revenue_gross, 0)
  const totalOrders = mockMonthlyRevenue.reduce((s, m) => s + m.orders, 0)
  const latestMonth = mockMonthlyRevenue[mockMonthlyRevenue.length - 1]
  const aov = latestMonth.revenue_gross / latestMonth.orders

  return (
    <main style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div className="mb-8">
        <span className="label" style={{ display: 'block', marginBottom: 8 }}>
          Analytics
        </span>
        <h1
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.5rem',
            fontWeight: 500,
            color: '#FFFFFF',
            margin: 0,
          }}
        >
          Sales & Products
        </h1>
      </div>

      {/* Top stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          backgroundColor: '#222',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Total Revenue (6 Mo)', value: formatEur(totalRevenue), sub: 'Brutto' },
          { label: 'Total Orders (6 Mo)', value: totalOrders.toLocaleString('de-DE'), sub: 'Bestellungen' },
          { label: 'AOV (Mar)', value: formatEur(aov), sub: 'Durchschnittswert' },
          { label: 'Return Rate (Mar)', value: `${mockReturnRate[mockReturnRate.length - 1].rate}%`, sub: 'Rücksendungen' },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: '#141414', padding: '20px' }}>
            <span className="label" style={{ display: 'block', marginBottom: 8 }}>{stat.label}</span>
            <span className="metric" style={{ display: 'block', fontSize: '1.5rem', fontWeight: 600, color: '#FFF', lineHeight: 1, marginBottom: 4 }}>
              {stat.value}
            </span>
            <span className="label" style={{ color: '#333' }}>{stat.sub}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Monthly Revenue */}
        <Card>
          <CardHeader label="Revenue by Month" />
          <div className="flex flex-col gap-2">
            {mockMonthlyRevenue.map((m) => {
              const maxRev = Math.max(...mockMonthlyRevenue.map((x) => x.revenue_gross))
              const pct = (m.revenue_gross / maxRev) * 100
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="label" style={{ width: 30, color: '#555' }}>{m.month}</span>
                  <div style={{ flex: 1, height: 4, backgroundColor: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#7DEFEF', borderRadius: 2 }} />
                  </div>
                  <span className="metric" style={{ fontSize: '0.8125rem', color: '#CCC', width: 68, textAlign: 'right' }}>
                    {formatEur(m.revenue_gross)}
                  </span>
                  <span className="metric" style={{ fontSize: '0.75rem', color: '#444', width: 30, textAlign: 'right' }}>
                    {m.orders}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Units by SKU */}
        <Card>
          <CardHeader label="Units Sold by SKU" />
          <div className="flex flex-col gap-3">
            {mockUnitsBySku.map((item) => {
              const maxUnits = Math.max(...mockUnitsBySku.map((x) => x.units))
              const pct = (item.units / maxUnits) * 100
              return (
                <div key={item.sku} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: "'Gustavo', sans-serif", fontSize: '0.8125rem', color: '#CCC' }}>
                      {item.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="metric" style={{ fontSize: '0.8125rem', color: '#FFF', fontWeight: 600 }}>{item.units}</span>
                      <span className="metric" style={{ fontSize: '0.75rem', color: '#555' }}>{formatEur(item.revenue)}</span>
                    </div>
                  </div>
                  <div style={{ height: 3, backgroundColor: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#7DEFEF', borderRadius: 2, opacity: 0.7 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Revenue by Country */}
        <Card>
          <CardHeader label="Revenue by Country" />
          <div className="flex flex-col gap-2">
            {mockRevenueByCountry.map((c) => (
              <div key={c.code} className="flex items-center gap-3">
                <span className="label" style={{ width: 20, color: '#555' }}>{c.code}</span>
                <span style={{ fontFamily: "'Gustavo', sans-serif", fontSize: '0.8125rem', color: '#CCC', flex: 1 }}>
                  {c.country}
                </span>
                <div style={{ width: 80, height: 3, backgroundColor: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${c.percent}%`, height: '100%', backgroundColor: '#7DEFEF', borderRadius: 2 }} />
                </div>
                <span className="metric" style={{ fontSize: '0.8125rem', color: '#888', width: 40, textAlign: 'right' }}>
                  {c.percent}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Bundle attach + Return rate */}
        <Card>
          <CardHeader label="Bundle Attach Rate" />
          <div className="flex flex-col gap-2 mb-6">
            {mockBundleAttachRate.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="label" style={{ width: 30, color: '#555' }}>{m.month}</span>
                <div style={{ flex: 1, height: 4, backgroundColor: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(m.rate / 30) * 100}%`, height: '100%', backgroundColor: '#E8DFD0', borderRadius: 2 }} />
                </div>
                <span className="metric" style={{ fontSize: '0.8125rem', color: '#CCC', width: 40, textAlign: 'right' }}>
                  {m.rate}%
                </span>
              </div>
            ))}
          </div>

          <span className="label" style={{ display: 'block', marginBottom: 8 }}>Return Rate</span>
          <div className="flex flex-col gap-2">
            {mockReturnRate.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="label" style={{ width: 30, color: '#555' }}>{m.month}</span>
                <div style={{ flex: 1, height: 4, backgroundColor: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(m.rate / 5) * 100}%`, height: '100%', backgroundColor: '#FF4444', borderRadius: 2, opacity: 0.6 }} />
                </div>
                <span className="metric" style={{ fontSize: '0.8125rem', color: '#888', width: 40, textAlign: 'right' }}>
                  {m.rate}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  )
}
