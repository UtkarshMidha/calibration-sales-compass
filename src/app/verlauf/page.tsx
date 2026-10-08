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
  const { monate } = useVerlauf();
  const { data: pot } = usePotenzial();
  const [tab, setTab] = useState<ChartTab>("churn");
  const [potTab, setPotTab] = useState<PotTab>("kommend");
  const [sel, setSel] = useState<string | null>(null);

  const short = (key: string) => `${MK[key.slice(5, 7)]?.[lang] ?? key.slice(5)} ${key.slice(2, 4)}`;

  const chartData = useMemo(
    () => (monate ?? []).map((m) => ({ ...m, label: short(m.monat) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monate, lang],
  );

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
      <div className="px-5 py-4 max-w-[1400px] mx-auto space-y-4">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900">
            {lang === "de" ? "Verlauf" : "History"}
          </h1>
          <p className="text-[13px] text-slate-500">
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
                  <span className={`w-10 h-10 rounded-xl ${k.bg} grid place-items-center shrink-0`}>
                    <Icon size={18} className={k.fg} />
                  </span>
                </div>
                <p className="text-[11.5px] font-semibold text-slate-500 mt-3 leading-tight">{k.label}</p>
                <p className="tnum text-[24px] font-extrabold text-slate-900 leading-tight tracking-tight">{k.value}</p>
                <p className="text-[11.5px] text-slate-400 tnum">{k.sub}</p>
              </div>
            );
          })}
        </div>

        <section className="card p-4 anim-fade-up">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 p-1">
              <TabBtn active={tab === "churn"} onClick={() => setTab("churn")}>
                {lang === "de" ? "Abwanderung" : "Churn"}
              </TabBtn>
              <TabBtn active={tab === "aktiv"} onClick={() => setTab("aktiv")}>
                {lang === "de" ? "Aktivität" : "Activity"}
              </TabBtn>
            </div>
            <div className="flex-1" />
            <span className="text-[11.5px] text-slate-400">
              {lang === "de" ? "Balken/Segment anklicken → Details unten" : "Click a bar/segment → details below"}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 mb-2 leading-relaxed">
            {tab === "churn"
              ? (lang === "de"
                ? "Balken: in diesem Monat abgewanderte Kunden. Linie: kumuliert abgewanderte Kunden. Nur Monate mit ≥ 6 Monaten Abstand sind aussagekräftig – jüngere Monate können noch zurückkehren."
                : "Bars: customers who churned that month. Line: cumulative churned customers. Only months 6+ months back are conclusive – recent months may still return.")
              : (lang === "de"
                ? "Balken: Kalibrierungen je Monat. Linie: aktive Kunden je Monat – das Grundrauschen, gegen das Stilllegung auffällt."
                : "Bars: calibrations per month. Line: active customers per month – the baseline against which silence stands out.")}
          </p>
          <div className="h-[240px]">
            {!monate ? (
              <div className="h-full rounded-xl bg-slate-50 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 14, right: 8, left: -8, bottom: 0 }} onClick={pickMonth} style={{ cursor: "pointer" }}>
                  <defs>
                    <linearGradient id="v-churn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                    <linearGradient id="v-kal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                    <linearGradient id="v-kum" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1c3b51" />
                      <stop offset="100%" stopColor="#ff7000" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} interval={2} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} width={44 }
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} width={40}
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
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
                    cursor={{ fill: "rgba(37,99,235,.07)" }}
                  />
                  {tab === "churn" ? (
                    <>
                      <Bar yAxisId="left" dataKey="neuStill" radius={[6, 6, 3, 3]} maxBarSize={30} isAnimationActive animationDuration={700}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.monat === selected?.monat ? "#ff7000" : "url(#v-churn)"} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="stillKumuliert" stroke="url(#v-kum)" strokeWidth={2.6} dot={false} strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <Bar yAxisId="left" dataKey="kalibrierungen" radius={[6, 6, 3, 3]} maxBarSize={30} isAnimationActive animationDuration={700} fill="url(#v-kal)" />
                      <Line yAxisId="right" type="monotone" dataKey="aktiveKunden" stroke="#10b981" strokeWidth={2.4} dot={false} strokeLinecap="round" />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card overflow-hidden anim-fade-up">
          <header className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">
                {selected
                  ? (lang === "de" ? `Abgewandert im ${short(selected.monat)}` : `Churned in ${short(selected.monat)}`)
                  : (lang === "de" ? "Details" : "Details")}
              </h2>
              <p className="text-[12.5px] text-slate-500">
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
              <table className="w-full text-[13px] min-w-[720px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400">
                    <th className="text-left font-bold px-4 py-2">{lang === "de" ? "Kunde" : "Customer"}</th>
                    <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Branche" : "Industry"}</th>
                    <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Zuletzt aktiv" : "Last active"}</th>
                    <th className="text-right font-bold px-2 py-2">{lang === "de" ? "Volumen 6M" : "Volume 6M"}</th>
                    <th className="text-right font-bold px-2 py-2">{lang === "de" ? "Überfällig" : "Overdue"}</th>
                    <th className="text-right font-bold px-4 py-2">{lang === "de" ? "Wert" : "Value"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.top.map((r) => (
                    <tr key={r.kunde} className="hover:bg-blue-50/40">
                      <td className="px-4 py-2">
                        <Link href={`/kunden/${r.kunde}`} className="tnum font-bold text-slate-900 hover:text-[#2563eb]">Kunde {r.kunde}</Link>
                      </td>
                      <td className="px-2 py-2 text-slate-500 max-w-[240px] truncate">{r.branche}</td>
                      <td className="px-2 py-2 tnum text-slate-500">{r.letzteKal ? date(r.letzteKal, loc) : "–"}</td>
                      <td className="px-2 py-2 text-right tnum text-slate-700">{num(r.volumen6m, 0, loc)}</td>
                      <td className="px-2 py-2 text-right tnum font-semibold text-red-600">{r.ueberfaellig > 0 ? num(r.ueberfaellig, 0, loc) : "–"}</td>
                      <td className="px-4 py-2 text-right tnum font-bold text-slate-900 whitespace-nowrap">{euro(r.wert, loc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-4 anim-fade-up">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-[15px] font-bold text-slate-900">{lang === "de" ? "Potenzialkunden" : "Potential customers"}</h2>
            <div className="flex-1" />
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 p-1">
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
          <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">
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
            <div className="h-24 rounded-xl bg-slate-50 animate-pulse" />
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-[13px] min-w-[680px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400">
                    <th className="text-left font-bold px-4 py-2">{lang === "de" ? "Kunde" : "Customer"}</th>
                    <th className="text-left font-bold px-2 py-2">{lang === "de" ? "Branche" : "Industry"}</th>
                    <th className="text-left font-bold px-2 py-2">{potTab === "kommend" ? (lang === "de" ? "Fällig" : "Due") : potTab === "portal" ? (lang === "de" ? "Aufträge" : "Orders") : (lang === "de" ? "Lücke" : "Gap")}</th>
                    <th className="text-right font-bold px-2 py-2">{lang === "de" ? "Wert" : "Value"}</th>
                    <th className="text-right font-bold px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-[30px] px-3.5 rounded-[9px] text-[12.5px] font-semibold transition-all ${
        active ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:text-slate-900 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function PotRow({ kunde, branche, metric, wert }: { kunde: string; branche: string; metric: string; wert: string }) {
  return (
    <tr className="hover:bg-blue-50/40">
      <td className="px-4 py-2">
        <Link href={`/kunden/${kunde}`} className="tnum font-bold text-slate-900 hover:text-[#2563eb]">Kunde {kunde}</Link>
      </td>
      <td className="px-2 py-2 text-slate-500 max-w-[260px] truncate">{branche}</td>
      <td className="px-2 py-2 text-slate-700">{metric}</td>
      <td className="px-2 py-2 text-right tnum font-bold text-slate-900 whitespace-nowrap">{wert}</td>
      <td className="px-4 py-2 text-right">
        <Link href={`/kunden/${kunde}`} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[#2563eb] hover:underline">
          <ArrowRight size={13} />
        </Link>
      </td>
    </tr>
  );
}
