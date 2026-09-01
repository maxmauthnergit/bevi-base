# Bevi Base lokal laufen lassen

Ziel: Änderungen sofort im Browser sehen, ohne vorher in die Cloud zu deployen.
Der Server läuft auf deinem Rechner unter `http://localhost:3000` und lädt jede
Änderung automatisch neu.

---

## Start

**Doppelklick auf `Start Bevi Base.command`** (macOS) bzw. `Start Bevi Base.bat`
(Windows) im Projektordner.

Oder im Terminal:

```bash
npm run dev
```

Das ist alles. Der Befehl kümmert sich selbst um den Rest:

| | |
| --- | --- |
| Pakete fehlen oder sind veraltet | installiert sie nach |
| keine Zugangsdaten vorhanden | holt sie aus Vercel (Login-Fenster beim ersten Mal) |
| Vercel nicht erreichbar | legt `.env.local` aus der Vorlage an und sagt, was fehlt |
| Login würde stören | schaltet ihn lokal ab (siehe unten) |
| Server läuft | öffnet den Browser auf der richtigen Adresse |

Beim allerersten Start dauert das ein bis zwei Minuten (Installation), danach
wenige Sekunden. Zum Beenden: Fenster schließen oder `Strg+C`.

### Voraussetzung

Node.js 20 oder neuer — einmalig von [nodejs.org](https://nodejs.org) installieren
(LTS-Version). Ob es da ist, sagt dir `node -v`; fehlt es, meldet sich der Start
mit einem entsprechenden Hinweis.

---

## Der Login

Standardmäßig überspringt der lokale Server den Google-Login, damit du sofort
loslegen kannst. Dafür schreibt das Setup beim ersten Start diese Zeile in
`.env.local`:

```
DEV_AUTH_BYPASS=true
```

Die Flag wirkt ausschließlich im Dev-Modus. In einem `next build` ist
`NODE_ENV=production`, damit ist sie technisch abgeschaltet und kann nicht
versehentlich live gehen.

**Wenn du den echten Login lokal testen willst:** Zeile aus `.env.local`
löschen und im Supabase-Dashboard unter **Authentication → URL Configuration →
Redirect URLs** einmalig `http://localhost:3000/**` eintragen. Das ändert nichts
an der Produktion.

---

## Zugangsdaten

Alle Werte liegen in `.env.local` — die Datei ist gitignored und verlässt deinen
Rechner nicht. Normalerweise musst du sie nie anfassen.

Wenn sich in Vercel etwas geändert hat, holst du den aktuellen Stand mit:

```bash
npm run env:pull
```

Ohne Vercel: `.env.local` von Hand ausfüllen. In `.env.example` steht bei jeder
Variable, wo du sie findest. Was gerade fehlt, zeigt:

```bash
npm run check:env
```

Ohne Shopify-, Meta-, WeShip- oder PayPal-Zugangsdaten startet die App trotzdem —
nur die jeweiligen Seiten zeigen beim Laden einen Fehler. Du kannst also mit dem
Minimum (nur Supabase) anfangen.

---

## Vor dem Deploy

`npm run dev` ist schnell, aber nicht identisch mit der Cloud. Der echte Build
findet TypeScript- und Build-Fehler, die im Dev-Modus durchrutschen:

```bash
npm run preview
```

Das ist `next build && next start` und serviert die App unter
`http://localhost:3000` genau so, wie sie in der Cloud läuft — ohne Hot Reload
und ohne Login-Bypass. Läuft das durch, läuft auch das Deploy durch.

Dazu noch `npm run lint`.

---

## Wichtig zu wissen

**Die Datenbank ist dieselbe.** Lokal hängst du am selben Supabase-Projekt wie
die Cloud-Version. Was du lokal löschst oder hochlädst, ist auch in der
Produktion gelöscht bzw. hochgeladen. Für riskante Tests (Uploads, Löschungen)
lieber ein zweites Supabase-Projekt anlegen und dessen URL + Keys in
`.env.local` eintragen — die Cloud bleibt davon unberührt.

---

## Wenn etwas nicht geht

| Symptom | Lösung |
| --- | --- |
| `Node.js … is too old` | Node 20+ von [nodejs.org](https://nodejs.org) installieren. |
| `Could not reach Vercel` | Einmal `npm run env:pull` von Hand ausführen, oder `.env.local` selbst ausfüllen. |
| `.env.local is missing values…` | Die genannten Supabase-Werte eintragen. |
| Login leitet zurück auf `/login` | `DEV_AUTH_BYPASS=true` in `.env.local` fehlt, oder die Redirect-URL in Supabase ist nicht eingetragen. |
| `Port 3000 is in use` | Kein Problem — Next.js nimmt automatisch 3001, der Browser öffnet die richtige Adresse. |
| Seite meldet „Missing … credentials" | Zugangsdaten dieser Integration fehlen in `.env.local` — normal, wenn du sie nicht gesetzt hast. |
| Browser öffnet sich nicht | Adresse aus der Terminal-Ausgabe selbst aufrufen. `NO_OPEN=1 npm run dev` schaltet das Öffnen dauerhaft ab. |
| Änderung erscheint nicht | Hard Reload (Cmd+Shift+R). Hilft das nicht: Server stoppen, `rm -rf .next`, neu starten. |
