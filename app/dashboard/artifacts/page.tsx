import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { ARTIFACTS } from '@/data/artifacts'

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ArtifactsPage() {
  const items = [...ARTIFACTS].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <main className="px-4 pt-16 pb-5 md:px-6 md:pt-20 md:pb-6 lg:px-10 lg:pt-28 lg:pb-8" style={{ maxWidth: 960 }}>
      <div className="mb-4">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
          Artifacts
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-2)' }}>
          Einmalige Analysen und Entscheidungsseiten.
        </p>
      </div>

      <Card noPadding>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((a, i) => (
            <li key={a.href} style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-border)' }}>
              <div className="flex flex-col gap-1 px-6 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    href={a.href}
                    style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', textDecoration: 'none' }}
                    className="hover:underline"
                  >
                    {a.title}
                  </Link>
                  <span className="label">{a.kind} · {fmtDate(a.date)}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--color-text-2)' }}>
                  {a.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  )
}
