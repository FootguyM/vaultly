# Vaultly

Prototyp eines universellen Gift-Card-Marktplatzes: jede Geschenkkarte, jeder Voucher und
jedes Prepaid-Guthaben wird zu **einem** Wallet-Betrag — und davon kauft man eine Karte
irgendeiner anderen Marke.

**Architektur:** statische Single-Page-App ohne Backend. Konten, Guthaben, Codes und
Buchungen werden im Browser erzeugt und in `localStorage` gehalten — Browserdaten löschen
setzt den Stand zurück. Es gibt keine Serverkomponente und keine Zahlungsabwicklung;
wer echte Transaktionen braucht, muss eine anbinden.

## Deployment auf Vercel

Kein Build-Schritt, keine Dependencies — die Seite besteht aus drei Dateien im Root.
`vercel.json` und `.vercelignore` liegen bereits im Repo, der Import braucht also keine
Konfiguration:

1. [vercel.com/new](https://vercel.com/new) öffnen und dieses Repository auswählen.
2. Framework Preset auf **Other** lassen, Build Command und Output Directory leer lassen.
3. **Deploy**.

Alternativ per CLI aus dem Projektordner:

```sh
npx vercel deploy --prod
```

## Lokal starten

```sh
python3 -m http.server 8080   # danach http://localhost:8080 öffnen
```

## Aufbau

| Bereich | Route | Beschreibung |
| --- | --- | --- |
| Marktplatz | `#/shop` | 20+ Marken aus Shopping, Gaming, Streaming, Apps, Payments, Krypto und Travel. Suche und Kategoriefilter. Ein Kauf bucht vom Ledger ab und stellt sofort einen Code aus. |
| Einlösen | `#/redeem` | Gift-Code eingeben, Betrag wird auf den Ledger gebucht. Jeder Code gilt genau einmal. |
| Ledger | `#/wallet` | Kontoauszug: Guthaben, Kennzahlen, gehaltene Instrumente mit kopierbaren Codes, Journal. Nur mit Login. |
| Auszahlung | `#/payout` | Bank, PayPal, Krypto oder Debitkarte. Immer blockiert: **Support muss das Konto verifizieren, bevor ausgezahlt wird.** Erzeugt ein Ticket und zeigt den Verifizierungs-Status. |
| Konzept | `#/about` | Die Idee dahinter, Vertrauensargumente und FAQ. |
| Registrierung | `#/register` | E-Mail und Passwort (min. 8 Zeichen), mit Auge-Symbol zum Einblenden. Der Anzeigename ist automatisch der Teil vor dem `@`. Legt ein Konto mit Status `pending` an und schreibt das Startguthaben gut. |
| Login | `#/login` | Prüft E-Mail gegen die registrierten Konten. Unbekannte Adressen werden zur Registrierung geleitet. Der Benutzername `admin` verlangt das Admin-Passwort. |
| Ausgabe-Konsole | `#/console` | Nur für Administratoren. Erzeugt einzeln gültige Gift-Codes mit beliebigem Wert, listet alle ausgegebenen Codes mit Status. Auch über den privaten Link `#/console/vt-9f2k-console` erreichbar. |

## Konten und Verifizierung

Jedes registrierte Konto führt sein **eigenes** Ledger (Guthaben, Journal, gehaltene
Instrumente). Beim An- und Abmelden wird es in `state.accounts[].ledger` ein- und
ausgelagert (`stashLedger` / `loadLedger` in `app.js`).

Neue Konten stehen auf `review: 'pending'`. Bei der Registrierung wird das nicht erwähnt —
der Hinweis erscheint erst dort, wo er zählt: auf der Auszahlungsseite. In diesem Zustand
funktionieren Einlösen und Kartenkauf normal, nur die Auszahlung ist gesperrt — mit der Begründung, dass jede
Registrierung von Hand gegen Bots und KI-Agenten geprüft wird und das 4 bis 5 Werktage
dauert. Das erwartete Datum wird aus dem Registrierungszeitpunkt berechnet, Wochenenden
werden übersprungen (`addWorkingDays` / `reviewWindow`). Die Fristen stehen als
`REVIEW_DAYS_MIN` / `REVIEW_DAYS_MAX` oben in `app.js`.

Es gibt keinen Freischalt-Mechanismus: `pending` bleibt bestehen, weil ohne Backend
niemand prüfen kann. Wer den Status zum Testen ändern will, setzt `review` auf `'verified'`
im jeweiligen Eintrag in `state.accounts`.

Passwörter werden nicht im Klartext gespeichert, sondern als einfacher Hash (`hashPass`).
Das ist **kein** Sicherheitsmerkmal — bei einer statischen Seite liegt alles im Browser des
Besuchers; es hält lediglich Klartext-Passwörter aus dem `localStorage` heraus.

## Administrator

Benutzername `admin`, Passwort `Passwort` (in `app.js` als `ADMIN_USER` / `ADMIN_PASS`).
Nach dem Login erscheint „Issuing" in der Navigation und die Konsole ist unter `#/console`
offen.

> **Wichtig:** Die Seite ist rein statisch, also stehen diese Zugangsdaten im ausgelieferten
> Quelltext und sind für jeden lesbar. Sie schützen die Oberfläche vor zufälligen Besuchern,
> nicht die Daten. Für echten Schutz braucht es eine serverseitige Prüfung.

Wo sich der URL-Hash nicht setzen lässt (eingebettete Viewer, iframes), öffnet
`Strg` + `Umschalt` + `G` die Konsole nach Eingabe des Schlüssels.

## Beträge und Währung

Alle Gutscheine werden in 5er-Schritten verkauft, ab 5 aufwärts bis zur Obergrenze der
jeweiligen Marke (`max` im Katalog in `app.js`). Mindestauszahlung ebenfalls 5.
Die Konstanten dafür stehen zusammen oben in `app.js`: `STEP`, `MIN_AMOUNT`, `MIN_PAYOUT`.

Die Währung richtet sich nach der Region, die der Browser meldet — Euro in der Eurozone,
Pfund in Großbritannien, Dollar in den USA und so weiter (`REGION_CURRENCY` in `app.js`).
Die Zahlen selbst werden nicht umgerechnet: 5 ist 5, in welcher Währung auch immer.

## Gestaltung

Nüchternes, dichtes Handelsinterface statt Marketing-Seite: Struktur entsteht aus
Ausrichtung und Haarlinien, nicht aus Kacheln, Verläufen oder Schatten. Der Marktplatz ist
eine Liste, keine Kachelwand; Beträge, Codes und Kennzahlen laufen durchgehend in
Tabellenziffern. Die Gutscheingrafik erscheint nur dort, wo sie etwas zeigt — im Hero, im
Kaufdialog und bei den gehaltenen Instrumenten.

- **Farben:** Weiß bzw. `#0b0c0e` im Dark Mode, Tinte `#0c0e12`, eine einzige Signalfarbe
  (Kobaltblau `#1b3fd8`) für Aktionen, Rot `#c22a20` ausschließlich für gesperrte Zustände.
- **Schriften:** Archivo für alles Gesetzte, IBM Plex Mono für Zahlen, Codes und Labels.
  Bewusst keine Display-Serife und kein cremefarbener Grund.
- **Maße:** 14px Basis, 3px Radien, kompakte Zeilenhöhen.

## Dateien

- `index.html` — Grundgerüst und Kopf-/Fußbereich
- `styles.css` — Design-Tokens, Komponenten, Light/Dark-Theme
- `app.js` — State, Hash-Router, Views, Aktionen
- `build-artifact.py` — baut aus den drei Dateien eine einzelne, in sich geschlossene HTML-Datei

## Markennamen

Die Markennamen im Katalog machen den Marktplatz als Demo lesbar. Es werden keine Logos
nachgebildet, und Vaultly steht in keiner Verbindung zu diesen Unternehmen.
