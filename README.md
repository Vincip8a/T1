# Dein Name — Linktree im Click-Wheel-Look

Eine Linktree-Seite, die aussieht wie ein silberner Click-Wheel-MP3-Player (iPod Classic,
6./7. Generation) in einem Mac-OS-X-Aqua-Fenster. Gebaut mit **Vite** und **Three.js**,
ausgeliefert als statische Seite über GitHub Pages.

Alle Inhalte — Menü, Texte, Links, Playlist, Downloads — stehen in einer einzigen Datei:
[`public/config.json`](public/config.json). Für Textänderungen ist kein Build-Wissen nötig.

Sämtliche Grafiken (Favicon, Playlist-Cover, Social-Bild, PDFs) sind selbst gezeichnet und
werden reproduzierbar aus Skripten in [`tools/`](tools/) erzeugt.

---

## Schnellstart

```bash
npm install     # Abhängigkeiten installieren
npm run dev     # Entwicklungsserver starten (URL steht im Terminal)
npm run build   # Produktions-Build nach dist/
npm run preview # Build lokal gegenprüfen
```

Benötigt **Node 22** oder neuer.

---

## Inhalte ändern: `public/config.json`

Die Datei wird zur Laufzeit geladen. Nach dem Speichern reicht ein Neuladen im Browser —
kein Neustart des Dev-Servers nötig.

### `brand`

Steht für Kopfzeile, Fenstertitel und Absender.

| Feld          | Typ    | Bedeutung                                                   |
| ------------- | ------ | ----------------------------------------------------------- |
| `name`        | String | Dein Name, erscheint prominent auf der Seite                 |
| `monogram`    | String | Zwei Buchstaben für Icon und Cover, z. B. `"DN"`             |
| `tagline`     | String | Einzeiler unter dem Namen                                    |
| `windowTitle` | String | Text in der Titelleiste des Aqua-Fensters                    |
| `email`       | String | Kontaktadresse, wird für `mailto:`-Links verwendet           |

### `menu[]`

Die Liste der Einträge im Hauptmenü — eine Zeile pro Eintrag, in genau dieser Reihenfolge.
Jeder Eintrag hat vier gemeinsame Felder:

| Feld    | Typ    | Bedeutung                                                              |
| ------- | ------ | ---------------------------------------------------------------------- |
| `id`    | String | Eindeutiger Schlüssel, intern verwendet (klein, ohne Leerzeichen)      |
| `label` | String | Beschriftung im Menü                                                    |
| `type`  | String | Bauart der Unterseite: `list`, `page`, `nowplaying` oder `downloads`   |
| `title` | String | Überschrift der Unterseite                                              |

Je nach `type` kommen weitere Felder dazu:

#### `type: "list"` — eine Liste von Links

| Feld             | Typ    | Bedeutung                              |
| ---------------- | ------ | -------------------------------------- |
| `items[].label`  | String | Beschriftung der Zeile                 |
| `items[].detail` | String | Zusatz rechts in der Zeile             |
| `items[].href`   | String | Ziel-URL (oder `mailto:` / `tel:`)     |

#### `type: "page"` — ein Textblock mit Schaltflächen

| Feld               | Typ    | Bedeutung                                  |
| ------------------ | ------ | ------------------------------------------ |
| `body`             | String | Fließtext der Seite                        |
| `actions[].label`  | String | Beschriftung der Schaltfläche              |
| `actions[].href`   | String | Ziel-URL der Schaltfläche                  |

#### `type: "nowplaying"` — Playlist-Ansicht

| Feld                | Typ    | Bedeutung                                               |
| ------------------- | ------ | ------------------------------------------------------- |
| `artist`            | String | Name über der Titelliste                                |
| `cover`             | String | Pfad zum Cover, z. B. `"/assets/playlist-cover.svg"`    |
| `spotifyUrl`        | String | Link zur Playlist beim Streamingdienst                  |
| `tracks[].title`    | String | Titel des Stücks                                        |
| `tracks[].artist`   | String | Interpret                                               |
| `tracks[].duration` | String | Länge als Text, z. B. `"3:48"`                          |

#### `type: "downloads"` — Dateiliste

| Feld              | Typ    | Bedeutung                                               |
| ----------------- | ------ | ------------------------------------------------------- |
| `items[].label`   | String | Beschriftung des Eintrags                               |
| `items[].file`    | String | Pfad zur Datei, z. B. `"/downloads/media-kit.pdf"`      |
| `items[].format`  | String | Dateiformat als Text, z. B. `"PDF"`                     |
| `items[].size`    | String | Dateigröße als Text, z. B. `"387 kB"`                   |

### `settings`

| Feld         | Typ     | Bedeutung                                                      |
| ------------ | ------- | -------------------------------------------------------------- |
| `clickSound` | Boolean | `true` spielt beim Navigieren ein Klickgeräusch                |
| `intro`      | Boolean | `true` zeigt die Einstiegsanimation beim ersten Aufruf         |

### Beispiel

```json
{
  "brand": {
    "name": "Dein Name",
    "monogram": "DN",
    "tagline": "Design, Code und Konzept",
    "windowTitle": "Dein Name — Linktree",
    "email": "dein.name@example.com"
  },
  "menu": [
    {
      "id": "kontakt",
      "label": "Kontakt",
      "type": "list",
      "title": "Kontakt",
      "items": [
        { "label": "E-Mail", "detail": "dein.name@example.com", "href": "mailto:dein.name@example.com" },
        { "label": "LinkedIn", "detail": "@deinname", "href": "https://www.linkedin.com/in/deinname" }
      ]
    },
    {
      "id": "work-together",
      "label": "Work Together",
      "type": "page",
      "title": "Zusammenarbeiten",
      "body": "Kurz beschreiben, woran du arbeitest und wofür dich Leute anfragen können.",
      "actions": [
        { "label": "Projekt anfragen", "href": "mailto:dein.name@example.com" }
      ]
    },
    {
      "id": "playlist",
      "label": "Playlist",
      "type": "nowplaying",
      "title": "Meine Playlist",
      "artist": "Dein Name",
      "cover": "/assets/playlist-cover.svg",
      "spotifyUrl": "https://open.spotify.com/",
      "tracks": [
        { "title": "Titel eins", "artist": "Interpret eins", "duration": "3:48" },
        { "title": "Titel zwei", "artist": "Interpret zwei", "duration": "4:12" }
      ]
    },
    {
      "id": "downloads",
      "label": "Downloads",
      "type": "downloads",
      "title": "Downloads",
      "items": [
        { "label": "Portfolio 2026", "file": "/downloads/portfolio-2026.pdf", "format": "PDF", "size": "440 kB" },
        { "label": "Case Study: Projekt X", "file": "/downloads/case-study-projekt-x.pdf", "format": "PDF", "size": "387 kB" },
        { "label": "Media Kit", "file": "/downloads/media-kit.pdf", "format": "PDF", "size": "387 kB" }
      ]
    }
  ],
  "settings": {
    "clickSound": true,
    "intro": true
  }
}
```

---

## PDFs ersetzen

Die drei mitgelieferten PDFs in `public/downloads/` sind **gestaltete Platzhalter**. Inhalte,
Zahlen und Kontaktdaten darin sind frei erfunden und als Platzhalter gekennzeichnet.

So ersetzt du sie durch eigene:

1. Eigenes PDF nach `public/downloads/` legen.
2. In `public/config.json` im `downloads`-Eintrag `file`, `label`, `format` und `size`
   auf die neue Datei anpassen.
3. Dateigröße ermitteln: `ls -lh public/downloads/`

Alternativ die Platzhalter weiterverwenden und nur die Texte austauschen: Die Inhalte stehen
als HTML-Vorlagen in [`tools/make-downloads.mjs`](tools/make-downloads.mjs). Nach dem Ändern

```bash
node tools/make-downloads.mjs
```

ausführen — das überschreibt die drei PDFs und gibt die neuen Dateigrößen aus.

---

## Assets neu erzeugen

Alle Grafiken entstehen aus Skripten in `tools/`. Gerendert wird mit einem lokal vorhandenen
Chromium — es wird **kein** npm-Paket dafür gebraucht.

```bash
node tools/make-all.mjs        # alles auf einmal
node tools/make-icons.mjs      # favicon.svg, playlist-cover.svg, apple-touch-icon.png
node tools/make-og.mjs         # og-image.png (1200x630)
node tools/make-downloads.mjs  # die drei PDFs
```

Die Skripte suchen sich ein Chromium in dieser Reihenfolge:

1. Umgebungsvariable `CHROME_PATH`
2. Chromium von Playwright (`npx playwright install chromium`)
3. System-Installation von Chrome, Chromium oder Edge

Wird keines gefunden, bricht das Skript mit einem Hinweis ab. Ein anderer Pfad lässt sich
erzwingen:

```bash
CHROME_PATH="/Pfad/zu/chromium" node tools/make-all.mjs
```

Gestaltung und Farben liegen zentral in [`tools/lib/brand.mjs`](tools/lib/brand.mjs)
(Palette, Monogramm, gezeichnete Motive) und [`tools/lib/pdf.mjs`](tools/lib/pdf.mjs)
(Seitenlayout der PDFs).

---

## Deployment auf GitHub Pages

Der Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) baut das Projekt
und veröffentlicht `dist/`. Er läuft bei jedem Push auf `main` und lässt sich zusätzlich von
Hand starten (Actions → *Deploy to GitHub Pages* → *Run workflow*).

Einmalig einzurichten:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions** auswählen.
2. Auf `main` pushen (oder den Workflow von Hand starten).
3. Die Adresse der Seite steht danach unter Settings → Pages und in der Ausgabe des Workflows.

Der Workflow verwendet Node 22, installiert mit `npm ci` und baut mit `npm run build`. Die
nötigen Rechte (`pages: write`, `id-token: write`) sind darin bereits gesetzt.

> **Hinweis bei Projekt-Seiten:** Liegt die Seite unter `https://<nutzer>.github.io/<repo>/`
> statt auf einer eigenen Domain, muss in `vite.config.js` `base: '/<repo>/'` gesetzt sein,
> sonst laufen Pfade zu Assets und Downloads ins Leere.

---

## Projektstruktur

```
.
├─ .github/workflows/deploy.yml  GitHub-Pages-Deployment
├─ public/                       wird unverändert ausgeliefert
│  ├─ config.json                alle Inhalte der Seite
│  ├─ favicon.svg                Player-Silhouette, auch bei 16 px lesbar
│  ├─ apple-touch-icon.png       180x180, für den Homescreen
│  ├─ og-image.png               1200x630, Social-Media-Vorschau
│  ├─ assets/
│  │  └─ playlist-cover.svg      600x600, Album-Cover der Playlist
│  └─ downloads/                 die drei Platzhalter-PDFs
├─ src/                          Anwendungscode (Vite + Three.js)
├─ tools/                        Skripte, die alle Grafiken erzeugen
│  ├─ lib/brand.mjs              Farben, Schrift, gezeichnete Motive
│  ├─ lib/pdf.mjs                Seitenlayout der PDFs
│  ├─ lib/render.mjs             HTML → PDF/PNG via Chromium
│  ├─ make-all.mjs               erzeugt alles
│  ├─ make-icons.mjs             Icons und Playlist-Cover
│  ├─ make-og.mjs                Social-Media-Bild
│  └─ make-downloads.mjs         die drei PDFs
├─ index.html                    Einstiegspunkt
├─ vite.config.js                Build-Konfiguration
└─ package.json
```

---

## Rechtliches zu den Grafiken

Favicon, Touch-Icon, Playlist-Cover, Social-Bild und die PDFs sind vollständig selbst
gezeichnet (SVG und HTML, reine Geometrie). Es werden keine fremden Bilder, keine Logos und
keine geschützten Marken verwendet. Die Player-Darstellung ist eine stilisierte Eigenzeichnung
und zitiert nur die allgemeine Formensprache von Geräten dieser Bauart.
