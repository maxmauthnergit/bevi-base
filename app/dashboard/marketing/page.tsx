import { Card, CardHeader } from '@/components/ui/Card'
import {
  mockMonthlyAdSpend,
  mockRoasTrend,
  mockCacTrend,
  mockSpendVsRevenue,
  mockInstagramFollowers,
} from '@/lib/mock/marketing'

function formatEur(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function MarketingPage() {
  const latest = mockMonthlyAdSpend[mockMonthlyAdSpend.length - 1]
  const latestRoas = mockRoasTrend[mockRoasTrend.length - 1]
  const latestCac = mockCacTrend[mockCacTrend.length - 1]
  const prevRoas = mockRoasTrend[mockRoasTrend.length - 2]
  const prevCac = mockCacTrend[mockCacTrend.length - 2]

  const roasDelta = latestRoas.roas - prevRoas.roas
  const cacDelta = latestCac.cac - prevCac.cac

  return (
    <main style={{ padding: '32px 40px' }}>
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
          Marketing
        </h1>
      </div>

      {/* Top stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          backgroundColor: '#E3E2DC',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        {[
          {
            label: 'Ad Spend MTD',
            value: formatEur(latest.meta),
            sub: 'Meta Ads',
            color: '#DC2626',
          },
          {
            label: 'ROAS',
            value: latestRoas.roas.toFixed(2) + '×',
            sub: roasDelta >= 0 ? `↑ ${roasDelta.toFixed(2)} vs. Vormonat` : `↓ ${Math.abs(roasDelta).toFixed(2)} vs. Vormonat`,
            color: roasDelta >= 0 ? '#0D8585' : '#DC2626',
          },
          {
            label: 'CAC',
            value: formatEur(latestCac.cac),
            sub: cacDelta <= 0 ? `↓ ${formatEur(Math.abs(cacDelta))} vs. Vormonat` : `↑ ${formatEur(cacDelta)} vs. Vormonat`,
            color: cacDelta <= 0 ? '#0D8585' : '#DC2626',
          },
          {
            label: 'Instagram Followers',
            value: mockInstagramFollowers.current.toLocaleString('en-GB'),
            sub: `+${mockInstagramFollowers.delta.toLocaleString('en-GB')} this month`,
            color: '#0D8585',
          },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: '#FFFFFF', padding: '20px' }}>
            <span className="label" style={{ display: 'block', marginBottom: 8 }}>{stat.label}</span>
            <span
              className="metric"
              style={{
                display: 'block',
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#111110',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {stat.value}
            </span>
            <span
              className="metric"
              style={{ fontSize: '0.75rem', color: stat.color }}
            >
              {stat.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Spend vs Revenue + Ad Spend Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Spend vs Revenue */}
        <Card>
          <CardHeader label="Spend vs. Revenue" />
          <div className="flex flex-col gap-3">
            {mockSpendVsRevenue.map((m) => {
              const maxRev = Math.max(...mockSpendVsRevenue.map((x) => x.revenue))
              return (
                <div key={m.month} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="label" style={{ color: '#9E9D98' }}>{m.month}</span>
                    <div className="flex items-center gap-4">
                      <span className="metric" style={{ fontSize: '0.75rem', color: '#DC2626' }}>
                        {formatEur(m.spend)}
                      </span>
                      <span className="metric" style={{ fontSize: '0.75rem', color: '#0D8585' }}>
                        {formatEur(m.revenue)}
                      </span>
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 4, backgroundColor: '#E3E2DC', borderRadius: 2 }}>
                    {/* Revenue bar */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${(m.revenue / maxRev) * 100}%`,
                        backgroundColor: '#7DEFEF',
                        borderRadius: 2,
                        opacity: 0.4,
                      }}
                    />
                    {/* Spend bar */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${(m.spend / maxRev) * 100}%`,
                        backgroundColor: '#DC2626',
                        borderRadius: 2,
                        opacity: 0.5,
                      }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <div style={{ width: 8, height: 3, backgroundColor: '#7DEFEF', opacity: 0.4, borderRadius: 1 }} />
                <span className="label" style={{ color: '#9E9D98' }}>Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ width: 8, height: 3, backgroundColor: '#DC2626', opacity: 0.5, borderRadius: 1 }} />
                <span className="label" style={{ color: '#9E9D98' }}>Spend</span>
              </div>
            </div>
          </div>
        </Card>

        {/* ROAS + CAC trend */}
        <Card>
          <CardHeader label="ROAS Trend" />
          <div className="flex flex-col gap-2 mb-6">
            {mockRoasTrend.map((m) => {
              const maxRoas = Math.max(...mockRoasTrend.map((x) => x.roas))
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="label" style={{ width: 30, color: '#9E9D98' }}>{m.month}</span>
                  <div style={{ flex: 1, height: 4, backgroundColor: '#E3E2DC', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(m.roas / maxRoas) * 100}%`,
                        height: '100%',
                        backgroundColor: '#7DEFEF',
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span className="metric" style={{ fontSize: '0.8125rem', color: '#6B6A64', width: 36, textAlign: 'right' }}>
                    {m.roas.toFixed(2)}×
                  </span>
                </div>
              )
            })}
          </div>

          <span className="label" style={{ display: 'block', marginBottom: 8 }}>CAC Trend</span>
          <div className="flex flex-col gap-2">
            {mockCacTrend.map((m) => {
              const maxCac = Math.max(...mockCacTrend.map((x) => x.cac))
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="label" style={{ width: 30, color: '#9E9D98' }}>{m.month}</span>
                  <div style={{ flex: 1, height: 4, backgroundColor: '#E3E2DC', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(m.cac / maxCac) * 100}%`,
                        height: '100%',
                        backgroundColor: '#C8A882',
                        borderRadius: 2,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="metric" style={{ fontSize: '0.8125rem', color: '#9E9D98', width: 40, textAlign: 'right' }}>
                    {formatEur(m.cac)}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Monthly spend breakdown */}
      <Card>
        <CardHeader label="Monthly Ad Spend Breakdown" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Month', 'Meta Ads', 'Google (—)', 'Influencer', 'Total'].map((h) => (
                  <th
                    key={h}
                    className="label"
                    style={{
                      textAlign: h === 'Month' ? 'left' : 'right',
                      paddingBottom: 10,
                      borderBottom: '1px solid #E3E2DC',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockMonthlyAdSpend.map((row, i) => (
                <tr key={row.month} style={{ borderBottom: i < mockMonthlyAdSpend.length - 1 ? '1px solid #F0EFE9' : 'none' }}>
                  <td className="label" style={{ padding: '10px 0', color: '#6B6A64' }}>{row.month}</td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#DC2626' }}>
                    {formatEur(row.meta)}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#9E9D98' }}>
                    —
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#9A7A5A' }}>
                    {formatEur(row.influencer)}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontSize: '0.8125rem', color: '#111110', fontWeight: 600 }}>
                    {formatEur(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  )
}
