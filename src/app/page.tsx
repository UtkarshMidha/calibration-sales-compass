"use client";

import { ArrowRight, CalendarClock, Copy, FileText, Mail, ShieldAlert, Sparkles, Sun, TrendingUp, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HEADLINE, getCockpitAggregates, getKunde, getPrognoseGesamt } from "@/lib/data";
import { dateWeekday, euro, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useDashboard, type RealTopKunde } from "@/lib/real-data";
import { useApp } from "@/lib/store";

const DONUT_COLORS = ["#ef4444", "#3b9ee3", "#10b981", "#8b5cf6", "#94a3b8"];

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
  const realTop: RealTopKunde[] = useMemo(() => real?.topKunden.slice(0, 8) ?? [], [real]);

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

  const copyRealMail = (r: RealTopKunde) => {
    const text =
      lang === "de"
        ? `Sehr geehrte Damen und Herren,\n\nbei der Durchsicht Ihrer Messmittel ist uns aufgefallen, dass für ${r.ueberfaellig} Messmittel (Kunde ${r.kunde}, ${r.branche}) die Kalibrierung im Median seit ${r.tageMedian} Tagen überfällig ist.\n\nDamit Ihre Prüfmittelüberwachung auditsicher bleibt, holen wir die Messmittel gerne bei Ihnen ab. Ein Angebotsentwurf über ca. ${euro(r.ev, loc, false)} liegt bei.\n\nDarf ich die Abholung für die kommende Woche einplanen?\n\nMit freundlichen Grüßen\n${t(app.user.nameKey)}`
        : `Dear Sir or Madam,\n\nwe noticed that ${r.ueberfaellig} of your instruments (customer ${r.kunde}, ${r.branche}) are overdue by a median of ${r.tageMedian} days.\n\nTo keep your equipment audit-proof we can collect the instruments. A draft quote of about ${euro(r.ev, loc, false)} is attached.\n\nMay I schedule the pickup for next week?\n\nKind regards\n${t(app.user.nameKey)}`;
    navigator.clipboard?.writeText(text).then(() => app.toast(lang === "de" ? "E-Mail-Text kopiert." : "Email text copied."));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 max-w-[1400px] mx-auto space-y-4">
        {/* ---------------- hero ---------------- */}
        <div className="hero px-6 py-5 flex items-center gap-6 flex-wrap anim-fade-up">
          <div className="relative z-10 min-w-0 flex-1">
            <p className="text-white/70 text-[13px] font-medium">{greeting}, {firstName} —</p>
            <h1 className="text-white text-[22px] md:text-[26px] font-extrabold tracking-tight leading-tight">
              {lang === "de" ? "Hier sind Ihre heutigen Empfehlungen" : "Here are today's recommendations"}
            </h1>
            <p className="text-white/75 text-[13px] mt-1 tnum">
              {rk?.empfehlungen ?? list.length} {lang === "de" ? "priorisierte Kunden" : "prioritized customers"} · {lang === "de" ? "Erwarteter Umsatz" : "Expected revenue"}: {euro(rk?.umsatzHeute ?? evSum, loc)}
            </p>
          </div>
          <div className="relative z-10 hidden md:flex items-center gap-3 bg-white/95 rounded-2xl px-4 py-3 shadow-lg shrink-0">
            <span className="w-10 h-10 rounded-xl bg-amber-100 grid place-items-center">
              <Sun size={20} className="text-amber-500" />
            </span>
            <span>
              <span className="block text-[13.5px] font-bold text-slate-900 tnum">{dateWeekday("2026-10-07", loc)}</span>
              <span className="block text-[12px] text-slate-500">{lang === "de" ? "Zeit, Chancen zu nutzen!" : "Time to seize opportunities!"}</span>
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
                  <span className={`w-10 h-10 rounded-xl ${k.bg} grid place-items-center shrink-0`}>
                    <Icon size={18} className={k.fg} />
                  </span>
                  <MiniSpark points={k.spark} color={k.fg.includes("red") ? "#ef4444" : k.fg.includes("blue") ? "#3b9ee3" : k.fg.includes("emerald") ? "#10b981" : "#8b5cf6"} />
                </div>
                <p className="text-[11.5px] font-semibold text-slate-500 mt-3 leading-tight">{k.label}</p>
                <p className="tnum text-[24px] font-extrabold text-slate-900 leading-tight tracking-tight">{k.value}</p>
                <p className="text-[11.5px] text-slate-400 tnum">{k.sub}</p>
              </div>
            );
          })}
        </div>

        {/* ---------------- main grid ---------------- */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
          {/* left */}
          <div className="space-y-4 min-w-0">
            <section className="card overflow-hidden anim-fade-up">
              <header className="flex items-center gap-3 px-5 pt-4 pb-3 flex-wrap">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles size={16} className="text-[#2563eb]" /> {t("dash.topEmpfehlungen")}
                  </h2>
                  <p className="text-[12.5px] text-slate-500">
                    {lang === "de" ? "Diese Kunden sollten Sie heute kontaktieren – basierend auf Daten und KI-Analyse." : "Contact these customers today – based on data and AI analysis."}
                  </p>
                </div>
                <div className="flex-1" />
                <Link href="/tagesliste" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[#2563eb] hover:underline">
                  {t("dash.alleAnsehen")} <ArrowRight size={13} />
                </Link>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[720px]">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400">
                      <th className="text-left font-bold px-4 py-2 w-10">#</th>
                      <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Kunde" : "Customer"}</th>
                      <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Anlass" : "Reason"}</th>
                      <th className="text-right font-bold px-2 py-2">{lang === "de" ? "Erwarteter Wert" : "Expected value"}</th>
                      <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Dringlichkeit" : "Urgency"}</th>
                      <th className="text-right font-bold px-4 py-2">{lang === "de" ? "Aktionen" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {realTop.length > 0
                      ? realTop.map((r, idx) => (
                          <tr key={r.kunde} className="hover:bg-blue-50/40 transition-colors group">
                            <td className="px-4 py-2.5">
                              <span className={`w-6 h-6 rounded-full grid place-items-center text-[12px] font-bold tnum ${idx < 3 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>{idx + 1}</span>
                            </td>
                            <td className="px-2 py-2.5">
                              <Link href={`/kunden/${r.kunde}`} className="font-bold text-slate-900 hover:text-[#2563eb] leading-tight block tnum">Kunde {r.kunde}</Link>
                              <span className="text-[11.5px] text-slate-400">{r.branche}</span>
                            </td>
                            <td className="px-2 py-2.5">
                              <AnlassChip anlass="ueberfaellig" n={r.ueberfaellig} lang={lang} />
                            </td>
                            <td className="px-2 py-2.5 text-right tnum font-bold text-slate-900 whitespace-nowrap">{euro(r.ev, loc)}</td>
                            <td className="px-2 py-2.5">
                              <Dringlichkeit p={r.tageMedian >= 80 ? "hoch" : r.tageMedian >= 40 ? "mittel" : "niedrig"} lang={lang} />
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                <IconBtn title={lang === "de" ? "E-Mail-Text kopieren" : "Copy email text"} onClick={() => copyRealMail(r)}><Copy size={14} /></IconBtn>
                                <IconBtn title={lang === "de" ? "Kunde öffnen" : "Open customer"} onClick={() => router.push(`/kunden/${r.kunde}`)} accent><ArrowRight size={14} /></IconBtn>
                              </div>
                            </td>
                          </tr>
                        ))
                      : top8.map((item, idx) => {
                      const k = getKunde(item.kundeId)!;
                      return (
                        <tr key={item.kundeId} className="hover:bg-blue-50/40 transition-colors group">
                          <td className="px-4 py-2.5">
                            <span className={`w-6 h-6 rounded-full grid place-items-center text-[12px] font-bold tnum ${idx < 3 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>{idx + 1}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <Link href={`/kunden/${k.id}`} className="font-bold text-slate-900 hover:text-[#2563eb] leading-tight block">{k.name}</Link>
                            <span className="text-[11.5px] text-slate-400">{k.branche}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <AnlassChip anlass={item.empfehlung.anlass} n={item.empfehlung.betroffeneAnzahl} lang={lang} />
                          </td>
                          <td className="px-2 py-2.5 text-right tnum font-bold text-slate-900 whitespace-nowrap">{euro(item.ev, loc)}</td>
                          <td className="px-2 py-2.5">
                            <Dringlichkeit p={item.prioritaet} lang={lang} />
                          </td>
                          <td className="px-4 py-2.5">
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
              <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <span className="text-[12px] text-slate-400 tnum">
                  {real
                    ? (lang === "de" ? `Top 8 nach erwartetem Wert · Stand ${dateWeekday(real.stichtag, loc)}` : `Top 8 by expected value · as of ${dateWeekday(real.stichtag, loc)}`)
                    : (lang === "de" ? `1–8 von ${list.length} Empfehlungen` : `1–8 of ${list.length} recommendations`)}
                </span>
                <Link href="/tagesliste" className="text-[12.5px] font-bold text-[#2563eb] hover:underline inline-flex items-center gap-1">
                  {lang === "de" ? "Tagesliste öffnen" : "Open daily list"} <ArrowRight size={13} />
                </Link>
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="card p-4 anim-fade-up">
                <h3 className="text-[13px] font-bold text-slate-900">{t("dash.potenzialNachAnlass")}</h3>
                <p className="text-[11.5px] text-slate-400 mt-0.5">
                  {lang === "de"
                    ? `Anteil am erwarteten Umsatz je Anlass – ${donutTop.anlass} ist mit ${donutTop.pct} % der größte Hebel.`
                    : `Share of expected revenue per reason – ${donutTop.anlass} is the biggest lever at ${donutTop.pct} %.`}
                </p>
                <div
                  className="h-[190px] mt-1 relative"
                  onMouseEnter={() => setDonutHover(true)}
                  onMouseLeave={() => setDonutHover(false)}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {donut.map((_, i) => (
                          <linearGradient key={i} id={`donut-g-${i}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={DONUT_COLORS[i % DONUT_COLORS.length]} stopOpacity="1" />
                            <stop offset="100%" stopColor={DONUT_COLORS[i % DONUT_COLORS.length]} stopOpacity="0.72" />
                          </linearGradient>
                        ))}
                      </defs>
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
                          <Cell key={i} fill={`url(#donut-g-${i})`} />
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
                      <p className="tnum text-[16px] font-extrabold text-slate-900 leading-none whitespace-nowrap">{euroK(donutTotal, loc)}</p>
                      <p className="text-[10.5px] text-slate-400 font-semibold mt-1">{lang === "de" ? "Gesamt" : "Total"}</p>
                    </div>
                  </div>
                </div>
                <ul className="mt-1 space-y-1">
                  {donut.map((d, i) => (
                    <li key={d.anlass} className="flex items-center gap-2 text-[12px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="text-slate-600 truncate flex-1">{d.anlass}</span>
                      <span className="tnum font-bold text-slate-800">{d.pct} %</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="card p-4 anim-fade-up">
                <h3 className="text-[13px] font-bold text-slate-900">{t("dash.faellig6m")}</h3>
                <p className="text-[11.5px] text-slate-400 mt-0.5">
                  {lang === "de"
                    ? `Anzahl fälliger Messmittel je Monat – Spitze im ${due6Peak.monat} (${num(due6Peak.anzahl, 0, loc)}), gesamt ${num(due6Total, 0, loc)} für Abhol- und Kapazitätsplanung.`
                    : `Due instruments per month – peak in ${due6Peak.monat} (${num(due6Peak.anzahl, 0, loc)}), ${num(due6Total, 0, loc)} total for pickup and capacity planning.`}
                </p>
                <div className="h-[190px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={due6.map((f) => ({ monat: f.monat, anzahl: f.anzahl }))} margin={{ top: 14, right: 4, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="due6-blue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#2563eb" />
                        </linearGradient>
                        <linearGradient id="due6-peak" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fdba74" />
                          <stop offset="100%" stopColor="#ea580c" />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="monat" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} width={36} />
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
                      <Bar dataKey="anzahl" radius={[7, 7, 4, 4]} maxBarSize={34} isAnimationActive animationDuration={800} animationEasing="ease-out">
                        {due6.map((d, i) => (
                          <Cell key={i} fill={d.monat === due6Peak.monat ? "url(#due6-peak)" : "url(#due6-blue)"} />
                        ))}
                        <LabelList dataKey="anzahl" position="top" formatter={(v: unknown) => (Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : `${v}`)} style={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11.5px] text-slate-400 mt-1 tnum">
                  {lang === "de" ? "Fälligkeiten je Monat ab Stichtag 25.09.2026 – orange = stärkster Monat." : "Due dates per month from 25/09/2026 – orange = peak month."}
                </p>
              </section>
            </div>
          </div>

          {/* right */}
          <div className="space-y-4">
            <section className="card p-4 anim-fade-up">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={15} className="text-[#7c3aed]" />
                <h3 className="text-[13.5px] font-bold text-slate-900">{lang === "de" ? "KI-Assistent" : "AI Assistant"}</h3>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 h-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                </span>
              </div>
              <p className="text-[12.5px] text-slate-500 leading-relaxed">
                {lang === "de" ? "Ich helfe Ihnen bei allen Fragen zu Kunden, Messmitteln und Verkaufschancen." : "I help with all questions on customers, instruments and sales opportunities."}
              </p>
              <button onClick={() => app.setAssistantOpen(true)} className="mt-3 w-full h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#2563eb] transition-colors text-left px-3 text-[13px] text-slate-400">
                {lang === "de" ? "Fragen Sie mich etwas…" : "Ask me anything…"}
              </button>
              <div className="mt-2.5 space-y-1.5">
                {[
                  lang === "de" ? "Welche Kunden haben das höchste Potenzial?" : "Which customers have the highest potential?",
                  lang === "de" ? "Zeige mir Kunden mit überfälligen Messmitteln" : "Show customers with overdue instruments",
                  lang === "de" ? "Erstelle einen E-Mail-Entwurf für den Top-Kunden" : "Draft an email for the top customer",
                ].map((s) => (
                  <button key={s} onClick={() => app.setAssistantOpen(true)} className="w-full text-left text-[12.5px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-[#2563eb] hover:bg-blue-50/50 transition-colors text-slate-600 truncate">
                    {s}
                  </button>
                ))}
              </div>
            </section>

            <section className="card p-4 anim-fade-up">
              <h3 className="text-[13px] font-bold text-slate-900 mb-2.5">⚡ {t("dash.schnellaktionen")}</h3>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction icon={<FileText size={16} className="text-[#2563eb]" />} bg="bg-blue-50" title={lang === "de" ? "Angebot erstellen" : "Create quote"} sub={lang === "de" ? "PDF aus fälligen" : "PDF from due"} onClick={() => top8[0] && openQuote(top8[0].kundeId)} />
                <QuickAction icon={<Mail size={16} className="text-violet-600" />} bg="bg-violet-50" title="E-Mail-Entwurf" sub={lang === "de" ? "Formelle E-Mail" : "Formal email"} onClick={() => top8[0] && router.push(`/kunden/${top8[0].kundeId}`)} />
                <QuickAction icon={<ShieldAlert size={16} className="text-emerald-600" />} bg="bg-emerald-50" title={lang === "de" ? "Kundenanalyse" : "Customer analysis"} sub={lang === "de" ? "Detaillierte Ansicht" : "Detailed view"} onClick={() => router.push("/kunden")} />
                <QuickAction icon={<TrendingUp size={16} className="text-amber-600" />} bg="bg-amber-50" title={lang === "de" ? "Bericht exportieren" : "Export report"} sub="Excel oder PDF" onClick={() => router.push(isLeitung ? "/cockpit" : "/kunden")} />
              </div>
            </section>

            <section className="card p-4 anim-fade-up">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-bold text-slate-900">{isLeitung ? t("dash.risikoBranche") : t("dash.topBranchen")}</h3>
                <Link href={isLeitung ? "/cockpit" : "/kunden"} className="text-[12px] font-bold text-[#2563eb] hover:underline">{t("dash.alleAnsehen")} →</Link>
              </div>
              <div className="space-y-2.5">
                {topBranchen.map((b, i) => (
                  <div key={b.name}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[12.5px] text-slate-600 truncate">{b.name}</span>
                      <span className="tnum text-[12px] font-bold text-slate-800">{b.pct} %</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(6, (b.wert / Math.max(...topBranchen.map((x) => x.wert))) * 100)}%`, background: ["#2563eb", "#7c3aed", "#10b981", "#f59e0b", "#94a3b8"][i % 5] }} />
                    </div>
                  </div>
                ))}
              </div>
              {isLeitung && (
                <Link href="/cockpit" className="mt-3 w-full h-10 rounded-xl bg-slate-900 text-white text-[13px] font-semibold grid place-items-center hover:bg-slate-700 transition-colors">
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
    ueberfaellig: "bg-red-50 text-red-600 border-red-100",
    faellig_bald: "bg-blue-50 text-blue-700 border-blue-100",
    abwanderung: "bg-violet-50 text-violet-700 border-violet-100",
    branche: "bg-emerald-50 text-emerald-700 border-emerald-100",
    portal: "bg-amber-50 text-amber-700 border-amber-100",
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
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[11.5px] font-semibold whitespace-nowrap ${map[anlass] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {label[anlass] ?? anlass}
    </span>
  );
}

function Dringlichkeit({ p, lang }: { p: string; lang: string }) {
  const map: Record<string, string> = {
    hoch: "bg-red-50 text-red-600 border-red-200",
    mittel: "bg-amber-50 text-amber-700 border-amber-200",
    niedrig: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const label = p === "hoch" ? (lang === "de" ? "Sehr hoch" : "Very high") : p === "mittel" ? (lang === "de" ? "Mittel" : "Medium") : (lang === "de" ? "Niedrig" : "Low");
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-md border text-[11.5px] font-bold whitespace-nowrap ${map[p] ?? ""}`}>
      {label}
    </span>
  );
}

function IconBtn({ children, title, href, onClick, accent }: { children: React.ReactNode; title: string; href?: string; onClick?: () => void; accent?: boolean }) {
  const cls = `w-8 h-8 rounded-lg grid place-items-center border transition-colors ${accent ? "bg-[#2563eb] border-[#2563eb] text-white hover:bg-[#1d4ed8]" : "bg-white border-slate-200 text-slate-500 hover:border-[#2563eb] hover:text-[#2563eb]"}`;
  if (href) return <a href={href} title={title} className={cls}>{children}</a>;
  return <button title={title} onClick={onClick} className={cls}>{children}</button>;
}

function QuickAction({ icon, bg, title, sub, onClick }: { icon: React.ReactNode; bg: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-200 hover:shadow-[0_8px_20px_-12px_rgba(16,41,58,.25)] transition-all p-2.5">
      <span className={`w-8 h-8 rounded-lg ${bg} grid place-items-center mb-1.5`}>{icon}</span>
      <span className="block text-[12.5px] font-bold text-slate-800 leading-tight">{title}</span>
      <span className="block text-[11px] text-slate-400 leading-tight mt-0.5">{sub}</span>
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
