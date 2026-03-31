'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { DailySnapshot } from '@/lib/types'

interface TrendChartProps {
  data: DailySnapshot[]
}

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        backgroundColor: '#1A1A1A',
        border: '1px solid #333',
        borderRadius: '4px',
        padding: '10px 14px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.75rem',
      }}
    >
      <p style={{ color: '#888', marginBottom: 6 }}>{formatDate(label)}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: entry.color, marginBottom: 2 }}>
          {entry.name}: {formatEur(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function TrendChart({ data }: TrendChartProps) {
  // Show every 5th date label to avoid crowding
  const tickDates = data
    .filter((_, i) => i % 5 === 0 || i === data.length - 1)
    .map((d) => d.date)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart
        data={data}
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="#1E1E1E"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          ticks={tickDates}
          tickFormatter={formatDate}
          tick={{ fill: '#555', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
          tick={{ fill: '#555', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{
            fontSize: '0.625rem',
            fontFamily: "'Gustavo', sans-serif",
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#888',
            paddingTop: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="shopify_revenue_gross"
          name="Revenue"
          stroke="#7DEFEF"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: '#7DEFEF' }}
        />
        <Line
          type="monotone"
          dataKey="meta_spend"
          name="Ad Spend"
          stroke="#FF4444"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: '#FF4444' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
