// ─── Website-Audit bevi-bag.com — Berichtsdaten ──────────────────────────────
// Single source of truth for /dashboard/website-audit. Update this file to
// refresh the report; the page only renders what is here (plus the live
// Shopify block, which is fetched read-only at request time).
//
// Regeln für Inhalte:
//  - Jede Aussage mit Beleg (Messung, URL, Datei im Theme-Repo).
//  - Was nicht gemessen werden konnte: `null` + Eintrag in `dataGaps`.
//    Nichts schätzen.

export type Timeframe      = 'Quick Win' | 'Nächste 4 Wochen' | 'Bis DHDL'
export type Implementation = 'Theme-Einstellung' | 'Custom Section/Snippet' | 'App' | 'Content/Copy' | 'Fotografie'
export type Rating         = 'gut' | 'mittel' | 'schwach'

export const TIMEFRAMES: Timeframe[] = ['Quick Win', 'Nächste 4 Wochen', 'Bis DHDL']
export const IMPLEMENTATIONS: Implementation[] = [
  'Theme-Einstellung', 'Custom Section/Snippet', 'App', 'Content/Copy', 'Fotografie',
]

export interface Measure {
  id:             string
  title:          string
  problem:        string   // inkl. Beleg
  action:         string
  effect:         string   // erwarteter Effekt auf Conversion
  impact:         number   // 1–10
  confidence:     number   // 1–10
  ease:           number   // 1–10
  implementation: Implementation
  effortDays:     number
  timeframe:      Timeframe
  note?:          string
}

export interface TechScore {
  page:          string
  url:           string
  device:        'mobil' | 'desktop'
  performance:   number | null
  accessibility: number | null
  bestPractices: number | null
  seo:           number | null
  lcpS:          number | null
  cls:           number | null
  tbtMs:         number | null
  inpMs:         number | null   // nur Felddaten (CrUX) — siehe dataGaps
  weightKb:      number | null
}

export interface Finding {
  title:    string
  detail:   string
  evidence: string
  rating:   Rating
}

export interface UxStage {
  stage:    string
  rating:   Rating
  question: string
  findings: Finding[]
}

export interface BenchmarkBrand {
  brand:            string
  url:              string
  checked:          boolean   // false = nicht prüfbar
  reviews:          string
  stickyAtc:        string
  expressCheckout:  string
  freeShipping:     string
  betterThanUs:     string[]
  transferable:     string[]
  limits?:          string
}

export interface DhdlItem {
  topic:          string
  status:         Rating
  finding:        string
  recommendation: string
}

export interface DataGap {
  metric:  string
  status:  string
  howTo:   string
}

// ─── Meta ───────────────────────────────────────────────────────────────────

export const auditMeta = {
  analysisDate: '2026-11-08',
  site:         'https://bevi-bag.com',
  dhdlAiring:   'Frühjahr 2027',
  scope:        'Startseite, Produktseite Bevi Bag (Full Set), Warenkorb (Drawer + /cart), Theme-Repo bevi-shopify-theme (read-only)',
  method: [
    'Live-Site mobil: Playwright mit iPhone-13-Emulation (390×844), Screenshots und DOM-Auswertung.',
    'Technik: Lighthouse 12 lokal (Chromium headless, Standard-Throttling, je 2 Läufe, Median-nah). Ersetzt die PageSpeed-Insights-API, für die kein API-Key hinterlegt war — Lab-Werte sind vergleichbar, Felddaten (CrUX/INP) fehlen.',
    'Theme: Templates, Section-Reihenfolge und App-Embeds aus maxmauthnergit/bevi-shopify-theme (Concept 1.6.0), nur gelesen.',
    'Benchmark: öffentlich sichtbare Seiten, mobil, ohne Checkout. Drittanbieter-Widgets (Reviews, Popups) der Benchmark-Shops waren teils blockiert und sind entsprechend gekennzeichnet.',
    'Checkout selbst wurde nicht betreten (keine Testbestellung).',
  ],
}

// ─── Executive Summary ──────────────────────────────────────────────────────

export const executiveSummary: string[] = [
  'Das Produkt erklärt sich schnell: Der Hero-Claim „The only crossbody bag with built-in hydration.“ und die Infografik als erstes Galeriebild beantworten „Was ist das?“ in unter 3 Sekunden. Was fehlt, ist Kaufsicherheit am Kaufbutton: keine Lieferzeit, kein Rückgabehinweis, keine Zahlungsarten, ein Rating (4.79) ohne Anzahl.',
  'Im Warenkorb gibt es vermeidbare Reibung: Express-Checkout (Apple Pay, PayPal, Shop Pay) ist auf der Produktseite deaktiviert und im Drawer nicht vorhanden. Der Drawer-Upsell schlägt „Bundle M“ vor, das legt eine zweite Tasche in den Warenkorb.',
  'Mobile Performance ist der technische Engpass: Lighthouse mobil 39–60 Punkte (Desktop 75–94), LCP mobil bis 7,1 s, Total Blocking Time 1,5–2,0 s — allein Google Tag Manager blockiert 1,26 s. Die Produktseite lädt beim Durchscrollen ca. 39 MB, vor allem 1080p-Videos.',
  'Größtes DHDL-Risiko ist die Sprache: Der Shop ist komplett englisch (lang="en", kein hreflang), das TV-Publikum ist deutschsprachig. Dazu kommt: Es gibt keine E-Mail-Erfassung — Newsletter-Popup und Footer-Newsletter sind deaktiviert. Wer bei der TV-Spitze nicht sofort kauft, ist verloren.',
  'Die Priorisierung beruht auf dem Audit, nicht auf Funnel-Daten. Der Session-Funnel nach Gerät hängt an ShopifyQL (Status siehe Live-Block); fehlt er, bitte aus Shopify Analytics nachliefern und die ICE-Scores danach neu kalibrieren.',
]

// ─── Manuell nachzuliefernde KPIs (Shopify Analytics Export) ────────────────
// Werte aus Shopify Analytics → Berichte eintragen; `null` = noch offen.
// Die Page zeigt diese Werte, wenn die API sie nicht liefert.

export interface ManualFunnel {
  device:            'mobil' | 'desktop' | 'gesamt'
  sessions:          number | null
  addedToCart:       number | null
  reachedCheckout:   number | null
  completedCheckout: number | null
}

export const manualKpis: {
  period:  string | null
  source:  string | null
  funnel:  ManualFunnel[]
  returnRatePct: number | null
} = {
  period: null,
  source: null,
  funnel: [
    { device: 'mobil',   sessions: null, addedToCart: null, reachedCheckout: null, completedCheckout: null },
    { device: 'desktop', sessions: null, addedToCart: null, reachedCheckout: null, completedCheckout: null },
  ],
  returnRatePct: null,
}

// ─── Technik ────────────────────────────────────────────────────────────────

// Lighthouse 12, 08.11.2026, Mittelwert aus 2 Läufen je Seite/Gerät.
// Ladegewicht = Lighthouse total-byte-weight (nur bis Load, ohne Scrollen).
// INP ist ein Feldwert und mit Lab-Tools nicht messbar → null (siehe dataGaps).
const H = 'https://bevi-bag.com'
export const techScores: TechScore[] = [
  { page: 'Startseite',   url: `${H}/`,                    device: 'mobil',   performance: 43, accessibility: 91, bestPractices: 71, seo: 85, lcpS: 5.7, cls: 0,     tbtMs: 2020, inpMs: null, weightKb: 4226 },
  { page: 'Startseite',   url: `${H}/`,                    device: 'desktop', performance: 80, accessibility: 91, bestPractices: 70, seo: 85, lcpS: 1.5, cls: 0.014, tbtMs: 253,  inpMs: null, weightKb: 6829 },
  { page: 'Produktseite', url: `${H}/products/bevi-bag`,   device: 'mobil',   performance: 57, accessibility: 87, bestPractices: 71, seo: 92, lcpS: 3.1, cls: 0,     tbtMs: 2033, inpMs: null, weightKb: 18825 },
  { page: 'Produktseite', url: `${H}/products/bevi-bag`,   device: 'desktop', performance: 75, accessibility: 90, bestPractices: 70, seo: 92, lcpS: 1.4, cls: 0.03,  tbtMs: 382,  inpMs: null, weightKb: 21441 },
  { page: 'Warenkorb',    url: `${H}/cart`,                device: 'mobil',   performance: 60, accessibility: 98, bestPractices: 71, seo: 92, lcpS: 3.5, cls: 0,     tbtMs: 1536, inpMs: null, weightKb: 2257 },
  { page: 'Warenkorb',    url: `${H}/cart`,                device: 'desktop', performance: 94, accessibility: 98, bestPractices: 70, seo: 92, lcpS: 0.9, cls: 0.019, tbtMs: 179,  inpMs: null, weightKb: 2220 },
  // LCP mobil schwankte stark (7,1 s / 17,8 s); angegeben ist der bessere Lauf.
  { page: 'Landingpage /pages/home-reasons', url: `${H}/pages/home-reasons`, device: 'mobil',   performance: 39, accessibility: 89, bestPractices: 71, seo: 85, lcpS: 7.1, cls: 0,     tbtMs: 1567, inpMs: null, weightKb: 3803 },
  { page: 'Landingpage /pages/home-reasons', url: `${H}/pages/home-reasons`, device: 'desktop', performance: 83, accessibility: 89, bestPractices: 70, seo: 85, lcpS: 1.9, cls: 0.032, tbtMs: 157,  inpMs: null, weightKb: 17636 },
]

export const techFindings: Finding[] = [
  {
    title: 'Videos dominieren das Seitengewicht',
    detail: 'Die Produktseite lädt beim Durchscrollen ca. 39 MB, davon ca. 30 MB Video (6 MP4s in 1080p, 4,8–7,2 Mbit/s, größte Datei 10,8 MB). Startseite: 23 MB, davon 13,7 MB Video. Für mobilen Meta-Traffic (oft Mobilfunk) ist das der größte Einzelhebel.',
    evidence: 'Playwright-Netzwerkmitschnitt, iPhone 13, komplett gescrollt; Sections ss-media-grid / video-with-text in templates/product.bevi-bag.json',
    rating: 'schwach',
  },
  {
    title: 'Hohe Main-Thread-Last durch Tracking und Apps',
    detail: 'Total Blocking Time mobil 1,5–2,0 s (Mittel). Größter Einzelposten auf der PDP mobil: Google Tag Manager mit 1.257 ms Blocking Time und 859 KB, danach Meta Pixel 426 ms / 269 KB und Clarity 129 ms. Geladen werden zwei gtag.js (Google Ads AW-17269607674 und GA4), Meta Pixel, Microsoft Clarity, Judge.me (Vue-Helper 82 KB, 92 % ungenutzt), Shopify Web Pixels (300 KB, 51 % ungenutzt). JS insgesamt ca. 60 % ungenutzt, CSS ca. 81 % ungenutzt (theme.css allein 78–91 %).',
    evidence: 'Lighthouse 12 (TBT, third-party-summary); Coverage via Playwright; layout/theme.liquid:65-93 (Clarity + 2× gtag hart eingebunden)',
    rating: 'schwach',
  },
  {
    title: 'Tracking ohne Consent-Gate',
    detail: 'Clarity und gtag werden direkt in theme.liquid geladen, unabhängig vom Shopify-Privacy-Banner. Das ist ein DSGVO-Risiko (rechtlich prüfen lassen) und kostet zusätzlich Ladezeit vor jeder Interaktion.',
    evidence: 'layout/theme.liquid:65-71 (Clarity), :74-93 (gtag)',
    rating: 'schwach',
  },
  {
    title: 'LCP-Bild korrekt priorisiert, CLS stabil',
    detail: 'Das LCP-Bild ist eager + fetchpriority=high (Startseite bevi_header_mobile.avif). CLS liegt bei 0–0,014. Das Layout springt also nicht — hier besteht kein Handlungsbedarf.',
    evidence: 'Lighthouse CLS; DOM-Auswertung des LCP-Elements',
    rating: 'gut',
  },
  {
    title: 'Überdimensionierte Bilder und unnötige Preloads',
    detail: 'Social-Proof-Avatare werden mit 380 px geladen und mit 25 px angezeigt. Fotos mit 1200–2400 px werden mit 166–342 px angezeigt, Galeriebilder mit width=2000 angefordert. Die Schrift Crimson Text wird doppelt vorgeladen, obwohl per CSS alles auf Gustavo umgestellt ist. accelerated-checkout-backwards-compat.css blockiert das Rendern, obwohl Dynamic Checkout aus ist.',
    evidence: 'Playwright-DOM (naturalWidth vs. clientWidth), <head> des ausgelieferten HTML',
    rating: 'mittel',
  },
  {
    title: 'Viel Template-Ballast im Theme',
    detail: '90 Templates, davon 17 Produkt-Templates (3 Test/Pre-Order) und ca. 30 personenbezogene page-Templates. Live genutzt wird templates/product.bevi-bag.json. Kein Performance-Problem, aber ein Wartungsrisiko vor DHDL (falsches Template zugewiesen = falsche Seite live).',
    evidence: 'templates/ im Theme-Repo; Section-IDs im Live-HTML',
    rating: 'mittel',
  },
]

export const seoFindings: Finding[] = [
  {
    title: 'Product-Schema ohne Bewertungen',
    detail: 'JSON-LD „Product“ mit 2 Offers (89 €, Black InStock, Beige OutOfStock), aber ohne AggregateRating/Review, obwohl 4.79 angezeigt wird. Organization, WebSite und BreadcrumbList fehlen. Der Vergleichspreis 99 € ist nicht ausgezeichnet, brand ist nur ein String.',
    evidence: 'JSON-LD auf /products/bevi-bag und Startseite',
    rating: 'mittel',
  },
  {
    title: 'Sprache und Lokalisierung',
    detail: 'lang="en", Locale en-AT, kein hreflang, keine /de-Version (bevi-bag.com/de → 404). Für Suchanfragen auf Deutsch („Trinkrucksack Festival“, „Tasche mit Trinksystem“) ist die Seite kaum relevant.',
    evidence: 'HTML-Head, curl /de → 404',
    rating: 'schwach',
  },
  {
    title: 'Open Graph und Meta-Tags',
    detail: 'Title, Description und Canonical sind vorhanden. og:image nutzt http:// (nur secure_url ist https), og:price:amount/currency fehlen auf der Produktseite, twitter:site ist leer („@“), /cart hat keine Description.',
    evidence: 'HTML-Head von Startseite, PDP und /cart',
    rating: 'mittel',
  },
  {
    title: 'Testseite indexierbar',
    detail: '/pages/test steht in der Sitemap, liefert 200 und hat kein robots-noindex. Templates wie /pages/julia sind ohne Seite (404).',
    evidence: 'sitemap_pages_1.xml',
    rating: 'mittel',
  },
]

// ─── UX- und Conversion-Audit ───────────────────────────────────────────────

export const uxAudit: UxStage[] = [
  {
    stage: 'Above the Fold (Startseite, mobil)',
    rating: 'mittel',
    question: 'Wird in 3 Sekunden klar, was Bevi ist, für wen und warum?',
    findings: [
      {
        title: 'Was: sofort klar',
        detail: 'Der Claim „The only crossbody bag with built-in hydration.“ und das Bild mit Mundstück erklären das Produkt im ersten Screen.',
        evidence: 'Screenshot Startseite mobil, erster Screen',
        rating: 'gut',
      },
      {
        title: 'Für wen und warum: nur implizit',
        detail: 'Einsatzzweck (Festival, Reisen, Events) taucht erst in der Produktbeschreibung auf. Preis, Rating und Kundenzahl stehen nicht im ersten Screen. Der CTA „Explore now“ ist unverbindlich statt kaufnah.',
        evidence: 'Startseite: „3.060+ others“ erst unter dem Hero; Preis erst in der featured-product-Section',
        rating: 'mittel',
      },
      {
        title: 'Sehr lange Startseite',
        detail: 'Die Startseite ist ca. 33.000 px hoch (≈ 50 Bildschirme). Der Kaufbereich (featured-product mit ATC) kommt zwar früh — der Rest wiederholt Inhalte der Produktseite.',
        evidence: 'document.body.scrollHeight = 33.161 px (iPhone 13)',
        rating: 'mittel',
      },
    ],
  },
  {
    stage: 'Produktseite',
    rating: 'mittel',
    question: 'Bilder, Benefits, Varianten, Preis, Sticky ATC, Lieferzeit, Versand/Retoure, FAQ',
    findings: [
      {
        title: 'Galerie und Medien stark',
        detail: 'Das erste Galeriebild ist eine Infografik mit allen Teilen (Gurt, Trinkblase 1 L, zwei Schläuche, AirTag-Fach). Insgesamt 32 Bilder und 4 Videos.',
        evidence: 'Screenshot PDP Screen 1; DOM-Zählung',
        rating: 'gut',
      },
      {
        title: 'Preis und Varianten klar, ausverkaufte Farbe ohne Ausweg',
        detail: '89 € statt 99 € plus „Incl. VAT | Free shipping available“ ist eindeutig. Beige ist ausverkauft (durchgestrichenes Swatch), der Back-in-Stock-Block der App ist im Template deaktiviert — Interessierte an Beige haben keinen nächsten Schritt.',
        evidence: 'products.json (Beige OutOfStock); templates/product.bevi-bag.json: Back-in-Stock-App-Block disabled',
        rating: 'mittel',
      },
      {
        title: 'Sticky ATC vorhanden',
        detail: 'sticky_buy_button ist im main-product aktiv und erscheint beim Scrollen.',
        evidence: 'templates/product.bevi-bag.json; DOM: fixierter „Add to cart“',
        rating: 'gut',
      },
      {
        title: 'Keine Kaufsicherheit am Button',
        detail: 'Direkt am Kaufbutton fehlen Lieferzeit (laut FAQ: Free = bis 5 Werktage Bearbeitung, Standard 4,99 € = 1–2 Werktage), Rückgabe (14 Tage), Zahlungsarten und Express-Checkout (show_dynamic_checkout: false).',
        evidence: 'PDP-Text; /pages/faq; templates/product.bevi-bag.json buy_buttons',
        rating: 'schwach',
      },
      {
        title: 'Features vor Benefits, keine FAQ auf der PDP',
        detail: 'Die Beschreibung listet Features („integrated and discreet drinking system“). Einwände wie Reinigung, Dichtigkeit, Festival-Einlass und Hygiene-Rückgabe beantwortet nur die separate FAQ-Seite. Die PDP ist ca. 35.000 px lang, Reviews kommen erst weit unten.',
        evidence: 'PDP-Text; Section-Reihenfolge in templates/product.bevi-bag.json (Judge.me-Snippet an Position 7 nach main-product)',
        rating: 'schwach',
      },
    ],
  },
  {
    stage: 'Trust und Social Proof',
    rating: 'schwach',
    question: 'Reviews, Garantien, Zahlungsarten, Siegel, Gründer-Story, Presse',
    findings: [
      {
        title: 'Rating ohne Anzahl',
        detail: 'Neben dem Preis steht „4.79“ (aus dem Review-Metafeld), aber keine Anzahl und kein Link zu den Reviews. Die Judge.me-Reviews erscheinen nur als Snippet-Karussell weit unten, gemischt Deutsch/Englisch/Polnisch, ohne Gesamtliste und ohne Fotos.',
        evidence: 'snippets/product-rating.liquid (Metafeld reviews.rating); Judge.me rev-snippet-widget im DOM',
        rating: 'schwach',
      },
      {
        title: 'Kundenzahl als Social Proof',
        detail: '„Julia, David and 3.060+ others already stay hydrated with Bevi.“ direkt unter der Galerie ist ein guter Anker.',
        evidence: 'Section ss-social-proof',
        rating: 'gut',
      },
      {
        title: 'Keine Garantie, keine Presse, keine Gründer',
        detail: 'Es gibt kein Garantie-Versprechen, keine Zahlungsicons, keine „bekannt aus“-Leiste und keine Gründer-Story auf Startseite oder PDP. Die Rückgabe ist auf die gesetzlichen 14 Tage begrenzt, geöffnete Trinkblasen/Schläuche sind aus Hygienegründen ausgeschlossen — ein Einwand, der nirgends proaktiv aufgefangen wird.',
        evidence: '/policies/refund-policy; Startseite und PDP komplett gescannt',
        rating: 'schwach',
      },
    ],
  },
  {
    stage: 'Einwandbehandlung',
    rating: 'mittel',
    question: 'Größe/Maße, Material, Pflege, Vergleich zu Alternativen',
    findings: [
      {
        title: 'Maße und Lieferumfang vorhanden',
        detail: '„Bevi Bag (ca. 33×14 cm) • 1L water bladder (100% BPA free) • Shoulder strap • Long tube (45cm) • Short tube (12cm)“ steht direkt unter dem Button. Gut.',
        evidence: 'PDP-Beschreibung',
        rating: 'gut',
      },
      {
        title: 'Pflege und Kühlung erklärt, aber verstreut',
        detail: '„Easy to clean“, „kept cold for up to five hours“, „preventing leakage“ stehen in langen Image-with-Text-Sections. Ein kompakter Block „Häufige Fragen“ am Kaufbutton fehlt.',
        evidence: 'PDP-Sections image-with-text',
        rating: 'mittel',
      },
      {
        title: 'Kein Vergleich zu Alternativen',
        detail: 'Warum nicht Trinkflasche oder Trinkrucksack? Der Vergleich ist das naheliegendste Kaufargument für ein neues Produktkonzept und fehlt.',
        evidence: 'Startseite und PDP',
        rating: 'schwach',
      },
    ],
  },
  {
    stage: 'Warenkorb und Checkout',
    rating: 'mittel',
    question: 'Reibung, Upsells, Express-Checkout, Free-Shipping-Schwelle',
    findings: [
      {
        title: 'Cart-Drawer öffnet sofort',
        detail: 'Nach „Add to cart“ öffnet sich ein Drawer mit Produkt, Upsell-Slider und „Check out“. Das ist ein schneller Weg.',
        evidence: 'Screenshot Cart-Drawer mobil',
        rating: 'gut',
      },
      {
        title: 'Upsell schlägt zweite Tasche vor',
        detail: 'Erste Empfehlung im Drawer ist „Bundle M: Bevi Bag (Full Set) & Bevi Cleaning Kit“ (102 €). Mit „+“ landet eine zweite Tasche im Warenkorb, statt das Cleaning Kit (24 €) zu ergänzen.',
        evidence: 'sections/overlay-group.json (cart recommendations); Screenshot Cart-Drawer',
        rating: 'schwach',
      },
      {
        title: 'Free-Shipping-Bar ohne Funktion',
        detail: 'free_shipping_minimum_amount ist 0 — die Leiste zeigt immer „You are eligible for free shipping.“ und belegt Platz, ohne zu motivieren. Gleichzeitig wird beim kostenlosen Versand bis zu 5 Werktage bearbeitet (FAQ) — das steht nirgends im Warenkorb.',
        evidence: 'sections/overlay-group.json; sections/cart-drawer.liquid:84-104; /pages/faq',
        rating: 'mittel',
      },
      {
        title: 'Kein Express-Checkout',
        detail: 'Weder auf der PDP noch im Drawer gibt es Apple Pay, Google Pay, PayPal oder Shop Pay als Ein-Klick-Button. Mobil ist das der kürzeste Weg zum Kauf.',
        evidence: 'show_dynamic_checkout: false; DOM ohne shopify-accelerated-checkout',
        rating: 'schwach',
      },
    ],
  },
  {
    stage: 'Copy',
    rating: 'mittel',
    question: 'Klarheit, Tonalität, Konsistenz',
    findings: [
      {
        title: 'Klar und sympathisch',
        detail: '„Water to wear.“ und „Bevi is Italian for drink your damn water.“ sind prägnant und markentypisch.',
        evidence: 'Startseite',
        rating: 'gut',
      },
      {
        title: 'Nur Englisch, uneinheitliche Begriffe',
        detail: 'Die gesamte Seite ist englisch, Reviews und Rechtstexte teils deutsch. Uneinheitlich sind „crossbody bag“ und „cross-shoulder bag“ sowie „the only“ und „world’s first“ (FAQ).',
        evidence: 'Startseite, PDP, /pages/faq',
        rating: 'schwach',
      },
    ],
  },
]

// ─── Benchmark ──────────────────────────────────────────────────────────────

export const benchmark: BenchmarkBrand[] = [
  {
    brand: 'Bevi (Ist)',
    url: 'https://bevi-bag.com/products/bevi-bag',
    checked: true,
    reviews: '4.79 ohne Anzahl (Judge.me, Snippet-Karussell)',
    stickyAtc: 'ja',
    expressCheckout: 'nein (deaktiviert)',
    freeShipping: 'immer (EU), Leiste ohne Funktion',
    betterThanUs: [],
    transferable: [],
  },
  {
    brand: 'Got Bag',
    url: 'https://got-bag.com/products/rolltop-2-0',
    checked: true,
    reviews: '4,80 bei 1.510 (Reviews.io, aus JSON-LD; Widget nicht gerendert)',
    stickyAtc: 'nein',
    expressCheckout: 'im Code, nicht sichtbar',
    freeShipping: 'ab 100 €, sonst 2,99 €',
    betterThanUs: [
      'Drei Icon-Zeilen direkt unter dem Kaufbutton: „Schnelle Lieferung 3-4 Werktage“, „Kostenloser Versand mit DHL GoGreen Plus“, „z. B. mit Klarna auf Rechnung“.',
      'Sterne mit Anzahl direkt unter dem Titel, als Sprunglink zu den Reviews.',
      'Modelgröße als Bildtext („Model: 179 cm“) und Maße mit Alltagsbezug („passend für DIN A3“).',
      'Warenkorb mit Zahlungsicons und günstigem Zubehör-Upsell (Wallet 19 €).',
    ],
    transferable: [
      'Icon-Zeilen unter dem ATC (Custom Snippet) — größter Hebel für kalten Meta-Traffic.',
      'Rating + Anzahl als Link unter dem Titel (Judge.me-Badge).',
      'Bildtexte „Model: x cm“ in der Galerie.',
    ],
    limits: 'Review-Widget und Klaviyo durch Proxy blockiert; Zahlen aus dem HTML.',
  },
  {
    brand: 'Aevor',
    url: 'https://www.aevor.com/products/trip-pack-black-eclipse',
    checked: true,
    reviews: 'Reviews.io unter H1 (Anzahl nicht prüfbar, Widget blockiert)',
    stickyAtc: 'nein',
    expressCheckout: 'im Code, nicht sichtbar',
    freeShipping: 'ab 39 € (DE/AT), mit Fortschrittsleiste',
    betterThanUs: [
      'Wechselnde Announcement-Bar mit drei Kaufargumenten: Versand ab 39 €, „30 Tage Rückgaberecht“, „10% Welcome-Rabatt“.',
      'Bundle-Upsell im Drawer als echtes Set („Travel Pack + Wash Pack Set €139,90 statt €169,80“) statt einer zweiten Hauptware.',
      'Ein Nutzensatz direkt unter dem Preis („Rein damit. Los.“), Technik erst im Accordion „Technische Daten“.',
      '12 Zahlungsicons unter dem Kaufbutton.',
    ],
    transferable: [
      'Announcement-Bar mit Rückgabe + Erstbesucher-Anreiz (Theme-Einstellung).',
      'Drawer-Upsell auf Zubehör umstellen (Theme-Einstellung).',
      'Accordion „Technische Daten / Lieferumfang“ unter dem ATC.',
    ],
    limits: 'Reviews.io und Klaviyo blockiert.',
  },
  {
    brand: 'Bellroy',
    url: 'https://bellroy.com/products/transit-workpack',
    checked: true,
    reviews: 'keine Produkt-Reviews im HTML, „4.9-star Google rating“ im Footer',
    stickyAtc: 'nicht prüfbar',
    expressCheckout: 'nicht prüfbar',
    freeShipping: '„Free shipping available“, keine Schwelle sichtbar',
    betterThanUs: [
      '8 Icon-Bullets zur Kaufentscheidung direkt unter dem Titel („Fits a 16\" laptop“, „Water-resistant“).',
      'Garantie und verlängerte Rückgabe mit Datum („3-year warranty … extended returns until January 31 2027“).',
      'Modelgröße und „Compare“-Link, Designer-Zitat („— James, Bellroy designer“).',
      'Gratisbeigabe beim Kauf („Free charm duo“) statt Rabatt.',
    ],
    transferable: [
      'Icon-Bullets „Was Bevi kann“ statt Fließtext (Custom Snippet).',
      'Verlängerte Rückgabe (z. B. 30 Tage) als Policy-Entscheidung — kommuniziert am ATC.',
      'Gratisbeigabe (Phone Strap) als Erstbesucher- oder DHDL-Angebot.',
    ],
    limits: 'Eigenes CSS/JS und Bilder blockiert, Auswertung aus server-gerendertem HTML (US-Cache).',
  },
  {
    brand: 'Db Journey',
    url: 'https://dbjourney.com/de-de/products/hugger-backpack-30l-black-out',
    checked: true,
    reviews: '4,6 bei 938 (Yotpo, aus JSON-LD)',
    stickyAtc: 'ja, mit Preis',
    expressCheckout: 'Apple Pay / G Pay / Klarna im Code, Buttons nicht prüfbar',
    freeShipping: 'nur für Db-Black-Mitglieder',
    betterThanUs: [
      'Sticky ATC mit Preis („In den Einkaufswagen legen €209“).',
      'Unter dem ATC: Klarna-Hinweis + Icons „Schneller Versand“, „Kostenlose Rücksendung“, „2-year legal guarantee“.',
      'Größenvergleich in Nutzen („1 Tag / 1–2 Tage / 1–3 Tage“) statt Liter, Bestseller-Badge.',
      'Hotspot-Bild Vorder-/Rückseite/Innen und UGC-Kacheln „Aus unserer Community“.',
    ],
    transferable: [
      'Preis im Sticky ATC (Theme-Einstellung prüfen).',
      'Trust-Icons unter dem ATC (gleiches Snippet wie Got Bag).',
      'Hotspot „Was passt rein?“ (Concept-Hotspot-Section, sofern im Theme vorhanden; sonst Custom Section).',
    ],
    limits: 'Yotpo blockiert; Drawer füllte sich im Test nicht.',
  },
  {
    brand: 'ooia (DHDL-Alumni)',
    url: 'https://ooia.de/products/slip-seamless-ultimate-cocoa',
    checked: true,
    reviews: '17.000+ 5-Sterne / 20.000+ (Trustpilot)',
    stickyAtc: 'nein',
    expressCheckout: 'keine Buttons sichtbar',
    freeShipping: 'ab 4 Produkten',
    betterThanUs: [
      'Social Proof als Zahl im Hero („über 500.000 Kund*innen … 17.000 5-Sterne-Bewertungen“).',
      'Einwandbehandlung auf drei Ebenen: Laufzeile unter dem Hero („schadstofffrei · OEKO-TEX · 1–2 mm dünn“), Benefit-Kacheln unter dem ATC, FAQ „NOCH FRAGEN?“ auf der PDP.',
      'Lieferzeit pro Artikel im Drawer („Versand innerhalb von 2 Tagen“) + Ein-Klick-Upsell (Socken 13,25 €).',
      'Newsletter-Anreiz als Gratisprodukt („ANMELDEN & GRATIS SOCKEN“) statt Prozent-Rabatt.',
      'Nutzt DHDL heute nicht mehr sichtbar — setzt auf Kundenzahl, Trustpilot und Gründerinnen-Story (/pages/story).',
    ],
    transferable: [
      'Laufzeile mit Einwand-Killern („BPA-frei · 1 Liter · 5 h kühl · auslaufsicher“) — Concept hat Scrolling-Text.',
      'PDP-FAQ-Accordion (Concept faq-Section ist vorhanden).',
      'Gratis-Zubehör statt Rabatt als E-Mail-Anreiz — schützt die Marge in der TV-Spitze.',
    ],
    limits: 'Trustpilot- und Klaviyo-Widgets blockiert; Zahlen aus sichtbarem Text.',
  },
  {
    brand: 'Johnny Urban',
    url: 'https://johnny-urban.com',
    checked: false,
    reviews: '—',
    stickyAtc: '—',
    expressCheckout: '—',
    freeShipping: '—',
    betterThanUs: [],
    transferable: [],
    limits: 'Nicht prüfbar: www.johnny-urban.com leitet auf johnny-urban.com um, diese Domain ist in der Umgebung nicht freigegeben. Bei Bedarf freigeben und nachziehen.',
  },
]

// ─── DHDL-Readiness ─────────────────────────────────────────────────────────

export const dhdl: { verdict: string; secrecyNote: string; items: DhdlItem[] } = {
  verdict:
    'Bedingt bereit. Shopify skaliert die Infrastruktur, Sticky ATC und Bundles sind da. Für kalten, deutschsprachigen TV-Traffic auf dem Handy fehlen aber Sprache, E-Mail-Erfassung, Kaufsicherheit am Button und ein schlankes Mobile-Erlebnis. Alle vier sind bis Frühjahr 2027 lösbar.',
  secrecyNote:
    'Vor der Ausstrahlung darf nichts DHDL-Bezogenes live sichtbar sein. Deshalb: DHDL-Landingpage und „Bekannt aus“-Element als Custom Sections mit Schalter bauen (Standard: aus), die Seite in Shopify unveröffentlicht anlegen, keine DHDL-Begriffe in Handles, Alt-Texten, Meta-Tags oder Sitemap. Freischalten erst am Sendetag.',
  items: [
    {
      topic: 'Sprache',
      status: 'schwach',
      finding: 'Shop komplett englisch, /de → 404, kein hreflang. TV-Zuschauer:innen landen auf einer englischen Seite.',
      recommendation: 'Deutsch als Sprache für DE/AT/CH (Shopify Markets + Translate & Adapt), Copy auf Deutsch neu schreiben statt maschinell übersetzen.',
    },
    {
      topic: 'Eigene Landingpage',
      status: 'mittel',
      finding: 'TV-Zuschauer:innen tippen „Bevi“ bei Google oder bevi-bag.com direkt ein und landen auf der 33.000-px-Startseite. Eine fokussierte Seite fehlt. /pages/home-reasons ist ein Startseiten-Klon.',
      recommendation: 'Ja: kurze DHDL-Landingpage (Hero mit Gründer:innen aus der Sendung, 3 Benefits, Reviews, FAQ, ATC) + Startseiten-Banner, beides per Schalter am Sendetag aktivieren.',
    },
    {
      topic: '„Bekannt aus DHDL“',
      status: 'mittel',
      finding: 'Kein Presse-/TV-Element vorhanden. ooia nutzt DHDL heute gar nicht mehr sichtbar — der Effekt ist zeitlich begrenzt.',
      recommendation: 'Nach Ausstrahlung als dezente Leiste unter dem Hero und am ATC, nach einigen Monaten durch Review-Zahl ersetzen.',
    },
    {
      topic: 'Angebot für Erstbesucher',
      status: 'schwach',
      finding: 'Kein Anreiz, keine E-Mail-Erfassung (Newsletter-Popup und Footer-Newsletter deaktiviert).',
      recommendation: 'Gratis-Zubehör (z. B. Phone Strap) gegen E-Mail statt Rabatt; schützt Marge und erzeugt eine Liste für Nachfass-Mails.',
    },
    {
      topic: 'Lagerbestand',
      status: 'mittel',
      finding: 'Beige ist aktuell ausverkauft, der Back-in-Stock-Block ist aus, Bestandsanzeige deaktiviert. Ein Ausverkauf während der Spitze wäre unsichtbar und ohne Rückfangnetz.',
      recommendation: 'Back-in-Stock aktivieren, Pre-Order-Fallback (Template product.pre-order-bevi-bag existiert) vorbereiten, Bestandsplanung über die DHDL-Order-Seite in Bevi Base.',
    },
    {
      topic: 'Ladezeit bei Apps',
      status: 'schwach',
      finding: 'Lighthouse mobil 39–60, TBT 1,5–2,0 s (davon GTM 1,26 s), PDP ca. 39 MB beim Scrollen. In einer TV-Spitze sind viele Nutzer:innen gleichzeitig im Mobilfunk.',
      recommendation: 'Videos auf 720p/komprimiert, Tracking hinter Consent und deduplizieren, Ziel: Lighthouse mobil ≥ 70 auf der Landingpage.',
    },
    {
      topic: 'Checkout-Fehler',
      status: 'mittel',
      finding: 'Checkout nicht getestet (keine Testbestellung in diesem Audit). Kein Express-Checkout aktiv.',
      recommendation: 'Vor der Sendung: Testbestellungen mit allen Zahlungsarten mobil (iOS/Android), Rabattcodes, Bundles; Express-Checkout aktivieren; Shopify-Status und Payment-Limits mit Provider klären.',
    },
    {
      topic: 'E-Mail-Capture für Nicht-Käufer',
      status: 'schwach',
      finding: 'Keine Erfassung vorhanden. Bei TV-Traffic kauft der Großteil nicht beim ersten Besuch.',
      recommendation: 'Popup/Teaser mobil-freundlich (verzögert, kein Fullscreen) + Willkommens-Flow mit 3 Mails (Produkt, Reviews, Angebot).',
    },
  ],
}

// ─── Maßnahmen ──────────────────────────────────────────────────────────────

export const measures: Measure[] = [
  // Quick Wins
  {
    id: 'M01', timeframe: 'Quick Win', implementation: 'Theme-Einstellung',
    title: 'Express-Checkout auf Produktseite und im Drawer aktivieren',
    problem: 'Kein Apple Pay / Google Pay / PayPal / Shop Pay als Ein-Klick-Button (show_dynamic_checkout: false). Traffic ist überwiegend mobil.',
    action: 'Dynamic-Checkout-Buttons im buy_buttons-Block einschalten, Accelerated Checkout im Cart-Drawer prüfen; Zahlungsarten in Shopify Payments/PayPal aktivieren.',
    effect: 'Weniger Formular-Reibung mobil; kürzester Weg vom Ad-Klick zum Kauf.',
    impact: 8, confidence: 7, ease: 9, effortDays: 0.25,
  },
  {
    id: 'M02', timeframe: 'Quick Win', implementation: 'Theme-Einstellung',
    title: 'Drawer-Upsell auf Zubehör umstellen',
    problem: 'Erste Drawer-Empfehlung ist „Bundle M“ (102 €) — legt eine zweite Tasche in den Warenkorb.',
    action: 'Cart-Recommendations auf Cleaning Kit (24 €), Phone Strap (14 €) und Extra-Trinkblase (19 €) setzen.',
    effect: 'Höherer AOV ohne Verwirrung im Warenkorb.',
    impact: 5, confidence: 8, ease: 9, effortDays: 0.25,
  },
  {
    id: 'M03', timeframe: 'Quick Win', implementation: 'App',
    title: 'Review-Anzahl am Titel und vollständiges Review-Widget',
    problem: '„4.79“ steht ohne Anzahl und ohne Link; Reviews nur als Snippet-Karussell weit unten, Sprachen gemischt.',
    action: 'Judge.me-Badge mit Anzahl unter den Titel (Sprunglink), vollständiges Review-Widget mit Fotos höher auf die PDP, Rich Snippets (AggregateRating) aktivieren.',
    effect: 'Mehr Vertrauen bei Erstbesucher:innen; Sterne in Google-Ergebnissen.',
    impact: 7, confidence: 7, ease: 8, effortDays: 1,
  },
  {
    id: 'M04', timeframe: 'Quick Win', implementation: 'Theme-Einstellung',
    title: 'Back-in-Stock für Beige aktivieren',
    problem: 'Beige ist ausverkauft, der App-Block ist deaktiviert — Interessierte haben keinen nächsten Schritt.',
    action: 'AMP-Back-in-Stock-Block im Template product.bevi-bag aktivieren.',
    effect: 'Nachfrage wird gesammelt statt verloren; Signal für Nachbestellung.',
    impact: 4, confidence: 8, ease: 9, effortDays: 0.1,
  },
  {
    id: 'M05', timeframe: 'Quick Win', implementation: 'Content/Copy',
    title: 'Hero-CTA und Announcement-Bar schärfen',
    problem: 'CTA „Explore now“ ist unverbindlich; Preis, Rating und Rückgabe fehlen im ersten Screen. Announcement-Bar zeigt nur Versand und Bundles.',
    action: 'CTA „Shop Bevi Bag – €89“, Zeile „★ 4.8 · 3.060+ Kund:innen“ unter dem Claim; Announcement-Bar um Rückgabe und Lieferzeit ergänzen.',
    effect: 'Schnellere Orientierung für kalten Traffic, mehr Klicks in die PDP.',
    impact: 5, confidence: 5, ease: 9, effortDays: 0.25,
  },
  {
    id: 'M06', timeframe: 'Quick Win', implementation: 'Fotografie',
    title: 'Videos mobil verschlanken',
    problem: 'PDP lädt ca. 30 MB Video (6 MP4s in 1080p, bis 10,8 MB); Startseite 13,7 MB.',
    action: 'Videos als 720p, H.264 ~1,5 Mbit/s neu exportieren, Poster-Bild setzen, weniger Videos gleichzeitig; Ziel < 3 MB pro Video.',
    effect: 'Spürbar schneller mobil, besonders im Mobilfunk und in der TV-Spitze.',
    impact: 7, confidence: 7, ease: 7, effortDays: 1,
  },
  {
    id: 'M07', timeframe: 'Quick Win', implementation: 'Content/Copy',
    title: 'SEO-Hygiene: Testseite, OG-Tags, Schema',
    problem: '/pages/test indexierbar; twitter:site leer; og:price fehlt; Organization-Schema fehlt.',
    action: 'Testseite löschen/ausblenden, Social-Handle in den Theme-Einstellungen setzen; Rest mit M03 (Rich Snippets) und M12 bündeln.',
    effect: 'Sauberere Suchergebnisse und Link-Vorschauen; kein direkter Conversion-Effekt.',
    impact: 2, confidence: 8, ease: 9, effortDays: 0.25,
  },
  // Nächste 4 Wochen
  {
    id: 'M08', timeframe: 'Nächste 4 Wochen', implementation: 'Custom Section/Snippet',
    title: 'Trust-Zeilen unter dem Kaufbutton',
    problem: 'Am ATC fehlen Lieferzeit, Rückgabe und Zahlungsarten. Got Bag und Db lösen das mit 3 Icon-Zeilen.',
    action: 'Snippet mit 3–4 Zeilen: „Versand in 1–2 Werktagen“ (bzw. ehrlich je Versandart), „14 Tage Rückgabe“ (oder verlängert), „PayPal · Klarna · Apple Pay“, „BPA-frei & auslaufsicher“. Auch im Drawer statt der funktionslosen Free-Shipping-Leiste.',
    effect: 'Weniger Abbrüche aus Unsicherheit — typischer Hebel bei kaltem Ad-Traffic.',
    impact: 7, confidence: 7, ease: 7, effortDays: 1.5,
  },
  {
    id: 'M09', timeframe: 'Nächste 4 Wochen', implementation: 'Custom Section/Snippet',
    title: 'Einwand-FAQ direkt auf der Produktseite',
    problem: 'Reinigung, Dichtigkeit, Festival-Einlass, Hygiene-Rückgabe und „was passt rein“ werden nur auf /pages/faq oder verstreut beantwortet.',
    action: 'Accordion mit 6–8 Fragen direkt unter Beschreibung/Bundles; Inhalte aus FAQ und Kundenservice-Anfragen.',
    effect: 'Beantwortet Kaufzweifel dort, wo sie entstehen.',
    impact: 6, confidence: 6, ease: 7, effortDays: 1.5,
  },
  {
    id: 'M10', timeframe: 'Nächste 4 Wochen', implementation: 'Theme-Einstellung',
    title: 'Produktseite kürzen und umsortieren',
    problem: 'PDP ca. 35.000 px; Reviews an Position 7; viele Image-with-Text-Sections wiederholen sich mit der Startseite.',
    action: 'Reihenfolge: Galerie/Kauf → Trust → Reviews → 3 Kern-Benefits → Vergleich → FAQ → Rest. Doppelte Sections entfernen (Template-Änderung nur nach Freigabe).',
    effect: 'Wichtigste Kaufargumente in den ersten 5 Screens; weniger Ladegewicht.',
    impact: 6, confidence: 5, ease: 6, effortDays: 1,
    note: 'templates/*.json werden laut Theme-Regeln nicht im Repo geändert — Umsetzung im Theme-Editor.',
  },
  {
    id: 'M11', timeframe: 'Nächste 4 Wochen', implementation: 'Custom Section/Snippet',
    title: 'Vergleich: Bevi vs. Trinkflasche vs. Trinkrucksack',
    problem: 'Neues Produktkonzept ohne Einordnung gegenüber Alternativen.',
    action: 'Vergleichstabelle (Hände frei, Volumen, Kühlung, Stil, Festival-tauglich) als Custom Section.',
    effect: 'Macht den Mehrwert in Sekunden greifbar; stärkt die Preisbegründung.',
    impact: 5, confidence: 5, ease: 6, effortDays: 1.5,
  },
  {
    id: 'M12', timeframe: 'Nächste 4 Wochen', implementation: 'Theme-Einstellung',
    title: 'Tracking hinter Consent, Scripts entschlacken',
    problem: 'Clarity und 2× gtag hart in theme.liquid ohne Consent; TBT mobil 1,5–2,0 s, davon Google Tag Manager 1,26 s; doppelter Crimson-Text-Preload.',
    action: 'Tracking über Shopify Customer Privacy API / Google & YouTube-App bzw. Custom Pixels laden, gtag deduplizieren, Clarity an Consent koppeln, ungenutzte Preloads entfernen.',
    effect: 'Schnellere Interaktion mobil, geringeres DSGVO-Risiko.',
    impact: 6, confidence: 6, ease: 5, effortDays: 1.5,
    note: 'Erfordert Änderung an layout/theme.liquid — laut Theme-Regeln nur nach ausdrücklicher Freigabe.',
  },
  // Bis DHDL
  {
    id: 'M13', timeframe: 'Bis DHDL', implementation: 'App',
    title: 'Deutsche Shop-Version',
    problem: 'Shop komplett englisch, /de → 404. DHDL-Publikum ist deutschsprachig; viele Reviews sind bereits deutsch.',
    action: 'Deutsch für DE/AT/CH über Shopify Markets + Translate & Adapt; Copy redaktionell auf Deutsch schreiben, hreflang automatisch.',
    effect: 'Größter Einzelhebel für TV-Traffic; auch für Meta-Ads im DACH-Raum.',
    impact: 9, confidence: 7, ease: 4, effortDays: 5,
  },
  {
    id: 'M14', timeframe: 'Bis DHDL', implementation: 'App',
    title: 'E-Mail-Capture mit Erstbesucher-Anreiz',
    problem: 'Newsletter-Popup und Footer-Newsletter deaktiviert; keine Erfassung von Nicht-Käufer:innen.',
    action: 'Mobil-freundlicher Teaser (verzögert, kein Fullscreen) mit Gratis-Zubehör statt Rabatt + Willkommens-Flow (3 Mails) über Shopify Email oder Klaviyo.',
    effect: 'Zweite Chance für die Mehrheit, die beim ersten Besuch nicht kauft.',
    impact: 8, confidence: 7, ease: 6, effortDays: 2,
  },
  {
    id: 'M15', timeframe: 'Bis DHDL', implementation: 'Custom Section/Snippet',
    title: 'DHDL-Landingpage + „Bekannt aus“-Element (versteckt vorbereitet)',
    problem: 'TV-Traffic landet auf der 33.000-px-Startseite; kein TV-/Presse-Element.',
    action: 'Kurze Landingpage aus Custom Sections (Hero mit Gründer:innen, 3 Benefits, Reviews, FAQ, ATC) + Banner/Leiste mit Schalter, Standard aus; Seite unveröffentlicht, nichts DHDL-Bezogenes live vor Sendetag.',
    effect: 'Fokussiertes Erlebnis in der Spitze; Wiedererkennung aus der Sendung.',
    impact: 7, confidence: 6, ease: 5, effortDays: 3,
  },
  {
    id: 'M16', timeframe: 'Bis DHDL', implementation: 'Fotografie',
    title: 'Gründer-Story und Anwendungsbilder',
    problem: 'Keine Gründer-Story und keine Model-/Größenbezüge; DHDL-Zuschauer:innen kennen die Gründer:innen aus der Sendung.',
    action: 'Kurzer Gründer-Block mit Foto und Zitat; Galerie-Bildtexte „Model: x cm“; 2–3 Alltagsbilder (Stadt, Reise) neben Festival.',
    effect: 'Persönliche Glaubwürdigkeit, breitere Zielgruppe als nur Festival.',
    impact: 5, confidence: 5, ease: 6, effortDays: 2,
  },
  {
    id: 'M17', timeframe: 'Bis DHDL', implementation: 'Theme-Einstellung',
    title: 'Bestands- und Pre-Order-Logik für die Spitze',
    problem: 'Bestandsanzeige aus; kein Fallback bei Ausverkauf während der Sendung.',
    action: 'Pre-Order-Template vorbereiten, Back-in-Stock (M04) aktiv, „Nur noch wenige“ erst unter einer Schwelle anzeigen; Mengen über die DHDL-Order-Seite planen.',
    effect: 'Kein Umsatzverlust durch Ausverkauf, glaubwürdige Knappheit statt Fake-Dringlichkeit.',
    impact: 6, confidence: 6, ease: 6, effortDays: 1,
  },
  {
    id: 'M18', timeframe: 'Bis DHDL', implementation: 'Content/Copy',
    title: 'Rückgabe-Versprechen überdenken',
    problem: 'Nur gesetzliche 14 Tage, Trinkblase nach Öffnen ausgeschlossen — Hürde für Erstkäufer:innen eines neuen Produkts. Wettbewerb: Aevor 30 Tage, Db 30 Tage kostenlos, ooia 90 Tage.',
    action: 'Z. B. 30 Tage Rückgabe für ungenutzte Tasche, Ersatz-Trinkblase günstig statt Ausschluss kommunizieren; prominent am ATC.',
    effect: 'Senkt das wahrgenommene Risiko spürbar; Retourenkosten im Blick behalten.',
    impact: 6, confidence: 5, ease: 6, effortDays: 0.5,
    note: 'Geschäftsentscheidung — Retourenquote vorher aus Shopify prüfen.',
  },
]

// ─── Datenlücken ────────────────────────────────────────────────────────────

export const dataGaps: DataGap[] = [
  {
    metric: 'Session-Funnel (Sessions → Warenkorb → Checkout → Kauf) je mobil/desktop',
    status: 'Live über ShopifyQL versucht (siehe Live-Block). Feldnamen gegen den Live-Store nicht verifiziert; der Token braucht read_reports.',
    howTo: 'Shopify Analytics → Berichte → „Conversion-Funnel“ bzw. „Sitzungen nach Gerätetyp“, letzte 90 Tage, in data/website-audit.ts → manualKpis.funnel eintragen.',
  },
  {
    metric: 'Conversion Rate',
    status: 'Abhängig vom Funnel (Sessions). Ohne Sessions nicht berechenbar.',
    howTo: 'Shopify Analytics → Übersicht „Conversion-Rate der Onlineshop-Sitzungen“, 90 Tage, nach Gerät.',
  },
  {
    metric: 'Top-Landingpages und Traffic-Quellen (alle Besucher)',
    status: 'Live über ShopifyQL versucht. Die Bestell-Variante zeigt nur Käufer:innen (customerJourneySummary), nicht alle Besucher.',
    howTo: 'Shopify Analytics → „Sitzungen nach Landingpage“ und „Sitzungen nach Verweisquelle“, 90 Tage, als CSV.',
  },
  {
    metric: 'Retourenquote',
    status: 'Über die API nur als Erstattungsquote (Bestellungen mit Refund) verfügbar — enthält auch Teil-Erstattungen und Kulanz, keine echten Rücksendungen.',
    howTo: 'Shopify Analytics → „Retouren“ (Netto-Retouren / Bruttoumsatz) oder WeShip-Retourenliste; Wert in manualKpis.returnRatePct.',
  },
  {
    metric: 'INP und Felddaten (Core Web Vitals echter Nutzer)',
    status: 'Kein PageSpeed-API-Key hinterlegt; Lighthouse lokal liefert nur Labordaten (TBT als Ersatz-Indikator für INP).',
    howTo: 'PageSpeed-API-Key in den Einstellungen der Cloud-Umgebung als Network-Secret für www.googleapis.com hinterlegen (Header X-Goog-Api-Key) oder pagespeed.web.dev manuell prüfen; Shopify Admin → Onlineshop → Themes → „Web-Performance“.',
  },
  {
    metric: 'Review-Anzahl',
    status: 'Öffentlich nur der Schnitt 4.79 sichtbar; Anzahl nicht im HTML.',
    howTo: 'Judge.me-Dashboard → Gesamtzahl Reviews Bevi Bag.',
  },
  {
    metric: 'Checkout (Zahlungsarten, Fehler, Abbrüche je Schritt)',
    status: 'Nicht geprüft — keine Testbestellung in diesem Audit.',
    howTo: 'Shopify Analytics → „Checkout-Konversion“; Testbestellung mobil.',
  },
  {
    metric: 'Benchmark Johnny Urban',
    status: 'Nicht prüfbar (Domain johnny-urban.com nicht freigegeben).',
    howTo: 'Domain in der Umgebung freigeben und nachziehen, oder manuell im Workshop ansehen.',
  },
]

export function iceScore(m: Pick<Measure, 'impact' | 'confidence' | 'ease'>) {
  return Math.round(((m.impact + m.confidence + m.ease) / 3) * 10) / 10
}
