# Dein Name · Linktree im Click-Wheel-Look

Eine Linktree-Seite, die aussieht wie ein silberner Click-Wheel-MP3-Player (iPod Classic,
6./7. Generation) in einem Mac-OS-X-Aqua-Fenster. Gebaut mit **Vite** und **Three.js**,
ausgeliefert als statische Seite über GitHub Pages.

Alle Inhalte (Menü, Texte, Links, Playlist, Downloads) stehen in einer einzigen Datei:
[`public/config.json`](public/config.json). Für Textänderungen ist kein Build-Wissen nötig.
Social-Bild, Cover und PDFs lesen Name, Monogramm, E-Mail und Menüpunkte ebenfalls aus dieser
Datei, müssen nach einer Namensänderung aber neu erzeugt werden, siehe
[Assets neu erzeugen](#assets-neu-erzeugen).

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

Die Datei wird zur Laufzeit geladen. Nach dem Speichern reicht ein Neuladen im Browser,
ein Neustart des Dev-Servers ist nicht nötig. Titel, Meta-Tags und die Linkliste für Besucher
ohne JavaScript schreibt der Build aus dieser Datei in `index.html`: nach Änderungen also neu
bauen (das erledigt der Deploy-Workflow bei jedem Push).

**Pfade** zu eigenen Dateien (Cover, Downloads, Rechtliches) relativ angeben, ohne `/` am Anfang,
z. B. `"downloads/media-kit.pdf"`. Sie gelten relativ zur Seite und funktionieren so auch unter
`https://<nutzer>.github.io/<repo>/`. Ein führendes `/` wird genauso behandelt. Erlaubt sind
außerdem vollständige `https://`-, `http://`-, `mailto:`- und `tel:`-Adressen; andere Adressen
(z. B. `javascript:`) und unvollständige (z. B. nur `"https://"`) werden mit einem Hinweis in der
Browser-Konsole ignoriert, die Zeile erscheint dann ohne Link (auf dem iPod und in der Linkliste
ohne JavaScript).

### `brand`

Steht für Kopfzeile, Fenstertitel und Absender.

| Feld          | Typ    | Bedeutung                                                   |
| ------------- | ------ | ----------------------------------------------------------- |
| `name`        | String | Dein Name: Menüleiste, Tab-Titel, Kopf des iPod-Hauptmenüs  |
| `monogram`    | String | Zwei Buchstaben für Icon, Cover und die Menüleiste auf schmalen Handys (dort statt des Namens), z. B. `"DN"` |
| `tagline`     | String | Einzeiler: Statuszeile unter dem iPod, Meta-Beschreibung und Text der Social-Media-Vorschau |
| `windowTitle` | String | Text in der Titelleiste des Aqua-Fensters                    |
| `email`       | String | Kontaktadresse für „Kontakt“ in der Menüleiste (ohne sie entfällt der Punkt) |

### `siteUrl`

Optional: die öffentliche Adresse der Seite, z. B. `"https://<nutzer>.github.io/<repo>/"`.
Social-Media-Vorschauen (LinkedIn, X, WhatsApp, Slack) brauchen eine absolute Bild-URL; der Build
schreibt `og:image` und `og:url` deshalb absolut, sobald er die Adresse kennt. Im
GitHub-Pages-Workflow ermittelt er sie selbst aus dem Repository
(`https://<nutzer>.github.io/<repo>/`). `siteUrl` ist also nur nötig für eine eigene Domain oder
einen anderen Host (alternativ die Umgebungsvariable `SITE_URL` beim Build). Ohne bekannte Adresse
(z. B. bei einem lokalen Build) bleibt das Vorschaubild relativ und wird von den meisten Diensten
nicht angezeigt.

### `menu[]`

Die Liste der Einträge im Hauptmenü: eine Zeile pro Eintrag, in genau dieser Reihenfolge.
Jeder Eintrag hat vier gemeinsame Felder und ein optionales fünftes:

| Feld    | Typ    | Bedeutung                                                              |
| ------- | ------ | ---------------------------------------------------------------------- |
| `id`    | String | Eindeutiger Schlüssel, intern verwendet (klein, ohne Leerzeichen)      |
| `label` | String | Beschriftung im Menü                                                    |
| `type`  | String | Bauart der Unterseite: `list`, `page`, `nowplaying` oder `downloads`   |
| `title` | String | Überschrift der Unterseite                                              |
| `lang`  | String | Optional: Sprache von `label` und `title`, wenn sie nicht Deutsch ist, z. B. `"en"` für „Work Together“ (Screenreader sprechen sie dann richtig aus) |

Je nach `type` kommen weitere Felder dazu. Zeilen (`items[]`, `actions[]`) können ebenfalls ein
`lang` haben. Fehlt einer Zeile das `label`, zeigt sie ihr `detail`, die Adresse oder den
Dateinamen; eine Zeile ganz ohne Angaben wird mit einem Hinweis in der Browser-Konsole übersprungen.

#### `type: "list"`: eine Liste von Links

| Feld             | Typ    | Bedeutung                              |
| ---------------- | ------ | -------------------------------------- |
| `items[].label`  | String | Beschriftung der Zeile                 |
| `items[].detail` | String | Zusatz rechts in der Zeile             |
| `items[].href`   | String | Ziel-URL (oder `mailto:` / `tel:`)     |

#### `type: "page"`: ein Textblock mit Schaltflächen

| Feld               | Typ    | Bedeutung                                  |
| ------------------ | ------ | ------------------------------------------ |
| `body`             | String | Fließtext der Seite                        |
| `actions[].label`  | String | Beschriftung der Schaltfläche              |
| `actions[].href`   | String | Ziel-URL der Schaltfläche                  |

#### `type: "nowplaying"`: Playlist-Ansicht

| Feld                | Typ    | Bedeutung                                               |
| ------------------- | ------ | ------------------------------------------------------- |
| `artist`            | String | Name über der Titelliste                                |
| `cover`             | String | Pfad zum Cover, z. B. `"assets/playlist-cover.svg"`     |
| `spotifyUrl`        | String | Link zur Playlist bei einem Streamingdienst (Spotify, Apple Music, YouTube Music, SoundCloud, Deezer, Tidal, Amazon Music); die Schaltfläche heißt passend „In Spotify öffnen“, „In Apple Music öffnen“ usw., bei anderen Adressen „Playlist öffnen“ |
| `tracks[].title`    | String | Titel des Stücks                                        |
| `tracks[].artist`   | String | Interpret                                               |
| `tracks[].duration` | String | Länge als Text, z. B. `"3:48"`                          |

#### `type: "downloads"`: Dateiliste

| Feld              | Typ    | Bedeutung                                               |
| ----------------- | ------ | ------------------------------------------------------- |
| `items[].label`   | String | Beschriftung des Eintrags                               |
| `items[].file`    | String | Pfad zur Datei, z. B. `"downloads/media-kit.pdf"`       |
| `items[].format`  | String | Dateiformat als Text, z. B. `"PDF"`                     |
| `items[].size`    | String | Dateigröße als Text, z. B. `"292 kB"` (1 kB = 1000 Byte) |

Die Datei am besten in `public/downloads/` ablegen. Eine Datei auf einem anderen Server (z. B.
einem Cloud-Speicher) öffnet sich in einem neuen Tab, weil Browser dort nicht direkt
herunterladen.

### `legal`

Die Links rechts in der Menüleiste (auch auf `impressum.html`, `datenschutz.html` und der
Fehlerseite `404.html`) und unter der Linkliste ohne JavaScript. In Deutschland Pflicht für
geschäftsmäßige Seiten: die beiden Platzhalter-Seiten durch eigene Texte ersetzen oder hier auf
die eigenen Seiten verweisen. Die Platzhalter tragen `<meta name="robots" content="noindex">`,
damit Suchmaschinen sie nicht aufnehmen; nach dem Ersetzen dort `index, follow` eintragen.

| Feld          | Typ    | Bedeutung                                                    |
| ------------- | ------ | ------------------------------------------------------------ |
| `impressum`   | String | Pfad oder URL des Impressums, z. B. `"impressum.html"`       |
| `datenschutz` | String | Pfad oder URL der Datenschutzerklärung, `"datenschutz.html"` |

Fehlt ein Feld, fehlt auch der Link.

### `settings`

| Feld         | Typ     | Bedeutung                                                            |
| ------------ | ------- | -------------------------------------------------------------------- |
| `clickSound` | Boolean | `true` spielt beim Navigieren ein Klickgeräusch                      |
| `intro`      | Boolean | `true` zeigt die 3D-Einstiegsanimation bei jedem Aufruf, `false` nie |

Für `intro` werden auch `"off"` und `"never"` als „aus“ verstanden. Die Animation lässt sich
jederzeit mit „Intro überspringen“, Esc oder „Links“ in der Menüleiste abbrechen; ohne WebGL
entfällt sie automatisch, auf einem zu langsamen Gerät endet sie früher. Wer sie nur in der
veröffentlichten `config.json` abschaltet, ohne neu zu bauen, spart die Animation, aber nicht den
Download ihres Skripts: dafür neu bauen.

### Beispiel

```json
{
  "siteUrl": "https://deinname.github.io/linktree/",
  "brand": {
    "name": "Dein Name",
    "monogram": "DN",
    "tagline": "Design, Code und Konzept",
    "windowTitle": "Dein Name · Linktree",
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
      "lang": "en",
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
      "cover": "assets/playlist-cover.svg",
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
        { "label": "Portfolio 2026", "file": "downloads/portfolio-2026.pdf", "format": "PDF", "size": "308 kB" },
        { "label": "Case Study: Projekt X", "file": "downloads/case-study-projekt-x.pdf", "format": "PDF", "size": "289 kB" },
        { "label": "Media Kit", "file": "downloads/media-kit.pdf", "format": "PDF", "size": "292 kB" }
      ]
    }
  ],
  "legal": {
    "impressum": "impressum.html",
    "datenschutz": "datenschutz.html"
  },
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
3. Dateigröße ermitteln: `node tools/file-sizes.mjs` gibt für jede Datei in
   `public/downloads/` die fertige Zeile zum Einfügen aus, z. B. `"size": "308 kB"`
   (1 kB = 1000 Byte, auf ganze kB gerundet; ab 1 MB z. B. `"1,2 MB"`). Bitte nicht `du`
   nehmen: es rundet auf und zeigt dann oft 1 kB mehr.

Alternativ die Platzhalter weiterverwenden und nur die Texte austauschen: Die Inhalte stehen
als HTML-Vorlagen in [`tools/make-downloads.mjs`](tools/make-downloads.mjs). Nach dem Ändern

```bash
node tools/make-downloads.mjs
```

ausführen. Das überschreibt die drei PDFs und gibt die neuen Dateigrößen schon in der Form für
`config.json` aus (`"size": "308 kB"`).

---

## Assets neu erzeugen

Alle Grafiken entstehen aus Skripten in `tools/`. Gerendert wird mit einem lokal vorhandenen
Chromium, es wird **kein** npm-Paket dafür gebraucht.

```bash
node tools/make-all.mjs        # alles auf einmal
node tools/make-icons.mjs      # favicon.svg, playlist-cover.svg, apple-touch-icon.png
node tools/make-og.mjs         # og-image.png (1200x630)
node tools/make-downloads.mjs  # die drei PDFs
```

Die Skripte suchen sich ein Chromium in dieser Reihenfolge (die Screenshot-Skripte in
`scripts/` ebenso):

1. Umgebungsvariable `CHROME_PATH`
2. Chromium von Playwright (`npx playwright install chromium`; auch unter
   `PLAYWRIGHT_BROWSERS_PATH`)
3. System-Installation von Chrome, Chromium oder Edge

Wird keines gefunden, bricht das Skript mit einem Hinweis ab. Ein anderer Pfad lässt sich
erzwingen:

```bash
CHROME_PATH="/Pfad/zu/chromium" node tools/make-all.mjs
```

Gestaltung und Farben liegen zentral in [`tools/lib/brand.mjs`](tools/lib/brand.mjs)
(Palette, gezeichnete Motive) und [`tools/lib/pdf.mjs`](tools/lib/pdf.mjs)
(Seitenlayout der PDFs).

> **Wichtig nach einer Namensänderung:** Die Skripte lesen `brand` (Name, Monogramm, E-Mail),
> den Titel der Playlist und die Menüpunkte aus `public/config.json`. Nach einer Änderung dort
> `node tools/make-all.mjs` ausführen, sonst zeigen Social-Bild, Cover und PDFs die alten
> Angaben. Die übrigen PDF-Texte stehen in [`tools/make-downloads.mjs`](tools/make-downloads.mjs).

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

> **Hinweis bei Projekt-Seiten:** `vite.config.js` nutzt `base: './'` (relative Pfade). Die Seite
> funktioniert damit ohne Anpassung sowohl unter `https://<nutzer>.github.io/<repo>/` als auch auf
> einer eigenen Domain: Config, Assets und Downloads werden relativ zur Seite geladen. Nur bei
> einer eigenen Domain für Social-Media-Vorschauen `siteUrl` in `config.json` setzen (siehe oben).

---

## Projektstruktur

Aufbau, Ablauf und Modul-Schnittstellen im Detail: [`ARCHITECTURE.md`](ARCHITECTURE.md).

```
.
├─ .github/workflows/deploy.yml  GitHub-Pages-Deployment
├─ public/                       wird unverändert ausgeliefert
│  ├─ config.json                alle Inhalte der Seite
│  ├─ impressum.html             Impressum (Platzhalter, bitte ersetzen)
│  ├─ datenschutz.html           Datenschutzerklärung (Platzhalter, bitte ersetzen)
│  ├─ 404.html                   eigene Fehlerseite für GitHub Pages
│  ├─ static.css, static.js      gemeinsamer Desktop-Look und Menüleiste dieser drei Seiten
│  ├─ favicon.svg                Player-Silhouette, auch bei 16 px lesbar
│  ├─ apple-touch-icon.png       180x180, für den Homescreen
│  ├─ og-image.png               1200x630, Social-Media-Vorschau
│  ├─ assets/
│  │  └─ playlist-cover.svg      600x600, Album-Cover der Playlist
│  └─ downloads/                 die drei Platzhalter-PDFs
├─ src/                          Anwendungscode
│  ├─ main.js                    Ablauf: Desktop, iPod, Intro, Übergabe
│  ├─ base.css                   Grundstil, Button „Intro überspringen“
│  ├─ shared/ipodSpec.js         Maße und Farben des iPods (eine Quelle für 3D und DOM)
│  ├─ shared/config.js           lädt config.json
│  ├─ shared/href.js             die Link-Regeln (iPod, Menüleiste, Linkliste ohne JavaScript)
│  ├─ shared/dom.js              DOM-Helfer h()
│  ├─ window/                    Aqua-Desktop, Menüleiste und Fenster
│  ├─ ipod/                      die iPod-Oberfläche (Click Wheel, Menüs, Now Playing)
│  └─ intro/                     3D-Intro mit Three.js (wird nachgeladen)
├─ dev/                          Testseiten für Intro, iPod und Fenster
├─ scripts/                      Screenshots per Headless-Chromium
├─ tools/                        Skripte, die alle Grafiken erzeugen
│  ├─ lib/brand.mjs              Farben, Schrift, gezeichnete Motive
│  ├─ lib/pdf.mjs                Seitenlayout der PDFs
│  ├─ lib/render.mjs             HTML → PDF/PNG via Chromium
│  ├─ make-all.mjs               erzeugt alles
│  ├─ make-icons.mjs             Icons und Playlist-Cover
│  ├─ make-og.mjs                Social-Media-Bild
│  ├─ make-downloads.mjs         die drei PDFs
│  └─ file-sizes.mjs             Dateigrößen für "size" in config.json
├─ index.html                    Einstiegspunkt
├─ vite.config.js                Build-Konfiguration (füllt Meta-Tags und <noscript> aus config.json)
├─ ARCHITECTURE.md               Architektur für Entwickler
└─ package.json
```

---

## Rechtliches zu den Grafiken

Favicon, Touch-Icon, Playlist-Cover, Social-Bild und die PDFs sind vollständig selbst
gezeichnet (SVG und HTML, reine Geometrie). Es werden keine fremden Bilder und keine Logos
verwendet. Die Player-Darstellung ist eine stilisierte Eigenzeichnung und zitiert nur die
allgemeine Formensprache von Geräten dieser Bauart. Diese Aussage gilt für die Grafiken. Im
Seitentext kommt der Produktname „iPod“ vor (Fenstertitel, Symbolname, Hinweis ohne JavaScript,
Rechtsseiten); er ist eine Marke ihres Inhabers und wird nur beschreibend verwendet. Wer das
vermeiden möchte, ändert `windowTitle` in `config.json` und die übrigen Stellen im Code.
