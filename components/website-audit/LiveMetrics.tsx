import { Card, CardHeader } from '@/components/ui/Card'
import { getAuditLiveMetrics, type FunnelRow, type Status } from '@/lib/website-audit/metrics'
import { manualKpis, type ManualFunnel } from '@/data/website-audit'
import { GapBadge, Pill, muted, td, th } from './primitives'

const nf  = new Intl.NumberFormat('de-DE')
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const pct = (v: number) => new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 }).format(v)

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Tile({ label, value, sub, gap }: { label: string; value?: string; sub?: string; gap?: string }) {
  return (
    <div className="wa-avoid-break p-5 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
      <span className="label">{label}</span>
      {gap
        ? <div className="flex flex-col gap-2 items-start"><GapBadge /><span style={muted}>{gap}</span></div>
        : <>
            <span className="metric" style={{ fontSize: '1.625rem', fontWeight: 600, lineHeight: 1, color: 'var(--color-text)' }}>{value}</span>
            {sub && <span style={muted}>{sub}</span>}
          </>}
    </div>
  )
}

function ErrorNote({ s, label = 'API-Antwort anzeigen' }: { s: Status<unknown>; label?: string }) {
  if (s.ok) return s.note ? <p style={{ ...muted, marginTop: 10 }}>Quelle: {s.note}</p> : null
  return (
    <details style={{ ...muted, marginTop: 10 }}>
      <summary style={{ cursor: 'pointer' }}>{label}</summary>
      <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6 }}>{s.error}</code>
    </details>
  )
}

const STEPS: { key: keyof Omit<FunnelRow, 'device'>; label: string }[] = [
  { key: 'sessions',          label: 'Sessions' },
  { key: 'addedToCart',       label: 'Add to Cart' },
  { key: 'reachedCheckout',   label: 'Checkout erreicht' },
  { key: 'completedCheckout', label: 'Kauf' },
]

const DEVICE_DE: Record<string, string> = { mobile: 'Mobil', desktop: 'Desktop', tablet: 'Tablet', mobil: 'Mobil', gesamt: 'Gesamt' }

function manualRows(): FunnelRow[] | null {
  const rows = manualKpis.funnel.filter((r: ManualFunnel) => r.sessions !== null)
  if (!rows.length) return null
  return rows.map(r => ({
    device: r.device, sessions: r.sessions ?? 0, addedToCart: r.addedToCart ?? 0,
    reachedCheckout: r.reachedCheckout ?? 0, completedCheckout: r.completedCheckout ?? 0,
  }))
}

function FunnelTable({ rows }: { rows: FunnelRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr>
            <th className="label" style={th}>Gerät</th>
            {STEPS.map(s => <th key={s.key} className="label" style={{ ...th, textAlign: 'right' }}>{s.label}</th>)}
            <th className="label" style={{ ...th, textAlign: 'right' }}>Conversion Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.device}>
              <td style={{ ...td, fontWeight: 600 }}>{DEVICE_DE[r.device.toLowerCase()] ?? r.device}</td>
              {STEPS.map((s, i) => {
                const v = r[s.key]
                const prev = i === 0 ? null : r[STEPS[i - 1].key]
                return (
                  <td key={s.key} style={{ ...td, textAlign: 'right' }} className="metric">
                    {nf.format(v)}
                    {prev ? <div style={muted}>{pct(v / prev)} vom Vorschritt</div> : null}
                    <div aria-hidden style={{ height: 4, borderRadius: 2, marginTop: 6, marginLeft: 'auto',
                      width: `${r.sessions ? Math.max(2, (v / r.sessions) * 100) : 0}%`, backgroundColor: 'var(--color-accent)' }} />
                  </td>
                )
              })}
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }} className="metric">
                {r.sessions ? pct(r.completedCheckout / r.sessions) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RankList({ rows, unit }: { rows: { label: string; value: number; extra?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
      {rows.map(r => (
        <li key={r.label}>
          <div className="flex justify-between gap-3" style={{ fontSize: '0.8125rem' }}>
            <span style={{ wordBreak: 'break-all' }}>{r.label}</span>
            <span className="metric" style={{ whiteSpace: 'nowrap' }}>{nf.format(r.value)} {unit}{r.extra ? ` · ${r.extra}` : ''}</span>
          </div>
          <div aria-hidden style={{ height: 4, borderRadius: 2, marginTop: 4, width: `${(r.value / max) * 100}%`, backgroundColor: 'var(--color-border-2)' }} />
        </li>
      ))}
    </ol>
  )
}

export async function LiveMetrics() {
  let m: Awaited<ReturnType<typeof getAuditLiveMetrics>>
  try {
    m = await getAuditLiveMetrics(90)
  } catch (e) {
    return (
      <Card>
        <CardHeader label="Shopify-Daten (90 Tage)" action={<GapBadge>Nicht verfügbar</GapBadge>} />
        <p style={muted}>Die Shopify-Anbindung hat nicht geantwortet: {(e as Error).message}</p>
      </Card>
    )
  }

  const funnelRows = m.funnel.ok && m.funnel.data.length ? m.funnel.data : manualRows()
  const funnelSource = m.funnel.ok && m.funnel.data.length
    ? 'ShopifyQL (live)'
    : funnelRows ? `manuell: ${manualKpis.source ?? 'Shopify Analytics'}${manualKpis.period ? `, ${manualKpis.period}` : ''}` : null

  const total = funnelRows?.reduce((a, r) => ({
    sessions: a.sessions + r.sessions, purchases: a.purchases + r.completedCheckout,
  }), { sessions: 0, purchases: 0 })

  const o = m.orders.ok ? m.orders.data : null

  return (
    <div className="flex flex-col gap-4">
      <p style={muted}>
        Zeitraum {fmtDate(m.from)} – {fmtDate(m.to)} ({m.timezone}). Live und nur lesend aus Shopify geladen. Was die API nicht liefert, ist als Datenlücke markiert — nichts ist geschätzt.
      </p>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Tile label="Conversion Rate"
          value={total && total.sessions ? pct(total.purchases / total.sessions) : undefined}
          sub={funnelSource ?? undefined}
          gap={total && total.sessions ? undefined : 'Sessions nicht über die API verfügbar — aus Shopify Analytics nachliefern.'} />
        <Tile label="Bestellungen" value={o ? nf.format(o.orders) : undefined} sub="ohne Test & Storno"
          gap={o ? undefined : 'Bestellungen nicht abrufbar.'} />
        <Tile label="AOV (brutto)" value={o ? eur.format(o.aovGross) : undefined} sub="inkl. MwSt. und Versand"
          gap={o ? undefined : 'Bestellungen nicht abrufbar.'} />
        <Tile label="Anteil Neukunden"
          value={o && o.journeyOrders ? pct(o.newCustomerOrders / o.journeyOrders) : undefined}
          sub={o ? `Erstbestellungen, Basis ${nf.format(o.journeyOrders)} Bestellungen mit Journey-Daten` : undefined}
          gap={o && o.journeyOrders ? undefined : `Customer-Journey-Daten nicht verfügbar${m.journey.ok ? '' : ' (API verweigert)'}.`} />
        <Tile label="Erstattungsquote"
          value={o ? pct(o.refundRate) : undefined}
          sub={o ? `${nf.format(o.ordersWithRefund)} Bestellungen mit Erstattung · keine echte Retourenquote` : undefined}
          gap={o ? undefined : 'Bestellungen nicht abrufbar.'} />
        <Tile label="Retourenquote"
          value={manualKpis.returnRatePct !== null ? `${nf.format(manualKpis.returnRatePct)} %` : undefined}
          sub="manuell aus Shopify Analytics"
          gap={manualKpis.returnRatePct !== null ? undefined : 'Über die API nicht als echte Retourenquote verfügbar.'} />
      </div>
      {!m.orders.ok && <ErrorNote s={m.orders} label="API-Antwort Bestellungen" />}
      {!m.journey.ok && <ErrorNote s={m.journey} label="API-Antwort Customer Journey" />}

      <Card>
        <CardHeader label="Funnel je Gerät"
          action={funnelSource ? <Pill>{funnelSource}</Pill> : <GapBadge />} />
        {funnelRows
          ? <FunnelTable rows={funnelRows} />
          : <p style={muted}>Der Session-Funnel ist über die API nicht verfügbar. Bitte aus Shopify Analytics (Conversion-Funnel nach Gerät, 90 Tage) in <code>data/website-audit.ts → manualKpis.funnel</code> eintragen.</p>}
        <ErrorNote s={m.funnel} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader label="Top-Landingpages"
            action={m.landingPages.ok ? <Pill>alle Sessions</Pill> : o?.topLandingPages.length ? <Pill>nur Käufer:innen</Pill> : <GapBadge />} />
          {m.landingPages.ok
            ? <RankList unit="Sessions" rows={m.landingPages.data.map(r => ({ label: r.label, value: r.sessions, extra: r.conversions !== null ? `${nf.format(r.conversions)} Käufe` : undefined }))} />
            : o?.topLandingPages.length
              ? <RankList unit="Bestellungen" rows={o.topLandingPages.map(r => ({ label: r.label, value: r.orders }))} />
              : <p style={muted}>Nicht verfügbar.</p>}
          <ErrorNote s={m.landingPages} />
        </Card>
        <Card>
          <CardHeader label="Traffic-Quellen"
            action={m.referrers.ok ? <Pill>alle Sessions</Pill> : o?.topSources.length ? <Pill>nur Käufer:innen</Pill> : <GapBadge />} />
          {m.referrers.ok
            ? <RankList unit="Sessions" rows={m.referrers.data.map(r => ({ label: r.label, value: r.sessions, extra: r.conversions !== null ? `${nf.format(r.conversions)} Käufe` : undefined }))} />
            : o?.topSources.length
              ? <RankList unit="Bestellungen" rows={o.topSources.map(r => ({ label: r.label, value: r.orders }))} />
              : <p style={muted}>Nicht verfügbar.</p>}
          <ErrorNote s={m.referrers} />
        </Card>
      </div>
    </div>
  )
}
