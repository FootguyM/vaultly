# Vaultly

Prototyp eines universellen Gift-Card-Marktplatzes: jede Geschenkkarte, jeder Voucher und
jedes Prepaid-Guthaben wird zu **einem** Wallet-Betrag — und davon kauft man eine Karte
irgendeiner anderen Marke.

**Reines Frontend.** Kein Backend, keine Zahlungsabwicklung, keine echten Gutscheincodes.
Konten, Guthaben, Codes und Transaktionen entstehen im Browser und liegen in
`localStorage`. Browserdaten löschen setzt die Demo zurück.

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
| Login | `#/login` | Demo-Login: jede E-Mail funktioniert, das Konto entsteht sofort. |
| Ausgabe-Konsole | `#/console/vt-9f2k-console` | **Privater Link.** Erzeugt einzeln gültige Gift-Codes mit beliebigem Wert, listet alle ausgegebenen Codes mit Status und setzt die Demo zurück. |

Die Konsole ist eine Client-Route — bequem für die Demo, aber keine echte Zugriffskontrolle.
Wo sich der URL-Hash nicht setzen lässt (eingebettete Viewer, iframes), öffnet
`Strg` + `Umschalt` + `G` dieselbe Konsole nach Eingabe des Schlüssels.

## Gestaltung

Der Stil zitiert gedruckte Wertdokumente — Tickets, Vouchers, Banknoten —, weil eine
Geschenkkarte genau das ist: ein Inhaberpapier. Umgesetzt mit Haarlinien statt Schatten,
3px-Radien statt weicher Ecken, Guilloche-Gravur auf den Gutscheinen, Seriennummern in
Tabellenziffern und einem aufgedrückten Stempel für gesperrte Auszahlungen.

- **Farben:** Papier `#f2f3ef`, Tinte `#171c18`, Tiefdruck-Grün `#1f5c3d`, Stempel-Oxblood
  `#a32e22`, Messing `#836829`. Neutraltöne mit Grünstich.
- **Schriften:** Instrument Serif (Headlines), Archivo (Interface), IBM Plex Mono
  (Seriennummern, Beträge, Kennzahlen).

## Dateien

- `index.html` — Grundgerüst und Kopf-/Fußbereich
- `styles.css` — Design-Tokens, Komponenten, Light/Dark-Theme
- `app.js` — State, Hash-Router, Views, Aktionen
- `build-artifact.py` — baut aus den drei Dateien eine einzelne, in sich geschlossene HTML-Datei

## Markennamen

Die Markennamen im Katalog machen den Marktplatz als Demo lesbar. Es werden keine Logos
nachgebildet, und Vaultly steht in keiner Verbindung zu diesen Unternehmen.
