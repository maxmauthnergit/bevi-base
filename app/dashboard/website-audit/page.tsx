import { Suspense } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { LiveMetrics } from '@/components/website-audit/LiveMetrics'
import { MeasuresTable } from '@/components/website-audit/MeasuresTable'
import { PrintButton } from '@/components/website-audit/PrintButton'
import {
  Pill, RatingPill, ScoreCell, SectionTitle, muted, td, th,
} from '@/components/website-audit/primitives'
import {
  auditMeta, benchmark, dataGaps, dhdl, executiveSummary, iceScore, measures,
  seoFindings, techFindings, techScores, uxAudit, type Finding,
} from '@/data/website-audit'

// Live Shopify block pages through 90 days of orders.
export const maxDuration = 60

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 })

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

const TOC = [
  ['summary', 'Executive Summary'],
  ['kpis', 'KPIs & Funnel'],
  ['technik', 'Technik'],
  ['ux', 'UX-Audit'],
  ['benchmark', 'Benchmark'],
  ['dhdl', 'DHDL-Readiness'],
  ['massnahmen', 'Maßnahmen'],
  ['luecken', 'Datenlücken'],
] as const

function FindingList({ items }: { items: Finding[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
      {items.map(f => (
        <li key={f.title} className="wa-avoid-break">
          <div className="flex items-center gap-2 flex-wrap">
            <RatingPill rating={f.rating} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.title}</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', lineHeight: 1.5 }}>{f.detail}</p>
          <p style={{ ...muted, margin: '4px 0 0' }}>Beleg: {f.evidence}</p>
        </li>
      ))}
    </ul>
  )
}

export default function WebsiteAuditPage() {
  const top5 = [...measures].sort((a, b) => iceScore(b) - iceScore(a)).slice(0, 5)

  return (
    <main className="wa-print-root px-4 pt-16 pb-5 md:px-6 md:pt-20 md:pb-6 lg:px-10 lg:pt-28 lg:pb-8" style={{ maxWidth: 1280 }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
            Website-Audit bevi-bag.com
          </h1>
          <p style={{ ...muted, margin: '8px 0 0', fontSize: '0.8125rem' }}>
            Ist-Analyse mit Fokus Conversion · Stand der Analyse: <b>{fmtDate(auditMeta.analysisDate)}</b> · DHDL-Ausstrahlung: {auditMeta.dhdlAiring}
          </p>
        </div>
        <PrintButton />
      </div>

      <nav aria-label="Abschnitte" className="wa-no-print flex flex-wrap gap-2" style={{ marginBottom: 8 }}>
        {TOC.map(([id, label]) => (
          <a key={id} href={`#${id}`} style={{ textDecoration: 'none' }}><Pill>{label}</Pill></a>
        ))}
      </nav>

      {/* ── Executive Summary ──────────────────────────────────── */}
      <SectionTitle id="summary" kicker="01" title="Executive Summary" />
      <Card>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 12 }}>
          {executiveSummary.map((s, i) => (
            <li key={i} style={{ fontSize: '0.875rem', lineHeight: 1.55 }}>{s}</li>
          ))}
        </ol>
        <div style={{ marginTop: 24 }}>
          <span className="label">Top-5-Maßnahmen nach ICE</span>
          <ol style={{ margin: '12px 0 0', paddingLeft: 20, display: 'grid', gap: 6 }}>
            {top5.map(m => (
              <li key={m.id} style={{ fontSize: '0.8125rem' }}>
                <b>{m.title}</b> <span style={muted}>· ICE {nf.format(iceScore(m))} · {m.timeframe} · {m.implementation}</span>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      {/* ── KPIs & Funnel ──────────────────────────────────────── */}
      <SectionTitle id="kpis" kicker="02" title="KPI-Kacheln & Funnel">
        Letzte 90 Tage über die bestehende Shopify-Anbindung. Dieser Block wird bei jedem Aufruf neu geladen; alle anderen Abschnitte sind der Stand vom {fmtDate(auditMeta.analysisDate)}.
      </SectionTitle>
      <Suspense fallback={<SkeletonCard lines={6} />}>
        <LiveMetrics />
      </Suspense>

      {/* ── Technik ────────────────────────────────────────────── */}
      <SectionTitle id="technik" kicker="03" title="Technik-Scores">
        Lighthouse 12 lokal (Lab-Daten, je 2 Läufe gemittelt). Scores ≥ 90 gut, 50–89 verbesserungswürdig, &lt; 50 schwach. INP ist nur als Felddatum messbar und fehlt (siehe Datenlücken).
      </SectionTitle>
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                {['Seite', 'Gerät', 'Performance', 'Accessibility', 'Best Practices', 'SEO', 'LCP', 'CLS', 'TBT', 'INP', 'Gewicht'].map((h, i) => (
                  <th key={h} className="label" style={{ ...th, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {techScores.map(s => (
                <tr key={s.page + s.device}>
                  <td style={{ ...td, fontWeight: 600 }}>{s.page}</td>
                  <td style={td}>{s.device}</td>
                  <td style={{ ...td, textAlign: 'right' }}><ScoreCell value={s.performance} /></td>
                  <td style={{ ...td, textAlign: 'right' }}><ScoreCell value={s.accessibility} /></td>
                  <td style={{ ...td, textAlign: 'right' }}><ScoreCell value={s.bestPractices} /></td>
                  <td style={{ ...td, textAlign: 'right' }}><ScoreCell value={s.seo} /></td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{s.lcpS !== null ? `${nf.format(s.lcpS)} s` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{s.cls !== null ? nf.format(s.cls) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{s.tbtMs !== null ? `${nf.format(s.tbtMs)} ms` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--color-muted)' }} className="metric">{s.inpMs !== null ? `${s.inpMs} ms` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{s.weightKb !== null ? `${nf.format(Math.round(s.weightKb / 102.4) / 10)} MB` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2" style={{ marginTop: 16 }}>
        <Card>
          <CardHeader label="Performance, Scripts, Bilder" />
          <FindingList items={techFindings} />
        </Card>
        <Card>
          <CardHeader label="Strukturierte Daten, Meta-Tags, Open Graph" />
          <FindingList items={seoFindings} />
        </Card>
      </div>

      {/* ── UX-Audit ───────────────────────────────────────────── */}
      <SectionTitle id="ux" kicker="04" title="UX- und Conversion-Audit (mobile first)">
        Entlang der Customer Journey, geprüft mit iPhone-13-Emulation.
      </SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        {uxAudit.map(stage => (
          <Card key={stage.stage} className="wa-avoid-break">
            <CardHeader label={stage.stage} action={<RatingPill rating={stage.rating} />} />
            <p style={{ ...muted, margin: '-20px 0 16px' }}>{stage.question}</p>
            <FindingList items={stage.findings} />
          </Card>
        ))}
      </div>

      {/* ── Benchmark ──────────────────────────────────────────── */}
      <SectionTitle id="benchmark" kicker="05" title="Benchmark">
        Nur öffentlich sichtbare Inhalte, mobil, ohne Checkout. Konkrete Muster statt Lob — und was davon für Bevi realistisch übertragbar ist.
      </SectionTitle>
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                {['Brand', 'Reviews', 'Sticky ATC', 'Express-Checkout', 'Gratisversand'].map(h => (
                  <th key={h} className="label" style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {benchmark.map(b => (
                <tr key={b.brand} style={b.brand.startsWith('Bevi') ? { backgroundColor: 'rgba(125,239,239,0.08)' } : undefined}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {b.brand}
                    {!b.checked && <div><Pill fg="var(--color-warning)" bg="rgba(234,108,0,0.08)">nicht prüfbar</Pill></div>}
                  </td>
                  <td style={td}>{b.reviews}</td>
                  <td style={td}>{b.stickyAtc}</td>
                  <td style={td}>{b.expressCheckout}</td>
                  <td style={td}>{b.freeShipping}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2" style={{ marginTop: 16 }}>
        {benchmark.filter(b => !b.brand.startsWith('Bevi')).map(b => (
          <Card key={b.brand} className="wa-avoid-break">
            <CardHeader label={b.brand} action={<a href={b.url} target="_blank" rel="noreferrer" style={{ ...muted, wordBreak: 'break-all' }}>{b.url.replace('https://', '')}</a>} />
            {b.betterThanUs.length > 0 && (
              <>
                <span className="label">Was sie besser machen</span>
                <ul style={{ margin: '10px 0 16px', paddingLeft: 18, display: 'grid', gap: 6, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  {b.betterThanUs.map(x => <li key={x}>{x}</li>)}
                </ul>
                <span className="label">Für Bevi übertragbar</span>
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 6, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  {b.transferable.map(x => <li key={x}>{x}</li>)}
                </ul>
              </>
            )}
            {b.limits && <p style={{ ...muted, margin: '14px 0 0' }}>Einschränkung: {b.limits}</p>}
          </Card>
        ))}
      </div>

      {/* ── DHDL ───────────────────────────────────────────────── */}
      <SectionTitle id="dhdl" kicker="06" title={`DHDL-Readiness (${auditMeta.dhdlAiring})`} />
      <Card>
        <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.55 }}><b>Einschätzung:</b> {dhdl.verdict}</p>
        <div className="wa-avoid-break" style={{
          marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(234,108,0,0.06)', border: '1px solid rgba(234,108,0,0.25)',
        }}>
          <span className="label" style={{ color: 'var(--color-warning)' }}>Wichtig vor der Ausstrahlung</span>
          <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', lineHeight: 1.5 }}>{dhdl.secrecyNote}</p>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                {['Thema', 'Status', 'Befund', 'Empfehlung'].map(h => <th key={h} className="label" style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {dhdl.items.map(i => (
                <tr key={i.topic} className="wa-avoid-break">
                  <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{i.topic}</td>
                  <td style={td}><RatingPill rating={i.status} /></td>
                  <td style={td}>{i.finding}</td>
                  <td style={td}>{i.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Maßnahmen ──────────────────────────────────────────── */}
      <SectionTitle id="massnahmen" kicker="07" title="Maßnahmen">
        Priorisiert nach ICE (Impact, Confidence, Ease, je 1–10). Die Confidence ist gedämpft, solange Funnel-Daten fehlen.
      </SectionTitle>
      <Card>
        <MeasuresTable measures={measures} />
      </Card>

      {/* ── Datenlücken & Methodik ─────────────────────────────── */}
      <SectionTitle id="luecken" kicker="08" title="Datenlücken & Methodik">
        Was nicht gemessen werden konnte und wie es nachgeliefert wird.
      </SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader label="Datenlücken" />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14 }}>
            {dataGaps.map(g => (
              <li key={g.metric} className="wa-avoid-break">
                <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{g.metric}</span>
                <p style={{ ...muted, margin: '4px 0 0' }}>{g.status}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', lineHeight: 1.45 }}><b>Nachliefern:</b> {g.howTo}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader label="Methodik" />
          <p style={{ ...muted, margin: '0 0 12px' }}>Umfang: {auditMeta.scope}</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: '0.8125rem', lineHeight: 1.5 }}>
            {auditMeta.method.map(x => <li key={x}>{x}</li>)}
          </ul>
        </Card>
      </div>
    </main>
  )
}
