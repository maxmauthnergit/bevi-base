# Bevi Base

Internes Dashboard der Bevi Bag GmbH — Next.js 16 (App Router), Supabase,
Anbindung an Shopify, Meta Ads, WeShip und PayPal.

## Lokal starten

Doppelklick auf **`Start Bevi Base.command`** (macOS) bzw. `Start Bevi Base.bat`
(Windows). Oder im Terminal:

```bash
npm run dev
```

Mehr ist nicht nötig: der Befehl installiert fehlende Pakete, holt die
Zugangsdaten aus Vercel, prüft sie und öffnet den Browser. Änderungen erscheinen
sofort — ein Deploy in die Cloud ist dafür nicht nötig.

Einzige Voraussetzung ist Node.js 20+. Details, Login-Handhabung und
Fehlerbehebung stehen in **[docs/LOCAL_DEV.md](docs/LOCAL_DEV.md)**.

## Scripts

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Setup + Dev-Server mit Hot Reload, öffnet den Browser |
| `npm run preview` | Produktions-Build lokal testen (`next build && next start`) |
| `npm run build` | Produktions-Build erzeugen |
| `npm run lint` | ESLint |
| `npm run env:pull` | Zugangsdaten aus Vercel nach `.env.local` holen |
| `npm run check:env` | Prüft, welche Environment-Variablen fehlen |
| `npm run setup` | Bootstrap ohne Serverstart (macht `npm run dev` automatisch) |

## Struktur

```
app/            Routen (App Router) — Seiten unter /dashboard, APIs unter /api
components/     UI-Komponenten (Navigation, Charts, Karten)
lib/            Integrationen (shopify, meta, weship, paypal), Supabase-Clients,
                Parser für Bank- und WeShip-Dateien, Konfiguration
supabase/       SQL-Schema
scripts/        Bootstrap für die lokale Entwicklung
docs/           Anleitungen
```

## Hinweise

- Zugangsdaten liegen ausschließlich in `.env.local` (gitignored) bzw. in den
  Environment-Variablen des Hostings. Nie ins Repo committen.
- Lokal und Cloud sprechen standardmäßig mit **derselben** Supabase-Datenbank —
  siehe Warnhinweis in `docs/LOCAL_DEV.md`.
