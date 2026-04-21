import { SalesKpiSection } from '@/components/kpi/SalesKpiSection'

export default function SalesPage() {
  return (
    <main style={{ padding: '32px 40px' }}>
      <div className="mb-4">
        <h1
          style={{
            fontFamily: "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '1.75rem',
            fontWeight: 600,
            color: '#111110',
            margin: 0,
          }}
        >
          Sales
        </h1>
      </div>

      <SalesKpiSection />
    </main>
  )
}
