"use client";

import { AlertTriangle, CircleCheck, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import {
  ANNAHMEN,
  ASSISTENT_EVAL,
  DQ_REPORT,
  RUECKLAUF_HISTOGRAMM,
  getKalibrierungskurve,
  getModellguete,
  getPrecisionKurve,
  getPrognoseGesamt,
  type Modellkarte,
} from "@/lib/data";
import { date, num, pct } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { Card, Chip, Sparkline } from "@/components/ui";

const GRADIENT_MODEL = "linear-gradient(180deg, var(--color-brand), var(--color-brand-700))";
const GRADIENT_OTHER = "linear-gradient(180deg, var(--color-navy-600), var(--color-navy-700))";

export default function ModellguetePage() {
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const karten = getModellguete();

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      {/* ---------------- intro ---------------- */}
      <div className="mb-4 anim-fade-up">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-[9px] bg-azure-100 text-azure-800 grid place-items-center shrink-0">
            <ShieldCheck size={16} />
          </span>
          <h1 className="text-[20px] font-bold leading-tight text-navy-800">{t("modell.titel")}</h1>
        </div>
        <p className="text-[13px] text-ink-2 mt-2 max-w-3xl leading-relaxed">
          {t("modell.intro", { datum: date("2026-10-06", loc) })}
        </p>
      </div>

      {/* ---------------- Modellkarten ---------------- */}
      <div className="grid gap-3 xl:grid-cols-2 mb-3 stagger">
        {karten.map((m) => (
          <Card key={m.id} className="anim-fade-up">
            <div className="px-4 pt-3.5 pb-4">
              {/* title + status */}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[14.5px] font-bold text-navy-800 leading-snug">{m.titel}</h2>
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
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">{t("modell.was")}</p>
                <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">{m.was[lang]}</p>
              </div>

              {/* metrics strip */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-[9px] bg-surface-1 border border-line px-2.5 py-2 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3 leading-tight">{m.metrikName}</p>
                  <p className="tnum text-[19px] font-bold text-navy-800 mt-1.5 leading-none">{m.wertLabel}</p>
                </div>
                <div className="rounded-[9px] bg-surface-1 border border-line px-2.5 py-2 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3 leading-tight">
                    {m.baselineName}
                  </p>
                  <p className="tnum text-[19px] font-bold text-ink-2 mt-1.5 leading-none">{m.baselineLabel}</p>
                </div>
                <div className="rounded-[9px] bg-surface-1 border border-line px-2.5 py-2 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3 leading-tight">
                    {t("modell.ziel")}
                  </p>
                  <p className="text-[12px] font-semibold text-ink-2 mt-1.5 leading-snug">{m.ziel}</p>
                </div>
              </div>

              {/* chart */}
              <div className="mt-3 rounded-[10px] border border-line bg-surface-1 p-3">
                <ModellChart chart={m.chart} />
              </div>

              {/* bedeutet das? */}
              <div className="mt-3 pt-3 border-t border-line">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">{t("modell.bedeutet")}</p>
                <p className="text-[13px] text-ink mt-1 leading-relaxed">{m.bedeutet[lang]}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ---------------- Datenqualität ---------------- */}
      <div className="grid gap-3 xl:grid-cols-3 mb-3">
        <Card
          className="anim-fade-up xl:col-span-2"
          title={t("modell.datenqualitaet")}
          hint={
            lang === "de"
              ? "Regeln, die der Pipeline-Lauf auf die Rohdaten angewendet hat."
              : "Rules the pipeline run applied to the raw data."
          }
        >
          <div className="pb-3.5 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-surface-1 text-[10.5px] uppercase tracking-wider text-ink-3">
                  <th className="text-left font-bold px-3 py-1.5">{lang === "de" ? "Regel" : "Rule"}</th>
                  <th className="text-right font-bold px-3 py-1.5">{lang === "de" ? "Betroffen" : "Affected"}</th>
                  <th className="text-left font-bold px-3 py-1.5">
                    {lang === "de" ? "Beschreibung" : "Description"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {DQ_REPORT.map((r, i) => (
                  <tr key={`${r.regel}-${i}`} className="even:bg-surface-1/60">
                    <td className="px-3 py-1.5 tnum font-semibold text-navy-800">{r.regel}</td>
                    <td className="px-3 py-1.5 tnum text-right text-ink-2">{num(r.betroffen, 0, loc)}</td>
                    <td className="px-3 py-1.5 text-ink">{r.beschreibung[lang]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ---------------- Assistent ---------------- */}
        <Card className="anim-fade-up" title={t("modell.assistent")}>
          <div className="px-4 pb-4 pt-1 flex items-center gap-4">
            <p className="tnum text-[34px] font-bold text-navy-800 leading-none shrink-0">
              {ASSISTENT_EVAL.richtig}
              <span className="text-ink-3">/{ASSISTENT_EVAL.gesamt}</span>
            </p>
            <div className="min-w-0">
              <Chip tone="ok">
                <CircleCheck size={11} />
                {lang === "de" ? "belegt aus den Daten" : "grounded in the data"}
              </Chip>
              <p className="text-[11.5px] text-ink-3 mt-1.5 leading-snug tnum">
                {lang === "de" ? "Golden-Set, Stand 06.10.2026" : "Golden set, as of 06/10/2026"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------- Annahmen ---------------- */}
      <Card
        className="mb-3 anim-fade-up"
        title={t("modell.annahmen")}
        hint={
          lang === "de"
            ? "Woran das Modell rechnet – jede Annahme ist offen dokumentiert."
            : "What the model assumes – every assumption documented openly."
        }
      >
        <div className="pb-3.5 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-surface-1 text-[10.5px] uppercase tracking-wider text-ink-3">
                <th className="text-left font-bold px-3 py-1.5">ID</th>
                <th className="text-left font-bold px-3 py-1.5">{lang === "de" ? "Titel" : "Title"}</th>
                <th className="text-left font-bold px-3 py-1.5">{t("common.wert")}</th>
                <th className="text-left font-bold px-3 py-1.5">{t("modell.quelle")}</th>
                <th className="text-left font-bold px-3 py-1.5">{t("modell.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {ANNAHMEN.map((a) => (
                <tr key={a.id} className="even:bg-surface-1/60">
                  <td className="px-3 py-1.5 tnum font-semibold text-navy-800 whitespace-nowrap">{a.id}</td>
                  <td className="px-3 py-1.5 text-ink font-medium min-w-[200px]">{a.titel}</td>
                  <td className="px-3 py-1.5 tnum text-ink-2 whitespace-nowrap">{a.wert}</td>
                  <td className="px-3 py-1.5 text-ink-2 min-w-[240px]">{a.quelle}</td>
                  <td className="px-3 py-1.5">
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
      <p className="mb-2 text-[11.5px] text-ink-3 leading-relaxed flex items-start gap-1.5 max-w-4xl">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>
          {lang === "de"
            ? "Alle Kennzahlen stammen aus dem Pipeline-Lauf (Holdout), Baselines in Klammern bzw. in der Baseline-Spalte – ehrlich gemessen, nichts geschönt. Wird ein Ziel verfehlt, wird die Baseline ausgeliefert."
            : "All metrics come from the pipeline run (holdout), baselines in parentheses and in the baseline column – honestly measured, nothing smoothed. When a target is missed, the baseline is shipped."}
        </span>
      </p>
    </div>
  );
}

/* ============================== charts ============================== */

function ModellChart({ chart }: { chart: Modellkarte["chart"] }) {
  const app = useApp();
  const { lang } = useI18n();

  if (chart === "ruecklauf") return <RuecklaufChart />;
  if (chart === "precision") return <PrecisionChart />;
  if (chart === "kalibrierung") return <KalibrierungChart />;
  if (chart === "ranking") return <RankingChart />;
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

/* ---- M1/M2: Rücklauf-Histogramm (flex columns) ---- */
function RuecklaufChart() {
  const { lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const max = Math.max(...RUECKLAUF_HISTOGRAMM.map((d) => d.anteil));

  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3 mb-2">
        {lang === "de" ? "Eingang relativ zur Fälligkeit" : "Arrival relative to the due date"}
      </p>
      <div className="flex items-end gap-2 h-[170px]">
        {RUECKLAUF_HISTOGRAMM.map((d) => (
          <div key={d.bucket} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end">
            <span className="tnum text-[10.5px] text-ink-3 mb-1">{pct(d.anteil, 0, loc)}</span>
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: `${Math.max(3, (d.anteil / max) * 140)}px`,
                background: d.anteil === max ? GRADIENT_MODEL : GRADIENT_OTHER,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-line-strong mt-1 pt-1.5">
        {RUECKLAUF_HISTOGRAMM.map((d) => (
          <span key={d.bucket} className="flex-1 min-w-0 text-center text-[9.5px] leading-tight text-ink-3">
            {d.bucket}
          </span>
        ))}
      </div>
      <ChartLegend
        entries={[
          {
            label: lang === "de" ? "Anteil der Eingänge" : "Share of arrivals",
            swatch: <span className="w-3 h-3 rounded-[3px]" style={{ background: "var(--color-brand)" }} />,
          },
        ]}
      />
    </div>
  );
}

/* ---- M3: precision@k (SVG polylines) ---- */
function PrecisionChart() {
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const pts = getPrecisionKurve();
  const w = 460;
  const h = 200;
  const pad = { l: 42, r: 12, t: 12, b: 30 };
  const x = (k: number) => pad.l + ((k - 10) / 190) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - 0.15) / 0.7) * (h - pad.t - pad.b);
  const path = (key: "modell" | "baseline") =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.k).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const yTicks = [0.2, 0.4, 0.6, 0.8];
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
              fontSize="9.5"
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
            fontSize="9.5"
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
              fontSize="9.5"
              className="tnum"
              fill="var(--color-ink-3)"
            >
              {Math.round(v * 100)} %
            </text>
            <text
              x={pad.l - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="9.5"
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
          fontSize="9.5"
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
          fontSize="9.5"
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

/* ---- Ranking: three-band comparison ---- */
function RankingChart() {
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const bars = [
    { label: t("prioritaet.hoch"), v: 54, bg: GRADIENT_MODEL },
    { label: t("prioritaet.mittel"), v: 33, bg: GRADIENT_OTHER },
    {
      label: t("prioritaet.niedrig"),
      v: 19,
      bg: "linear-gradient(180deg, var(--color-line-strong), var(--color-ink-3))",
    },
  ];
  const max = 60;

  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3 mb-2">
        {lang === "de" ? "Volumen unter Erwartung" : "Volume below expectation"}
      </p>
      <div className="flex items-end gap-5 h-[150px] px-1">
        {bars.map((b) => (
          <div key={b.label} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end">
            <span className="tnum text-[12.5px] font-bold text-navy-800 mb-1">{pct(b.v / 100, 0, loc)}</span>
            <div
              className="w-full rounded-t-[5px]"
              style={{ height: `${Math.max(3, (b.v / max) * 118)}px`, background: b.bg }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-5 px-1 border-t border-line-strong mt-1 pt-1.5">
        {bars.map((b) => (
          <span key={b.label} className="flex-1 min-w-0 text-center text-[11.5px] font-semibold text-ink-2">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
