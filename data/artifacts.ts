// ─── Artifacts registry ──────────────────────────────────────────────────────
// One-off analyses and decision pages. They are not in the menu themselves;
// /dashboard/artifacts lists them, and the "Artifacts" nav item stays active
// on every href listed here. Add a new artifact by adding an entry.
//
// Keep this file free of heavy imports — the nav (client) imports it.

export interface Artifact {
  href:        string
  title:       string
  description: string
  date:        string   // YYYY-MM-DD, created or last analysed
  kind:        'Analyse' | 'Entscheidung'
}

export const ARTIFACTS: Artifact[] = [
  {
    href:        '/dashboard/website-audit',
    title:       'Website-Audit bevi-bag.com',
    description: 'Ist-Analyse mit Fokus Conversion vor DHDL: KPIs & Funnel, Technik-Scores, UX-Audit, Benchmark, DHDL-Readiness und priorisierte Maßnahmen.',
    date:        '2026-11-08',
    kind:        'Analyse',
  },
  {
    href:        '/dashboard/decisions/dhdl-order',
    title:       'DHDL-Bestellung',
    description: 'Nachbestellung vor der Ausstrahlung: aktueller Lagerstand, Verhältnis Bags zu Zusatzprodukten und Mengenempfehlung.',
    date:        '2026-10-28',
    kind:        'Entscheidung',
  },
]
