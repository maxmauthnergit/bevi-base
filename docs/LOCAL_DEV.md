# Bevi Base lokal laufen lassen

Ziel: Änderungen sofort im Browser sehen, ohne vorher in die Cloud zu deployen.
Der lokale Server läuft auf deinem Rechner unter `http://localhost:3000` und lädt
jede Änderung automatisch neu (Hot Reload, meist unter einer Sekunde).

---

## Einmalig einrichten

### 1. Voraussetzungen

Node.js 20 oder neuer (empfohlen: 22). Prüfen mit:

```bash
node -v
```

Falls nicht installiert: von [nodejs.org](https://nodejs.org) die LTS-Version holen.

### 2. Projekt holen und Pakete installieren

```bash
git clone https://github.com/maxmauthnergit/bevi-base.git
cd bevi-base
npm install
```

### 3. Zugangsdaten anlegen (`.env.local`)

Die App braucht dieselben Environment-Variablen wie in der Cloud. Zwei Wege:

**Weg A — aus Vercel ziehen (empfohlen, dauert 30 Sekunden):**

```bash
npx vercel link          # einmalig: Ordner mit dem Vercel-Projekt verbinden
npx vercel env pull .env.local
```

Das schreibt alle Production-Variablen in `.env.local`.

**Weg B — von Hand:**

```bash
cp .env.example .env.local
```

Dann `.env.local` öffnen und die Werte eintragen. In `.env.example` steht bei
jeder Variable, wo du sie findest (Supabase-Dashboard, Shopify-Admin, usw.).

> `.env.local` ist in `.gitignore` — die Datei landet nie im Repo. Genau so soll es sein.

Kontrolle, ob alles da ist:

```bash
npm run check:env
```

### 4. Login lokal erlauben (Supabase)

Damit der Google-Login auch von `localhost` funktioniert, muss die lokale
Adresse in Supabase freigeschaltet sein:

Supabase Dashboard → **Authentication** → **URL Configuration** → unter
**Redirect URLs** eintragen:

```
http://localhost:3000/**
```

Das ist eine einmalige Einstellung und ändert nichts an der Produktion.

**Alternative, wenn du dich lokal gar nicht einloggen willst:** in `.env.local`

```
DEV_AUTH_BYPASS=true
```

setzen. Dann überspringt `npm run dev` den Login und `/dashboard` ist direkt
offen. Das greift ausschließlich im Dev-Modus — in einem `next build` ist
`NODE_ENV=production`, damit ist der Bypass dort technisch abgeschaltet und kann
nicht versehentlich live gehen.

---

## Täglich: entwickeln

```bash
npm run dev
```

Dann `http://localhost:3000` im Browser öffnen. Vor dem Start läuft automatisch
der Env-Check und sagt dir, falls etwas fehlt.

Jede gespeicherte Datei erscheint sofort im Browser. Fehler zeigt Next.js als
Overlay direkt auf der Seite an, mit Verweis auf Datei und Zeile.

Nützliche Varianten:

```bash
npm run dev -- -p 3001      # anderer Port, falls 3000 belegt ist
npm run dev -- -H 0.0.0.0   # vom Handy im gleichen WLAN erreichbar
```

Für den Handy-Test: mit `-H 0.0.0.0` starten und am Handy
`http://<deine-lokale-IP>:3000` aufrufen (IP unter macOS: `ipconfig getifaddr en0`).

---

## Vor dem Deploy: Produktions-Build lokal testen

`npm run dev` ist schnell, aber nicht identisch mit der Cloud. Bevor du deployst,
lohnt sich der echte Build — der findet TypeScript-Fehler und Build-Probleme, die
im Dev-Modus durchrutschen:

```bash
npm run preview
```

Das ist `next build && next start` und serviert die App unter
`http://localhost:3000` genau so, wie sie in der Cloud läuft (kein Hot Reload,
kein Auth-Bypass). Läuft das durch, läuft auch das Deploy durch.

Zusätzlich vor jedem Push:

```bash
npm run lint
```

---

## Wichtig zu wissen

**Die Datenbank ist dieselbe.** Lokal verbindest du dich mit demselben Supabase-
Projekt wie die Cloud-Version. Was du lokal löschst oder hochlädst, ist auch in
der Produktion gelöscht bzw. hochgeladen. Für risikoreiche Tests (Uploads,
Löschungen) lieber ein zweites Supabase-Projekt anlegen und dessen URL + Keys in
`.env.local` eintragen — die Cloud bleibt davon unberührt.

**Fehlende Integrationen sind kein Problem.** Ohne Shopify-, Meta-, WeShip- oder
PayPal-Zugangsdaten startet die App trotzdem; nur die jeweiligen Seiten zeigen
beim Laden einen Fehler. Du kannst also mit dem Minimum (nur Supabase) anfangen.

---

## Wenn etwas nicht geht

| Symptom | Ursache / Lösung |
| --- | --- |
| `✗ No .env.local found` | Schritt 3 nachholen. |
| `✗ .env.local is missing values…` | Die genannten Supabase-Variablen in `.env.local` eintragen. |
| Login leitet zurück auf `/login` | Redirect-URL in Supabase fehlt → Schritt 4. |
| `Port 3000 is already in use` | `npm run dev -- -p 3001` |
| Seite zeigt „Missing … credentials" | Zugangsdaten dieser Integration fehlen in `.env.local` — normal, wenn du sie nicht gesetzt hast. |
| Nach `git pull` seltsame Fehler | `npm install` (neue Pakete), notfalls `rm -rf .next` und neu starten. |
| Änderung erscheint nicht im Browser | Hard Reload (Cmd+Shift+R). Hilft das nicht: Dev-Server stoppen, `rm -rf .next`, `npm run dev`. |
