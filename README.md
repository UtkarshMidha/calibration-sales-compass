# PeCal Kompass

Hackathon-MVP („PeCal Kompass") für die Perschmann Calibration GmbH: ein KI-gestützter Vertriebsassistent, der aus dem Kalibrierungsdatensatz jeden Tag eine priorisierte **Tagesliste** baut — mit Herleitung, Kunden-360, Angebotsentwurf, Cockpit und Modellgüte-Transparenz.

## Starten

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

Weitere Skripte:

| Skript              | Zweck                       |
| ------------------- | --------------------------- |
| `npm run dev`       | Entwicklungsserver          |
| `npm run build`     | Produktions-Build           |
| `npm run start`     | Produktionsserver           |
| `npm run typecheck` | TypeScript-Prüfung (`tsc`)  |
| `npm run data:build`| Kennzahlen aus `database_tables/*.csv` neu berechnen → `public/data/*.json` |

## Daten & Zählweisen (wichtig für die Demo)

- **Echte Messwerte** (`npm run data:build`, Python, Stichtag 25.09.2026): 65.282 überfällige Messmittel bei 2.424 Kunden, 10.994 fällig (30 Tage) bei 699 Kunden, 6.525 Kunden, 488.699 Messmittel. Dashboard-KPIs, Top-Kunden, Fälligkeits-Balken, Kunden- und Messmittel-Seiten lesen diese JSON-Dateien (`public/data/`).
- **Warum 12 überall?** Die Tageslisten-Länge = Einstellung „Anzahl Empfehlungen" (Standard 12, änderbar unter Einstellungen). Dashboard-Top-Liste, Sidebar-Badge und Fortschritt zeigen denselben Wert.
- **Zwei verschiedene Rankings, gleiche Länge:** Das Dashboard ordnet echte Überfälligkeiten nach €-Wert; die Tagesliste priorisiert Modell-Empfehlungen aus 5 Anlässen (Überfällig, Fällig, Abwanderung, Branche, Portal) nach erwartetem Wert. Namen/Kontakte bleiben Demo (nicht im Datensatz).
- **Modellgüte-Werte sind statisch eingebettet** (Holdout-Messung 06.10.2026); jeder Pipeline-Lauf berechnet sie neu.
- **Stichtage:** 25.09.2026 und 25.03.2026 (Rückblick). Weitere folgen mit dem nächsten Datenlauf.

## Challenge-Abdeckung

| Vorgabe | Antwort im Produkt |
|---|---|
| Künftigen Kalibrierbedarf vorhersagen | Dashboard Fälligkeits-Balken (6 Monate), Tagesliste „Fällig demnächst", Kunde-360 Zeitstrahl, Verlauf → Potenzial → Fällig demnächst |
| Aktivität & Abwanderungsrisiko erkennen | Verlauf → Stilllegung (18M-Kurve + Details je Monat), Churn-KPI, Kunde-360 Risiko-Gauge, Tagesliste „Abwanderungsrisiko" |
| Auftragsvolumen prognostizieren | Cockpit-Prognose mit 80-%-Band (Leitung), Verlauf → Aktivität (Historie als Basis) |
| Nach Umsatzpotenzial priorisieren | Erwarteter Wert (€) in Tagesliste und Dashboard-Top-8 |
| Branchen-Portfolios vergleichen | Verlauf → Potenzial → Branchenlücken (Peer-Vergleich ≥ 40 %), Kunde-360 Lückenmatrix |
| Täglich „wen und warum" | Tagesliste mit Begründung, Warum-Aufschlüsselung und Aktionen (Übernehmen, Anruf, E-Mail, Angebot, Erledigt) |

## Screens

- **Dashboard** (`/`) — echte Kennzahlen (Stand 25.09.2026), Top-Empfehlungen nach €-Wert, Umsatzpotenzial-Donut, Fälligkeits-Balken (6 Monate), KI-Assistent-Overlay, Schnellaktionen, Top-Branchen.
- **Tagesliste** (`/tagesliste`) — priorisierte Modell-Empfehlungen (Länge = Einstellung, Standard 12), Suche + Anlass-/Prioritätsfilter, Ergebnis-Erfassung; Klick/Enter öffnet die Fokus-Ansicht (ein Kunde, vollflächig, Esc/zurück zur Liste). Tabs **Offen/Erledigt**: Erledigte (inkl. Wiedervorlagen) bleiben mit Ergebnis sichtbar, einzeln zurückholbar; **Demo zurücksetzen** im Erledigt-Tab löscht Arbeitsstand (Claims, Ergebnisse, Entwürfe, Lernwerte) für einen frischen POC-Durchlauf — ein npm-Befehl kann kein Browser-localStorage löschen, daher dieser Knopf statt Skript.
- **Verlauf** (`/verlauf`) — Abwanderung bisher (18M-Kurve, Monat anklickbar mit Kunden-Details) und Potenzialkunden (fällig demnächst, ohne Portal, Branchenlücken aus Peer-Vergleich).
- **Kunden** (`/kunden`) — echte Kundennummern/Branchen durchsuch-/filterbar, tief verlinkbar.
- **Kunde-360** (`/kunden/[kundeId]`) — Modellkunden: Risiko-Gauge, Zeitstrahl, Lückenmatrix, 24M-Historie, Messmittelliste mit Export, 12M-Prognose, Kontaktverlauf; echte Kundennummern: kompakte Zähldaten + Messmittel-Auszug.
- **Messmittel** (`/messmittel`) — Auszug der ältesten Fälligkeiten mit Statusfiltern (mit Erklärung per Hover).
- **Angebote** (`/angebote`, `/angebote/[id]`) — Richtpreis-Editor (DAkkS = Deutsche Akkreditierungsstelle, ×1,35); **PDF herunterladen** erzeugt ein mehrseitiges Dokument (Anschreiben, Positionen, vollständige Messmittel-Anlage, Hinweise, Fußzeilen mit Seitenzahlen) via `src/lib/pdf.ts` (jsPDF + autotable; Smoke-Test: `scripts/pdf-smoke.ts`).
- **Cockpit** (`/cockpit`, nur Leitung) — KPIs, Prognose mit Baseline-Vergleich (Hover-Erklärung), Umsatz in Gefahr je Branche/Gebiet mit Fazit-Satz, Team-Aktivität.
- **Developer** (`/modellguete`) — Modellkarten in Klartext, Bereinigungs-Übersicht, Annahmen, Assistenten-Evaluation.
- **Einstellungen** (`/einstellungen`) — Tageslisten-Länge, Stundensatz, Pause nach Ergebnis, Risiko-Schwelle, Stichtag; Erweitertes (Erfolgsannahmen, KI-Nutzung) eingeklappt.

## Demo-Hinweise (bewusst)

- Alle Daten sind **fiktiv, deterministisch erzeugt** (Seed = Kundennummer). Die Bestandskunden-Umfrage des PRD existiert nicht als Rohdaten → Team-/Zufriedenheitswerte sind Platzhalter und als solche markiert.
- Stichtage: **25.09.2026** (Pitch-Vergangenheit) und **25.03.2026** (Rückblick). Kunde `10132` = Müller Präzisionstechnik GmbH (PRD-Protagonist, 42 überfällig).
- Der Assistent arbeitet **hybrid**: Kennzahlen-Fragen beantwortet die lokale, regelbasierte Engine sofort mit interaktiven Karten (gleicher Datenstand wie die UI, keine Halluzination). Alles andere geht an das **Sprachmodell (Groq `openai/gpt-oss-*`, Key nur serverseitig in `.env`)** — mit einem Grounding-Kontext (`src/lib/grounding.ts`), der ausschließlich die berechneten Daten enthält, und einer Quellen-Angabe bei jeder Antwort. Fehlt Key oder wird gedrosselt (Free-Tier-TPM), fällt der Assistent auf die ehrliche Lokalantwort zurück; Außerhalb-Fragen (Wetter, SQL, …) werden abgelehnt.
- Zustand (Claims, Ergebnisse, Entwürfe, Einstellungen) liegt in `localStorage` unter `pecal-kompass-v1`.

## Technik

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · lucide-react · clsx.

```
src/
  app/           Routen (Heute, Kunden, Kunde-360, Angebote, Cockpit, Modellgüte, Einstellungen)
                 + api/assistant (Server-Endpoint: Groq mit Grounding, Key bleibt serverseitig)
  components/    Shell (Rail/Topbar/Shortcuts), CommandPalette, Assistant, ui (Design-System)
  lib/           data (Datensatz + Intelligenz), store (State), i18n (DE/EN), content (E-Mail/Leitfaden),
                 assistant (Antwort-Engine), grounding (LLM-Kontext), reasons (Begründungs-Templates),
                 format (Datums-/Währungshelfer)
```

Tastatur: `Strg+K` Suche · `Strg+J` Assistent · `J/K` blättern · `Enter` öffnen · `Esc` zurück · `?` Hilfe.
