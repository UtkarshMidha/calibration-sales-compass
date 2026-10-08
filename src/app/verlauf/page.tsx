"use client";

import { ArrowRight, CalendarClock, ShieldAlert, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { date, euro, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { usePotenzial, useVerlauf } from "@/lib/real-data";
import { useApp } from "@/lib/store";

const MK: Record<string, { de: string; en: string }> = {
  "01": { de: "Jan", en: "Jan" }, "02": { de: "Feb", en: "Feb" },
  "03": { de: "Mär", en: "Mar" }, "04": { de: "Apr", en: "Apr" },
  "05": { de: "Mai", en: "May" }, "06": { de: "Jun", en: "Jun" },
  "07": { de: "Jul", en: "Jul" }, "08": { de: "Aug", en: "Aug" },
  "09": { de: "Sep", en: "Sep" }, "10": { de: "Okt", en: "Oct" },
  "11": { de: "Nov", en: "Nov" }, "12": { de: "Dez", en: "Dec" },
};

type ChartTab = "churn" | "aktiv";
type PotTab = "kommend" | "portal" | "luecken";

export default function VerlaufPage() {
  const { lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const app = useApp();
  const { monate } = useVerlauf();
  const { data: pot } = usePotenzial();
  const [tab, setTab] = useState<ChartTab>("churn");
  const [potTab, setPotTab] = useState<PotTab>("kommend");
  const [sel, setSel] = useState<string | null>(null);

  const short = (key: string) => `${MK[key.slice(5, 7)]?.[lang] ?? key.slice(5)} ${key.slice(2, 4)}`;

  /* Abwanderung ist erst ~6 Monate später sicher (Stille ≠ Churn).
   * Monate danach sind nicht aussagekräftig und werden im Churn-Tab
   * ausgeblendet, statt die kumulierte Linie flach ins Leere zu ziehen. */
  const churnCutoff = useMemo(() => shiftMonthKey(app.stichtag.slice(0, 7), -6), [app.stichtag]);

  const chartData = useMemo(() => {
    const base = (monate ?? []).map((m) => ({ ...m, label: short(m.monat) }));
    return tab === "churn" ? base.filter((m) => m.monat <= churnCutoff) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monate, lang, tab, churnCutoff]);

  const selected = useMemo(() => {
    if (!monate || monate.length === 0) return null;
    if (sel) return monate.find((m) => m.monat === sel) ?? null;
    return monate.reduce((a, b) => (b.neuStill > a.neuStill ? b : a), monate[0]);
  }, [monate, sel]);

  const last = monate?.[monate.length - 1];
  const peak = useMemo(
    () => (monate ?? []).reduce((a, b) => (b.neuStill > (a?.neuStill ?? -1) ? b : a), monate?.[0]),
    [monate],
  );
  const potSum = useMemo(() => {
    if (!pot) return 0;
    return (
      pot.kommend.reduce((s, r) => s + r.wert, 0) +
      pot.portal.reduce((s, r) => s + r.wert, 0) +
      pot.luecken.reduce((s, r) => s + r.wert, 0)
    );
  }, [pot]);

  const pickMonth = (s: unknown) => {
    const p = (s as { activePayload?: { payload?: { monat?: string } }[] })?.activePayload;
    const m = p?.[0]?.payload?.monat;
    if (m) setSel(m);
  };

  const kpis = [
    {
      label: lang === "de" ? "Abgewanderte Kunden" : "Churned customers",
      value: last ? num(last.stillKumuliert, 0, loc) : "–",
      sub: lang === "de" ? "kumuliert · ≥ 6 Monate ohne Kalibrierung" : "cumulative · no calibration for 6+ months",
      icon: Users, bg: "bg-red-50", fg: "text-red-500",
    },
    {
      label: lang === "de" ? "Gefährdeter Wert" : "Value at risk",
      value: last ? euro(last.stillWert, loc) : "–",
      sub: lang === "de" ? "überfällige Messmittel dieser Kunden" : "overdue instruments of these customers",
      icon: ShieldAlert, bg: "bg-amber-50", fg: "text-amber-600",
    },
    {
      label: lang === "de" ? "Stärkster Verlustmonat" : "Worst churn month",
      value: peak ? short(peak.monat) : "–",
      sub: peak ? `${num(peak.neuStill, 0, loc)} ${lang === "de" ? "Kunden verloren – nie zurückgekehrt" : "customers lost – never returned"}` : "",
      icon: TrendingUp, bg: "bg-violet-50", fg: "text-violet-600",
    },
    {
      label: lang === "de" ? "Offenes Potenzial" : "Open potential",
      value: euro(potSum, loc),
      sub: lang === "de" ? "fällig + Portal + Branchenlücken" : "due + portal + industry gaps",
      icon: CalendarClock, bg: "bg-emerald-50", fg: "text-emerald-600",
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="page space-y-4">
        <div>
          <h1 className="page-title">
            {lang === "de" ? "Verlauf" : "History"}
          </h1>
          <p className="page-sub">
            {lang === "de"
              ? "Abwanderung bisher · Potenzial als Nächstes. Stand 25.09.2026 – Monat anklicken für Details."
              : "Churn so far · potential next. As of 25/09/2026 – click a month for details."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="card kpi p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={`w-9 h-9 rounded-[8px] ${k.bg} grid place-items-center shrink-0`}>
                    <Icon size={17} className={k.fg} />
                  </span>
                </div>
                <p className="section-label mt-3 leading-tight">{k.label}</p>
                <p className="tnum text-[24px] font-bold text-navy-800 leading-tight tracking-tight">{k.value}</p>
                <p className="text-[12px] text-ink-3 tnum">{k.sub}</p>
              </div>
            );
          })}
        </div>

        <section className="card p-5 anim-fade-up">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div className="inline-flex items-center gap-1 rounded-[8px] bg-surface-1 border border-line p-1">
              <TabBtn active={tab === "churn"} onClick={() => setTab("churn")}>
                {lang === "de" ? "Abwanderung" : "Churn"}
              </TabBtn>
              <TabBtn active={tab === "aktiv"} onClick={() => setTab("aktiv")}>
                {lang === "de" ? "Aktivität" : "Activity"}
              </TabBtn>
            </div>
            <div className="flex-1" />
            <span className="text-[11.5px] text-ink-3">
              {lang === "de" ? "Balken/Segment anklicken → Details unten" : "Click a bar/segment → details below"}
            </span>
          </div>
          <p className="text-[12px] text-ink-2 mb-2 leading-relaxed">
            {tab === "churn"
              ? (lang === "de"
                ? "Balken: in diesem Monat abgewanderte Kunden. Linie: kumuliert abgewanderte Kunden. Nur Monate mit ≥ 6 Monaten Abstand sind aussagekräftig – jüngere Monate werden daher ausgeblendet."
                : "Bars: customers who churned that month. Line: cumulative churned customers. Only months 6+ months back are conclusive – more recent months are hidden for that reason.")
              : (lang === "de"
                ? "Balken: Kalibrierungen je Monat. Linie: aktive Kunden je Monat – das Grundrauschen, gegen das Stilllegung auffällt."
                : "Bars: calibrations per month. Line: active customers per month – the baseline against which silence stands out.")}
          </p>
          <div className="h-[240px]">
            {!monate ? (
              <div className="h-full rounded-[8px] bg-surface-2 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 14, right: 8, left: -8, bottom: 0 }} onClick={pickMonth} style={{ cursor: "pointer" }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6d7378" }} interval={2} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6d7378" }} width={44 }
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6d7378" }} width={44}
                    tickFormatter={(v: number) => num(v, 0, loc)} />
                  <Tooltip
                    content={(p: unknown) => {
                      const { active, payload, label } = p as {
                        active?: boolean; payload?: { value?: unknown; dataKey?: string | number }[]; label?: string;
                      };
                      if (!active || !payload || payload.length === 0) return null;
                      const row = chartData.find((m) => m.label === label);
                      return (
                        <div className="chart-tip">
                          <p className="t-sub">{lang === "de" ? "Monat" : "Month"} {label}</p>
                          {tab === "churn" ? (
                            <>
                              <p className="font-bold tnum">{num(Number(payload[0]?.value ?? 0), 0, loc)} {lang === "de" ? "abgewandert" : "churned"}</p>
                              <p className="tnum">{num(row?.stillKumuliert ?? 0, 0, loc)} {lang === "de" ? "kumuliert" : "cumulative"}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold tnum">{num(Number(payload[0]?.value ?? 0), 0, loc)} {lang === "de" ? "Kalibrierungen" : "calibrations"}</p>
                              <p className="tnum">{num(row?.aktiveKunden ?? 0, 0, loc)} {lang === "de" ? "aktive Kunden" : "active customers"}</p>
                            </>
                          )}
                        </div>
                      );
                    }}
                    cursor={{ fill: "rgba(28,59,81,.06)" }}
                  />
                  {tab === "churn" ? (
                    <>
                      <Bar yAxisId="left" dataKey="neuStill" radius={[6, 6, 2, 2]} maxBarSize={30} isAnimationActive animationDuration={700}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.monat === selected?.monat ? "var(--color-navy-800)" : "#dc2626"} fillOpacity={d.monat === selected?.monat ? 1 : 0.85} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="stillKumuliert" stroke="var(--color-navy-800)" strokeWidth={2.6} dot={false} strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <Bar yAxisId="left" dataKey="kalibrierungen" radius={[6, 6, 2, 2]} maxBarSize={30} isAnimationActive animationDuration={700} fill="var(--color-azure)" />
                      <Line yAxisId="right" type="monotone" dataKey="aktiveKunden" stroke="var(--color-ok)" strokeWidth={2.4} dot={false} strokeLinecap="round" />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card overflow-hidden anim-fade-up">
          <header className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold text-navy-800">
                {selected
                  ? (lang === "de" ? `Abgewandert im ${short(selected.monat)}` : `Churned in ${short(selected.monat)}`)
                  : (lang === "de" ? "Details" : "Details")}
              </h2>
              <p className="text-[12.5px] text-ink-3 mt-0.5">
                {selected && selected.top.length > 0
                  ? (lang === "de"
                    ? `${selected.neuStill} Kunden · Top nach Vorvolumen – anklicken für Kundenansicht`
                    : `${selected.neuStill} customers · top by prior volume – click for customer view`)
                  : (lang === "de"
                    ? "In diesem Monat ist niemand abgewandert (zu kurz her für eine Aussage)."
                    : "Nobody churned this month (too recent to tell).")}
              </p>
            </div>
          </header>
          {selected && selected.top.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tbl w-full text-[13px] min-w-[680px]">
                <thead>
                  <tr className="text-[11px]">
                    <th className="text-left font-bold px-5 py-2">{lang === "de" ? "Kunde" : "Customer"}</th>
                    <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Branche" : "Industry"}</th>
                    <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Zuletzt aktiv" : "Last active"}</th>
                    <th className="text-right font-bold px-2 py-2">{lang === "de" ? "Volumen 6M" : "Volume 6M"}</th>
                    <th className="text-right font-bold px-2 py-2">{lang === "de" ? "Überfällig" : "Overdue"}</th>
                    <th className="text-right font-bold px-5 py-2">{lang === "de" ? "Wert" : "Value"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {selected.top.map((r) => (
                    <tr key={r.kunde}>
                      <td className="px-5 py-2">
                        <Link href={`/kunden/${r.kunde}`} className="tnum font-semibold text-navy-800 hover:text-action">Kunde {r.kunde}</Link>
                      </td>
                      <td className="px-2 py-2 text-ink-2 max-w-[240px] truncate">{r.branche}</td>
                      <td className="px-2 py-2 tnum text-ink-2">{r.letzteKal ? date(r.letzteKal, loc) : "–"}</td>
                      <td className="px-2 py-2 text-right tnum text-ink-2">{num(r.volumen6m, 0, loc)}</td>
                      <td className="px-2 py-2 text-right tnum font-semibold text-overdue">{r.ueberfaellig > 0 ? num(r.ueberfaellig, 0, loc) : "–"}</td>
                      <td className="px-5 py-2 text-right tnum font-bold text-navy-800 whitespace-nowrap">{euro(r.wert, loc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5 anim-fade-up">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-[14px] font-bold text-navy-800">{lang === "de" ? "Potenzialkunden" : "Potential customers"}</h2>
            <div className="flex-1" />
            <div className="inline-flex items-center gap-1 rounded-[8px] bg-surface-1 border border-line p-1">
              <TabBtn active={potTab === "kommend"} onClick={() => setPotTab("kommend")}>
                {lang === "de" ? "Fällig demnächst" : "Due soon"}
              </TabBtn>
              <TabBtn active={potTab === "portal"} onClick={() => setPotTab("portal")}>
                {lang === "de" ? "Ohne Portal" : "No portal"}
              </TabBtn>
              <TabBtn active={potTab === "luecken"} onClick={() => setPotTab("luecken")}>
                {lang === "de" ? "Branchenlücken" : "Industry gaps"}
              </TabBtn>
            </div>
          </div>
          <p className="text-[12.5px] text-ink-2 mb-3 leading-relaxed">
            {potTab === "kommend" && (lang === "de"
              ? "Fällig in 30 Tagen – jetzt anrufen und Abholung einplanen, bevor es überfällig wird."
              : "Due within 30 days – call now and schedule pickup before it goes overdue.")}
            {potTab === "portal" && (lang === "de"
              ? "Bestellen ohne trendic® hub (ab 5 Aufträgen/Jahr) – Zertifikate und Erinnerungen als Türöffner."
              : "Ordering without trendic® hub (5+ orders/year) – certificates and reminders as door opener.")}
            {potTab === "luecken" && (lang === "de"
              ? "Messmittelgruppen, die ≥ 40 % der Branchen-Peers bei uns kalibrieren – dieser Kunde aber nicht."
              : "Instrument groups ≥ 40% of industry peers calibrate with us – but this customer doesn't.")}
          </p>
          {!pot ? (
            <div className="h-24 rounded-[8px] bg-surface-2 animate-pulse" />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl w-full text-[13px] min-w-[680px]">
                <thead>
                  <tr className="text-[11px]">
                    <th className="text-left font-bold px-5 py-2">{lang === "de" ? "Kunde" : "Customer"}</th>
                    <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Branche" : "Industry"}</th>
                    <th className="text-left font-bold px-2 py-2">{potTab === "kommend" ? (lang === "de" ? "Fällig" : "Due") : potTab === "portal" ? (lang === "de" ? "Aufträge" : "Orders") : (lang === "de" ? "Lücke" : "Gap")}</th>
                    <th className="text-right font-bold px-2 py-2">{lang === "de" ? "Wert" : "Value"}</th>
                    <th className="text-right font-bold px-5 py-2"><span className="sr-only">{lang === "de" ? "Öffnen" : "Open"}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {potTab === "kommend" && pot.kommend.map((r) => (
                    <PotRow key={r.kunde} kunde={r.kunde} branche={r.branche} metric={`${num(r.due30, 0, loc)} ${lang === "de" ? "Messmittel" : "instruments"}`} wert={euro(r.wert, loc)} />
                  ))}
                  {potTab === "portal" && pot.portal.map((r) => (
                    <PotRow key={r.kunde} kunde={r.kunde} branche={r.branche} metric={`${num(r.auftraege12m, 0, loc)} ${lang === "de" ? "Aufträge, 0× Portal" : "orders, 0× portal"}`} wert={euro(r.wert, loc)} />
                  ))}
                  {potTab === "luecken" && pot.luecken.map((r) => (
                    <PotRow key={r.kunde + r.gruppe} kunde={r.kunde} branche={r.branche} metric={`${r.gruppe} · ${r.peerPct} % Peers · ≈${r.erwartet} Stk.`} wert={euro(r.wert, loc)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function shiftMonthKey(key: string, delta: number): string {
  const t = Number(key.slice(0, 4)) * 12 + (Number(key.slice(5, 7)) - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 px-3.5 rounded-[6px] text-[12.5px] font-semibold transition-colors ${
        active ? "bg-navy-800 text-white shadow" : "text-ink-3 hover:text-ink hover:bg-surface-0"
      }`}
    >
      {children}
    </button>
  );
}

function PotRow({ kunde, branche, metric, wert }: { kunde: string; branche: string; metric: string; wert: string }) {
  return (
    <tr>
      <td className="px-5 py-2">
        <Link href={`/kunden/${kunde}`} className="tnum font-semibold text-navy-800 hover:text-action">Kunde {kunde}</Link>
      </td>
      <td className="px-2 py-2 text-ink-2 max-w-[260px] truncate" title={branche}>{branche}</td>
      <td className="px-2 py-2 text-ink-2">{metric}</td>
      <td className="px-2 py-2 text-right tnum font-bold text-navy-800 whitespace-nowrap">{wert}</td>
      <td className="px-5 py-2 text-right">
        <Link
          href={`/kunden/${kunde}`}
          aria-label={`Kunde ${kunde} öffnen`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-[8px] text-[12.5px] font-bold text-ink-3 hover:text-action hover:bg-surface-1 transition-colors"
        >
          <ArrowRight size={14} />
        </Link>
      </td>
    </tr>
  );
}
