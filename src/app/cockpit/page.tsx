"use client";
import clsx from "clsx";
import { AlertTriangle, ArrowRight, Calendar, ChartLine, ChevronRight, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  ANLASS_ERFOLGSCHANCE,
  HEADLINE,
  USERS,
  getCockpitAggregates,
  getErgebnisVerteilung,
  getErfolgsquote,
  getPrognoseGesamt,
  getTeam,
  getVerlust,
} from "@/lib/data";
import { euro, num, pct } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { Card, Sparkline } from "@/components/ui";
const GRADIENT_BRANCHE = "linear-gradient(90deg, var(--color-brand-700), var(--color-brand))";
const OUTCOME_COLORS = ["#10b981", "#2563eb", "#94a3b8", "#f59e0b", "#8b5cf6", "#64748b", "#cbd5e1"];
export default function CockpitPage() {
  const app = useApp();
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const [showBaseline, setShowBaseline] = useState(false);
  if (app.user.role !== "leitung") {
    return (
      <div className="h-full overflow-y-auto px-5 py-4">
        <div className="max-w-xl mx-auto card p-8 text-center mt-10 anim-fade-up">
          <p className="text-[15px] font-bold text-slate-900">
            {lang === "de" ? "Cockpit ist der Vertriebsleitung vorbehalten." : "The cockpit is reserved for sales management."}
          </p>
          <p className="text-[13px] text-slate-500 mt-1.5">
            {lang === "de"
              ? "Wechseln Sie oben rechts zu Thomas Brandt, um Prognose, Risiko und Team zu sehen – oder arbeiten Sie mit Dashboard und Tagesliste weiter."
              : "Switch to Thomas Brandt (top right) to see forecast, risk and team – or continue with dashboard and daily list."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-[13px] font-semibold">
              {t("nav.dashboard")}
            </Link>
            <Link href="/tagesliste" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] border border-slate-200 text-[13px] font-semibold text-slate-700">
              {t("nav.tagesliste")}
            </Link>
          </div>
        </div>
      </div>
    );
  }
  const agg = getCockpitAggregates();
  const prognose = getPrognoseGesamt(app.stichtag);
  const f12 = prognose.filter((d) => !d.historie);
  const fTotal = f12.reduce((s, d) => s + d.kalibrierungen, 0);
  const fPeak = f12.reduce((a, b) => (b.kalibrierungen > a.kalibrierungen ? b : a), f12[0]);
  const fLast = f12[f12.length - 1];
  const fBandPct = fLast ? Math.round(((fLast.p90 - fLast.p10) / Math.max(1, fLast.kalibrierungen)) * 50) : 0;
  const kpis = [
    {
      label: t("cockpit.kpi.faellig3m"),
      value: num(agg.faellig3Monate, 0, loc),
      hint: t("cockpit.kpi.faellig3mHint"),
      accent: "#3b9ee3",
      icon: Calendar,
    },
    {
      label: t("cockpit.kpi.umsatz12m"),
      value: euro(agg.umsatz12m, loc),
      hint: t("cockpit.kpi.umsatz12mHint"),
      accent: "#ff7000",
      icon: ChartLine,
    },
    {
      label: t("cockpit.kpi.atRisk"),
      value: euro(agg.atRisk, loc),
      hint: t("cockpit.kpi.atRiskHint"),
      accent: "#B97A00",
      icon: TrendingDown,
    },
    {
      label: t("cockpit.kpi.ueberfaellig"),
      value: num(HEADLINE.ueberfaellig, 0, loc),
      hint: t("cockpit.kpi.ueberfaelligHint"),
      accent: "#D9480F",
      icon: AlertTriangle,
    },
  ];
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      {/* ---------------- intro ---------------- */}
      <div className="flex items-end justify-between gap-3 mb-4 anim-fade-up">
        <div>
          <h1 className="text-[20px] font-bold leading-tight text-navy-800">{t("cockpit.titel")}</h1>
          <p className="text-[13px] text-ink-2 mt-0.5">
            {lang === "de"
              ? "Portfolio auf einen Blick: Fälligkeiten, Umsatz – und wo er gefährdet ist."
              : "The portfolio at a glance: due dates, revenue – and where it is at risk."}
          </p>
        </div>
        <span className="hidden lg:inline-flex items-center gap-2 h-[26px] pl-2.5 pr-3 rounded-full bg-surface-0 border border-line text-[11.5px] text-ink-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          {lang === "de" ? "Stichtag" : "Reference date"}
          <span className="tnum font-semibold text-navy-800">{app.stichtag}</span>
        </span>
      </div>
      {/* ---------------- KPIs ---------------- */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 stagger mb-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card p-4 relative overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: k.accent }} />
              <span
                className="absolute right-3.5 top-3.5 w-8 h-8 rounded-full grid place-items-center"
                style={{ background: `${k.accent}1a` }}
              >
                <Icon size={16} style={{ color: k.accent }} />
              </span>
              <p className="text-[10.5px] tracking-wider text-ink-3 font-bold uppercase pr-9 leading-tight">{k.label}</p>
              <p className="tnum text-[26px] font-bold text-navy-800 leading-tight mt-2 whitespace-nowrap">{k.value}</p>
              <p className="text-[11.5px] text-ink-3 mt-1.5 leading-snug">{k.hint}</p>
            </div>
          );
        })}
      </div>
      {/* ---------------- forecast ---------------- */}
      <Card
        className="mb-3 anim-fade-up"
        title={t("cockpit.forecast")}
        hint={t("cockpit.forecastHint")}
        actions={
          <button
            onClick={() => setShowBaseline((v) => !v)}
            title={
              lang === "de"
                ? "Saison-naive Baseline: nimmt den Vorjahresmonat als Prognose. Dient als Vergleich – liegt unsere Prognose näher an der Wirklichkeit, lohnt sich das Modell."
                : "Seasonal-naive baseline: uses last year's month as the forecast. Serves as comparison – if our forecast is closer to reality, the model earns its keep."
            }
            className={clsx(
              "inline-flex items-center gap-2 h-[30px] px-2.5 rounded-[8px] border text-[12px] font-semibold transition-all",
              showBaseline
                ? "bg-navy-800 border-navy-800 text-white"
                : "bg-surface-0 border-line text-ink-2 hover:border-line-strong",
            )}
          >
            <span
              className={clsx(
                "w-3.5 h-3.5 rounded-[4px] border grid place-items-center",
                showBaseline ? "bg-brand border-brand" : "bg-surface-0 border-line-strong",
              )}
            >
              {showBaseline && <span className="w-1.5 h-1.5 rounded-[1px] bg-white" />}
            </span>
            {t("cockpit.baseline")}
          </button>
        }
      >
        <div className="px-4 pb-4">
          <Sparkline data={getPrognoseGesamt(app.stichtag)} showBaseline={showBaseline} lang={lang} height={200} />
          <div className="mt-3 grid sm:grid-cols-3 gap-2">
            <div className="rounded-[10px] bg-surface-1 border border-line px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{lang === "de" ? "Prognose 12 Monate" : "12-month forecast"}</p>
              <p className="tnum text-[16px] font-bold text-navy-800">{num(fTotal, 0, loc)}</p>
            </div>
            <div className="rounded-[10px] bg-surface-1 border border-line px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{lang === "de" ? "Stärkster Monat" : "Peak month"}</p>
              <p className="tnum text-[16px] font-bold text-navy-800">{fPeak.monat.slice(5)}/{fPeak.monat.slice(2, 4)} · {num(fPeak.kalibrierungen, 0, loc)}</p>
            </div>
            <div className="rounded-[10px] bg-surface-1 border border-line px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{lang === "de" ? "Unsicherheit am Ende" : "Uncertainty at end"}</p>
              <p className="tnum text-[16px] font-bold text-navy-800">± {num(fBandPct, 0, loc)} %</p>
            </div>
          </div>
          <p className="text-[12px] text-ink-2 mt-2.5 leading-relaxed">
            {lang === "de"
              ? "Lesart für die Leitung: Dunkelblau ist gemessene Vergangenheit, gestrichelt die Modellprognose mit 80-%-Band. Richten Sie Kapazität und Abhol-Touren am Spitzenmonat aus; das Band zeigt, wie viel Puffer Sie einplanen sollten."
              : "Reading for leadership: dark blue is measured history, dashed is the model forecast with an 80% band. Align capacity and pickup tours with the peak month; the band shows how much buffer to plan."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-[3px] rounded-full bg-navy-800" />
              {lang === "de" ? "Historie" : "History"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-[3px] rounded-full" style={{ background: "var(--color-azure)" }} />
              {lang === "de" ? "Prognose" : "Forecast"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-2.5 rounded-[3px] border border-azure/40 bg-azure/20" />
              {lang === "de" ? "80-%-Band" : "80% band"}
            </span>
            <span className={clsx("inline-flex items-center gap-1.5", !showBaseline && "opacity-50")}>
              <span className="w-4 border-t-2 border-dashed border-ink-3" />
              {lang === "de" ? "Baseline (Saison-naiv)" : "Baseline (seasonal-naive)"}
            </span>
          </div>
          <p
            className="mt-2 text-[11.5px] text-ink-3 leading-relaxed cursor-help underline decoration-dotted underline-offset-2"
            title={
              lang === "de"
                ? "Die Baseline prognostiziert stur den Vorjahresmonat. Unser Modell muss sie schlagen – sonst lohnt es sich nicht."
                : "The baseline stubbornly predicts last year's month. Our model must beat it – otherwise it is not worth it."
            }
          >
            {lang === "de"
              ? "Die Baseline zeigt, ob das Modell besser ist als „wie letztes Jahr“."
              : "The baseline shows whether the model beats “like last year”."}
          </p>
        </div>
      </Card>
      {/* ---------------- risk: lollipop (Branche) + tiles (Gebiet) ---------------- */}
      <div className="grid gap-3 lg:grid-cols-2 mb-3">
        <RiskLolli
          title={t("cockpit.atRiskBranche")}
          rows={agg.byBranche}
          hrefQuery="branche"
          loc={loc}
          hint={lang === "de" ? "Klick filtert die Kundenliste nach dieser Branche." : "Click filters the customer list by this industry."}
        />
        <RiskTiles
          title={t("cockpit.atRiskGebiet")}
          rows={agg.byGebiet}
          hrefQuery="gebiet"
          loc={loc}
          hint={lang === "de" ? "Klick filtert die Kundenliste nach diesem Gebiet." : "Click filters the customer list by this region."}
        />
      </div>
      {/* ---------------- funnel + bullets ---------------- */}
      <div className="grid gap-3 lg:grid-cols-2 mb-3">
        <TeamFunnel />
        <ErfolgsBullet loc={loc} />
      </div>
      {/* ---------------- donut + losses ---------------- */}
      <div className="grid gap-3 md:grid-cols-2">
        <OutcomeDonut loc={loc} />
        <LossLolli loc={loc} />
      </div>
    </div>
  );
}
/* ============================== sub-components ==============================
 * Modern storytelling set: lollipop ranking, tile grid (for near-equal
 * values), conversion funnel, bullet-vs-target rows, donut, loss lollipops.
 * ========================================================================== */
function StoryTakeaway({ text }: { text: string }) {
  const { lang } = useI18n();
  return (
    <p className="px-4 pt-0.5 pb-2.5 text-[12.5px] leading-relaxed text-ink-2 border-b border-line mb-2.5">
      <strong className="text-navy-800">{lang === "de" ? "Fazit: " : "Takeaway: "}</strong>
      {text}
    </p>
  );
}
/* ---- lollipop ranking: dot + track, staggered grow, click filters ---- */
function RiskLolli({
  title,
  rows,
  hrefQuery,
  loc,
  hint,
}: {
  title: string;
  rows: { key: string; wert: number }[];
  hrefQuery: "branche" | "gebiet";
  loc: string;
  hint?: string;
}) {
  const max = Math.max(...rows.map((r) => r.wert), 1);
  const total = rows.reduce((s, r) => s + r.wert, 0) || 1;
  const top = rows[0];
  const topPct = Math.round((top.wert / total) * 100);
  const { lang } = useI18n();
  return (
    <Card className="anim-fade-up" title={title} hint={hint}>
      <StoryTakeaway
        text={
          lang === "de"
            ? `${top.key} trägt ${topPct} % des gefährdeten Umsatzes (${euro(top.wert, loc)}) – dort zuerst gegensteuern.`
            : `${top.key} carries ${topPct} % of revenue at risk (${euro(top.wert, loc)}) – countersteer there first.`
        }
      />
      <div className="px-3 pb-3.5 space-y-0.5">
        {rows.map((r, i) => {
          const share = Math.round((r.wert / total) * 100);
          return (
            <Link
              key={r.key}
              href={`/kunden?${hrefQuery}=${encodeURIComponent(r.key)}`}
              className="group flex items-center gap-2.5 px-2 py-[5px] rounded-[9px] hover:bg-blue-50/60 transition-colors"
            >
              <span className="tnum text-[10.5px] font-bold text-slate-300 w-5 shrink-0 text-right">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="w-[34%] shrink-0 text-[12.5px] font-medium text-ink truncate group-hover:text-[#2563eb] transition-colors">
                {r.key}
              </span>
              <span className="flex-1 min-w-[40px] h-[7px] rounded-full bg-slate-100 relative">
                <span
                  className="anim-grow-x absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.max(3, (r.wert / max) * 100)}%`, background: GRADIENT_BRANCHE, animationDelay: `${Math.min(i * 45, 500)}ms` }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-white shadow anim-fade-in"
                  style={{ left: `${Math.max(3, (r.wert / max) * 100)}%`, background: "#b84e00", animationDelay: `${300 + Math.min(i * 45, 500)}ms` }}
                />
              </span>
              <span className="tnum text-[11.5px] font-bold text-navy-800 min-w-[92px] text-right shrink-0 whitespace-nowrap">
                {euro(r.wert, loc)}
              </span>
              <span className="tnum text-[10.5px] font-bold text-white bg-slate-400 rounded-md px-1.5 py-px shrink-0">
                {share < 1 ? "< 1" : share} %
              </span>
              <ChevronRight size={13} className="shrink-0 -ml-1 text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
/* ---- tile grid: honest when values are near-equal (bars would all look full) ---- */
function RiskTiles({
  title,
  rows,
  hrefQuery,
  loc,
  hint,
}: {
  title: string;
  rows: { key: string; wert: number }[];
  hrefQuery: "branche" | "gebiet";
  loc: string;
  hint?: string;
}) {
  const { lang, t } = useI18n();
  const max = Math.max(...rows.map((r) => r.wert), 1);
  const total = rows.reduce((s, r) => s + r.wert, 0) || 1;
  const spread = Math.round(((max - rows[rows.length - 1].wert) / max) * 100);
  return (
    <Card
      className="anim-fade-up"
      title={title}
      hint={hint}
      actions={
        <Link href="/kunden" className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563eb] hover:underline">
          {lang === "de" ? "Alle Kunden" : "All customers"} <ArrowRight size={12} />
        </Link>
      }
    >
      <p className="px-4 pt-0.5 pb-2.5 text-[12.5px] leading-relaxed text-ink-2 border-b border-line mb-3">
        <strong className="text-navy-800">{lang === "de" ? "Fazit: " : "Takeaway: "}</strong>
        {lang === "de"
          ? `Ausgeglichen – nur ${spread} % zwischen stärkstem und schwächstem Gebiet. Kein Hotspot, überall dranbleiben.`
          : `Balanced – only ${spread} % between strongest and weakest region. No hotspot, stay on all of them.`}
      </p>
      <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rows.map((r, i) => {
          const share = Math.round((r.wert / total) * 100);
          return (
            <Link
              key={r.key}
              href={`/kunden?${hrefQuery}=${encodeURIComponent(r.key)}`}
              className="group rounded-xl border border-line bg-surface-0 hover:border-[#2563eb] hover:shadow-[0_8px_20px_-12px_rgba(37,99,235,.5)] transition-all p-3 anim-fade-up"
              style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
            >
              <p className="text-[12px] font-bold text-ink truncate group-hover:text-[#2563eb]">{r.key}</p>
              <p className="tnum text-[16px] font-extrabold text-navy-800 tracking-tight mt-0.5">
                {(r.wert / 1_000_000).toLocaleString(loc, { maximumFractionDigits: 2 })} {lang === "de" ? "Mio. €" : "m €"}
              </p>
              <div className="h-[5px] rounded-full bg-slate-100 overflow-hidden mt-1.5">
                <div
                  className="anim-grow-x h-full rounded-full bg-gradient-to-r from-[#1c3b51] to-[#3b9ee3]"
                  style={{ width: `${(r.wert / max) * 100}%`, animationDelay: `${200 + Math.min(i * 50, 300)}ms` }}
                />
              </div>
              <p className="tnum text-[10.5px] mt-1 text-[#2563eb] font-bold">
                {share} % {lang === "de" ? "des Risikos" : "of risk"} · {lang === "de" ? "Kunden ansehen" : "View customers"} →
              </p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
/* ---- conversion funnel: übernommen → erledigt ---- */
function TeamFunnel() {
  const { t, lang } = useI18n();
  const team = getTeam();
  const totalClaimed = team.reduce((s, m) => s + m.uebernommen, 0) || 1;
  const totalDone = team.reduce((s, m) => s + m.erledigt, 0);
  const conv = Math.round((totalDone / totalClaimed) * 100);
  return (
    <Card className="anim-fade-up" title={t("cockpit.team")} hint={t("cockpit.teamHint")}>
      <div className="px-4 pb-4 pt-1 space-y-4">
        {team.map((m) => {
          const u = USERS.find((x) => x.id === m.userId);
          const c = Math.round((m.erledigt / Math.max(1, m.uebernommen)) * 100);
          return (
            <div key={m.userId}>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <p className="text-[13px] font-bold text-ink truncate">{u ? t(u.nameKey) : m.userId}</p>
                <p className="tnum text-[12px] font-extrabold text-navy-800 shrink-0">
                  {c} % <span className="font-normal text-ink-3">{lang === "de" ? "weitergebracht" : "converted"}</span>
                </p>
              </div>
              <div
                className="h-[26px] rounded-[8px] bg-slate-100 flex overflow-hidden"
                title={`${m.erledigt} ${lang === "de" ? "von" : "of"} ${m.uebernommen}`}
              >
                <div
                  className="anim-grow-x h-full bg-gradient-to-r from-[#1c6e4a] to-[#2f9e6e] flex items-center px-2.5 text-white text-[11.5px] font-bold whitespace-nowrap overflow-hidden"
                  style={{ width: `${(m.erledigt / Math.max(1, m.uebernommen)) * 100}%` }}
                >
                  {t("cockpit.erledigt")} · {m.erledigt}
                </div>
                <div className="flex-1 flex items-center px-2.5 text-[11.5px] font-semibold text-ink-3 whitespace-nowrap overflow-hidden">
                  {t("cockpit.uebernommen")} · {m.uebernommen}
                </div>
              </div>
              <p className="text-[11.5px] text-ink-3 mt-1 tnum">
                {m.uebernommen - m.erledigt} {lang === "de" ? "noch offen" : "still open"}
              </p>
            </div>
          );
        })}
        <p className="pt-1 border-t border-line text-[12px] text-ink-2 leading-relaxed">
          {lang === "de"
            ? `Team-Quote: ${conv} % aller übernommenen Empfehlungen sind erledigt.`
            : `Team rate: ${conv} % of claimed recommendations are done.`}
        </p>
      </div>
    </Card>
  );
}
/* ---- bullet rows: gemessen vs. Startannahme (Tick) ---- */
function ErfolgsBullet({ loc }: { loc: string }) {
  const { t, lang } = useI18n();
  const rows = getErfolgsquote();
  return (
    <Card
      className="anim-fade-up"
      title={t("cockpit.erfolgsquote")}
      hint={lang === "de" ? "Balken = gemessen, Strich = Startannahme. Darüber = besser als gedacht." : "Bar = measured, tick = starting assumption. Above it = better than thought."}
    >
      <div className="px-4 pb-4 pt-0.5 space-y-3">
        {rows.map((r, i) => {
          const quote = r.versuche > 0 ? r.erfolge / r.versuche : 0;
          const prior = ANLASS_ERFOLGSCHANCE[r.anlass] ?? 0;
          const win = quote >= prior;
          return (
            <div key={r.anlass}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] text-ink font-medium truncate">
                  {t(`anlass.${r.anlass}` as "anlass.ueberfaellig")}
                </span>
                <span className={`tnum text-[13px] font-extrabold shrink-0 ${win ? "text-[#1c6e4a]" : "text-[#b45309]"}`}>
                  {pct(quote, 0, loc)}
                </span>
              </div>
              <p className="tnum text-[11px] text-ink-3 mb-1">
                {r.erfolge} {lang === "de" ? "von" : "of"} {r.versuche} {lang === "de" ? "Versuchen" : "tries"}
                {" · "}
                {lang === "de" ? "Annahme" : "Assumption"} {pct(prior, 0, loc)}
              </p>
              <div className="relative h-[9px] rounded-full bg-slate-100">
                <div
                  className="anim-grow-x absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${quote * 100}%`,
                    background: win ? "linear-gradient(90deg,#1c6e4a,#2f9e6e)" : "linear-gradient(90deg,#b45309,#f59e0b)",
                    animationDelay: `${Math.min(i * 60, 300)}ms`,
                  }}
                />
                <span
                  title={`${lang === "de" ? "Annahme" : "Assumption"}: ${pct(prior, 0, loc)}`}
                  className="absolute top-[-3px] bottom-[-3px] w-[2.5px] rounded bg-navy-800"
                  style={{ left: `calc(${prior * 100}% - 1px)` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
/* ---- donut: Anteile auf einen Blick, Total in der Mitte ---- */
function OutcomeDonut({ loc }: { loc: string }) {
  const { t, lang } = useI18n();
  const rows = getErgebnisVerteilung().map((r) => ({ key: t(`ergebnis.${r.key}` as "ergebnis.angebot"), n: r.n }));
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  const data = rows.map((r) => ({ name: r.key, value: r.n }));
  const [hover, setHover] = useState(false);
  return (
    <Card
      className="anim-fade-up"
      title={lang === "de" ? "Ergebnisverteilung" : "Outcome distribution"}
      hint={lang === "de" ? "Protokollierte Ergebnisse der Empfehlungen." : "Outcomes logged on the recommendations."}
    >
      <div className="px-4 pb-4">
        <div
          className="h-[168px] relative"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={74}
                paddingAngle={2.5}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive
                animationDuration={800}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={OUTCOME_COLORS[i % OUTCOME_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={(p: unknown) => {
                  const { active, payload } = p as { active?: boolean; payload?: { name?: string; value?: unknown }[] };
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="chart-tip">
                      <p className="font-bold">{payload[0].name}</p>
                      <p className="tnum">{num(Number(payload[0].value ?? 0), 0, loc)}</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div
          className="absolute inset-0 grid place-items-center pointer-events-none transition-opacity duration-200"
          style={{ opacity: hover ? 0 : 1 }}
        >
            <div className="text-center">
              <p className="tnum text-[22px] font-extrabold text-navy-800 leading-none">{num(total, 0, loc)}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mt-0.5">
                {lang === "de" ? "Ergebnisse" : "Outcomes"}
              </p>
            </div>
          </div>
        </div>
        <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-1.5 text-[11.5px] min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }} />
              <span className="text-ink-2 truncate flex-1">{r.key}</span>
              <span className="tnum font-bold text-navy-800">{r.n}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
/* ---- loss lollipops mit Täter-Fazit ---- */
function LossLolli({ loc }: { loc: string }) {
  const { t, lang } = useI18n();
  const rows = [...getVerlust()].sort((a, b) => b.n - a.n);
  const max = Math.max(...rows.map((r) => r.n), 1);
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  const top = rows[0];
  const topPct = Math.round((top.n / total) * 100);
  return (
    <Card className="anim-fade-up" title={t("cockpit.verlust")} hint={lang === "de" ? "Abwanderungen: wer den Auftrag bekommen hat." : "Churn: who won the order."}>
      <p className="px-4 pt-0.5 pb-2.5 text-[12.5px] leading-relaxed text-ink-2 border-b border-line mb-2">
        <strong className="text-navy-800">{lang === "de" ? "Fazit: " : "Takeaway: "}</strong>
        {lang === "de"
          ? `${top.key} holt ${topPct} % der verlorenen Aufträge – dort lohnt die Rückhol-Kampagne.`
          : `${top.key} takes ${topPct} % of lost orders – worth a win-back campaign there.`}
      </p>
      <div className="px-4 pb-4 space-y-2">
        {rows.map((r, i) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-2 mb-[3px]">
              <span className="text-[12.5px] text-ink font-medium truncate">{r.key}</span>
              <span className="tnum text-[12px] font-extrabold text-navy-800 shrink-0">{r.n}</span>
            </div>
            <div className="flex-1 h-[7px] rounded-full bg-slate-100 relative">
              <span
                className="anim-grow-x absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1c3b51] to-[#356a8c]"
                style={{ width: `${Math.max(4, (r.n / max) * 100)}%`, animationDelay: `${Math.min(i * 60, 360)}ms` }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-white shadow bg-[#1c3b51] anim-fade-in"
                style={{ left: `${Math.max(4, (r.n / max) * 100)}%`, animationDelay: `${300 + Math.min(i * 60, 360)}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
