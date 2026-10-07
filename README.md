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

## Screens

- **Heute** (`/`) — Tagesliste (Kapazität 20), Anlass-/Prioritätsfilter, schnelle Ergebnis-Erfassung (Ergebnis, Wiedervorlage, E-Mail-Vorlage), Detail-Pane mit Herleitung, Zeitstrahl und Empfehlung (EV = Stunden × Stundensatz × Erfolgschance × Dringlichkeit).
- **Kunden** (`/kunden`) — Vollsortiment durchsuch-/filterbar (Branche, Gebiet, Sortierung), tief verlinkbar über `?branche=`/`?gebiet=`.
- **Kunde-360** (`/kunden/[kundeId]`) — Risiko-Gauge, Zeitstrahl der Rückläufer, Lückenmatrix (Gegenstück besitzt X), Aktivitätsverlauf 24 Monate, Messmittelliste mit CSV-Export, Kundenprognose (12 Monate, 80-%-Band), Kontaktverlauf.
- **Angebotsentwurf** (`/angebote/[id]`) — Richtpreis-Editor (DAkkS/Werk-Toggle je Position, Einzelposten entfernen, Logistik), DIN-5008-artiges Layout mit ENTWURF-Wasserzeichen, **Als PDF drucken** (Browser-Druckdialog, `@page A4`).
- **Cockpit** (`/cockpit`) — KPIs, Prognose mit Baseline-Vergleich, At-Risk nach Branche/Gebiet (klickbar → Kundenliste), Team-Aktivität, Erfolgsquote, Verlustgründe.
- **Modellgüte** (`/modellguete`) — Rücklauf-Histogramm, Precision@k gegen Baselines, Prognoseband, Kalibrierungskurve, Prioritäten-Wirksamkeit, Datenqualität, Modellannahmen, Assistenten-Evaluation.
- **Einstellungen** (`/einstellungen`) — Stundensatz, Tageslisten-Kapazität, Cooldown, Risiko-Schwelle, gelernte Erfolgschancen (Prior vs. Pipeline), Stichtag-Umschalter, LLM-Quoten.

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

Tastatur: `⌘/Strg+K` Command-Palette · `?` Hilfe · `Esc` schließen.
