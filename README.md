# 🧭 Calibration Sales Compass

> Which customers should we contact today — and why?

**Authors: [Utkarsh Midha (@UtkarshMidha)](https://github.com/UtkarshMidha) and [Raj Mahadevwala (@rajmahadev8)](https://github.com/rajmahadev8)** · 🥈 **2nd place**, Hack the Lab – Perschmann KI-Hackathon, Braunschweig 2026 · Built as `PeCal Kompass`, the AI sales assistant for Perschmann Calibration's inside-sales team

Inside sales spends most of the day writing quotations, so outreach is reactive: whoever calls first gets the attention, not whoever needs it most. Meanwhile the data already knows who needs calling — every instrument carries a due date, and every instrument that should have come back but didn't is a silent alarm. On the reference date alone, **65,282 instruments at 2,424 customers are overdue**. Calibration Sales Compass turns that scattered signal into one ranked morning list, with the reason in plain words and the quote draft one click away.

![A full pass through the app: dashboard, daily list, customer 360, quote draft, leadership cockpit, history](https://raw.githubusercontent.com/UtkarshMidha/calibration-sales-compass/main/docs/screenshots/demo.gif)

*One pass through the whole workspace in under a minute. Full frame-by-frame walkthrough with a screenshot for every step: **[WALKTHROUGH.md](https://github.com/UtkarshMidha/calibration-sales-compass/blob/main/WALKTHROUGH.md)**.*

## 🧩 Problem

The inside-sales desk (Vertriebsinnendienst) at a calibration lab lives in two tools — the ERP and the customer portal — and in neither of them can it see *who needs attention today*. The signals exist but are scattered across half a million rows: due dates, missing returns, shrinking order volumes, unused portfolio, customers who never touched the portal.

Concretely: quoting eats the day, customers miss calibration due dates or quietly move instruments to another provider, and nobody notices until much later. The little time left after quoting goes to whoever calls first, not to where the value is.

## 🏁 Objective

Every morning, answer *"Welche Kunden sollten wir heute kontaktieren — und warum?"* in under two minutes — and cut the time from recommendation to a sendable quote draft to under two minutes as well.

The standard it holds itself to: every recommendation carries a data-backed reason a rep can read out on the phone, every figure traces back to computed data (never a language model's imagination), and every model is validated against a simple baseline on held-out history — or the baseline ships instead, and the app says so.

## 💡 Solution

A ranked **Tagesliste** (daily list) of customer recommendations. Each has one primary **Anlass** (reason) out of five — overdue instruments, due soon, churn risk, industry portfolio gap, portal onboarding — a plain-German **Begründung**, an **expected value in €**, and one-click actions: claim, call script, email draft, quote draft, done, snooze.

Everything scores through one transparent formula:

```text
Expected value  =  estimated revenue  ×  success chance (per Anlass)  ×  urgency
Priority bands  =  top 20% EV → Hoch, next 30% → Mittel, rest → Niedrig
```

The **Angebotsentwurf** attacks the root cause, quoting time: one click pre-fills a formal DIN 5008 quotation PDF from the customer's due instruments — line items, DAkkS/Werk switch, logistics, instrument annex — in seconds. A grounded **AI assistant** answers questions about customers and forecasts strictly from computed data, with sources cited on every answer.

## ✨ Key features

- **A triage list, not a dashboard.** The home screen ranks who to call first, like an email client: list on the left, customer focus view on the right.
- **Five Anlässe, one ranking.** Overdue, due-soon, churn-risk, industry-potential and portal customers compete on expected € value, so different urgencies are comparable.
- **Reasons you can say on the phone.** 2–4 data-backed sentences per recommendation plus a "Warum?" breakdown of contributing factors — no raw model scores in the UI.
- **Quote draft in under 2 minutes.** Pre-filled from due instruments, DAkkS (×1.35, default since 01.01.2026) or Werk per line, multi-page branded PDF with full instrument annex.
- **Customer 360.** Risk gauge, due-date timeline (6 months back, 12 ahead), portfolio gap matrix vs. industry peers, 24-month history, contact timeline.
- **Leadership cockpit.** 12-month order-volume forecast with 80% uncertainty band, € at risk by industry and region, team activity — reserved for the Leitung role.
- **Assistant that narrates, never decides.** Figures come only from computed data via tools; the LLM phrases, drafts and summarises — and cites its sources.
- **Trust is a screen.** The Developer page shows hold-out metrics vs. baselines, data-quality rules and assumptions in plain language.
- **German office-native.** Formal Sie, German dates/currency, KW weeks, DE/EN toggle across the whole UI, keyboard-first (`Strg+K` search, `Strg+J` assistant).

## ⚙️ How it works?

Scores are computed, prose is rendered — never the other way round.

A deterministic pipeline over CSV snapshots (re-runnable via `npm run data:build`) produces per-customer features, five models (M1–M5) and one candidate recommendation per customer and Anlass. The app computes expected value at query time (so hourly rate and success chances apply instantly, no pipeline run), picks each customer's highest-value Anlass as primary, and assembles the ranked list: cooldown for recently worked customers, back-timed follow-ups, deterministic tie-breaks.

The pipeline never writes prose — it writes **reason codes with parameters** (`UEBERFAELLIG {n, median days}`, `TREND_RUECKGANG {percent}`, …), and the app renders them through DE/EN message templates. Explanations are therefore instant, free, translatable and testable. The LLM (Groq `openai/gpt-oss-*`, key server-side only) receives a grounding context containing *exclusively* computed figures, and every figure in an answer must come from a tool result in the same turn.

## 🏗️ Architecture

What is computed where, and what the model is never allowed to touch.

```text
CSV snapshots (git-ignored)            deterministic, re-runnable
        |
        v
+-- Python pipeline ------------------- scripts/build_real_data.py, train_*.py
|     M1 return behaviour (empirical-Bayes lag per customer)
|     M2 due forecast (due date shifted by customer lag)
|     M3 churn risk (LightGBM + isotonic calibration + SHAP reasons)
|     M4 order volume (bottom-up arrivals + 80% band)
|     M5 industry gaps (peer penetration >= 40%)
|     -> public/data/*.json (the app's only data source at runtime)
|
+-- Next.js app (App Router) ---------- src/app, src/components, src/lib
|     data.ts      Tagesliste assembly, EV ranking, reason rendering
|     store.tsx    claims, results, drafts, settings (localStorage)
|     assistant.ts local rule engine (instant KPI answers, zero tokens)
|     grounding.ts computed-only context for the LLM
|     /api/assistant  Groq chat with grounding (key never leaves server)
|
+-- Screens --------------------------- / (dashboard)  /tagesliste
                                        /kunden[/id]    /messmittel
                                        /angebote[/id]  /cockpit (Leitung)
                                        /verlauf        /modellguete
                                        /einstellungen
```

The red line of this project: the LLM narrates, never decides. Scores, rankings and figures come only from the pipeline and app logic ([ADR-style rule](https://github.com/UtkarshMidha/calibration-sales-compass/blob/main/WALKTHROUGH.md#how-these-screenshots-were-produced) enforced in code and evaluated by a golden question set).

<sub>Architecture and implementation by [@UtkarshMidha](https://github.com/UtkarshMidha) and [@rajmahadev8](https\://github.com/rajmahadev8).</sub>

## 🔒 The core guarantees

| Guarantee | Enforced by |
|---|---|
| No figure the data didn't compute | assistant answers only from tool results in the same turn |
| Explanations are traceable | reason codes + parameters, rendered via message templates |
| Models must beat baselines | hold-out backtests (M1–M5); fallback to baseline, labelled as such |
| Nothing is sent automatically | email/quote drafts only; every assistant write needs a click |
| No credentials in the repo | Groq key server-side in `.env` only; honest local fallback without it |
| Demo data is labelled | fictitious names/contacts carry a Demo badge; real counts stay real |
| Failures are loud | assistant degrades to the local engine with a notice, never silence |

## 🧱 Technology stack

**Application**
- Node 22, [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript
- Tailwind CSS v4, lucide-react, recharts, jsPDF + autotable (quote PDFs)

**Intelligence**
- Python 3.12 pipeline: gradient boosting (churn, 95% precision@100 on holdout), isotonic calibration, TreeSHAP, seasonal-naive/AutoETS baselines
- Groq `openai/gpt-oss-120b` (chat/drafts) + `openai/gpt-oss-20b` (briefing), free tier, budget-aware and cached

**Demo capture**
- Playwright (headless Chromium) + Pillow: scripted screenshots and GIFs, no mocks — see `scripts/demo_*.py`

## 📁 Repository structure

```text
.
├── src/
│   ├── app/                 routes: dashboard, tagesliste, kunden, messmittel,
│   │                         angebote, cockpit, verlauf, modellguete, einstellungen
│   │                         + api/assistant (Groq + grounding, server-side key)
│   ├── components/          Shell (nav/topbar), CommandPalette, Assistant, ui kit
│   └── lib/                 data (dataset + ranking), store (state), i18n (DE/EN),
│                            assistant (local engine), grounding (LLM context),
│                            reasons (templates), pdf (DIN 5008), real-data
├── scripts/
│   ├── build_real_data.py   CSV snapshots -> public/data/*.json
│   ├── train_churn.py       M3 churn model + validation
│   ├── train_modellguete.py model-quality tables
│   ├── demo_capture.py      scripted screenshots + per-page GIFs
│   └── demo_interactions.py  scripted interaction GIFs (claim, quote, assistant…)
├── public/data/             computed JSON (the app's runtime data source)
├── docs/screenshots/        the walkthrough images and GIFs
├── database_tables/         source CSV snapshots (git-ignored in practice)
├── WALKTHROUGH.md           frame-by-frame demo
└── PRD.local.md             original build spec (local only, git-ignored)
```

## ✅ Prerequisites

- Node 22+ and npm
- Python 3.12 (only for rebuilding data: `npm run data:build`)
- Nothing else. No Docker, no database, no API key for the core demo.

A Groq API key is needed **only** for live LLM answers — without it the assistant truthfully falls back to its local engine.

## 🚀 Quick start

```bash
npm install
npm run dev            # → http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm run start` | production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run data:build` | recompute `public/data/*.json` from `database_tables/*.csv` |

Optional LLM (live phrasing, drafts, briefing):

```bash
# .env (git-ignored, never commit)
GROQ_API_KEY=...
GROQ_CHAT_MODEL=openai/gpt-oss-120b
GROQ_FAST_MODEL=openai/gpt-oss-20b
```

## 🧭 Using the application

1. **Start on the dashboard.** This morning's headline: overdue instruments, expected revenue from 12 recommendations, dues in 30 days, high churn-risk customers — plus top-8 recommendations and the 6-month due chart.
2. **Work the Tagesliste.** Filter by Anlass or priority, open the focus view for one customer, read the Begründung, claim them so nobody calls twice.
3. **Go 360.** Risk gauge, due-date timeline, portfolio gap matrix against industry peers, history, contact timeline.
4. **Quote in one click.** *Angebot vorbereiten* pre-fills the draft from due instruments; switch DAkkS/Werk per line, add logistics, download the branded PDF.
5. **Think like Leitung.** Switch user to Thomas Brandt (bottom-left) and open the Cockpit: 12-month forecast with uncertainty band, € at risk, team activity.
6. **Ask the assistant.** `Strg+J`, e.g. *„Wen sollte ich heute zuerst anrufen?"* — answers cite computed figures and link customers as cards. `Strg+K` jumps anywhere; EN flips the whole UI to English.
7. **Check the trust.** Verlauf shows churn history and potential; Developer shows every model's hold-out metrics vs. baselines, data-quality rules and assumptions in plain words.

The seeded demo customer is **10132 · Müller Präzisionstechnik GmbH** (42 overdue instruments) — the same story on every checkout.

## 📊 The models

| Model | What it does | Validated by |
|---|---|---|
| M1 return behaviour | median return lag + return rate per customer (empirical Bayes vs. industry) | returns within ±1 month of predicted month, ≥ 60% |
| M2 due forecast | per-instrument expected arrival month + probability | same return-timing backtest |
| M3 churn risk | LightGBM probability + calibrated bands + SHAP reasons | precision@100 ≥ 1.2× recency-rule baseline |
| M4 order volume | bottom-up arrivals → calibrations/hours, 12 months + 80% band | WAPE vs. seasonal-naive and AutoETS |
| M5 industry potential | peer-group gaps (≥ 40% penetration) + DAkkS gaps, valued in € | gap adoption lift ≥ 2× vs. random |

Ranking quality itself is backtested: recommendations from a past cut-off date are checked against what customers actually did afterwards, per priority band.

## 🚧 Constraints

Worth stating plainly.

- **Customer names and contacts are fictitious** (deterministic demo data, seeded by customer number) and badged as Demo; counts, dates and € estimates come from the real snapshots.
- **€ figures are estimates** (processing time × hourly rate), marked *Richtpreis* — not real prices.
- **Model-quality numbers are embedded snapshots** of the last pipeline run; each run recomputes them.
- **No integrations.** No SAP/CRM/portal connection, no login/roles beyond the user picker, nothing is emailed or sent automatically.
- **Two reference dates** ship with the demo (25.09.2026 default, 25.03.2026 lookback).
- **Not a production system.** A hackathon MVP: local state in `localStorage`, no multi-user backend.

## 🧪 Testing

```bash
npm run typecheck   # clean
npm run build       # 11 routes, all green
```

Plus `scripts/pdf-smoke.ts` (quote PDF render check) and a golden question set evaluation for the assistant (correct tool choice and correct figures). No excuses tests beyond that — it's a 2-day hackathon build, and the validation that matters (M1–M5 backtests) lives in the pipeline and on the Developer page.

## 📜 Provenance and license

Built by **[Utkarsh Midha (@UtkarshMidha)](https://github.com/UtkarshMidha)** and **[Raj Mahadevwala (@rajmahadev8)](https://github.com/rajmahadev8)** for Hack the Lab – the Perschmann KI-Hackathon, Braunschweig, October 2026, where it placed **2nd** in Challenge 2 "Customer Activity Monitoring". The original build spec is kept locally as `PRD.local.md`.

MIT. See [`LICENSE`](https://github.com/UtkarshMidha/calibration-sales-compass/blob/main/LICENSE).

---

<sub>**Calibration Sales Compass** (built as PeCal Kompass) · © 2026 **Utkarsh Midha ([@UtkarshMidha](https://github.com/UtkarshMidha)) and Raj Mahadevwala ([@rajmahadev8](https://github.com/rajmahadev8))** · original repository: [github.com/UtkarshMidha/calibration-sales-compass](https://github.com/UtkarshMidha/calibration-sales-compass)</sub>
