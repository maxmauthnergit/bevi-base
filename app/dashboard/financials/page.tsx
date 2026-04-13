import { Card, CardHeader } from '@/components/ui/Card'
import {
  mockLiquidPosition,
  mockLiabilities,
  mockMonthlyPnL,
  mockCashflowForecast,
} from '@/lib/mock/financials'

function formatEur(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function sign(value: number) {
  return value >= 0 ? '#0D8585' : '#DC2626'
}

export default function FinancialsPage() {
  const totalLiabilities = mockLiabilities.reduce((s, l) => s + l.amount, 0)
  const netPosition = mockLiquidPosition.total - totalLiabilities

  return (
    <main style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div className="mb-5">
        <h1
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.75rem',
            fontWeight: 600,
            color: '#111110',
            margin: 0,
          }}
        >
          Financials & Cashflow
        </h1>
      </div>

      {/* Balances row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          backgroundColor: '#E3E2DC',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {[
          { label: 'Bank (Sparkasse)', value: mockLiquidPosition.bank_balance, sub: 'Manual entry', accent: false },
          { label: 'PayPal Balance', value: mockLiquidPosition.paypal_balance, sub: 'API — pending', accent: false },
          { label: 'Total Liquid', value: mockLiquidPosition.total, sub: `as of ${mockLiquidPosition.as_of}`, accent: true },
          { label: 'Net of Liabilities', value: netPosition, sub: `− ${formatEur(totalLiabilities)} liabilities`, accent: false },
        ].map((item) => (
          <div key={item.label} style={{ backgroundColor: '#FFFFFF', padding: '20px' }}>
            <span className="label" style={{ display: 'block', marginBottom: 8 }}>{item.label}</span>
            <span
              className="metric"
              style={{
                display: 'block',
                fontSize: '1.5rem',
                fontWeight: 600,
                color: item.accent ? '#0D8585' : '#111110',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {formatEur(item.value)}
            </span>
            <span className="label" style={{ color: '#9E9D98' }}>{item.sub}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Monthly P&L table */}
        <Card>
          <CardHeader label="Monthly P&L" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  {['', 'Rev.', 'COGS', 'CAC', 'WeShip', 'Fixed', 'Result'].map((h) => (
                    <th
                      key={h}
                      className="label"
                      style={{
                        textAlign: h === '' ? 'left' : 'right',
                        paddingBottom: 10,
                        borderBottom: '1px solid #E3E2DC',
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockMonthlyPnL.map((row, i) => (
                  <tr
                    key={row.month}
                    style={{ borderBottom: i < mockMonthlyPnL.length - 1 ? '1px solid #F0EFE9' : 'none' }}
                  >
                    <td className="label" style={{ padding: '9px 0', color: '#6B6A64' }}>{row.month}</td>
                    <td className="metric" style={{ textAlign: 'right', padding: '9px 0', color: '#0D8585' }}>
                      {formatEur(row.revenue_gross)}
                    </td>
                    <td className="metric" style={{ textAlign: 'right', padding: '9px 0', color: '#9E9D98' }}>
                      −{formatEur(row.cogs)}
                    </td>
                    <td className="metric" style={{ textAlign: 'right', padding: '9px 0', color: '#9E9D98' }}>
                      −{formatEur(row.cac)}
                    </td>
                    <td className="metric" style={{ textAlign: 'right', padding: '9px 0', color: '#9E9D98' }}>
                      −{formatEur(row.weship)}
                    </td>
                    <td className="metric" style={{ textAlign: 'right', padding: '9px 0', color: '#6B6A64' }}>
                      −{formatEur(row.fixed)}
                    </td>
                    <td
                      className="metric"
                      style={{
                        textAlign: 'right',
                        padding: '9px 0',
                        color: sign(row.result),
                        fontWeight: 600,
                      }}
                    >
                      {row.result >= 0 ? '+' : ''}{formatEur(row.result)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader label="Outstanding Liabilities" />
          <div className="flex flex-col gap-3 mb-6">
            {mockLiabilities.map((l, i) => (
              <div
                key={l.id}
                className="flex flex-col gap-1 pb-3"
                style={{ borderBottom: i < mockLiabilities.length - 1 ? '1px solid #F0EFE9' : 'none' }}
              >
                <div className="flex items-center justify-between">
                  <span
                    style={{
                      fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                      fontSize: '0.8125rem',
                      color: '#111110',
                    }}
                  >
                    {l.name}
                  </span>
                  <span className="metric" style={{ fontSize: '0.875rem', color: '#DC2626', fontWeight: 600 }}>
                    {formatEur(l.amount)}
                  </span>
                </div>
                {l.note && (
                  <span className="label" style={{ color: '#9E9D98' }}>{l.note}</span>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div
            className="flex items-center justify-between pt-3"
            style={{ borderTop: '1px solid #E3E2DC' }}
          >
            <span className="label">Total</span>
            <span className="metric" style={{ fontSize: '0.875rem', color: '#DC2626', fontWeight: 700 }}>
              {formatEur(totalLiabilities)}
            </span>
          </div>
        </Card>
      </div>

      {/* 3-Month Forecast */}
      <Card>
        <CardHeader
          label="3-Month Rolling Forecast"
          action={
            <span className="label" style={{ color: '#9E9D98' }}>
              Mock projections — edit in Settings
            </span>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {['Month', 'Proj. Revenue', 'Ad Spend', 'COGS', 'WeShip', 'Fixed', 'Proj. Result'].map((h) => (
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
              {mockCashflowForecast.map((row, i) => (
                <tr
                  key={row.month}
                  style={{ borderBottom: i < mockCashflowForecast.length - 1 ? '1px solid #F0EFE9' : 'none' }}
                >
                  <td style={{ padding: '10px 0' }}>
                    <span
                      style={{
                        fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                        fontSize: '0.8125rem',
                        color: '#6B6A64',
                      }}
                    >
                      {new Date(row.month + '-01').toLocaleDateString('en-GB', { month: 'long', year: '2-digit' })}
                    </span>
                    <span
                      className="label"
                      style={{ marginLeft: 8, color: '#9E9D98' }}
                    >
                      Forecast
                    </span>
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', color: '#0D8585' }}>
                    {formatEur(row.projected_revenue)}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', color: '#DC2626' }}>
                    −{formatEur(row.projected_ad_spend)}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', color: '#9E9D98' }}>
                    −{formatEur(row.projected_cogs)}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', color: '#9E9D98' }}>
                    −{formatEur(row.projected_weship_cost)}
                  </td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', color: '#6B6A64' }}>
                    −{formatEur(row.projected_fixed_costs)}
                  </td>
                  <td
                    className="metric"
                    style={{
                      textAlign: 'right',
                      padding: '10px 0',
                      color: sign(row.projected_result),
                      fontWeight: 700,
                    }}
                  >
                    {row.projected_result >= 0 ? '+' : ''}{formatEur(row.projected_result)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Running liquid position */}
        <div
          className="flex items-center justify-between mt-5 pt-4"
          style={{ borderTop: '1px solid #E3E2DC' }}
        >
          <div>
            <span className="label" style={{ display: 'block', marginBottom: 4 }}>
              Projected Liquid Position after Q2
            </span>
            <span className="label" style={{ color: '#9E9D98' }}>
              Current {formatEur(mockLiquidPosition.total)} + 3× projected results
            </span>
          </div>
          <span
            className="metric"
            style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0D8585' }}
          >
            {formatEur(
              mockLiquidPosition.total +
                mockCashflowForecast.reduce((s, m) => s + m.projected_result, 0)
            )}
          </span>
        </div>
      </Card>
    </main>
  )
}
