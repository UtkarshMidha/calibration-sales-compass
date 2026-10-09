<!--
  Calibration Sales Compass (built as PeCal Kompass): Walkthrough
  Author: Utkarsh Midha (@UtkarshMidha) · github.com/UtkarshMidha/calibration-sales-compass
  Every screenshot below was captured from a live run of this repository.
-->

# 🧭 Calibration Sales Compass: Visual Walkthrough

> **Author: [@UtkarshMidha](https://github.com/UtkarshMidha)** · 🥈 2nd place, Hack the Lab – Perschmann KI-Hackathon, Braunschweig 2026

This is the demo, frame by frame, in place of a screen recording. Every image
below was captured from a real run of this repository: `npm run build` +
`next start`, the computed JSON in `public/data/` doing all the talking, and a
scripted Chromium driving the clicks — filtering the list, claiming a customer,
building a quote, switching users, asking the assistant. Nothing here is a mockup.

Three stories are told in order:

1. **The rep's morning.** Sabine Schneider opens the app and works the list down to a sendable quote.
2. **The Leitung view.** Thomas Brandt sees forecast, revenue at risk and whether the numbers can be trusted.
3. **The assistant and the keyboard.** Grounded answers, command palette, English toggle.

*Walkthrough by @UtkarshMidha*

---

## Part 1: the rep's morning

### 1. The dashboard — today's headline

![Dashboard: KPIs, top recommendations, revenue mix and 6-month due chart](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/01-dashboard.png)

*Good morning, Sabine.* Four numbers set the day: **65,282 overdue instruments
at 2,424 customers**, **≈ €27,989 expected revenue from 12 recommendations**,
**10,994 instruments due in the next 30 days**, and **1,127 customers at elevated
churn risk**. Below that, the top-8 recommendations with Anlass, expected value
and urgency — Reuter Konstruktionstechnik (€5,616, 317 overdue) on top — plus
the revenue mix and the 6-month due-date chart. The whole UI is in German,
formal Sie, with KW weeks and German number formats.

### 2. The Tagesliste — who to call, and why

![Daily list: ranked recommendations with reasons, filters and progress](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/02-tagesliste.png)

The morning briefing reads like a colleague's note: *12 recommendations today,
all high priority — biggest lever: Reuter …* Each row is one customer with one
primary Anlass, one expected value, and the top reason in plain words (*"317
instruments overdue 141 days on average"*). Search, Anlass and priority filters
combine; *Offen/Erledigt* tabs and the *0 von 12 erledigt* progress bar track the
day. Filtering is instant — here narrowed to overdue only:

![Daily list filtered to overdue recommendations](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/02c-tagesliste-filter.png)

The whole flow — filter, open, claim — as a GIF:

![Filtering, focusing and claiming a recommendation](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/flow-tagesliste.gif)

### 3. The focus view — one customer, full screen

![Focus view: reasoning, timeline, affected instruments, contact, actions](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/02b-tagesliste-fokus.png)

Clicking a row minimizes the list and gives the customer the full screen: the
**Begründung** (*317 overdue… 138 of them over 60 days — probably calibrated
elsewhere or retired*), a **Warum?** factor breakdown, the due-date timeline,
the affected instruments table with statuses like *Teilabwanderung*, the contact
block and the action bar — claim, email draft, quote draft, snooze. Everything a
rep needs to say on the phone, no clutter.

### 4. Customer 360 — the seeded demo story

![Customer 360 for Müller Präzisionstechnik: risk gauge, timeline, gap matrix](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/04-kunde-360.png)

Customer **10132 · Müller Präzisionstechnik GmbH** is the seeded demo case, so
this story reproduces identically on any checkout: 61% churn risk (HOCH), 260
active instruments, 42 overdue, expected value ≈ €1,585, Rücklaufquote 63%.
Below: the due-date timeline (overdue left of *Heute*, expected arrivals right)
and the portfolio gap matrix against industry peers — two gaps worth ≈ €2,175.

### 5. The quote — from recommendation to PDF in seconds

![Quote draft: letter, line items, DAkkS switch, logistics, totals](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/06b-angebot-entwurf.png)

*Angebot vorbereiten* pre-fills draft **AE-2026-000123** from the customer's 43
due/overdue instruments: formal letter, 41 line items grouped by service with
catalog numbers and processing minutes, DAkkS/Werk switch per line, logistics
options (loan box, DHL pickup, pickup tour), live totals — ≈ €2,275 net. One
click on *Alle auf DAkkS* reprices everything live (×1.35, the default since
01.01.2026): ≈ €2,957 net, ≈ €3,519 gross —

![Switching the whole draft to DAkkS reprices every line live](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/06c-angebot-dakks.png)

— and *PDF herunterladen* renders the multi-page branded document (letter,
positions, full instrument annex, notes, page numbers):

![Quote draft → DAkkS toggle → totals recompute](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/flow-angebot.gif)

### 6. Customers and instruments — the full dataset, browsable

![Customer list: 6,525 customers sortable by overdue counts](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/03-kunden.png)

6,525 customers, searchable by number, filterable by industry, sortable by
overdue counts and last calibration. And the instrument extract — the 2,000
oldest due dates with status filters (*Alle, Überfällig, Über 60 Tage, Fällig
bald*) and per-row days-overdue:

![Instrument extract: oldest due dates with status filters](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/05-messmittel.png)

---

## Part 2: the Leitung view

### 7. Switching to Thomas Brandt

![User switcher: Sabine Schneider ↔ Thomas Brandt](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/07a-benutzerwechsel.png)

One click on the bottom-left user card switches roles. The cockpit is reserved
for Vertriebsleitung — as Sabine, the app says so plainly and points back to
work instead of showing a dead end.

### 8. The cockpit — volume, risk, and what to do about it

![Cockpit: forecast with uncertainty band, KPIs, reading guide](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/07-cockpit.png)

As Thomas Brandt: **61,842 expected calibrations (3 months), ≈ €15.4M revenue
estimate (12 months), ≈ €6.8M revenue at risk, 64,915 overdue instruments** —
each KPI with a one-line explanation of how it is computed. The forecast chart
plots 24 months of measured history plus 12 months of model forecast with an
80% band, and a reading guide underneath tells leadership exactly how to use it
(*dark blue is measured past, dashed is forecast — size capacity and pickup
tours around the peak month*). A baseline toggle answers *"is the model better
than last year?"*.

### 9. Verlauf — churn so far, potential next

![History: churned customers, value at risk, loss peak, open potential](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/08-verlauf.png)

**3,798 churned customers** (≥ 6 months silent), **≈ €462,899 endangered
value**, the worst loss month (Mar 26: 274 customers never returned) clickable
down to customer rows — and **≈ €171,187 open potential** from dues, portal and
industry gaps. Bars are lost customers per month, the line the cumulative
count; recent months are honestly greyed out as not yet meaningful.

### 10. Developer — trust, in plain words

![Developer page: churn model holdout comparison, calibration, top features](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/09-modellguete.png)

This is the screen that wins juries: every model as a card with what it does,
its hold-out metric vs. simple baselines, and a plain-language *"Was bedeutet
das?"*. The churn model comparison — prior vs. logistic regression vs.
**gradient boosting (winner: 0.847 ROC-AUC, 95% precision@100)** — with the
predicted-vs-observed calibration curve and the top features beside it. Measured
October 2026, recomputed on every pipeline run; data-quality rules and
assumptions listed underneath without jargon.

---

## Part 3: the assistant and the keyboard

### 11. The assistant — grounded answers with sources

![Assistant drawer answering who to call first, with customer cards and source](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/11-assistent.png)

`Strg+J` opens the drawer anywhere. *„Wen sollte ich heute zuerst anrufen?"* is
answered from the computed list — Reuter first at ≈ €5,616, then four more as
tappable customer cards — with the source printed underneath (*Quelle:
Tagesliste vom 25.09.2026*). KPI questions are answered instantly by the local
rule engine (zero tokens); everything else goes to the language model with a
grounding context of computed figures only. Key missing or throttled? The
drawer says so and falls back to the local engine — the app never invents a
number.

![Asking the assistant who to call first](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/flow-assistent.gif)

### 12. Command palette and English

![Command palette jumping to customer 10132](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/12-palette-suche.png)

`Strg+K`, type `10132`, Enter — on the customer page before the finger leaves
the keyboard. The palette jumps to customers, pages and actions with fuzzy
search. And the whole UI flips to English with one toggle — dates, roles,
navigation, tables, even the data badge:

![Dashboard fully in English after the toggle](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/13-dashboard-en.png)

![Palette search, jump, and language toggle](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/flow-palette.gif)

### 13. Settings — the demo's control room

![Settings: list length, hourly rate, cooldown, risk threshold, reference dates](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/10-einstellungen.png)

List length (12), hourly rate (90 €/h — explicitly *never changes the ranking,
only the € labels*), 14-day cooldown after a logged outcome, 50% risk
threshold, and the two reference dates (25.09.2026 default, 25.03.2026
lookback). Success chances and LLM usage hide under collapsed *Erweitert*
sections with hover explanations. Everything recomputes instantly, no pipeline
run.

---

## How these screenshots were produced

Production build (`npm run build` + `next start`) on `localhost:3000`, driven
through headless Chromium by `scripts/demo_capture.py` (per-page stills +
scroll GIFs) and `scripts/demo_interactions.py` (filter → focus → claim, quote
→ DAkkS toggle, assistant Q&A, palette jump, EN toggle, user switch). Viewport
1280×800, GIFs downscaled to 960 wide. Customer **10132** is the seeded demo
case; names and contacts are fictitious demo data (badged DEMO), counts and
figures come from the computed snapshots. The quote draft number
(`AE-2026-000123`) and the cockpit-as-Leitung pass through the app's real UI —
no staged states.

---

<sub>**Calibration Sales Compass** (built as PeCal Kompass) · Author: **Utkarsh Midha ([@UtkarshMidha](https://github.com/UtkarshMidha))** · 🥈 2nd place, Hack the Lab – Perschmann KI-Hackathon, Braunschweig 2026 · MIT licensed. If you are reading this in a fork, the original lives at [github.com/UtkarshMidha/calibration-sales-compass](https://github.com/UtkarshMidha/calibration-sales-compass).</sub>
