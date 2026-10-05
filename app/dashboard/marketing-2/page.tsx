import { DateRangeBar } from '@/components/ui/DateRangeBar'
import { UnitEconomicsSection } from '@/components/kpi/UnitEconomicsSection'

export default function Marketing2Page() {
  return (
    <main className="px-4 pt-16 pb-5 md:px-6 md:pt-20 md:pb-6 lg:px-10 lg:pt-28 lg:pb-8">
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
          Marketing 2.0
        </h1>
      </div>

      <DateRangeBar />

      <UnitEconomicsSection />
    </main>
  )
}
