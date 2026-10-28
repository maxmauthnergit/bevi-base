import { Card, CardHeader } from '@/components/ui/Card'
import { getOrderLineItemsForRange, parseInTimezone, getShopTimezone } from '@/lib/shopify/queries'
import { getWeShipStockBreakdown } from '@/lib/weship/queries'
import type { WeShipStockBreakdown } from '@/lib/weship/queries'
import {
  ADD_ON_CATEGORIES, CATEGORY_LABEL, MAIN_CATEGORIES,
  DEFAULT_EXTRA_BAGS, DEFAULT_RATIO_FROM, DEFAULT_RATIO_TO,
  DHDL_AIRING_RTL_PLUS, DHDL_AIRING_VOX, MANUAL_STOCK,
  classifyProduct, computeRatios, computeRecommendation,
} from '@/lib/decisions/dhdl-order'
import type { AddOnCategory, Category } from '@/lib/decisions/dhdl-order'

// Temporary decision page — reachable by direct link only, not in the nav.
// Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&extra=5000&gh=0.1 (garment holder per bag)
export const maxDuration = 60

const FONT = "'Gustavo', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const nf   = new Intl.NumberFormat('de-DE')
const pf   = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 })
const rf   = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 })

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

function param(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function Dash() {
  return <span style={{ color: '#9E9D98' }}>—</span>
}

function Num({ v }: { v: number | null | undefined }) {
  return v === null || v === undefined ? <Dash /> : <>{nf.format(v)}</>
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className="label"
      style={{
        textAlign: right ? 'right' : 'left', paddingBottom: 10, paddingRight: 20,
        borderBottom: '1px solid #E3E2DC', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, right, bold, muted }: { children: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean }) {
  return (
    <td
      className={right ? 'metric' : undefined}
      style={{
        textAlign: right ? 'right' : 'left', padding: '10px 20px 10px 0',
        fontFamily: right ? undefined : FONT,
        fontWeight: bold ? 600 : undefined,
        color: muted ? '#9E9D98' : '#111110',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  )
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>{children}</table>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.75rem', color: '#6B6A64', marginTop: 16, lineHeight: 1.5 }}>{children}</p>
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '0.8125rem', color: '#DC2626' }}>{children}</p>
}

const P: React.CSSProperties = { fontFamily: FONT, fontSize: '0.875rem', color: '#111110', lineHeight: 1.6, margin: '0 0 12px' }

export default async function DhdlOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp        = await searchParams
  const fromStr   = ISO_RE.test(param(sp.from) ?? '') ? param(sp.from)! : DEFAULT_RATIO_FROM
  const toStr     = ISO_RE.test(param(sp.to) ?? '')   ? param(sp.to)!   : DEFAULT_RATIO_TO
  const extraBags = Math.max(0, parseInt(param(sp.extra) ?? '', 10) || DEFAULT_EXTRA_BAGS)
  const ghRaw     = parseFloat(param(sp.gh) ?? '')
  const assumed: Partial<Record<AddOnCategory, number>> = Number.isFinite(ghRaw) && ghRaw >= 0 ? { garment_holder: ghRaw } : {}

  const tz = await getShopTimezone()
  const [stockResult, ordersResult] = await Promise.allSettled([
    getWeShipStockBreakdown(),
    getOrderLineItemsForRange(parseInTimezone(fromStr, '00:00:00', tz), parseInTimezone(toStr, '23:59:59', tz)),
  ])

  const stockRows: WeShipStockBreakdown[] = stockResult.status === 'fulfilled' ? stockResult.value : []
  const stockError = stockResult.status === 'rejected' ? String(stockResult.reason) : null
  const orders     = ordersResult.status === 'fulfilled' ? ordersResult.value : []
  const ordersError = ordersResult.status === 'rejected' ? String(ordersResult.reason) : null

  // One row per planned product; WeShip figures shown for reference only,
  // planning uses MANUAL_STOCK. Sticker, inserts etc. ('other') are dropped.
  const plannedCategories = [...MAIN_CATEGORIES, ...ADD_ON_CATEGORIES]
  const stockTable = plannedCategories.map(category => ({
    category,
    weship: stockRows.find(r => classifyProduct(r.name, null, r.sku) === category) ?? null,
    planned: MANUAL_STOCK[category],
  }))

  const incomingFound    = stockRows.some(r => r.incoming !== null)
  const unavailableFound = stockRows.some(r => r.unavailable !== null)
  const reservedSources  = [...new Set(stockRows.map(r => r.reserved_source).filter(Boolean))]
  const detectedFields   = [...new Set(stockRows.flatMap(r => Object.keys(r.fields)))]

  const ratio = computeRatios(orders)
  const rec   = computeRecommendation(MANUAL_STOCK, ratio, extraBags, assumed)
  const unresolvedBundles = ratio.unitsByCategory.bundle_unresolved

  const weeklyCats: Category[] = ['bag_black', 'bag_beige', 'cleaning_kit', 'phone_strap', 'water_bladder']

  return (
    <main className="px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8" style={{ maxWidth: 1200 }}>
      <div className="mb-4">
        <span className="label" style={{ color: '#9E9D98' }}>Decisions · temporär</span>
        <h1 style={{ fontFamily: FONT, fontSize: '1.75rem', fontWeight: 600, color: '#111110', margin: '4px 0 0' }}>
          DHDL-Bestellung
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {/* 1 — Intro */}
        <Card>
          <CardHeader label="Sachverhalt" />
          <p style={P}>
            Vor der Ausstrahlung von „Die Höhle der Löwen“ brauchen wir eine große Nachbestellung, damit wir den
            erwarteten Nachfrage-Peak bedienen können. Diese Seite fasst den aktuellen Lagerstand zusammen, leitet aus
            historischen Bestellungen das Verhältnis von Bags zu Zusatzprodukten ab und gibt eine Empfehlung, wie viele
            Zusatzprodukte wir zu {nf.format(extraBags)} zusätzlichen Bevi Bags bestellen sollten.
          </p>
          <p style={{ ...P, margin: 0 }}>
            <strong>Annahme:</strong> Frühestmögliche Ausstrahlung am <strong>{fmtDate(DHDL_AIRING_RTL_PLUS)}</strong> auf
            RTL+, eine Woche später (<strong>{fmtDate(DHDL_AIRING_VOX)}</strong>) auf VOX. Basierend auf DHDL-Daten der
            vergangenen Staffeln ist das der früheste realistische Termin. Wir kalkulieren mit dieser Deadline: Die Ware
            muss bis dahin bei WeShip eingelagert sein.
          </p>
        </Card>

        {/* 2 — Stock */}
        <Card>
          <CardHeader label="Aktueller Bestand (WeShip)" />
          {stockError && <ErrorNote>WeShip-Live-Bestand konnte nicht geladen werden: {stockError}</ErrorNote>}
          <Table>
            <thead>
              <tr>
                <Th>Produkt</Th>
                <Th right>Lager</Th>
                <Th right>Reserviert</Th>
                <Th right>Nicht reserviert</Th>
                <Th right>Eingehend</Th>
                <Th right>Nicht verfügbar</Th>
                <Th right>Gesamt (WeShip)</Th>
                <Th right>Planungsbestand</Th>
              </tr>
            </thead>
            <tbody>
              {stockTable.map(({ category, weship: r, planned }) => (
                <tr key={category} style={{ borderBottom: '1px solid #F0EFE9' }}>
                  <td style={{ padding: '10px 20px 10px 0' }}>
                    <span style={{ display: 'block', fontFamily: FONT, color: '#111110' }}>
                      {CATEGORY_LABEL[category]}
                      {category === 'garment_holder' && <span style={{ color: '#9E9D98' }}> (neu)</span>}
                    </span>
                    {r?.sku && <span className="metric" style={{ fontSize: '0.6875rem', color: '#9E9D98' }}>{r.sku}</span>}
                  </td>
                  <Td right muted><Num v={r?.on_stock} /></Td>
                  <Td right muted><Num v={r?.reserved} /></Td>
                  <Td right muted><Num v={r?.unreserved} /></Td>
                  <Td right muted><Num v={r?.incoming} /></Td>
                  <Td right muted><Num v={r?.unavailable} /></Td>
                  <Td right muted><Num v={r?.total} /></Td>
                  <td className="metric" style={{ textAlign: 'right', padding: '10px 0', fontWeight: 600, color: '#0D8585' }}>
                    {nf.format(planned)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Note>
            <strong>Planungsbestand</strong> ist manuell festgelegt (Stand WeShip-Portal, Oktober 2026) und Basis für die
            Empfehlung: Black inkl. der 1.452 als „nicht verfügbar“ gelisteten Stück, Cleaning Kit = 251 + 500 zusätzlich.
            Die WeShip-Spalten dienen nur zum Abgleich. Gesamt (WeShip) = nicht reserviert + eingehend + nicht verfügbar;
            Reserviert stammt aus: {reservedSources.join(', ') || '—'}.
            {!stockError && !incomingFound && ' Die WeShip-API liefert kein Feld für eingehende Ware.'}
            {!stockError && !unavailableFound && ' Die WeShip-API liefert kein Feld für nicht verfügbare Ware.'}
            {!stockError && <>{' '}Gefundene Bestandsfelder in der API: {detectedFields.join(', ') || '—'}.</>}
          </Note>
        </Card>

        {/* 3 — Ratio */}
        <Card>
          <CardHeader label="Verhältnis Bags zu Zusatzprodukten" />
          {ordersError ? (
            <ErrorNote>Shopify-Bestellungen konnten nicht geladen werden: {ordersError}</ErrorNote>
          ) : (
            <>
              <p style={P}>
                Zeitraum <strong>{fmtDate(fromStr)} – {fmtDate(toStr)}</strong> (alles lagernd):{' '}
                {nf.format(ratio.orderCount)} Bestellungen, davon {nf.format(ratio.bundleOrderCount)} mit Bundles.
                Bundle-Bestellungen sind in ihre Einzelprodukte aufgelöst und mitgezählt. Stornierte Bestellungen sind
                ausgenommen.
              </p>
              <Table>
                <thead>
                  <tr>
                    <Th>Produkt</Th>
                    <Th right>Stück</Th>
                    <Th right>davon aus Bundles</Th>
                    <Th right>Pro Bag</Th>
                    <Th right>Anteil</Th>
                  </tr>
                </thead>
                <tbody>
                  {MAIN_CATEGORIES.map(c => (
                    <tr key={c} style={{ borderBottom: '1px solid #F0EFE9' }}>
                      <Td>{CATEGORY_LABEL[c]}</Td>
                      <Td right bold>{nf.format(ratio.unitsByCategory[c])}</Td>
                      <Td right muted>{nf.format(ratio.bundleUnitsByCategory[c])}</Td>
                      <Td right muted>—</Td>
                      <Td right>{ratio.mainUnits > 0 ? pf.format(ratio.unitsByCategory[c] / ratio.mainUnits) : <Dash />}</Td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: '1px solid #E3E2DC' }}>
                    <Td bold>Bags gesamt</Td>
                    <Td right bold>{nf.format(ratio.mainUnits)}</Td>
                    <Td right muted>{nf.format(ratio.bundleUnitsByCategory.bag_black + ratio.bundleUnitsByCategory.bag_beige)}</Td>
                    <Td right>1</Td>
                    <Td right>{ratio.mainUnits > 0 ? pf.format(1) : <Dash />}</Td>
                  </tr>
                  {ADD_ON_CATEGORIES.map(c => (
                    <tr key={c} style={{ borderBottom: '1px solid #F0EFE9' }}>
                      <Td>{CATEGORY_LABEL[c]}</Td>
                      <Td right bold>{nf.format(ratio.unitsByCategory[c])}</Td>
                      <Td right muted>{nf.format(ratio.bundleUnitsByCategory[c])}</Td>
                      <Td right>{ratio.ratios[c] !== null ? rf.format(ratio.ratios[c]!) : <Dash />}</Td>
                      <Td right>{ratio.ratios[c] !== null ? pf.format(ratio.ratios[c]!) : <Dash />}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Note>
                „Pro Bag“ = verkaufte Stück des Zusatzprodukts ÷ verkaufte Bags (Black + Beige). Garment Holder ist neu
                und hat noch keine Verkaufsdaten.
                {unresolvedBundles > 0 && (
                  <span style={{ color: '#DC2626' }}>
                    {' '}Achtung: {nf.format(unresolvedBundles)} Bundle-Positionen kamen ohne Einzelprodukte von Shopify
                    und sind in der Ratio nicht enthalten (siehe Positionen unten).
                  </span>
                )}
              </Note>

              <details style={{ marginTop: 20 }}>
                <summary className="label" style={{ cursor: 'pointer' }}>Verkäufe pro Woche (Lücken = möglicher Stock-out)</summary>
                <div style={{ marginTop: 12 }}>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Woche ab</Th>
                        {weeklyCats.map(c => <Th key={c} right>{CATEGORY_LABEL[c]}</Th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {ratio.weekly.map(w => (
                        <tr key={w.week} style={{ borderBottom: '1px solid #F0EFE9' }}>
                          <Td>{w.week}</Td>
                          {weeklyCats.map(c => (
                            <td key={c} className="metric" style={{
                              textAlign: 'right', padding: '8px 20px 8px 0',
                              color: w.units[c] === 0 ? '#DC2626' : '#111110',
                            }}>
                              {nf.format(w.units[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </details>

              <details style={{ marginTop: 12 }}>
                <summary className="label" style={{ cursor: 'pointer' }}>Alle Positionen im Zeitraum</summary>
                <div style={{ marginTop: 12 }}>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Titel</Th>
                        <Th>Variante</Th>
                        <Th>Zugeordnet</Th>
                        <Th right>Stück</Th>
                        <Th right>davon aus Bundles</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {ratio.products.map(p => (
                        <tr key={p.key} style={{ borderBottom: '1px solid #F0EFE9' }}>
                          <Td>{p.title}</Td>
                          <Td muted>{p.variant ?? '—'}</Td>
                          <Td muted={p.category === 'other'}>{CATEGORY_LABEL[p.category]}</Td>
                          <Td right>{nf.format(p.units)}</Td>
                          <Td right muted>{nf.format(p.unitsInBundles)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </details>
            </>
          )}
        </Card>

        {/* 4 — Recommendation */}
        <Card>
          <CardHeader label={`Empfehlung bei +${nf.format(extraBags)} Bags`} />
          {ordersError ? (
            <ErrorNote>Empfehlung nicht möglich, solange die Bestellungen fehlen.</ErrorNote>
          ) : (
            <>
              <p style={P}>
                Aktuell {nf.format(rec.bagStock)} Bags im Bestand + {nf.format(extraBags)} neu ={' '}
                <strong>{nf.format(rec.bagsAfterOrder)} Bags</strong> nach der Bestellung. Damit die Zusatzprodukte im
                gleichen Verhältnis wie im Referenzzeitraum mitverkauft werden können, sollten wir bestellen:
              </p>
              <Table>
                <thead>
                  <tr>
                    <Th>Produkt</Th>
                    <Th right>Bestand aktuell</Th>
                    <Th right>Ratio</Th>
                    <Th right>Zielbestand</Th>
                    <Th right>Bestellen</Th>
                  </tr>
                </thead>
                <tbody>
                  {rec.rows.map(r => {
                    const isBag = (MAIN_CATEGORIES as string[]).includes(r.category)
                    return (
                      <tr key={r.category} style={{ borderBottom: '1px solid #F0EFE9' }}>
                        <Td>
                          {CATEGORY_LABEL[r.category]}
                          {r.ratioIsAssumption && <span style={{ color: '#9E9D98' }}> (Annahme)</span>}
                        </Td>
                        <Td right muted>{nf.format(r.stock)}</Td>
                        <Td right>
                          {r.ratio === null ? <Dash /> : isBag ? pf.format(r.ratio) : rf.format(r.ratio)}
                        </Td>
                        <Td right><Num v={r.target} /></Td>
                        <td className="metric" style={{
                          textAlign: 'right', padding: '10px 0', fontWeight: 600,
                          color: r.order === null ? '#9E9D98' : '#0D8585',
                        }}>
                          {r.order === null ? (r.category === 'garment_holder' ? 'manuell festlegen' : '—') : nf.format(r.order)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
              <Note>
                Bags: Die {nf.format(extraBags)} Stück sind nach dem historischen Farbanteil aufgeteilt, abzüglich des
                vorhandenen Bestands je Farbe. Zusatzprodukte: Zielbestand = Bags nach Bestellung × Ratio; Bestellmenge =
                Zielbestand − Bestand aktuell, auf volle 100 aufgerundet. Der Garment Holder hat keine Verkaufshistorie –
                eine angenommene Ratio lässt sich per URL setzen, z. B. <code>?gh=0.15</code> (15 % der Bags). Weitere
                Parameter: <code>?extra=</code> (zusätzliche Bags), <code>?from=</code>/<code>?to=</code> (Referenzzeitraum,
                YYYY-MM-DD).
              </Note>
            </>
          )}
        </Card>
      </div>
    </main>
  )
}
