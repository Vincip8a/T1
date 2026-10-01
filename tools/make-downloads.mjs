#!/usr/bin/env node
// Erzeugt die drei Platzhalter-PDFs in public/downloads/ aus HTML-Vorlagen.
// Gerendert wird mit einem lokal vorhandenen Chromium (siehe tools/lib/render.mjs).
//
// Aufruf:  node tools/make-downloads.mjs
//
// Alle Inhalte sind erfunden und als Platzhalter gekennzeichnet. Zum Ersetzen
// eigene PDFs in public/downloads/ ablegen und public/config.json anpassen.

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { brand } from './lib/brand.mjs'
import {
  bullets,
  cover,
  divider,
  buildDocument,
  kv,
  lead,
  note,
  page,
  stats,
  steps,
  cards,
} from './lib/pdf.mjs'
import { formatSize, htmlToPdf } from './lib/render.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/downloads')

const PLACEHOLDER_HINT =
  'Dieses Dokument ist ein gestalteter Platzhalter. Alle Projekte, Zahlen und ' +
  'Kontaktdaten sind frei erfunden. Ersetze die Datei in <b>public/downloads/</b> ' +
  'durch dein echtes PDF und passe den Eintrag in <b>public/config.json</b> an.'

/* ------------------------------------------------------------------ */
/* Portfolio                                                           */
/* ------------------------------------------------------------------ */

const projects = [
  {
    eyebrow: 'Beispielprojekt 01',
    title: 'Projekt Alpha — Website-Relaunch',
    lead:
      'Ein erfundenes Beispielprojekt, das zeigt, wie eine Projektseite in diesem ' +
      'Portfolio aufgebaut ist: kurze Einordnung, Rahmendaten, Ergebnis, Details.',
    facts: [
      { term: 'Rolle', value: 'Konzept, Design, Umsetzung' },
      { term: 'Zeitraum', value: 'Platzhalter · 4 Monate' },
      { term: 'Leistungen', value: 'UX, Interface, Frontend' },
      { term: 'Team', value: '3 Personen (Platzhalter)' },
    ],
    numbers: [
      { value: '1.234', label: 'Platzhalter-Kennzahl eins' },
      { value: '+00 %', label: 'Platzhalter-Kennzahl zwei' },
      { value: '0,0 s', label: 'Platzhalter-Kennzahl drei' },
    ],
    points: [
      'Informationsarchitektur neu sortiert und auf vier Hauptbereiche reduziert.',
      'Gestaltungssystem mit Farb-, Typo- und Komponenten-Tokens aufgebaut.',
      'Umsetzung als statische Seite, Inhalte über eine Konfigurationsdatei pflegbar.',
    ],
  },
  {
    eyebrow: 'Beispielprojekt 02',
    title: 'Projekt Beta — Markenauftritt',
    lead:
      'Zweites Beispielprojekt. Der Aufbau bleibt gleich, damit sich die Seiten ' +
      'beim Durchblättern ruhig lesen und Inhalte leicht austauschbar sind.',
    facts: [
      { term: 'Rolle', value: 'Art Direction' },
      { term: 'Zeitraum', value: 'Platzhalter · 6 Wochen' },
      { term: 'Leistungen', value: 'Logo, Farbwelt, Typografie' },
      { term: 'Team', value: '2 Personen (Platzhalter)' },
    ],
    numbers: [
      { value: '12', label: 'Platzhalter-Kennzahl eins' },
      { value: '3', label: 'Platzhalter-Kennzahl zwei' },
      { value: '00 %', label: 'Platzhalter-Kennzahl drei' },
    ],
    points: [
      'Wortmarke, Monogramm und eine zurückhaltende Sekundärpalette entwickelt.',
      'Anwendungsbeispiele für Web, Print und Social als Vorlagen angelegt.',
      'Kurzes Styleguide-PDF mit Abständen, Schriftgrößen und Do/Don’t-Regeln.',
    ],
  },
  {
    eyebrow: 'Beispielprojekt 03',
    title: 'Projekt Gamma — Produkt-App',
    lead:
      'Drittes Beispielprojekt mit Schwerpunkt auf Interaktion und Prototyping. ' +
      'Auch hier gilt: alle Angaben sind Platzhalter.',
    facts: [
      { term: 'Rolle', value: 'Produktdesign, Prototyping' },
      { term: 'Zeitraum', value: 'Platzhalter · 5 Monate' },
      { term: 'Leistungen', value: 'Research, UI, Designsystem' },
      { term: 'Team', value: '6 Personen (Platzhalter)' },
    ],
    numbers: [
      { value: '0.000', label: 'Platzhalter-Kennzahl eins' },
      { value: '4,9', label: 'Platzhalter-Kennzahl zwei' },
      { value: '00 %', label: 'Platzhalter-Kennzahl drei' },
    ],
    points: [
      'Nutzerinterviews ausgewertet und in drei konkrete Aufgaben übersetzt.',
      'Klickbarer Prototyp für die wichtigsten zwei Abläufe gebaut und getestet.',
      'Komponentenbibliothek an die Entwicklung übergeben und dokumentiert.',
    ],
  },
]

const portfolio = buildDocument({
  title: 'Portfolio 2026 — Platzhalter',
  sections: [
    cover({
      kicker: 'Portfolio',
      title: 'Portfolio<br>2026',
      subtitle: 'Ausgewählte Arbeiten aus Design, Code und Konzept — als Platzhalter angelegt.',
      meta: ['Ausgabe 2026 · Version 0.1', 'dein.name@example.com', 'Alle Inhalte sind Beispieldaten'],
    }),
    ...projects.map((project) =>
      page({
        windowTitle: 'Portfolio 2026',
        eyebrow: project.eyebrow,
        title: project.title,
        body: [
          lead(project.lead),
          divider(),
          kv(project.facts),
          divider(),
          stats(project.numbers),
          divider(),
          bullets(project.points),
        ].join(''),
      }),
    ),
    page({
      windowTitle: 'Portfolio 2026',
      eyebrow: 'Kontakt',
      title: 'Lass uns zusammenarbeiten',
      body: [
        lead(
          'Die Kontaktseite schließt das Portfolio ab. Trage hier deine echten Daten ein — ' +
            'am einfachsten direkt in der HTML-Vorlage in <b>tools/make-downloads.mjs</b>.',
        ),
        divider(),
        kv([
          { term: 'E-Mail', value: 'dein.name@example.com' },
          { term: 'Website', value: 'example.com' },
          { term: 'Standort', value: 'Platzhalter-Stadt' },
          { term: 'Verfügbarkeit', value: 'Auf Anfrage' },
        ]),
        divider(),
        bullets([
          'Projektanfragen gern mit kurzer Beschreibung, Zeitraum und Budgetrahmen.',
          'Antwort in der Regel innerhalb von zwei Werktagen (Platzhalter).',
          'Weitere Arbeitsproben und Referenzen auf Anfrage.',
        ]),
        note(PLACEHOLDER_HINT),
      ].join(''),
    }),
  ],
})

/* ------------------------------------------------------------------ */
/* Case Study                                                          */
/* ------------------------------------------------------------------ */

const caseStudy = buildDocument({
  title: 'Case Study: Projekt X — Platzhalter',
  sections: [
    cover({
      kicker: 'Case Study',
      title: 'Projekt X',
      subtitle: 'Von der Ausgangslage über den Prozess zum Ergebnis — ein Beispiel-Fallbericht.',
      meta: ['Fallstudie · Version 0.1', 'Zeitraum: Platzhalter', 'Alle Zahlen sind Beispieldaten'],
    }),
    page({
      windowTitle: 'Case Study · Projekt X',
      eyebrow: 'Kapitel 01',
      title: 'Challenge',
      body: [
        lead(
          'Projekt X steht stellvertretend für eine typische Ausgangslage: viel gewachsener ' +
            'Inhalt, unklare Prioritäten und ein Auftritt, der nicht mehr zur eigentlichen Arbeit passt.',
        ),
        divider(),
        bullets([
          'Die Startseite erklärte alles gleichzeitig und dadurch nichts richtig.',
          'Inhalte lagen an vier Orten und widersprachen sich an drei davon.',
          'Auf kleinen Bildschirmen brach das Layout an den wichtigsten Stellen.',
          'Für jede Änderung war Entwicklungszeit nötig — niemand pflegte etwas.',
        ]),
        divider(),
        kv([
          { term: 'Ausgangslage', value: 'Gewachsener Altbestand' },
          { term: 'Hauptproblem', value: 'Keine klare Hierarchie' },
          { term: 'Zielgruppe', value: 'Platzhalter-Publikum' },
          { term: 'Rahmen', value: 'Platzhalter · 10 Wochen' },
        ]),
      ].join(''),
    }),
    page({
      windowTitle: 'Case Study · Projekt X',
      eyebrow: 'Kapitel 02',
      title: 'Prozess',
      body: [
        lead('Vier Schritte, die sich in dieser Reihenfolge bewährt haben — hier als Beispiel beschrieben.'),
        divider(),
        steps([
          {
            title: 'Bestand aufnehmen',
            text: 'Alle vorhandenen Inhalte gesammelt, doppelte zusammengeführt, veraltete gestrichen.',
          },
          {
            title: 'Struktur festlegen',
            text: 'Aus dem Rest vier Bereiche gebildet und jeden auf eine Aufgabe festgelegt.',
          },
          {
            title: 'Gestalten und prüfen',
            text: 'Entwürfe früh an echten Inhalten getestet statt an Blindtext — zwei Runden.',
          },
          {
            title: 'Umsetzen und übergeben',
            text: 'Umsetzung plus kurze Anleitung, damit Inhalte ohne Entwicklung pflegbar bleiben.',
          },
        ]),
      ].join(''),
    }),
    page({
      windowTitle: 'Case Study · Projekt X',
      eyebrow: 'Kapitel 03',
      title: 'Ergebnis',
      body: [
        lead(
          'Nach dem Umbau trägt die Struktur die Inhalte statt umgekehrt. Die folgenden ' +
            'Werte sind Platzhalter und zeigen nur, wie ein Ergebnisteil aussehen kann.',
        ),
        divider(),
        stats([
          { value: '0.000', label: 'Platzhalter-Kennzahl eins' },
          { value: '+00 %', label: 'Platzhalter-Kennzahl zwei' },
          { value: '0,0 s', label: 'Platzhalter-Kennzahl drei' },
        ]),
        divider(),
        bullets([
          'Vier klare Bereiche statt einer Startseite, die alles auf einmal erklärt.',
          'Inhalte liegen an einer Stelle und werden dort gepflegt.',
          'Layout funktioniert vom Telefon bis zum großen Bildschirm.',
        ]),
      ].join(''),
    }),
    page({
      windowTitle: 'Case Study · Projekt X',
      eyebrow: 'Kapitel 04',
      title: 'Zahlen & Learnings',
      body: [
        lead('Zum Abschluss die Rahmendaten des Projekts und drei Dinge, die hängen geblieben sind.'),
        divider(),
        kv([
          { term: 'Dauer', value: 'Platzhalter · 10 Wochen' },
          { term: 'Umfang', value: '0 Seiten, 0 Komponenten' },
          { term: 'Beteiligte', value: '0 Personen' },
          { term: 'Budgetrahmen', value: 'Auf Anfrage' },
        ]),
        divider(),
        bullets([
          'Inhalte zuerst — Gestaltung an Blindtext verschiebt die Probleme nur nach hinten.',
          'Weniger Bereiche heißt mehr Klarheit, nicht weniger Inhalt.',
          'Wer die Inhalte pflegt, muss die Struktur ohne Erklärung verstehen.',
        ]),
        note(PLACEHOLDER_HINT),
      ].join(''),
    }),
  ],
})

/* ------------------------------------------------------------------ */
/* Media Kit                                                           */
/* ------------------------------------------------------------------ */

const mediaKit = buildDocument({
  title: 'Media Kit — Platzhalter',
  sections: [
    cover({
      kicker: 'Media Kit',
      title: 'Media Kit',
      subtitle: `${brand.name} — Kurzprofil, Leistungen und Reichweite auf vier Seiten.`,
      meta: ['Version 0.1 · Stand: Platzhalter', 'dein.name@example.com', 'Alle Zahlen sind Beispieldaten'],
    }),
    page({
      windowTitle: 'Media Kit',
      eyebrow: 'Über mich',
      title: 'Kurzprofil',
      body: [
        lead(
          `${brand.name} arbeitet an der Schnittstelle von Gestaltung und Umsetzung: ` +
            'Konzept, Interface und der Code, der beides zusammenhält. Dieser Text ist ein Platzhalter.',
        ),
        divider(),
        bullets([
          'Schwerpunkt auf Projekten, die klein anfangen und wachsen dürfen.',
          'Arbeitsweise: wenige Entwürfe, früh an echten Inhalten getestet.',
          'Am liebsten Zusammenarbeit über mehrere Runden statt einmaliger Übergabe.',
        ]),
        divider(),
        kv([
          { term: 'Standort', value: 'Platzhalter-Stadt' },
          { term: 'Sprachen', value: 'Deutsch, Englisch' },
          { term: 'Seit', value: 'Platzhalter-Jahr' },
          { term: 'Verfügbarkeit', value: 'Auf Anfrage' },
        ]),
      ].join(''),
    }),
    page({
      windowTitle: 'Media Kit',
      eyebrow: 'Angebot',
      title: 'Leistungen',
      body: [
        lead('Vier Pakete als Beispiel. Zuschnitt und Preise sind Platzhalter und kommen je nach Projekt.'),
        divider(),
        cards([
          {
            title: 'Konzept & Struktur',
            tag: 'Paket 01',
            text: 'Inhalte sortieren, Hierarchie festlegen, Seitenstruktur als Grundlage für alles Weitere.',
          },
          {
            title: 'Gestaltung',
            tag: 'Paket 02',
            text: 'Interface, Farbwelt und Typografie als zusammenhängendes System statt als Einzelbilder.',
          },
          {
            title: 'Umsetzung',
            tag: 'Paket 03',
            text: 'Saubere, leichte Frontend-Umsetzung — Inhalte bleiben ohne Entwicklung pflegbar.',
          },
          {
            title: 'Begleitung',
            tag: 'Paket 04',
            text: 'Laufende Betreuung nach dem Start: Anpassungen, kleine Ausbauten, Beratung.',
          },
        ]),
      ].join(''),
    }),
    page({
      windowTitle: 'Media Kit',
      eyebrow: 'Zahlen',
      title: 'Reichweite & Kennzahlen',
      body: [
        lead(
          'Alle Werte auf dieser Seite sind Platzhalter. Trage deine echten Zahlen ein — ' +
            'und nenne immer Quelle und Zeitraum dazu.',
        ),
        divider(),
        stats([
          { value: '0.000', label: 'Follower · Plattform A' },
          { value: '0.000', label: 'Follower · Plattform B' },
          { value: '0.000', label: 'Abonnenten · Newsletter' },
        ]),
        divider(),
        stats([
          { value: '00 %', label: 'Interaktionsrate (Platzhalter)' },
          { value: '0.000', label: 'Aufrufe pro Monat' },
          { value: '00 : 00', label: 'Verweildauer (Platzhalter)' },
        ]),
        note(
          'Hinweis: Reichweitenangaben ohne Quelle und Zeitraum sind für Partner wertlos. ' +
            'Ergänze bei den echten Zahlen jeweils Plattform, Erhebungszeitraum und Messmethode.',
        ),
      ].join(''),
    }),
    page({
      windowTitle: 'Media Kit',
      eyebrow: 'Kontakt',
      title: 'Anfragen',
      body: [
        lead('Für Kooperationen, Projektanfragen und Presseanfragen.'),
        divider(),
        kv([
          { term: 'E-Mail', value: 'dein.name@example.com' },
          { term: 'Website', value: 'example.com' },
          { term: 'Presse', value: 'presse@example.com' },
          { term: 'Antwortzeit', value: 'Zwei Werktage (Platzhalter)' },
        ]),
        divider(),
        bullets([
          'Bitte Zeitraum, Umfang und Budgetrahmen gleich mitschicken.',
          'Für Pressefotos und Logo-Dateien kurz formlos anfragen.',
          'Kooperationen werden als solche gekennzeichnet.',
        ]),
        note(PLACEHOLDER_HINT),
      ].join(''),
    }),
  ],
})

/* ------------------------------------------------------------------ */

export const documents = [
  { file: 'portfolio-2026.pdf', html: portfolio },
  { file: 'case-study-projekt-x.pdf', html: caseStudy },
  { file: 'media-kit.pdf', html: mediaKit },
]

async function main() {
  await mkdir(outDir, { recursive: true })
  for (const doc of documents) {
    const target = join(outDir, doc.file)
    const bytes = await htmlToPdf(doc.html, target)
    console.log(`public/downloads/${doc.file.padEnd(26)} ${formatSize(bytes)}`)
  }
}

// Nur ausfuehren, wenn das Skript direkt aufgerufen wird - so koennen andere
// Skripte die HTML-Vorlagen importieren, ohne zu rendern.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
