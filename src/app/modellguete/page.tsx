"use client";

import { AlertTriangle, CircleCheck, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ANNAHMEN,
  DQ_REPORT,
  RUECKLAUF_HISTOGRAMM,
  getKalibrierungskurve,
  getModellguete,
  getPrecisionKurve,
  getPrognoseGesamt,
} from "@/lib/data";
import { evaluateGolden } from "@/lib/golden";
import { date, num, pct } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useModellgueteReal, type KartenChartData, type RealModellguete } from "@/lib/real-data";
import { useApp } from "@/lib/store";
import { Btn, Card, Chip, Modal, Sparkline } from "@/components/ui";

const SOLID_MODEL = "var(--color-brand-700)";
const SOLID_OTHER = "var(--color-navy-700)";
const SOLID_MUTED = "var(--color-ink-3)";

export default function ModellguetePage() {
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const { data: real } = useModellgueteReal();
  const [goldenOpen, setGoldenOpen] = useState(false);
  const gold = useMemo(() => evaluateGolden(t, lang), [t, lang]);
  const goldOk = gold.filter((g) => g.passed).length;
  const todayKey = new Date().toISOString().slice(0, 10);
  /* Echte Karten aus der Datenbank, sobald gemessen – sonst Demo-Format als Hülle. */
  const karten = real?.cards ?? getModellguete();

  const rankingCaption = (id: string) =>
    id === "R1"
      ? lang === "de" ? "Abwanderungsrate je Score-Band" : "Churn rate per score band"
      : id === "M5"
        ? lang === "de" ? "Füllrate je Peer-Band" : "Fill rate per peer band"
        : undefined;

  return (
    <div className="h-full overflow-y-auto">
      <div className="page space-y-4">
      {/* ---------------- intro ---------------- */}
      <div className="anim-fade-up">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-[8px] bg-surface-1 border border-line text-navy-800 grid place-items-center shrink-0">
            <ShieldCheck size={16} />
          </span>
          <h1 className="page-title">{t("modell.titel")}</h1>
        </div>
        <p className="page-sub max-w-3xl">
          {t("modell.intro", { datum: date("2026-10-06", loc) })}
        </p>
      </div>

      {/* ---------------- echte Modellmessung (Datenbank, temporal backtest) ---------------- */}
      <EchteMessung />

      {/* ---------------- Modellkarten ---------------- */}
      <div className="grid gap-3 xl:grid-cols-2 stagger">
        {karten.map((m) => (
          <Card key={m.id} className="anim-fade-up">
            <div className="px-5 pt-4 pb-5">
              {/* title + status */}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[14px] font-bold text-navy-800 leading-snug">{m.titel}</h2>
                {m.erfuellt ? (
                  <Chip tone="ok" className="shrink-0">
                    <CircleCheck size={11} /> {t("modell.erfüllt")}
                  </Chip>
                ) : (
                  <Chip tone="overdue" className="shrink-0">
                    <AlertTriangle size={11} /> {t("modell.nichtErreicht")}
                  </Chip>
                )}
              </div>

              {/* was macht das? */}
              <div className="mt-2.5">
                <p className="section-label">{t("modell.was")}</p>
                <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">{m.was[lang]}</p>
              </div>

              {/* metrics strip */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-[8px] bg-surface-1 border border-line px-2.5 py-2 min-w-0">
                  <p className="section-label leading-tight">{m.metrikName}</p>
                  <p className="tnum text-[18px] font-bold text-navy-800 mt-1.5 leading-none">{m.wertLabel}</p>
                </div>
                <div className="rounded-[8px] bg-surface-1 border border-line px-2.5 py-2 min-w-0">
                  <p className="section-label leading-tight">
                    {m.baselineName}
                  </p>
                  <p className="tnum text-[18px] font-bold text-ink-2 mt-1.5 leading-none">{m.baselineLabel}</p>
                </div>
                <div className="rounded-[8px] bg-surface-1 border border-line px-2.5 py-2 min-w-0">
                  <p className="section-label leading-tight">
                    {t("modell.ziel")}
                  </p>
                  <p className="text-[12px] font-semibold text-ink-2 mt-1.5 leading-snug">{m.ziel}</p>
                </div>
              </div>

              {/* chart */}
              <div className="mt-3 rounded-[8px] border border-line bg-surface-1 p-3">
                <ModellChart
                  chart={m.chart}
                  data={"chartData" in m ? (m.chartData as KartenChartData) : undefined}
                  caption={rankingCaption(m.id)}
                />
              </div>

              {/* bedeutet das? */}
              <div className="mt-3 pt-3 border-t border-line">
                <p className="section-label">{t("modell.bedeutet")}</p>
                <p className="text-[13px] text-ink mt-1 leading-relaxed">{m.bedeutet[lang]}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ---------------- Datenqualität ---------------- */}
      <div className="grid gap-3 xl:grid-cols-3">
        <Card
          className="anim-fade-up xl:col-span-2"
          title={t("modell.datenqualitaet")}
          hint={
            lang === "de"
              ? "Was vor dem Rechnen bereinigt wurde – und wie viele Messmittel es betrifft."
              : "What was cleaned before computing – and how many instruments it affects."
          }
        >
          <div className="pb-4 overflow-x-auto">
            <table className="tbl w-full text-[12.5px]">
              <thead>
                <tr className="text-[11px]">
                  <th className="text-left font-bold px-5 py-1.5">
                    {lang === "de" ? "Bereinigung" : "Cleanup"}
                  </th>
                  <th className="text-right font-bold px-5 py-1.5">{lang === "de" ? "Betroffen" : "Affected"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {DQ_REPORT.map((r, i) => (
                  <tr key={`${r.regel}-${i}`}>
                    <td className="px-5 py-1.5 text-ink">{r.beschreibung[lang]}</td>
                    <td className="px-5 py-1.5 tnum text-right text-ink-2 whitespace-nowrap">{num(r.betroffen, 0, loc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ---------------- Assistent ---------------- */}
        <Card
          className="anim-fade-up"
          title={t("modell.assistent")}
          hint={
            lang === "de"
              ? "20 Kontrollfragen – live gegen die Antwort-Engine geprüft, mit Beleg pro Frage."
              : "20 check questions – tested live against the answer engine, with evidence per question."
          }
          actions={
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => setGoldenOpen(true)}
            >
              {lang === "de" ? "Fragen ansehen" : "View questions"}
            </Btn>
          }
        >
          <div className="px-5 pb-5 pt-1 flex items-center gap-4">
            <p className="tnum text-[24px] font-bold text-navy-800 leading-none shrink-0">
              {goldOk}
              <span className="text-ink-3">/{gold.length}</span>
            </p>
            <div className="min-w-0">
              <Chip tone={goldOk === gold.length ? "ok" : "due"}>
                <CircleCheck size={11} />
                {lang === "de" ? "belegt aus den Daten" : "grounded in the data"}
              </Chip>
              <p className="text-[12px] text-ink-3 mt-1.5 leading-snug tnum">
                {lang === "de" ? `Live geprüft ${date(todayKey, loc)}` : `Checked live ${date(todayKey, loc)}`}
              </p>
            </div>
          </div>
        </Card>
        <Modal
          open={goldenOpen}
          onClose={() => setGoldenOpen(false)}
          title={lang === "de" ? "Golden-Set: 20 Kontrollfragen" : "Golden set: 20 check questions"}
          wide
        >
          <p className="text-[13px] text-ink-2 leading-relaxed mb-3">
            {lang === "de"
              ? "Jede Frage läuft live gegen die Antwort-Engine (Standard-Stichtag und -Einstellungen). Grün heißt: Antwort mit Beleg – Text plus passende Karte."
              : "Each question runs live against the answer engine (default reference date and settings). Green means: answered with evidence – text plus matching card."}
          </p>
          <div className="divide-y divide-[var(--color-line)]">
            {gold.map((g) => (
              <div key={g.id} className="py-2.5 flex items-start gap-2.5">
                <span
                  className={g.passed ? "w-2 h-2 rounded-full bg-ok shrink-0 mt-1.5" : "w-2 h-2 rounded-full bg-critical shrink-0 mt-1.5"}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink leading-snug">{g.question}</p>
                  <p className="text-[12px] text-ink-3 mt-0.5">{g.evidence}</p>
                </div>
                <Btn
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => {
                    setGoldenOpen(false);
                    window.dispatchEvent(new CustomEvent<string>("pecal-ask", { detail: g.question }));
                  }}
                >
                  {lang === "de" ? "Testen" : "Try"}
                </Btn>
              </div>
            ))}
          </div>
        </Modal>
      </div>

      {/* ---------------- Annahmen ---------------- */}
      <Card
        className="anim-fade-up"
        title={t("modell.annahmen")}
        hint={
          lang === "de"
            ? "Woran das Modell rechnet – jede Annahme ist offen dokumentiert."
            : "What the model assumes – every assumption documented openly."
        }
      >
        <div className="pb-4 overflow-x-auto">
          <table className="tbl w-full text-[12.5px]">
            <thead>
              <tr className="text-[11px]">
                <th className="text-left font-bold px-5 py-1.5">{lang === "de" ? "Annahme" : "Assumption"}</th>
                <th className="text-left font-bold px-3 py-1.5">{t("common.wert")}</th>
                <th className="text-left font-bold px-3 py-1.5">{t("modell.quelle")}</th>
                <th className="text-left font-bold px-5 py-1.5">{t("modell.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {ANNAHMEN.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-1.5 text-ink font-medium min-w-[200px]">{a.titel}</td>
                  <td className="px-3 py-1.5 tnum text-ink-2 whitespace-nowrap">{a.wert}</td>
                  <td className="px-3 py-1.5 text-ink-2 min-w-[240px]">{a.quelle}</td>
                  <td className="px-5 py-1.5">
                    {a.status === "angenommen" ? (
                      <Chip tone="due">{t("modell.angenommen")}</Chip>
                    ) : (
                      <Chip tone="ok">{t("modell.gelernt")}</Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------------- footnote ---------------- */}
      <p className="text-[12px] text-ink-3 leading-relaxed flex items-start gap-1.5 max-w-4xl">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>
          {real
            ? lang === "de"
              ? `Alle Kennzahlen oben stammen aus echter Messung vom ${date(real.generated_at.slice(0, 10), loc)} über alle Datenbanktabellen (Backtests ohne Leakage) – ehrlich gemessen, nichts geschönt. Neues Daten-Update, Skript neu laufen lassen, Seite neu laden.`
              : `All figures above come from real measurement as of ${date(real.generated_at.slice(0, 10), loc)} across all database tables (leakage-free backtests) – honestly measured, nothing smoothed. New data update, rerun the script, reload the page.`
            : lang === "de"
              ? "Alle Kennzahlen stammen aus der Holdout-Messung vom 06.10.2026 – ehrlich gemessen, nichts geschönt. In dieser Demo sind sie fest eingebettet; jeder Pipeline-Lauf berechnet sie neu."
              : "All metrics come from the holdout measurement of 06/10/2026 – honestly measured, nothing smoothed. They are embedded in this demo; every pipeline run recalculates them."}
        </span>
      </p>
      </div>
    </div>
  );
}

/* ============================== echte Messung ==============================
 * Real churn backtest over ALL csv tables (scripts/train_churn.py):
 * features as of cutoff -> label = silent in the next 180 days.
 * Renders only when public/data/modellguete-real.json exists. */

function EchteMessung() {
  const { lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const { data } = useModellgueteReal();
  if (!data) return null;
  const best = data.models.reduce((a, b) => (b.pr_auc > a.pr_auc ? b : a), data.models[0]);
  const maxImp = Math.max(...data.importances.map((i) => i.value), 0.001);

  return (
    <Card
      className="anim-fade-up"
      title={lang === "de" ? "Echte Modellmessung: Churn" : "Real model measurement: churn"}
      hint={
        lang === "de"
          ? `Datenbank · Merkmale zum Stichtag ${date(data.cutoff, loc)} → still in den nächsten ${data.outcome_window_days} Tagen? Kein Leakage durch Konstruktion.`
          : `Database · features as of ${date(data.cutoff, loc)} → silent in the next ${data.outcome_window_days} days? No leakage by construction.`
      }
      actions={
        <span className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full bg-[#e7f6ef] border border-[#c4e8d8] text-[#1c6e4a] text-[11px] font-bold whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-ok" />
          {lang === "de" ? `Gemessen ${date(data.generated_at.slice(0, 10), loc)}` : `Measured ${date(data.generated_at.slice(0, 10), loc)}`}
        </span>
      }
    >
      <div className="px-5 pb-5 space-y-4">
        <div className="min-w-0">
          <p className="section-label mb-2">{lang === "de" ? "Modellvergleich (Holdout)" : "Model comparison (holdout)"}</p>
          <div className="overflow-x-auto rounded-[8px] border border-line">
            <table className="tbl w-full text-[12.5px] min-w-[420px]">
              <thead>
                <tr className="text-[11px]">
                  <th className="text-left font-bold px-3 py-2">{lang === "de" ? "Modell" : "Model"}</th>
                  <th className="text-right font-bold px-3 py-2">ROC-AUC</th>
                  <th className="text-right font-bold px-3 py-2">PR-AUC</th>
                  <th className="text-right font-bold px-3 py-2">{lang === "de" ? "Präzision@100" : "Precision@100"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {data.models.map((m) => (
                  <tr key={m.id} className={m.id === best.id ? "bg-brand-50/60" : undefined}>
                    <td className="px-3 py-2 font-semibold text-ink">
                      {m.id}
                      {m.id === best.id && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                          {lang === "de" ? "Sieger" : "Winner"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tnum text-ink-2">{m.roc_auc.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right tnum font-bold text-navy-800">{m.pr_auc.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right tnum text-ink-2">{pct(m.precision_at_100, 0, loc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-ink-3 mt-2 leading-relaxed tnum">
            {num(data.n_customers, 0, loc)} {lang === "de" ? "Kunden" : "customers"} · Train {num(data.n_train, 0, loc)} / Test{" "}
            {num(data.n_test, 0, loc)} · Churn-Rate {pct(data.churn_rate, 1, loc)}
          </p>
          <p className="text-[11.5px] text-ink-3 mt-1 leading-relaxed">
            {lang === "de"
              ? "Hinweis: Die Gerätezahl stammt aus dem aktuellen Stamm und kann schmeicheln – wer abwandert, meldet Geräte eher ab. Echte Zahl, ehrliche Unsicherheit."
              : "Caveat: instrument counts come from the current master and may flatter – churned customers tend to deregister equipment. Real figure, honest uncertainty."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <p className="section-label mb-2">{lang === "de" ? "Kalibrierung: vorhergesagt vs. beobachtet" : "Calibration: predicted vs. observed"}</p>
            <KalibrierMini data={data} />
          </div>
          <div className="min-w-0">
            <p className="section-label mb-2">{lang === "de" ? "Wichtigste Merkmale" : "Top features"}</p>
            <div className="space-y-1.5">
              {data.importances.slice(0, 6).map((f) => (
                <div key={f.feature}>
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-[12px] text-ink-2 truncate">{prettyFeature(f.feature, lang)}</span>
                    <span className="tnum text-[11px] font-bold text-navy-800">{f.value.toFixed(3)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-navy-800" style={{ width: `${Math.max(4, (f.value / maxImp) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function prettyFeature(f: string, lang: "de" | "en"): string {
  let base = f;
  for (const p of ["branche:", "branche="]) {
    if (base.startsWith(p)) {
      base = base.slice(p.length);
      break;
    }
  }
  if (base.startsWith("branche_")) base = base.slice("branche_".length); // alte JSONs
  const map: Record<string, string> = {
    n_instruments: lang === "de" ? "Geräte im Stamm" : "instruments on file",
    n_cal_12m: lang === "de" ? "Kalibrierungen (12 M.)" : "calibrations (12 mo)",
    recency_days: lang === "de" ? "Tage seit letzter Kalibrierung" : "days since last calibration",
    tenure_days: lang === "de" ? "Kundenalter (Tage)" : "customer tenure (days)",
    trend: lang === "de" ? "Mengentrend" : "volume trend",
    dakks_share: "DAkkS-Anteil",
    fail_share: lang === "de" ? "Durchfallanteil" : "fail share",
  };
  if (base in map) return map[base];
  return lang === "de" ? `Branche ${base}` : `Industry ${base}`;
}

function KalibrierMini({ data }: { data: RealModellguete }) {
  const w = 260;
  const h = 150;
  const pad = 26;
  const x = (v: number) => pad + v * (w - pad - 8);
  const y = (v: number) => h - pad - v * (h - pad - 8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="calibration">
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={pad - 4} y2={h - pad} stroke="var(--color-line)" strokeDasharray="2 4" />
          <line x1={pad} x2={w - 8} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="2 4" />
        </g>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--color-ink-3)" strokeWidth="1.4" strokeDasharray="5 4" />
      {data.calibration.map((b) => (
        <circle key={b.bin} cx={x(b.predicted)} cy={y(b.observed)} r="4" fill="var(--color-brand-700)">
          <title>{`P ${Math.round(b.predicted * 100)} % → ${Math.round(b.observed * 100)} % (n=${b.n})`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ============================== charts ============================== */

function ModellChart({ chart, data, caption }: { chart: string; data?: KartenChartData; caption?: string }) {
  const app = useApp();
  const { lang } = useI18n();

  if (chart === "ruecklauf") return <RuecklaufChart buckets={data?.buckets} />;
  if (chart === "precision") return <PrecisionChart points={data?.points} />;
  if (chart === "volumen") return <VolumenChart series={data?.series ?? []} />;
  if (chart === "ranking") return <RankingChart bars={data?.bars} caption={caption} />;
  if (chart === "kalibrierung") return <KalibrierungChart />;
  return <Sparkline data={getPrognoseGesamt(app.stichtag)} showBaseline lang={lang} height={170} />;
}

function ChartLegend({ entries }: { entries: { label: string; swatch: ReactNode }[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3">
      {entries.map((e) => (
        <span key={e.label} className="inline-flex items-center gap-1.5">
          {e.swatch}
          {e.label}
        </span>
      ))}
    </div>
  );
}

/* ---- M1: Durchlaufzeit-Histogramm (echte Buckets oder Demo-Fallback) ---- */
function RuecklaufChart({ buckets }: { buckets?: { bucket: string; anteil: number }[] }) {
  const { lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const real = buckets !== undefined;
  const rows = buckets ?? RUECKLAUF_HISTOGRAMM;
  const max = Math.max(...rows.map((d) => d.anteil));

  return (
    <div>
      <p className="section-label mb-2">
        {real
          ? lang === "de" ? "Tage von Beauftragung bis Abschluss" : "Days from order to completion"
          : lang === "de" ? "Eingang relativ zur Fälligkeit" : "Arrival relative to the due date"}
      </p>
      <div className="flex items-end gap-2 h-[160px]">
        {rows.map((d) => (
          <div key={d.bucket} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end">
            <span className="tnum text-[10px] text-ink-3 mb-1">{pct(d.anteil, 0, loc)}</span>
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: `${Math.max(3, (d.anteil / max) * 130)}px`,
                background: d.anteil === max ? SOLID_MODEL : SOLID_OTHER,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-line mt-1 pt-1.5">
        {rows.map((d) => (
          <span key={d.bucket} className="flex-1 min-w-0 text-center text-[10px] leading-tight text-ink-3">
            {d.bucket}
          </span>
        ))}
      </div>
      <ChartLegend
        entries={[
          {
            label: real
              ? lang === "de" ? "Anteil der Positionen" : "Share of lines"
              : lang === "de" ? "Anteil der Eingänge" : "Share of arrivals",
            swatch: <span className="w-3 h-3 rounded-[4px]" style={{ background: "var(--color-brand)" }} />,
          },
        ]}
      />
    </div>
  );
}

/* ---- M3: precision@k (echte Kurve oder Demo-Fallback, dynamische Y-Skala) ---- */
function PrecisionChart({ points }: { points?: { k: number; modell: number; baseline: number }[] }) {
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const pts = points ?? getPrecisionKurve();
  const w = 460;
  const h = 200;
  const pad = { l: 42, r: 12, t: 12, b: 30 };
  const lo = Math.max(0, Math.floor(Math.min(...pts.flatMap((p) => [p.modell, p.baseline])) * 20) / 20 - 0.05);
  const x = (k: number) => pad.l + ((k - 10) / 190) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1 - lo, 0.01)) * (h - pad.t - pad.b);
  const path = (key: "modell" | "baseline") =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.k).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const yTicks = [lo, +(((lo + 1) / 2).toFixed(2)), 1];
  const xTicks = [10, 50, 100, 150, 200];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="precision@k">
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-line)"
              strokeDasharray="2 4"
            />
            <text
              x={pad.l - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="10"
              className="tnum"
              fill="var(--color-ink-3)"
            >
              {pct(v, 0, loc)}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={h - pad.b} stroke="var(--color-line-strong)" />
        <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke="var(--color-line-strong)" />
        {xTicks.map((k) => (
          <text
            key={k}
            x={x(k)}
            y={h - pad.b + 14}
            textAnchor="middle"
            fontSize="10"
            className="tnum"
            fill="var(--color-ink-3)"
          >
            {k}
          </text>
        ))}
        <text x={w - pad.r} y={h - 4} textAnchor="end" fontSize="10" fontWeight="700" fill="var(--color-ink-3)">
          k
        </text>
        <path d={path("baseline")} fill="none" stroke="var(--color-ink-3)" strokeWidth="1.5" strokeDasharray="5 4" />
        <path d={path("modell")} fill="none" stroke="var(--color-brand-700)" strokeWidth="2" />
      </svg>
      <ChartLegend
        entries={[
          {
            label: lang === "de" ? "Modell" : "Model",
            swatch: <span className="w-4 h-[3px] rounded-full bg-brand-700" />,
          },
          {
            label: t("modell.baseline"),
            swatch: <span className="w-4 border-t-2 border-dashed border-ink-3" />,
          },
        ]}
      />
    </div>
  );
}

/* ---- M4: Prognose (Sparkline) handled in ModellChart ---- */

/* ---- M5: Kalibrierung (SVG scatter + diagonal) ---- */
function KalibrierungChart() {
  const { t, lang } = useI18n();
  const pts = getKalibrierungskurve();
  const w = 300;
  const h = 230;
  const pad = { l: 56, r: 16, t: 12, b: 38 };
  const x = (v: number) => pad.l + v * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v) * (h - pad.t - pad.b);
  const ticks = [0, 0.5, 1];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Kalibrierung">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={pad.t} y2={h - pad.b} stroke="var(--color-line)" strokeDasharray="2 4" />
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="2 4" />
            <text
              x={x(v)}
              y={h - pad.b + 14}
              textAnchor="middle"
              fontSize="10"
              className="tnum"
              fill="var(--color-ink-3)"
            >
              {Math.round(v * 100)} %
            </text>
            <text
              x={pad.l - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="10"
              className="tnum"
              fill="var(--color-ink-3)"
            >
              {Math.round(v * 100)} %
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={h - pad.b} stroke="var(--color-line-strong)" />
        <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke="var(--color-line-strong)" />
        {/* ideal diagonal */}
        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(1)}
          y2={y(1)}
          stroke="var(--color-ink-3)"
          strokeWidth="1.4"
          strokeDasharray="5 4"
        />
        {/* scatter */}
        {pts.map((p) => (
          <circle key={p.x} cx={x(p.x)} cy={y(p.modell)} r="4" fill="var(--color-brand-700)" />
        ))}
        <text
          x={w / 2}
          y={h - 6}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-3)"
          fontWeight="700"
        >
          {lang === "de" ? "vorhergesagt" : "predicted"}
        </text>
        <text
          transform={`rotate(-90 12 ${h / 2})`}
          x={12}
          y={h / 2}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-3)"
          fontWeight="700"
        >
          {lang === "de" ? "beobachtet" : "observed"}
        </text>
      </svg>
      <ChartLegend
        entries={[
          {
            label: t("modell.modell"),
            swatch: <span className="w-2.5 h-2.5 rounded-full bg-brand-700" />,
          },
          {
            label: lang === "de" ? "Idealdiagonale" : "Ideal diagonal",
            swatch: <span className="w-4 border-t-2 border-dashed border-ink-3" />,
          },
        ]}
      />
    </div>
  );
}

/* ---- Ranking: drei Bänder (echt oder Demo-Fallback) ---- */
function RankingChart({ bars, caption }: { bars?: { label: string; v: number }[]; caption?: string }) {
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const rows = bars ?? [
    { label: t("prioritaet.hoch"), v: 0.54 },
    { label: t("prioritaet.mittel"), v: 0.33 },
    { label: t("prioritaet.niedrig"), v: 0.19 },
  ];
  const bgs = [SOLID_MODEL, SOLID_OTHER, SOLID_MUTED];
  const max = Math.max(...rows.map((r) => r.v), 0.01);

  return (
    <div>
      <p className="section-label mb-2">
        {caption ?? (lang === "de" ? "Volumen unter Erwartung" : "Volume below expectation")}
      </p>
      <div className="flex items-end gap-5 h-[160px] px-1">
        {rows.map((b, i) => (
          <div key={b.label} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end">
            <span className="tnum text-[12.5px] font-bold text-navy-800 mb-1">{pct(b.v, 0, loc)}</span>
            <div
              className="w-full rounded-t-[4px]"
              style={{ height: `${Math.max(3, (b.v / max) * 128)}px`, background: bgs[i % bgs.length] }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-5 px-1 border-t border-line mt-1 pt-1.5">
        {rows.map((b) => (
          <span key={b.label} className="flex-1 min-w-0 text-center text-[12px] font-semibold text-ink-2">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- M4: echter Volumen-Backtest (Eingang vs. Modell vs. Saison-naiv) ---- */
function VolumenChart({ series }: { series?: { label: string; actual: number; modell: number; baseline: number }[] }) {
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  if (!series || series.length === 0) return null;
  return (
    <div>
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10, fill: "#6d7378" }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "#6d7378" }}
              width={36}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
            />
            <Tooltip
              content={(p: unknown) => {
                const { active, payload, label } = p as {
                  active?: boolean;
                  payload?: { value?: unknown }[];
                  label?: string;
                };
                if (!active || !payload || payload.length === 0 || !label) return null;
                const row = series.find((s) => s.label === label);
                if (!row) return null;
                return (
                  <div className="chart-tip">
                    <p className="t-sub">{label}</p>
                    <p className="font-bold tnum">
                      {lang === "de" ? "Eingang" : "Intake"} {num(row.actual, 0, loc)}
                    </p>
                    <p className="tnum">
                      {lang === "de" ? "Modell" : "Model"} {num(row.modell, 0, loc)} · {t("modell.baseline")}{" "}
                      {num(row.baseline, 0, loc)}
                    </p>
                  </div>
                );
              }}
              cursor={{ stroke: "var(--color-line-strong)", strokeDasharray: "3 3" }}
            />
            <Line dataKey="actual" stroke="var(--color-navy-800)" strokeWidth={2.2} dot={false} />
            <Line dataKey="modell" stroke="var(--color-brand-700)" strokeWidth={2.2} strokeDasharray="6 4" dot={false} />
            <Line dataKey="baseline" stroke="var(--color-ink-3)" strokeWidth={1.6} strokeDasharray="1 5" strokeLinecap="round" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        entries={[
          {
            label: lang === "de" ? "Echter Eingang" : "Actual intake",
            swatch: <span className="w-4 h-[3px] rounded-full bg-navy-800" />,
          },
          {
            label: lang === "de" ? "Modell" : "Model",
            swatch: <span className="w-4 h-[3px] rounded-full bg-brand-700" />,
          },
          {
            label: t("modell.baseline"),
            swatch: <span className="w-4 border-t-2 border-dotted border-ink-3" />,
          },
        ]}
      />
    </div>
  );
}
