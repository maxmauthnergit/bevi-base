import { Card, CardHeader } from '@/components/ui/Card'
import { getAuditLiveMetrics, type FunnelRow, type MetaDeviceRow, type Status } from '@/lib/website-audit/metrics'
import { auditMeta, manualKpis, type ManualFunnel } from '@/data/website-audit'
import { GapBadge, Pill, muted, td, th } from './primitives'

const nf  = new Intl.NumberFormat('de-DE')
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const pct = (v: number) => new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 }).format(v)

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Reliability labels ─────────────────────────────────────────────────────

type Reliability = 'vollständig' | 'Teilmenge' | 'unklar'

const REL_STYLE: Record<Reliability, { fg: string; bg: string; text: string }> = {
  'vollständig': { fg: 'var(--color-accent-fg)', bg: 'rgba(125,239,239,0.18)', text: 'vollständig' },
  'Teilmenge':   { fg: 'var(--color-warning)',   bg: 'rgba(234,108,0,0.08)',   text: 'nur Einwilligende' },
  'unklar':      { fg: 'var(--color-text-2)',    bg: 'var(--color-surface-2)', text: 'Abdeckung unklar' },
}

function RelPill({ r }: { r: Reliability }) {
  const s = REL_STYLE[r]
  return <Pill fg={s.fg} bg={s.bg}>{s.text}</Pill>
}

// ─── Small building blocks ──────────────────────────────────────────────────

function Tile({ label, value, sub, gap, reliability }: {
  label: string; value?: string; sub?: string; gap?: string; reliability?: Reliability
}) {
  return (
    <div className="wa-avoid-break p-5 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-start justify-between gap-2">
        <span className="label">{label}</span>
        {reliability && !gap && <RelPill r={reliability} />}
      </div>
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
  if (s.ok) return null
  return (
    <details style={{ ...muted, marginTop: 8 }}>
      <summary style={{ cursor: 'pointer' }}>{label}</summary>
      <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6 }}>{s.error}</code>
    </details>
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

// ─── Funnel assembly ────────────────────────────────────────────────────────

interface StageRow {
  stage:       string
  total:       number | null
  mobile:      number | null
  desktop:     number | null
  source:      string
  reliability: Reliability
  status?:     Status<unknown>
}

function byDevice(rows: FunnelRow[] | null, key: keyof Omit<FunnelRow, 'device'>) {
  if (!rows) return { total: null, mobile: null, desktop: null }
  const pick = (re: RegExp) => rows.filter(r => re.test(r.device.toLowerCase())).reduce((s, r) => s + r[key], 0)
  return {
    total:   rows.reduce((s, r) => s + r[key], 0),
    mobile:  pick(/^(mobile|mobil|tablet)/),
    desktop: pick(/^desktop/),
  }
}

function metaBy(rows: MetaDeviceRow[] | null, key: keyof Omit<MetaDeviceRow, 'device'>) {
  if (!rows) return { total: null, mobile: null, desktop: null }
  const get = (d: MetaDeviceRow['device']) => rows.filter(r => r.device === d).reduce((s, r) => s + r[key], 0)
  return { total: rows.reduce((s, r) => s + r[key], 0), mobile: get('mobil'), desktop: get('desktop') }
}

function manualRows(): FunnelRow[] | null {
  const rows = manualKpis.funnel.filter((r: ManualFunnel) => r.sessions !== null)
  if (!rows.length) return null
  return rows.map(r => ({
    device: r.device, sessions: r.sessions ?? 0, addedToCart: r.addedToCart ?? 0,
    reachedCheckout: r.reachedCheckout ?? 0, completedCheckout: r.completedCheckout ?? 0,
  }))
}

const cell = (v: number | null) => v === null ? <span style={{ color: 'var(--color-muted)' }}>—</span> : nf.format(v)

// ─── Component ──────────────────────────────────────────────────────────────

export async function LiveMetrics() {
  let m: Awaited<ReturnType<typeof getAuditLiveMetrics>>
  try {
    m = await getAuditLiveMetrics(auditMeta.kpiFrom)
  } catch (e) {
    return (
      <Card>
        <CardHeader label="Shopify-Daten" action={<GapBadge>Nicht verfügbar</GapBadge>} />
        <p style={muted}>Die Shopify-Anbindung hat nicht geantwortet: {(e as Error).message}</p>
      </Card>
    )
  }

  const o         = m.orders.ok ? m.orders.data : null
  const meta      = m.meta.ok ? m.meta.data : null
  const abandoned = m.abandonedCheckouts.ok ? m.abandonedCheckouts.data : null
  const sessionRows = m.funnel.ok && m.funnel.data.length ? m.funnel.data : manualRows()
  const sessionSrc  = m.funnel.ok && m.funnel.data.length ? 'ShopifyQL' : sessionRows ? 'manuell (Shopify Analytics)' : 'ShopifyQL'

  const clicks    = metaBy(meta, 'linkClicks')
  const sessions  = byDevice(sessionRows, 'sessions')
  const carts     = byDevice(sessionRows, 'addedToCart')
  const checkoutsStarted = o && abandoned !== null ? o.orders + abandoned : null

  const stages: StageRow[] = [
    { stage: 'Meta-Ads Link-Klicks', ...clicks, source: 'Meta Marketing API', reliability: 'vollständig', status: m.meta },
    { stage: 'Shop-Sessions', ...sessions, source: sessionSrc, reliability: 'Teilmenge', status: m.funnel },
    { stage: 'Sessions mit Add to Cart', ...carts, source: sessionSrc, reliability: 'unklar', status: m.funnel },
    { stage: 'Checkouts begonnen', total: checkoutsStarted, mobile: null, desktop: null,
      source: 'Bestellungen + abgebrochene Checkouts (Admin API)', reliability: 'vollständig',
      status: !m.abandonedCheckouts.ok ? m.abandonedCheckouts : m.orders },
    { stage: 'Käufe', total: o?.orders ?? null, mobile: null, desktop: null,
      source: 'Bestellungen (Admin API)', reliability: 'vollständig', status: m.orders },
  ]

  // Reliable ratios
  const checkoutCompletion = o && checkoutsStarted ? o.orders / checkoutsStarted : null
  const metaPurchases      = metaBy(meta, 'purchases').total
  const clickToBuyLow      = clicks.total && metaPurchases !== null ? metaPurchases / clicks.total : null
  const clickToBuyHigh     = clicks.total && o ? o.orders / clicks.total : null
  const consentedCr        = sessions.total && sessionRows
    ? byDevice(sessionRows, 'completedCheckout').total! / sessions.total : null

  return (
    <div className="flex flex-col gap-4">
      <p style={muted}>
        Zeitraum <b>{fmtDate(m.from)} – {fmtDate(m.to)}</b> ({m.timezone}). Live und nur lesend aus Shopify und Meta geladen.
        Jede Zahl trägt ihre Verlässlichkeit; was keine Quelle liefert, ist als Datenlücke markiert — nichts ist geschätzt.
      </p>

      {/* ── Tiles ─────────────────────────────────────────────────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Tile label="Bestellungen" reliability="vollständig"
          value={o ? nf.format(o.orders) : undefined} sub="ohne Test & Storno"
          gap={o ? undefined : 'Bestellungen nicht abrufbar.'} />
        <Tile label="AOV (brutto)" reliability="vollständig"
          value={o ? eur.format(o.aovGross) : undefined} sub="inkl. MwSt. und Versand"
          gap={o ? undefined : 'Bestellungen nicht abrufbar.'} />
        <Tile label="Checkout-Abschlussrate" reliability="vollständig"
          value={checkoutCompletion !== null ? pct(checkoutCompletion) : undefined}
          sub={checkoutsStarted !== null ? `${nf.format(o!.orders)} Käufe von ${nf.format(checkoutsStarted)} begonnenen Checkouts (ab Eingabe der Kontaktdaten)` : undefined}
          gap={checkoutCompletion !== null ? undefined : 'Abgebrochene Checkouts nicht abrufbar.'} />
        <Tile label="Klick-zu-Kauf (Meta)"
          value={clickToBuyLow !== null && clickToBuyHigh !== null ? `${pct(clickToBuyLow)} – ${pct(clickToBuyHigh)}` : undefined}
          sub="Spanne: Meta-gemessene Käufe ÷ Klicks (Untergrenze, nur Einwilligende) bis alle Shop-Käufe ÷ Klicks (Obergrenze, inkl. Nicht-Meta-Käufe)"
          gap={clickToBuyHigh !== null ? undefined : 'Meta-Klicks oder Bestellungen nicht abrufbar.'} />
        <Tile label="Conversion Rate (Einwilligende)" reliability="Teilmenge"
          value={consentedCr !== null && consentedCr <= 1 ? pct(consentedCr) : undefined}
          sub="Käufe ÷ Sessions, beides aus ShopifyQL — gilt nur für Besucher:innen mit Einwilligung"
          gap={consentedCr === null ? 'Sessions nicht verfügbar.' : consentedCr > 1 ? 'Mehr Käufe als Sessions — nicht interpretierbar.' : undefined} />
        <Tile label="Anteil Neukunden" reliability={o && o.journeyOrders ? 'vollständig' : undefined}
          value={o && o.journeyOrders ? pct(o.newCustomerOrders / o.journeyOrders) : undefined}
          sub={o ? `Erstbestellungen, Basis ${nf.format(o.journeyOrders)} Bestellungen mit Journey-Daten` : undefined}
          gap={o && o.journeyOrders ? undefined : `Customer-Journey-Daten nicht verfügbar${m.journey.ok ? '' : ' (API verweigert)'}.`} />
        <Tile label="Erstattungsquote" reliability="vollständig"
          value={o ? pct(o.refundRate) : undefined}
          sub={o ? `${nf.format(o.ordersWithRefund)} Bestellungen mit Erstattung · keine echte Retourenquote` : undefined}
          gap={o ? undefined : 'Bestellungen nicht abrufbar.'} />
        <Tile label="Retourenquote"
          value={manualKpis.returnRatePct !== null ? `${nf.format(manualKpis.returnRatePct)} %` : undefined}
          sub="manuell aus Shopify Analytics"
          gap={manualKpis.returnRatePct !== null ? undefined : 'Über die API nicht als echte Retourenquote verfügbar.'} />
      </div>

      {/* ── Funnel ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader label="Funnel nach Quelle und Verlässlichkeit" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th className="label" style={th}>Stufe</th>
                <th className="label" style={{ ...th, textAlign: 'right' }}>Gesamt</th>
                <th className="label" style={{ ...th, textAlign: 'right' }}>Mobil</th>
                <th className="label" style={{ ...th, textAlign: 'right' }}>Desktop</th>
                <th className="label" style={th}>Quelle</th>
                <th className="label" style={th}>Verlässlichkeit</th>
              </tr>
            </thead>
            <tbody>
              {stages.map(s => (
                <tr key={s.stage}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {s.stage}
                    {s.status && <ErrorNote s={s.status} />}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }} className="metric">{cell(s.total)}</td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{cell(s.mobile)}</td>
                  <td style={{ ...td, textAlign: 'right' }} className="metric">{cell(s.desktop)}</td>
                  <td style={{ ...td, ...muted }}>{s.source}</td>
                  <td style={td}>{s.total === null ? <GapBadge /> : <RelPill r={s.reliability} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ ...muted, marginTop: 14, display: 'grid', gap: 6, maxWidth: 820 }}>
          <p style={{ margin: 0 }}><b>Vollständig:</b> Meta zählt Klicks auf der eigenen Plattform, unabhängig vom Cookie-Banner des Shops. Bestellungen und abgebrochene Checkouts speichert Shopify als Datensätze. „Checkouts begonnen“ zählt ab der Eingabe der Kontaktdaten.</p>
          <p style={{ margin: 0 }}><b>Nur Einwilligende:</b> Shop-Sessions hängen von der Analyse-Einwilligung ab — laut Shopify sinkt die Session-Zahl mit niedriger Einwilligungsrate. Wie viele Besucher:innen genau fehlen, liefert keine Quelle.</p>
          <p style={{ margin: 0 }}><b>Abdeckung unklar:</b> „Sessions mit Add to Cart“ kommt aus derselben Session-Tabelle; ob und wie stark die Einwilligung hier filtert, ist nicht belegt. Nur als Tendenz lesen.</p>
          <p style={{ margin: 0 }}>Quoten zwischen Stufen unterschiedlicher Verlässlichkeit sind bewusst nicht berechnet. Mobil/Desktop gibt es für Käufe und Checkouts nicht: Shopify speichert das Gerät nicht an der Bestellung.</p>
        </div>
      </Card>

      {/* ── Meta pixel events for device split ───────────────────────── */}
      <Card>
        <CardHeader label="Meta-Pixel-Events nach Gerät (zum Vergleich)" action={<RelPill r="Teilmenge" />} />
        {meta ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr>
                  {['Gerät', 'Link-Klicks', 'Landingpage-Aufrufe', 'Add to Cart', 'Checkout begonnen', 'Käufe'].map((h, i) => (
                    <th key={h} className="label" style={{ ...th, textAlign: i ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meta.filter(r => r.linkClicks > 0 || r.purchases > 0).map(r => (
                  <tr key={r.device}>
                    <td style={{ ...td, fontWeight: 600, textTransform: 'capitalize' }}>{r.device}</td>
                    {[r.linkClicks, r.landingPageViews, r.addToCart, r.initiateCheckout, r.purchases].map((v, i) => (
                      <td key={i} style={{ ...td, textAlign: 'right' }} className="metric">{nf.format(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={muted}>Meta-Daten nicht verfügbar.</p>}
        <p style={{ ...muted, marginTop: 12 }}>
          Ab „Landingpage-Aufrufe“ misst der Meta-Pixel — nur bei Einwilligung und nur Meta zugeordnete Ereignisse. Gut für das Verhältnis Mobil zu Desktop, nicht für absolute Zahlen.
        </p>
        <ErrorNote s={m.meta} label="API-Antwort Meta" />
      </Card>

      {/* ── Landing pages & sources ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader label="Top-Landingpages"
            action={m.landingPages.ok ? <RelPill r="Teilmenge" /> : o?.topLandingPages.length ? <Pill>nur Käufer:innen</Pill> : <GapBadge />} />
          {m.landingPages.ok
            ? <RankList unit="Sessions" rows={m.landingPages.data.map(r => ({ label: r.label, value: r.sessions, extra: r.conversions !== null ? `${nf.format(r.conversions)} Käufe` : undefined }))} />
            : o?.topLandingPages.length
              ? <RankList unit="Bestellungen" rows={o.topLandingPages.map(r => ({ label: r.label, value: r.orders }))} />
              : <p style={muted}>Nicht verfügbar.</p>}
          <ErrorNote s={m.landingPages} />
        </Card>
        <Card>
          <CardHeader label="Traffic-Quellen"
            action={m.referrers.ok ? <RelPill r="Teilmenge" /> : o?.topSources.length ? <Pill>nur Käufer:innen</Pill> : <GapBadge />} />
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
