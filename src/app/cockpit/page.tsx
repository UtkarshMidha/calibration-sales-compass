"use client";

import clsx from "clsx";
import { AlertTriangle, Calendar, ChartLine, ChevronRight, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
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
const GRADIENT_GEBIET = "linear-gradient(90deg, var(--color-navy-700), var(--color-navy-600))";
const GRADIENT_TEAM = "linear-gradient(90deg, var(--color-navy-700), var(--color-navy-600))";
const GRADIENT_DONE = "linear-gradient(90deg, #1c6e4a, var(--color-ok))";
const GRADIENT_RESULT = "linear-gradient(90deg, var(--color-brand-700), var(--color-brand))";
const GRADIENT_LOSS = "linear-gradient(90deg, var(--color-navy-700), var(--color-navy-600))";

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
        </div>
      </Card>

      {/* ---------------- risk by branche / gebiet ---------------- */}
      <div className="grid gap-3 lg:grid-cols-2 mb-3">
        <RiskBars
          title={t("cockpit.atRiskBranche")}
          rows={agg.byBranche}
          hrefQuery="branche"
          gradient={GRADIENT_BRANCHE}
          loc={loc}
          hint={lang === "de" ? "Klick filtert die Kundenliste nach dieser Branche." : "Click filters the customer list by this industry."}
        />
        <RiskBars
          title={t("cockpit.atRiskGebiet")}
          rows={agg.byGebiet}
          hrefQuery="gebiet"
          gradient={GRADIENT_GEBIET}
          loc={loc}
          hint={lang === "de" ? "Klick filtert die Kundenliste nach diesem Gebiet." : "Click filters the customer list by this region."}
        />
      </div>

      {/* ---------------- team ---------------- */}
      <div className="grid gap-3 lg:grid-cols-2 mb-3">
        <TeamCard />
        <ErfolgsquoteCard loc={loc} />
      </div>

      {/* ---------------- results & losses ---------------- */}
      <div className="grid gap-3 md:grid-cols-2">
        <VerteilungCard
          title={lang === "de" ? "Ergebnisverteilung" : "Outcome distribution"}
          hint={lang === "de" ? "Protokollierte Ergebnisse der Empfehlungen." : "Outcomes logged on the recommendations."}
          rows={getErgebnisVerteilung().map((r) => ({
            key: t(`ergebnis.${r.key}` as "ergebnis.angebot"),
            n: r.n,
          }))}
          gradient={GRADIENT_RESULT}
        />
        <VerteilungCard
          title={t("cockpit.verlust")}
          hint={lang === "de" ? "Abwanderungen: wer den Auftrag bekommen hat." : "Churn: who won the order."}
          rows={getVerlust().map((r) => ({ key: r.key, n: r.n }))}
          gradient={GRADIENT_LOSS}
        />
      </div>
    </div>
  );
}

/* ============================== sub-components ============================== */

function RiskBars({
  title,
  rows,
  hrefQuery,
  gradient,
  loc,
  hint,
}: {
  title: string;
  rows: { key: string; wert: number }[];
  hrefQuery: "branche" | "gebiet";
  gradient: string;
  loc: string;
  hint?: string;
}) {
  const max = Math.max(...rows.map((r) => r.wert), 1);
  return (
    <Card className="anim-fade-up" title={title} hint={hint}>
      <div className="px-4 pb-4 pt-0.5 space-y-0.5">
        {rows.map((r) => (
          <Link
            key={r.key}
            href={`/kunden?${hrefQuery}=${encodeURIComponent(r.key)}`}
            className="group flex items-center gap-3 px-2 -mx-2 py-[5px] rounded-[7px] hover:bg-surface-1 transition-colors"
          >
            <span className="w-[38%] shrink-0 text-[12.5px] text-ink truncate group-hover:text-brand-700">{r.key}</span>
            <span className="flex-1 min-w-[40px] h-[8px] rounded-full bg-surface-2 overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(r.wert / max) * 100}%`, background: gradient }}
              />
            </span>
            <span className="tnum text-[11.5px] font-semibold text-navy-800 min-w-[104px] text-right shrink-0 whitespace-nowrap">
              {euro(r.wert, loc)}
            </span>
            <ChevronRight
              size={13}
              className="shrink-0 text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </Link>
        ))}
      </div>
    </Card>
  );
}

function MiniBar({
  label,
  value,
  max,
  gradient,
}: {
  label: string;
  value: number;
  max: number;
  gradient: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[86px] shrink-0 text-[11.5px] text-ink-3 truncate">{label}</span>
      <span className="flex-1 min-w-[30px] h-[7px] rounded-full bg-surface-2 overflow-hidden">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(2, (value / Math.max(max, 1)) * 100)}%`, background: gradient }}
        />
      </span>
      <span className="tnum text-[12px] font-semibold text-navy-800 min-w-[26px] text-right shrink-0">{value}</span>
    </div>
  );
}

function TeamCard() {
  const { t } = useI18n();
  const team = getTeam();
  const max = Math.max(...team.map((m) => Math.max(m.uebernommen, m.erledigt)), 1);

  return (
    <Card className="anim-fade-up" title={t("cockpit.team")} hint={t("cockpit.teamHint")}>
      <div className="px-4 pb-4 pt-1">
        {team.map((m, i) => {
          const u = USERS.find((x) => x.id === m.userId);
          return (
            <div
              key={m.userId}
              className={clsx("py-2.5", i > 0 && "border-t border-line", i === 0 && "pt-1", i === team.length - 1 && "pb-0")}
            >
              <p className="text-[13px] font-semibold text-ink truncate mb-1.5">{u ? t(u.nameKey) : m.userId}</p>
              <MiniBar label={t("cockpit.uebernommen")} value={m.uebernommen} max={max} gradient={GRADIENT_TEAM} />
              <div className="h-1.5" />
              <MiniBar label={t("cockpit.erledigt")} value={m.erledigt} max={max} gradient={GRADIENT_DONE} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ErfolgsquoteCard({ loc }: { loc: string }) {
  const { t } = useI18n();
  const rows = getErfolgsquote();

  return (
    <Card className="anim-fade-up" title={t("cockpit.erfolgsquote")}>
      <div className="px-4 pb-4 pt-0.5 space-y-2.5">
        {rows.map((r) => {
          const quote = r.versuche > 0 ? r.erfolge / r.versuche : 0;
          return (
            <div key={r.anlass}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[12.5px] text-ink font-medium truncate">
                  {t(`anlass.${r.anlass}` as "anlass.ueberfaellig")}
                </span>
                <span className="tnum text-[12px] font-bold text-navy-800 shrink-0">
                  {pct(quote, 0, loc)}
                  <span className="text-ink-3 font-normal">
                    {" "}
                    ({r.erfolge}/{r.versuche})
                  </span>
                </span>
              </div>
              <div className="h-[7px] rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${quote * 100}%`, background: GRADIENT_RESULT }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function VerteilungCard({
  title,
  hint,
  rows,
  gradient,
}: {
  title: string;
  hint?: string;
  rows: { key: string; n: number }[];
  gradient: string;
}) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <Card className="anim-fade-up" title={title} hint={hint}>
      <div className="px-4 pb-4 pt-0.5 space-y-2">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-2 mb-[3px]">
              <span className="text-[12.5px] text-ink truncate">{r.key}</span>
              <span className="tnum text-[12px] font-semibold text-navy-800 shrink-0">{r.n}</span>
            </div>
            <div className="h-[7px] rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(3, (r.n / max) * 100)}%`, background: gradient }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
