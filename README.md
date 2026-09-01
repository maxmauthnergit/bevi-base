# Bevi Base

Internes Dashboard der Bevi Bag GmbH — Next.js 16 (App Router), Supabase,
Anbindung an Shopify, Meta Ads, WeShip und PayPal.

## Lokal starten

```bash
npm install
cp .env.example .env.local   # Werte eintragen, siehe docs/LOCAL_DEV.md
npm run dev
```

Dann `http://localhost:3000` öffnen. Änderungen erscheinen sofort im Browser —
ein Deploy in die Cloud ist dafür nicht nötig.

Die vollständige Anleitung inklusive Zugangsdaten, Login auf localhost und
Fehlerbehebung steht in **[docs/LOCAL_DEV.md](docs/LOCAL_DEV.md)**.

## Scripts

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Dev-Server mit Hot Reload auf Port 3000 |
| `npm run preview` | Produktions-Build lokal testen (`next build && next start`) |
| `npm run build` | Produktions-Build erzeugen |
| `npm run lint` | ESLint |
| `npm run check:env` | Prüft, welche Environment-Variablen fehlen |

## Struktur

```
app/            Routen (App Router) — Seiten unter /dashboard, APIs unter /api
components/     UI-Komponenten (Navigation, Charts, Karten)
lib/            Integrationen (shopify, meta, weship, paypal), Supabase-Clients,
                Parser für Bank- und WeShip-Dateien, Konfiguration
supabase/       SQL-Schema
docs/           Anleitungen
```

## Hinweise

- Zugangsdaten liegen ausschließlich in `.env.local` (gitignored) bzw. in den
  Environment-Variablen des Hostings. Nie ins Repo committen.
- Lokal und Cloud sprechen standardmäßig mit **derselben** Supabase-Datenbank —
  siehe Warnhinweis in `docs/LOCAL_DEV.md`.
