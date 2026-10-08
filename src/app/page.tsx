"use client";

import { ArrowRight, CalendarClock, FileText, Mail, ShieldAlert, Sun, TrendingUp, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HEADLINE, getCockpitAggregates, getKunde, getPrognoseGesamt } from "@/lib/data";
import { dateWeekday, euro, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useDashboard } from "@/lib/real-data";
import { useApp } from "@/lib/store";

const DONUT_COLORS = ["#d9480f", "#3b9ee3", "#2f9e6e", "#7048e8", "#94a3b8"];

const MONAT_KURZ: Record<string, { de: string; en: string }> = {
  "01": { de: "Jan", en: "Jan" },
  "02": { de: "Feb", en: "Feb" },
  "03": { de: "Mär", en: "Mar" },
  "04": { de: "Apr", en: "Apr" },
  "05": { de: "Mai", en: "May" },
  "06": { de: "Jun", en: "Jun" },
  "07": { de: "Jul", en: "Jul" },
  "08": { de: "Aug", en: "Aug" },
  "09": { de: "Sep", en: "Sep" },
  "10": { de: "Okt", en: "Oct" },
  "11": { de: "Nov", en: "Nov" },
  "12": { de: "Dez", en: "Dec" },
};

export default function DashboardPage() {
  const app = useApp();
  const { t, lang } = useI18n();
  const router = useRouter();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const isLeitung = app.user.role === "leitung";

  const list = app.tagesliste;
  const evSum = useMemo(() => list.reduce((s, i) => s + i.ev, 0), [list]);
  const agg = useMemo(() => getCockpitAggregates(), []);
  const forecast = useMemo(() => getPrognoseGesamt(app.stichtag).filter((d) => !d.historie).slice(0, 6), [app.stichtag]);

  /* real snapshot data (database_tables/*.csv via npm run data:build) */
  const { data: real } = useDashboard();
  const rk = real?.kpis;

  const normSpark = (arr: number[] | undefined, fallback: number[]): number[] => {
    const a = arr && arr.length >= 4 ? arr : fallback;
    if (a.length === 8) return a;
    if (a.length > 8) return a.slice(a.length - 8);
    if (a.length === 0) return fallback.slice(0, 8);
    const out = [...a];
    while (out.length < 8) out.unshift(out[0]);
    return out;
  };

  const top8 = list.slice(0, 8);

  const donut = useMemo(() => {
    if (real) {
      return real.anlassMix.map((m) => ({
        anlass: t(`anlass.${m.anlass}` as "anlass.ueberfaellig"),
        wert: m.wert,
        pct: m.pct,
      }));
    }
    const m = new Map<string, number>();
    for (const i of list) m.set(i.empfehlung.anlass, (m.get(i.empfehlung.anlass) ?? 0) + i.ev);
    const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    return [...m.entries()].map(([anlass, wert]) => ({
      anlass: t(`anlass.${anlass}` as "anlass.ueberfaellig"),
      wert,
      pct: Math.round((wert / total) * 100),
    }));
  }, [list, t, real]);

  const due6 = useMemo(() => {
    const fmt = (key: string) => {
      const mm = key.slice(5);
      return MONAT_KURZ[mm]?.[lang] ?? mm;
    };
    if (real) return real.dueNext6.map((d) => ({ monat: fmt(d.monat), anzahl: d.anzahl }));
    return forecast.map((f) => ({ monat: fmt(f.monat), anzahl: f.kalibrierungen }));
  }, [real, forecast, lang]);

  const due6Total = useMemo(() => due6.reduce((s, d) => s + d.anzahl, 0), [due6]);
  const due6Peak = useMemo(() => due6.reduce((a, b) => (b.anzahl > a.anzahl ? b : a), due6[0] ?? { monat: "", anzahl: 0 }), [due6]);

  const donutTotal = useMemo(() => donut.reduce((s, d) => s + d.wert, 0), [donut]);
  const donutTop = useMemo(() => donut.reduce((a, b) => (b.pct > a.pct ? b : a), donut[0] ?? { anlass: "", wert: 0, pct: 0 }), [donut]);
  const [donutHover, setDonutHover] = useState(false);

  const topBranchen = useMemo(() => {
    if (real) return real.topBranchen.slice(0, 5).map((r) => ({ name: r.name, wert: r.wert, pct: r.pct }));
    const total = agg.byBranche.reduce((s, r) => s + r.wert, 0) || 1;
    return agg.byBranche.slice(0, 5).map((r) => ({ name: r.key, wert: r.wert, pct: Math.round((r.wert / total) * 100) }));
  }, [agg, real]);

  const firstName = t(app.user.nameKey).split(" ")[0];
  const greeting = lang === "de" ? "Guten Morgen" : "Good morning";

  /* sales KPIs come from the real CSV snapshots; Leitung keeps the model cockpit */
  const salesKpis = [
    { label: lang === "de" ? "Überfällige Messmittel" : "Overdue instruments", value: num(rk?.ueberfaellig ?? HEADLINE.ueberfaellig, 0, loc), sub: lang === "de" ? `bei ${num(rk?.ueberfaelligKunden ?? HEADLINE.ueberfaelligKunden, 0, loc)} Kunden` : `at ${num(rk?.ueberfaelligKunden ?? HEADLINE.ueberfaelligKunden, 0, loc)} customers`, icon: Wrench, bg: "bg-red-50", fg: "text-red-500", spark: normSpark(real?.sparks.ueberfaellig, [4, 5, 4, 6, 5, 7, 6, 8]) },
    { label: lang === "de" ? "Erwarteter Umsatz (heute)" : "Expected revenue (today)", value: euro(rk?.umsatzHeute ?? evSum, loc), sub: lang === "de" ? `aus ${rk?.empfehlungen ?? list.length} Empfehlungen` : `from ${rk?.empfehlungen ?? list.length} recommendations`, icon: TrendingUp, bg: "bg-blue-50", fg: "text-blue-600", spark: normSpark(real?.sparks.umsatz, [3, 4, 5, 4, 6, 7, 6, 9]) },
    { label: lang === "de" ? "Fällige Messmittel (30 Tage)" : "Due instruments (30 days)", value: num(rk?.due30 ?? 18432, 0, loc), sub: lang === "de" ? `bei ${num(rk?.due30Kunden ?? 1156, 0, loc)} Kunden` : `at ${num(rk?.due30Kunden ?? 1156, 0, loc)} customers`, icon: CalendarClock, bg: "bg-emerald-50", fg: "text-emerald-600", spark: normSpark(real?.sparks.faellig, [6, 5, 7, 6, 8, 7, 9, 8]) },
    { label: lang === "de" ? "Churn-Risiko (hoch)" : "Churn risk (high)", value: num(rk?.churnHoch ?? 327, 0, loc), sub: lang === "de" ? "Kunden mit erhöhtem Risiko" : "customers at elevated risk", icon: ShieldAlert, bg: "bg-violet-50", fg: "text-violet-600", spark: normSpark(real?.sparks.churn, [5, 6, 5, 4, 6, 5, 7, 6]) },
  ];

  const kpis = isLeitung
    ? [
        { label: t("cockpit.kpi.umsatz12m"), value: euro(agg.umsatz12m, loc), sub: lang === "de" ? "nächste 12 Monate" : "next 12 months", icon: TrendingUp, bg: "bg-blue-50", fg: "text-blue-600", spark: [3, 5, 4, 7, 6, 9, 8, 11] },
        { label: t("cockpit.kpi.atRisk"), value: euro(agg.atRisk, loc), sub: lang === "de" ? "Abwanderungsrisiko × Umsatz" : "churn risk × revenue", icon: ShieldAlert, bg: "bg-violet-50", fg: "text-violet-600", spark: [8, 7, 9, 6, 7, 5, 6, 4] },
        { label: t("cockpit.kpi.ueberfaellig"), value: num(rk?.ueberfaellig ?? HEADLINE.ueberfaellig, 0, loc), sub: lang === "de" ? `bei ${num(rk?.ueberfaelligKunden ?? HEADLINE.ueberfaelligKunden, 0, loc)} Kunden` : `at ${num(rk?.ueberfaelligKunden ?? HEADLINE.ueberfaelligKunden, 0, loc)} customers`, icon: TriangleAlert, bg: "bg-red-50", fg: "text-red-500", spark: normSpark(real?.sparks.ueberfaellig, [4, 5, 6, 5, 7, 8, 7, 9]) },
        { label: t("cockpit.kpi.faellig3m"), value: num(agg.faellig3Monate, 0, loc), sub: lang === "de" ? "erwarteter Eingang · 3 Monate" : "expected intake · 3 months", icon: CalendarClock, bg: "bg-emerald-50", fg: "text-emerald-600", spark: [5, 6, 5, 7, 8, 7, 9, 10] },
      ]
    : salesKpis;

  const openQuote = (kundeId: string) => {
    const id = app.createDraft(kundeId);
    router.push(`/angebote/${id}`);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="page space-y-4">
        {/* ---------------- Kopfzeile ---------------- */}
        <div className="card px-5 py-4 flex items-center gap-4 flex-wrap anim-fade-up">
          <span className="w-10 h-10 rounded-[10px] bg-surface-1 border border-line grid place-items-center shrink-0">
            <Sun size={20} className="text-due" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-ink-3">{greeting}, {firstName} · <span className="tnum">{dateWeekday("2026-10-07", loc)}</span></p>
            <h1 className="page-title">
              {lang === "de" ? "Hier sind Ihre heutigen Empfehlungen" : "Here are today's recommendations"}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-1 border border-line px-3 h-8 text-[12.5px] font-bold text-navy-800 tnum">
              {rk?.empfehlungen ?? list.length} {lang === "de" ? "Kunden" : "customers"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-azure-100 border border-[#c4e2f7] px-3 h-8 text-[12.5px] font-bold text-azure-800 tnum">
              {euro(rk?.umsatzHeute ?? evSum, loc)}
            </span>
          </div>
        </div>

        {/* ---------------- KPIs ---------------- */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 stagger">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="card kpi p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={`w-9 h-9 rounded-[10px] ${k.bg} grid place-items-center shrink-0`}>
                    <Icon size={17} className={k.fg} />
                  </span>
                  <MiniSpark points={k.spark} color={k.fg.includes("red") ? "#d9480f" : k.fg.includes("blue") ? "#3b9ee3" : k.fg.includes("emerald") ? "#2f9e6e" : "#7048e8"} />
                </div>
                <p className="text-[12px] font-semibold text-ink-3 mt-3 leading-tight">{k.label}</p>
                <p className="tnum text-[24px] font-bold text-navy-800 leading-tight tracking-tight">{k.value}</p>
                <p className="text-[12px] text-ink-3 tnum">{k.sub}</p>
              </div>
            );
          })}
        </div>

        {/* ---------------- main grid ---------------- */}
        <div className="grid gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_320px] items-start">
          {/* left */}
          <div className="space-y-4 min-w-0">
            <section className="card overflow-hidden anim-fade-up">
              <header className="flex items-center gap-3 px-5 pt-4 pb-3 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-[14px] font-bold text-navy-800 flex items-center gap-2">
                    <TrendingUp size={15} className="text-action" /> {t("dash.topEmpfehlungen")}
                  </h2>
                  <p className="text-[12.5px] text-ink-3 mt-0.5">
                    {lang === "de" ? "Diese Kunden sollten Sie heute kontaktieren – aus Fälligkeiten, Verlauf und Potenzial." : "Contact these customers today – from due dates, history and potential."}
                  </p>
                </div>
                <div className="flex-1" />
                <Link href="/tagesliste" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-action hover:underline">
                  {t("dash.alleAnsehen")} <ArrowRight size={13} />
                </Link>
              </header>
              <div className="overflow-x-auto">
                <table className="tbl w-full text-[13px] min-w-[680px]">
                  <thead>
                    <tr className="text-[11px]">
                      <th className="text-left font-bold px-5 py-2 w-10">#</th>
                      <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Kunde" : "Customer"}</th>
                      <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Anlass" : "Reason"}</th>
                      <th className="text-right font-bold px-2 py-2">{lang === "de" ? "Erwarteter Wert" : "Expected value"}</th>
                      <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Dringlichkeit" : "Urgency"}</th>
                      <th className="text-right font-bold px-5 py-2">{lang === "de" ? "Aktionen" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {/* Same source as the Tagesliste: demo customers with names,
                        industries and full 360° boards behind every row. */}
                    {top8.map((item, idx) => {
                      const k = getKunde(item.kundeId)!;
                      return (
                        <tr key={item.kundeId} className="group">
                          <td className="px-5 py-2.5">
                            <span className={`w-6 h-6 rounded-full grid place-items-center text-[12px] font-bold tnum ${idx < 3 ? "bg-[#fdece4] text-overdue" : "bg-surface-2 text-ink-3"}`}>{idx + 1}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <Link href={`/kunden/${k.id}`} className="font-semibold text-navy-800 hover:text-action leading-tight block">{k.name}</Link>
                            <span className="text-[12px] text-ink-3">{k.nummer} · {k.branche}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <AnlassChip anlass={item.empfehlung.anlass} n={item.empfehlung.betroffeneAnzahl} lang={lang} />
                          </td>
                          <td className="px-2 py-2.5 text-right tnum font-bold text-navy-800 whitespace-nowrap">{euro(item.ev, loc)}</td>
                          <td className="px-2 py-2.5">
                            <Dringlichkeit p={item.prioritaet} lang={lang} />
                          </td>
                          <td className="px-5 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <IconBtn title="E-Mail" onClick={() => router.push(`/kunden/${k.id}`)}><Mail size={14} /></IconBtn>
                              <IconBtn title={lang === "de" ? "Angebot erstellen" : "Create quote"} onClick={() => openQuote(k.id)} accent><FileText size={14} /></IconBtn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-2.5 card-divide bg-surface-1 flex items-center justify-between gap-3">
                <span className="text-[12px] text-ink-3 tnum truncate">
                  {lang === "de" ? `1–8 von ${list.length} Empfehlungen` : `1–8 of ${list.length} recommendations`}
                </span>
                <Link href="/tagesliste" className="text-[12.5px] font-bold text-action hover:underline inline-flex items-center gap-1 shrink-0">
                  {lang === "de" ? "Tagesliste öffnen" : "Open daily list"} <ArrowRight size={13} />
                </Link>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="card p-5 anim-fade-up">
                <h3 className="text-[13px] font-bold text-navy-800">{t("dash.potenzialNachAnlass")}</h3>
                <p className="text-[12px] text-ink-3 mt-1 leading-relaxed">
                  {lang === "de"
                    ? `Anteil am erwarteten Umsatz je Anlass – ${donutTop.anlass} ist mit ${donutTop.pct} % der größte Hebel.`
                    : `Share of expected revenue per reason – ${donutTop.anlass} is the biggest lever at ${donutTop.pct} %.`}
                </p>
                <div
                  className="h-[190px] mt-2 relative"
                  onMouseEnter={() => setDonutHover(true)}
                  onMouseLeave={() => setDonutHover(false)}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donut}
                        dataKey="wert"
                        nameKey="anlass"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={2.5}
                        stroke="#fff"
                        strokeWidth={2}
                        isAnimationActive
                        animationDuration={850}
                        animationEasing="ease-out"
                      >
                        {donut.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={(p: unknown) => {
                          const { active, payload } = p as {
                            active?: boolean;
                            payload?: { name?: string; value?: unknown }[];
                          };
                          if (!active || !payload || payload.length === 0) return null;
                          const item = payload[0];
                          return (
                            <div className="chart-tip">
                              <p className="font-bold">{item.name}</p>
                              <p className="tnum">{euro(Number(item.value ?? 0), loc)}</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={`absolute inset-0 grid place-items-center pointer-events-none transition-opacity duration-200 ${donutHover ? "opacity-0" : "opacity-100"}`}>
                    <div className="text-center px-2" title={euro(donutTotal, loc)}>
                      <p className="tnum text-[16px] font-bold text-navy-800 leading-none whitespace-nowrap">{euroK(donutTotal, loc)}</p>
                      <p className="text-[11px] text-ink-3 font-semibold mt-1">{lang === "de" ? "Gesamt" : "Total"}</p>
                    </div>
                  </div>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {donut.map((d, i) => (
                    <li key={d.anlass} className="flex items-center gap-2 text-[12px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="text-ink-2 truncate flex-1">{d.anlass}</span>
                      <span className="tnum font-bold text-navy-800">{d.pct} %</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="card p-5 anim-fade-up">
                <h3 className="text-[13px] font-bold text-navy-800">{t("dash.faellig6m")}</h3>
                <p className="text-[12px] text-ink-3 mt-1 leading-relaxed">
                  {lang === "de"
                    ? `Fällige Messmittel je Monat – Spitze im ${due6Peak.monat} (${num(due6Peak.anzahl, 0, loc)}).`
                    : `Due instruments per month – peak in ${due6Peak.monat} (${num(due6Peak.anzahl, 0, loc)}).`}
                </p>
                <div className="h-[190px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={due6.map((f) => ({ monat: f.monat, anzahl: f.anzahl }))} margin={{ top: 14, right: 4, left: -8, bottom: 0 }}>
                      <XAxis dataKey="monat" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6d7378" }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6d7378" }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} width={36} />
                      <Tooltip
                        content={(p: unknown) => {
                          const { active, payload, label } = p as {
                            active?: boolean;
                            payload?: { value?: unknown }[];
                            label?: string;
                          };
                          return active && payload && payload.length > 0 ? (
                            <div className="chart-tip">
                              <p className="t-sub">{lang === "de" ? "Monat" : "Month"} {label}</p>
                              <p className="font-bold tnum">{num(Number(payload[0].value ?? 0), 0, loc)} {lang === "de" ? "Messmittel fällig" : "instruments due"}</p>
                            </div>
                          ) : null;
                        }}
                        cursor={{ fill: "rgba(59,158,227,.08)" }}
                      />
                      <Bar dataKey="anzahl" radius={[6, 6, 2, 2]} maxBarSize={34} isAnimationActive animationDuration={800} animationEasing="ease-out">
                        {due6.map((d, i) => (
                          <Cell key={i} fill={d.monat === due6Peak.monat ? "#b84e00" : "#1c3b51"} fillOpacity={d.monat === due6Peak.monat ? 1 : 0.82} />
                        ))}
                        <LabelList dataKey="anzahl" position="top" formatter={(v: unknown) => (Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : `${v}`)} style={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[12px] text-ink-3 mt-2 tnum">
                  {lang === "de" ? `Gesamt ${num(due6Total, 0, loc)} · orange = stärkster Monat.` : `Total ${num(due6Total, 0, loc)} · orange = peak month.`}
                </p>
              </section>
            </div>
          </div>

          {/* right */}
          <div className="space-y-4">
            <section className="ai-panel p-5 anim-fade-up">
              <div className="flex items-center gap-2 mb-1">
                <span className="ai-chip">✦ {lang === "de" ? "KI-Assistent" : "AI Assistant"}</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-ok">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok" /> Online
                </span>
              </div>
              <p className="text-[12.5px] text-ink-2 leading-relaxed mt-1.5">
                {lang === "de" ? "Ich helfe Ihnen bei allen Fragen zu Kunden, Messmitteln und Verkaufschancen." : "I help with all questions on customers, instruments and sales opportunities."}
              </p>
              <button onClick={() => app.setAssistantOpen(true)} className="mt-3 w-full h-9 rounded-[8px] border border-ai-border bg-white hover:border-ai transition-colors text-left px-3 text-[13px] text-ink-3 hover:text-ink">
                {lang === "de" ? "Fragen Sie mich etwas…" : "Ask me anything…"}
              </button>
              <div className="mt-2 space-y-1.5">
                {[
                  lang === "de" ? "Welche Kunden haben das höchste Potenzial?" : "Which customers have the highest potential?",
                  lang === "de" ? "Zeige mir Kunden mit überfälligen Messmitteln" : "Show customers with overdue instruments",
                  lang === "de" ? "Erstelle einen E-Mail-Entwurf für den Top-Kunden" : "Draft an email for the top customer",
                ].map((s) => (
                  <button key={s} onClick={() => app.setAssistantOpen(true)} className="w-full text-left text-[12.5px] px-3 py-2 rounded-[8px] bg-white border border-line hover:border-ai transition-colors text-ink-2 truncate">
                    {s}
                  </button>
                ))}
              </div>
            </section>

            <section className="card p-5 anim-fade-up">
              <h3 className="text-[13px] font-bold text-navy-800 mb-3">{t("dash.schnellaktionen")}</h3>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction icon={<FileText size={16} className="text-action" />} bg="bg-azure-100" title={lang === "de" ? "Angebot erstellen" : "Create quote"} sub={lang === "de" ? "PDF aus fälligen" : "PDF from due"} onClick={() => top8[0] && openQuote(top8[0].kundeId)} />
                <QuickAction icon={<Mail size={16} className="text-violet" />} bg="bg-[#efeafe]" title="E-Mail-Entwurf" sub={lang === "de" ? "Formelle E-Mail" : "Formal email"} onClick={() => top8[0] && router.push(`/kunden/${top8[0].kundeId}`)} />
                <QuickAction icon={<ShieldAlert size={16} className="text-ok" />} bg="bg-[#e7f6ef]" title={lang === "de" ? "Kundenanalyse" : "Customer analysis"} sub={lang === "de" ? "Detaillierte Ansicht" : "Detailed view"} onClick={() => router.push("/kunden")} />
                <QuickAction icon={<TrendingUp size={16} className="text-due" />} bg="bg-[#fdf3dc]" title={lang === "de" ? "Bericht exportieren" : "Export report"} sub="Excel oder PDF" onClick={() => router.push(isLeitung ? "/cockpit" : "/kunden")} />
              </div>
            </section>

            <section className="card p-5 anim-fade-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-navy-800">{isLeitung ? t("dash.risikoBranche") : t("dash.topBranchen")}</h3>
                <Link href={isLeitung ? "/cockpit" : "/kunden"} className="text-[12px] font-bold text-action hover:underline">{t("dash.alleAnsehen")} →</Link>
              </div>
              <div className="space-y-2.5">
                {topBranchen.map((b) => (
                  <div key={b.name}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[12.5px] text-ink-2 truncate">{b.name}</span>
                      <span className="tnum text-[12px] font-bold text-navy-800">{b.pct} %</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-navy-800" style={{ width: `${Math.max(6, (b.wert / Math.max(...topBranchen.map((x) => x.wert))) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {isLeitung && (
                <Link href="/cockpit" className="mt-3 w-full h-9 rounded-[8px] bg-navy-800 text-white text-[13px] font-semibold grid place-items-center hover:bg-navy-700 transition-colors">
                  {t("dash.zumCockpit")} →
                </Link>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function euroK(v: number, loc: string): string {
  if (Math.abs(v) >= 10000) {
    const k = (v / 1000).toLocaleString(loc, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
    return `≈ ${k}k €`;
  }
  return euro(v, loc);
}

function AnlassChip({ anlass, n, lang }: { anlass: string; n: number; lang?: string }) {
  const en = lang === "en";
  const map: Record<string, string> = {
    ueberfaellig: "bg-[#fdece4] text-overdue border-[#f7d3c2]",
    faellig_bald: "bg-[#fdf3dc] text-[#8a5d00] border-[#f2e0b0]",
    abwanderung: "bg-[#efeafe] text-[#5936c9] border-[#ddd3fb]",
    branche: "bg-azure-100 text-azure-800 border-[#c4e2f7]",
    portal: "bg-[#e7f6ef] text-[#1c6e4a] border-[#c4e8d8]",
  };
  const label: Record<string, string> = en
    ? {
        ueberfaellig: `Overdue (${n})`,
        faellig_bald: `Due soon`,
        abwanderung: `Churn risk`,
        branche: `Industry potential`,
        portal: `Portal`,
      }
    : {
        ueberfaellig: `Überfällig (${n})`,
        faellig_bald: `Fällig`,
        abwanderung: `Churn-Risiko`,
        branche: `Branchenpotenzial`,
        portal: `Portal`,
      };
  return (
    <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full border text-[11.5px] font-semibold whitespace-nowrap ${map[anlass] ?? "bg-surface-2 text-ink-2 border-line"}`}>
      {label[anlass] ?? anlass}
    </span>
  );
}

function Dringlichkeit({ p, lang }: { p: string; lang: string }) {
  const map: Record<string, string> = {
    hoch: "bg-[#fdece4] text-overdue border-[#f7d3c2]",
    mittel: "bg-[#fdf3dc] text-[#8a5d00] border-[#f2e0b0]",
    niedrig: "bg-surface-1 text-ink-3 border-line",
  };
  const label = p === "hoch" ? (lang === "de" ? "Hoch" : "High") : p === "mittel" ? (lang === "de" ? "Mittel" : "Medium") : (lang === "de" ? "Niedrig" : "Low");
  return (
    <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full border text-[11.5px] font-bold whitespace-nowrap ${map[p] ?? ""}`}>
      {label}
    </span>
  );
}

function IconBtn({ children, title, href, onClick, accent }: { children: React.ReactNode; title: string; href?: string; onClick?: () => void; accent?: boolean }) {
  const cls = `w-8 h-8 rounded-[8px] grid place-items-center border transition-colors ${accent ? "bg-navy-800 border-navy-800 text-white hover:bg-navy-700" : "bg-surface-0 border-line text-ink-3 hover:border-line-strong hover:text-ink"}`;
  if (href) return <a href={href} title={title} className={cls}>{children}</a>;
  return <button title={title} aria-label={title} onClick={onClick} className={cls}>{children}</button>;
}

function QuickAction({ icon, bg, title, sub, onClick }: { icon: React.ReactNode; bg: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left rounded-[8px] border border-line bg-surface-1 hover:bg-surface-0 hover:border-line-strong transition-colors p-2.5">
      <span className={`w-8 h-8 rounded-[8px] ${bg} grid place-items-center mb-1.5`}>{icon}</span>
      <span className="block text-[12.5px] font-bold text-navy-800 leading-tight">{title}</span>
      <span className="block text-[11px] text-ink-3 leading-tight mt-0.5">{sub}</span>
    </button>
  );
}

function MiniSpark({ points, color }: { points: number[]; color: string }) {
  const w = 72;
  const h = 26;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * w} ${h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6)}`).join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  const id = `g${color.replace(/[^a-z0-9]/gi, "")}${points.length}`;
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function DashboardKpiPlaceholder() {
  return null;
}
