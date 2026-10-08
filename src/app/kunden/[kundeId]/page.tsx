"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  Mail,
  Phone,
  Timer,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildEmail } from "@/lib/content";
import {
  GEBIETE,
  USERS,
  GRUPPEN,
  getAktivitaet,
  getEmpfehlungFuer,
  getKunde,
  getKundenPrognose,
  getLuecken,
  getMessmittel,
  getZeitstrahl,
  type MessmittelStatus,
} from "@/lib/data";
import { useKundenIndex, useMessmittelSample } from "@/lib/real-data";
import { date, euro, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import {
  Btn,
  Chip,
  DemoBadge,
  EmptyState,
  Gauge,
  PrioritaetsBadge,
  StatusPill,
  Zeitstrahl,
} from "@/components/ui";

const TABS = ["uebersicht", "messmittel", "historie"] as const;
type Tab = (typeof TABS)[number];

const STATUS_FILTERS: (MessmittelStatus | "alle")[] = ["alle", "ueberfaellig", "teilabwanderung", "faellig_bald", "ok", "nio", "gestoppt"];

export default function Kunde360Page() {
  const params = useParams<{ kundeId: string }>();
  const app = useApp();
  const { t, lang } = useI18n();
  const router = useRouter();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const [tab, setTab] = useState<Tab>("uebersicht");
  const [statusFilter, setStatusFilter] = useState<MessmittelStatus | "alle">("alle");
  const [identQ, setIdentQ] = useState("");

  const k = getKunde(params.kundeId);

  if (!k) {
    return <RealKundeView kundeId={params.kundeId} />;
  }

  const emp = getEmpfehlungFuer(k.id, app.stichtag, app.settings);
  const claim = app.claims[k.id];
  const buckets = getZeitstrahl(k.id, app.stichtag);
  const luecken = getLuecken(k.id);
  const aktivitaet = getAktivitaet(k.id, app.stichtag);
  const prognose = getKundenPrognose(k.id, app.stichtag);
  const alleRows = getMessmittel(k.id, app.stichtag);

  const rows = useMemo(() => {
    const q = identQ.trim().toLowerCase();
    return alleRows.filter((r) => {
      if (statusFilter !== "alle" && r.status !== statusFilter) return false;
      if (q && !r.ident.toLowerCase().includes(q) && !r.typ.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [alleRows, statusFilter, identQ]);

  const counts = useMemo(() => {
    const m = new Map<MessmittelStatus, number>();
    for (const r of alleRows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [alleRows]);

  /* history chart data: exact stack (DAkkS + rest + failed = total) */
  const histData = useMemo(
    () =>
      aktivitaet.map((m) => ({
        monat: m.monat,
        dakks: m.dakks,
        rest: Math.max(0, m.anzahl - m.dakks - m.nio),
        nio: m.nio,
        total: m.anzahl,
      })),
    [aktivitaet],
  );

  const gapValue = luecken.reduce((s, l) => s + l.stunden * app.settings.stundensatz, 0);
  const gapCount = luecken.filter((l) => l.stunden > 0).length;

  const exportCsv = () => {
    const head = ["Ident", "Gruppe", "Typ", "Groesse", "Letzte Kalibrierung", "Faeligkeit", "Status", "Pruefungsart", "Bewertung", "Minuten"];
    const lines = rows.map((r) =>
      [r.ident, GRUPPEN[r.gruppe].name, r.typ, r.groesse, r.letzteKal, r.faelligkeit, r.status, r.pruefungsart, r.bewertung, String(r.minuten)]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["\uFEFF" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Messmittel-${k.nummer}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const anrede = buildEmail(k, emp?.empfehlung, emp?.empfehlung.anlass ?? "ueberfaellig", lang, app.user, t(app.user.nameKey), t);

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      {/* ---------------- header ---------------- */}
      <div className="card overflow-hidden anim-fade-up">
        <div className="px-5 pt-4 pb-3 border-b border-line flex items-start gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <Link href="/kunden" className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-brand-700 font-semibold mb-1.5">
              <ArrowLeft size={12} /> {t("kunden.titel")}
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[20px] font-bold text-navy-800 leading-tight">{k.name}</h2>
              <span className="tnum text-[13px] text-ink-3">{k.nummer}</span>
              <DemoBadge />
            </div>
            <p className="text-[13px] text-ink-2 mt-0.5">
              {k.branche} · {k.ort} · {t("empf.gebiet")} {k.gebiet} · {t("k360.kundeSeit")} {k.seit}
            </p>
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {emp ? (
                <>
                  <Chip tone={emp.empfehlung.anlass === "ueberfaellig" ? "overdue" : emp.empfehlung.anlass === "faellig_bald" ? "due" : emp.empfehlung.anlass === "abwanderung" ? "violet" : "azure"}>
                    {t(`anlass.${emp.empfehlung.anlass}` as "anlass.ueberfaellig")}
                  </Chip>
                  <PrioritaetsBadge p={emp.prioritaet} lang={lang} />
                  <span className="tnum text-[13px] font-bold text-navy-800">{euro(emp.ev, loc)}</span>
                  <Link href="/" className="text-[12px] font-bold text-brand-700 hover:underline inline-flex items-center gap-1">
                    {t("nav.heute")} <ArrowRight size={12} />
                  </Link>
                </>
              ) : (
                <span className="text-[12.5px] text-ink-3">
                  {lang === "de" ? "Heute keine Empfehlung für diesen Kunden." : "No recommendation today."}
                </span>
              )}
              {claim && (
                <Chip tone="navy">
                  <UserCheck size={11} /> {t("akt.uebernommen", { name: USERS.find((u) => u.id === claim)?.kurz ?? "–" })}
                </Chip>
              )}
            </div>
          </div>

          {/* gauge + key figures */}
          <div className="flex items-center gap-5 flex-wrap">
            <Gauge value={k.risiko} band={k.band} label={t("k360.risiko")} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-right">
              <Figure label={t("k360.aktiveMessmittel")} value={num(k.aktiv, 0, loc)} />
              <Figure label={t("anlass.ueberfaellig")} value={num(k.ueberfaellig, 0, loc)} tone={k.ueberfaellig > 0 ? "overdue" : undefined} />
              <Figure label={t("k360.letzteKal")} value={date(k.letzteKal, loc)} />
              <Figure label={t("empf.wert")} value={euro(k.umsatzStunden * app.settings.stundensatz, loc)} />
            </div>
          </div>
        </div>

        {/* action row */}
        <div className="px-4 py-2.5 bg-surface-1 flex items-center gap-1.5 flex-wrap">
          <Btn
            variant="primary"
            onClick={() => {
              app.claim(k.id);
              app.toast(t("toast.uebernommen"));
            }}
          >
            <UserCheck size={14} /> {t("akt.uebernehmen")}
          </Btn>
          <Btn variant="secondary" onClick={() => app.toast(anrede.betreff)}>
            <Mail size={14} /> {t("akt.email")}
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => {
              const id = app.createDraft(k.id);
              router.push(`/angebote/${id}`);
            }}
          >
            <FileText size={14} /> {t("akt.angebot")}
          </Btn>
          <Btn variant="ghost" onClick={() => app.toast(t("toast.wiedervorlage", { datum: date(app.stichtag, loc) }))}>
            <Timer size={14} /> {t("akt.spaeter")}
          </Btn>
          <div className="flex-1" />
          <span className="text-[12px] text-ink-3">
            {t("k360.ruecklaufQuote", { q: Math.round(k.ruecklauf.quote * 100) + " %" })} ·{" "}
            {t("k360.ruecklaufLag", { n: k.ruecklauf.lag })}
          </span>
        </div>
      </div>

      {/* ---------------- tabs ---------------- */}
      <div className="flex items-center gap-2 mt-4 mb-3 flex-wrap">
        <div className="inline-flex items-center gap-1 rounded-[8px] bg-surface-0 border border-line p-1 shadow-[0_1px_2px_rgba(16,41,58,.06)]">
          {TABS.map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={clsx(
                "h-[30px] px-3.5 rounded-[8px] text-[12.5px] font-semibold transition-all",
                tab === tb ? "bg-navy-800 text-white shadow" : "text-ink-3 hover:text-ink hover:bg-surface-1",
              )}
            >
              {tb === "uebersicht"
                ? t("k360.uebersicht")
                : tb === "messmittel"
                  ? t("k360.messmittelliste")
                  : lang === "de" ? "Historie & Potenzial" : "History & potential"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="hidden sm:block text-[11.5px] text-ink-3">
          {lang === "de" ? "24 Monate Historie · 12 Monate Prognose" : "24 months history · 12 months forecast"}
        </span>
      </div>

      {/* ---------------- Übersicht ---------------- */}
      {tab === "uebersicht" && (
        <div className="space-y-4 anim-fade-up">
          <section className="card p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 mb-3">{t("empf.zeitstrahl")}</h3>
            <Zeitstrahl buckets={buckets} stichtag={app.stichtag} lang={lang} />
          </section>

          <section className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div>
                <h3 className="section-label">{t("k360.luecken")}</h3>
                <p className="text-[12.5px] text-ink-2 mt-1 leading-relaxed">{t("k360.lueckenHint")}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="tnum text-[18px] font-bold text-brand-700">{euro(gapValue, loc)}</p>
                <p className="text-[11.5px] text-ink-3 tnum">
                  {gapCount} {gapCount === 1 ? (lang === "de" ? "Lücke" : "gap") : lang === "de" ? "Lücken" : "gaps"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-3 text-[11px] text-ink-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-brand-700" />
                {lang === "de" ? "Lücke: fehlt hier, ≥ 40 % der Peers haben sie" : "Gap: missing here, ≥ 40% of peers hold it"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-ok" />
                {lang === "de" ? "Abgedeckt: Geräte im Haus" : "Covered: instruments in-house"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-surface-3 border border-line-strong" />
                {lang === "de" ? "Keine Lücke: bei Peers selten (< 40 %)" : "No gap: rare among peers (< 40%)"}
              </span>
            </div>
            {gapCount === 0 ? (
              <p className="text-[13px] text-ink-2 py-4">{t("k360.keineLuecke")}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {luecken.map((l) => {
                  const g = GRUPPEN[l.gruppe];
                  const gap = l.stunden > 0;
                  const peerPct = Math.round(l.peer * 100);
                  const title = gap
                    ? lang === "de"
                      ? `Lücke: ${g.name} fehlt hier, aber ${peerPct} % der Branche ${k.branche} kalibrieren sie bei uns – Potenzial ≈ ${euro(l.stunden * app.settings.stundensatz, loc, false)}.`
                      : `Gap: ${g.name} is missing here, but ${peerPct}% of ${k.branche} peers calibrate it with us – potential ≈ ${euro(l.stunden * app.settings.stundensatz, loc, false)}.`
                    : l.besitzt > 0
                      ? lang === "de"
                        ? `${g.name}: ${num(l.besitzt, 0, loc)} Geräte im Haus – abgedeckt, keine Lücke.`
                        : `${g.name}: ${num(l.besitzt, 0, loc)} instruments in-house – covered, no gap.`
                      : lang === "de"
                        ? `${g.name}: nur ${peerPct} % der Peers haben diese Gruppe (unter 40 %) – keine Lücke.`
                        : `${g.name}: only ${peerPct}% of peers hold this group (below 40%) – no gap.`;
                  return (
                    <div
                      key={l.gruppe}
                      title={title}
                      className={clsx(
                        "rounded-[8px] border p-2.5 transition-colors cursor-help",
                        gap
                          ? "border-brand-700/50 bg-brand-50 hover:border-brand-700"
                          : l.besitzt > 0
                            ? "border-[#c4e8d8] bg-[#e7f6ef] hover:border-ok"
                            : "border-line bg-surface-1 hover:border-line-strong",
                      )}
                    >
                      <p className="text-[12.5px] font-semibold text-ink leading-tight">{g.name}</p>
                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <span className="text-[11px] text-ink-3 tnum">
                          {l.besitzt > 0 ? `${num(l.besitzt, 0, loc)} ×` : `${peerPct} % ${lang === "de" ? "Peers" : "peers"}`}
                        </span>
                        {gap ? (
                          <span className="tnum text-[11.5px] font-bold text-brand-700">
                            {euro(l.stunden * app.settings.stundensatz, loc, false)}
                          </span>
                        ) : l.besitzt > 0 ? (
                          <Check size={13} className="text-ok" />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 mb-3">{t("k360.timeline")}</h3>
            <ContactTimeline kundeId={k.id} />
          </section>
        </div>
      )}

      {/* ---------------- Historie & Potenzial (24M Historie + 12M Prognose gebündelt) ---------------- */}
      {tab === "historie" && (
        <div className="space-y-4 anim-fade-up">
          <section className="card p-5">
            <h3 className="section-label">{t("k360.historie")}</h3>
            <HistorieTakeaway rows={aktivitaet} dakksShare={k.dakksShare} nioShare={k.nioShare} lang={lang} loc={loc} />
            <div className="h-[210px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histData} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--color-line)" vertical={false} />
                  <XAxis
                    dataKey="monat"
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                    tick={{ fontSize: 10, fill: "#6d7378" }}
                    tickFormatter={(v: string) => `${Number(v.slice(5, 7))}/${v.slice(2, 4)}`}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#6d7378" }}
                    width={30}
                  />
                  <Tooltip
                    content={(p: unknown) => {
                      const { active, payload, label } = p as {
                        active?: boolean;
                        payload?: { value?: unknown }[];
                        label?: string;
                      };
                      if (!active || !payload || payload.length === 0 || !label) return null;
                      const row = histData.find((m) => m.monat === label);
                      if (!row) return null;
                      return (
                        <div className="chart-tip">
                          <p className="t-sub">
                            {Number(label.slice(5, 7))}/{label.slice(2, 4)}
                          </p>
                          <p className="font-bold tnum">
                            {num(row.total, 0, loc)} {lang === "de" ? "Kalibrierungen" : "calibrations"}
                          </p>
                          <p className="tnum">
                            DAkkS {num(row.dakks, 0, loc)} · {lang === "de" ? "Durchgefallen" : "Failed"}{" "}
                            {num(row.nio, 0, loc)}
                          </p>
                        </div>
                      );
                    }}
                    cursor={{ fill: "rgba(28,59,81,.06)" }}
                  />
                  <Bar dataKey="dakks" stackId="a" fill="var(--color-azure)" maxBarSize={24} />
                  <Bar dataKey="rest" stackId="a" fill="var(--color-navy-800)" maxBarSize={24} />
                  <Bar dataKey="nio" stackId="a" fill="var(--color-violet)" maxBarSize={24} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-ink-3 flex-wrap">
              <LegendDot color="var(--color-navy-800)" label={lang === "de" ? "Kalibrierungen" : "Calibrations"} />
              <span title={lang === "de" ? "DAkkS = Deutsche Akkreditierungsstelle (staatlich akkreditiert)" : "DAkkS = German accreditation body (state-accredited)"}>
                <LegendDot color="var(--color-azure)" label="DAkkS" />
              </span>
              <LegendDot color="var(--color-violet)" label={lang === "de" ? "Durchgefallen" : "Failed"} />
            </div>
          </section>

          <KundenPrognoseView data={prognose} lang={lang} loc={loc} />

          <section className="grid sm:grid-cols-3 gap-3">
            <MiniStat
              label={t("k360.letzteKal")}
              value={date(k.letzteKal, loc)}
              sub={`${k.monateSeitKal} ${lang === "de" ? "Monate" : "months"}`}
            />
            <MiniStat label={t("k360.ruecklauf")} value={`${Math.round(k.ruecklauf.quote * 100)} %`} sub={t("k360.peerMedian")} />
            <MiniStat
              label={t("kunden.kanal")}
              value={`${k.kanal.portal} % Portal`}
              sub={`${k.positions12m} ${lang === "de" ? "Aufträge / 12 Mon." : "orders / 12 mo"}`}
            />
          </section>
        </div>
      )}

      {/* ---------------- Messmittel ---------------- */}
      {tab === "messmittel" && (
        <div className="space-y-3 anim-fade-up">
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((s) => {
              const n = s === "alle" ? alleRows.length : counts.get(s) ?? 0;
              if (n === 0 && s !== "alle") return null;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx(
                    "h-[27px] px-2.5 rounded-full border text-[12px] font-semibold transition-colors",
                    statusFilter === s ? "bg-navy-800 border-navy-800 text-white" : "border-line text-ink-2 bg-surface-0 hover:border-line-strong",
                  )}
                >
                  {s === "alle" ? t("heute.alle") : t(`k360.status.${s}` as "k360.status.ok")}{" "}
                  <span className="tnum opacity-70">{num(n, 0, loc)}</span>
                </button>
              );
            })}
            <div className="flex-1" />
            <input
              value={identQ}
              onChange={(e) => setIdentQ(e.target.value)}
              placeholder="Ident-Nr. …"
              className="h-8 w-[170px] px-2.5 rounded-[8px] border border-line bg-surface-0 outline-none focus:border-brand-700 transition-colors text-[12.5px]"
            />
            <Btn size="sm" onClick={exportCsv}>
              <Download size={13} /> {t("k360.csv")}
            </Btn>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto max-h-[62vh]">
              <table className="tbl w-full text-[12.5px] min-w-[760px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-1 border-b border-line text-[11px] uppercase tracking-wider text-ink-3">
                    <th className="text-left font-bold px-4 py-2">{t("k360.spalten.ident")}</th>
                    <th className="text-left font-bold px-3 py-2">{t("k360.spalten.gruppe")}</th>
                    <th className="text-left font-bold px-3 py-2">{t("k360.spalten.pruefungsart")}</th>
                    <th className="text-left font-bold px-3 py-2">{t("k360.spalten.letzteKal")}</th>
                    <th className="text-left font-bold px-3 py-2">{t("k360.spalten.bewertung")}</th>
                    <th className="text-left font-bold px-3 py-2">{t("k360.spalten.faelligkeit")}</th>
                    <th className="text-left font-bold px-4 py-2">{t("k360.spalten.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {rows.slice(0, 150).map((r) => (
                    <tr key={r.id} className="hover:bg-surface-1">
                      <td className="px-4 py-1.5 tnum text-ink-2">{r.ident}</td>
                      <td className="px-3 py-1.5 text-ink">
                        {r.typ} <span className="text-ink-3">({r.groesse})</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          title={lang === "de" ? "DAkkS = Deutsche Akkreditierungsstelle (staatlich akkreditiert)" : "DAkkS = German accreditation body (state-accredited)"}
                          className={clsx("text-[11.5px] font-semibold", r.pruefungsart === "DAkkS" ? "text-azure-800" : "text-ink-3")}
                        >
                          {r.pruefungsart}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 tnum text-ink-2">{date(r.letzteKal, loc)}</td>
                      <td className="px-3 py-1.5 text-[11.5px] text-ink-3">{r.bewertung}</td>
                      <td className={clsx("px-3 py-1.5 tnum", r.status === "ueberfaellig" || r.status === "teilabwanderung" ? "text-overdue font-semibold" : "text-ink-2")}>
                        {date(r.faelligkeit, loc)}
                        {r.geschaetzt && <span className="ml-1 text-[10px] text-due">≈</span>}
                      </td>
                      <td className="px-4 py-1.5 text-left">
                        <StatusPill status={r.status} lang={lang} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-line bg-surface-1 flex items-center justify-between">
              <span className="text-[11.5px] text-ink-3 tnum">
                {t("k360.zeige", { n: num(Math.min(rows.length, 150), 0, loc), total: num(rows.length, 0, loc) })}
              </span>
              <span className="text-[11.5px] text-ink-3">{t("empf.geschaetzt")}</span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Prognose (in Historie gebündelt) ---------------- */}
      {tab === ("__prognose__" as Tab) && <KundenPrognoseView data={prognose} lang={lang} loc={loc} />}
    </div>
  );
}

/* ============================== pieces ============================== */

function Figure({ label, value, tone }: { label: string; value: string; tone?: "overdue" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-3 font-bold">{label}</p>
      <p className={clsx("tnum text-[16px] font-bold leading-tight", tone === "overdue" ? "text-overdue" : "text-navy-800")}>{value}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} /> {label}
    </span>
  );
}

/* One self-explanatory line under the history title: volume, trend,
 * DAkkS share (accredited regulars) and failed share with verdict. */
function HistorieTakeaway({
  rows,
  dakksShare,
  nioShare,
  lang,
  loc,
}: {
  rows: { anzahl: number }[];
  dakksShare: number;
  nioShare: number;
  lang: "de" | "en";
  loc: string;
}) {
  const n = rows.length;
  const total = rows.reduce((s, r) => s + r.anzahl, 0);
  const avg = n > 0 ? total / n : 0;
  const mean = (rs: { anzahl: number }[]) => (rs.length > 0 ? rs.reduce((s, r) => s + r.anzahl, 0) / rs.length : 0);
  const delta = mean(rows.slice(-6)) - mean(rows.slice(-12, -6));
  const base = mean(rows.slice(-12, -6));
  const dakks = Math.round(dakksShare * 100);
  const nio = Math.round(nioShare * 100);
  const trendWord =
    n < 12 || (base > 0 && Math.abs(delta / base) < 0.05)
      ? lang === "de" ? "gleichbleibend" : "steady"
      : delta > 0
        ? lang === "de" ? "steigend" : "rising"
        : lang === "de" ? "rückläufig" : "declining";
  const nioWord =
    nio <= 5
      ? lang === "de" ? "unauffällig" : "unsuspicious"
      : lang === "de" ? "auffällig – bitte prüfen" : "notable – please check";
  return (
    <p className="text-[12.5px] text-ink-2 leading-relaxed mt-1 mb-1">
      {lang === "de"
        ? `Etwa ${num(avg, 0, loc)} Kalibrierungen pro Monat, Tendenz ${trendWord}. Davon ${num(dakks, 0, loc)} % DAkkS-Prüfungen. ${num(nio, 0, loc)} % fallen durch (${nioWord}).`
        : `About ${num(avg, 0, loc)} calibrations per month, trend ${trendWord}. ${num(dakks, 0, loc)}% are DAkkS inspections. ${num(nio, 0, loc)}% fail (${nioWord}).`}
    </p>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-surface-0 p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-3 font-bold">{label}</p>
      <p className="tnum text-[17px] font-bold text-navy-800 mt-0.5">{value}</p>
      <p className="text-[11.5px] text-ink-3">{sub}</p>
    </div>
  );
}

function KundenPrognoseView({
  data,
  lang,
  loc,
}: {
  data: { monat: string; kalibrierungen: number; p10: number; p90: number }[];
  lang: "de" | "en";
  loc: string;
}) {
  const { t } = useI18n();
  const sumMean = data.reduce((s, d) => s + d.kalibrierungen, 0);
  const peak = data.reduce((a, b) => (b.kalibrierungen > a.kalibrierungen ? b : a), data[0]);
  const kurz = (monat: string) => `${Number(monat.slice(5, 7))}/${monat.slice(2, 4)}`;
  const bandData = data.map((d) => ({ ...d, label: kurz(d.monat), band: Math.max(0, d.p90 - d.p10) }));

  return (
    <div className="space-y-4 anim-fade-up">
      <section className="card p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h3 className="section-label">{t("k360.prognose")}</h3>
          <p className="text-[12.5px] text-ink-2 tnum">
            {lang === "de" ? "12 Monate:" : "12 months:"}{" "}
            <strong className="text-navy-800">≈ {num(sumMean, 0, loc)}</strong>
          </p>
        </div>
        <p className="text-[12.5px] text-ink-2 leading-relaxed mt-1">
          {lang === "de"
            ? `Erwartete Eingänge je Monat – Spitze im ${kurz(peak.monat)} (≈ ${num(peak.kalibrierungen, 0, loc)}). Kapazität und Abhol-Touren danach ausrichten.`
            : `Expected intake per month – peak in ${kurz(peak.monat)} (≈ ${num(peak.kalibrierungen, 0, loc)}). Align capacity and pickup tours accordingly.`}
        </p>
        <div className="h-[210px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={bandData} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#6d7378" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "#6d7378" }}
                width={32}
              />
              <Tooltip
                content={(p: unknown) => {
                  const { active, payload, label } = p as {
                    active?: boolean;
                    payload?: { value?: unknown }[];
                    label?: string;
                  };
                  if (!active || !payload || payload.length === 0 || !label) return null;
                  const row = bandData.find((d) => d.label === label);
                  if (!row) return null;
                  return (
                    <div className="chart-tip">
                      <p className="t-sub">{label}</p>
                      <p className="font-bold tnum">
                        {lang === "de" ? "Erwartet" : "Expected"} {num(row.kalibrierungen, 0, loc)}
                      </p>
                      <p className="tnum">
                        {lang === "de" ? "Spanne" : "Range"} {num(row.p10, 0, loc)}–{num(row.p90, 0, loc)}
                      </p>
                    </div>
                  );
                }}
                cursor={{ stroke: "var(--color-line-strong)", strokeDasharray: "3 3" }}
              />
              <Area dataKey="p10" stackId="band" strokeWidth={0} fill="transparent" />
              <Area dataKey="band" stackId="band" strokeWidth={0} fill="var(--color-azure)" fillOpacity={0.22} />
              <Line
                dataKey="kalibrierungen"
                stroke="var(--color-navy-800)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--color-navy-800)", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
              <ReferenceDot
                x={kurz(peak.monat)}
                y={peak.kalibrierungen}
                r={5}
                fill="var(--color-brand-700)"
                stroke="#fff"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-ink-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[3px] rounded-full bg-navy-800" />
            {lang === "de" ? "Erwartet" : "Expected"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-[10px] rounded-[3px] bg-azure/25 border border-azure/40" />
            {lang === "de"
              ? "Spanne: hier landet die Zahl in 8 von 10 Monaten"
              : "Range: the figure lands here in 8 out of 10 months"}
          </span>
        </div>
      </section>
    </div>
  );
}

/* deterministic contact timeline (demo content, seeded by Kundennummer) */
function ContactTimeline({ kundeId }: { kundeId: string }) {
  const { t, lang } = useI18n();
  const app = useApp();
  const loc = lang === "de" ? "de-DE" : "en-GB";

  let h = 0;
  for (let i = 0; i < kundeId.length; i++) h = (h * 31 + kundeId.charCodeAt(i)) >>> 0;
  const rnd = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };

  const events: { datum: string; art: string; text: string }[] = [];
  const arts =
    lang === "de"
      ? [
          ["Telefonat", "Rückfrage zu fälligen Messmitteln – Ansprechpartner erreicht."],
          ["E-Mail", "Entwurf mit Angebotspositionen versendet."],
          ["Auftrag", "Abholung über Hol- und Bringservice bestätigt."],
          ["Notiz", "Rückmeldung: Messmittel werden nächstes Quartal eingeschickt."],
          ["Telefonat", "Kein Durchwahl – Bitte um Rückruf hinterlassen."],
          ["Portal", "Zertifikate trendic® hub heruntergeladen."],
        ]
      : [
          ["Call", "Follow-up on due instruments – reached the contact."],
          ["Email", "Draft with quote lines sent."],
          ["Order", "Pickup via courier service confirmed."],
          ["Note", "Customer will send instruments next quarter."],
          ["Call", "No extension – asked for a callback."],
          ["Portal", "trendic® hub certificates downloaded."],
        ];

  const today = app.stichtag;
  for (let i = 0; i < 6; i++) {
    const daysAgo = Math.round(4 + i * (20 + rnd() * 26));
    const a = arts[Math.floor(rnd() * arts.length)];
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - daysAgo);
    events.push({ datum: d.toISOString().slice(0, 10), art: a[0], text: a[1] });
  }

  const own = Object.entries(app.ergebnisse)
    .filter(([id]) => id === kundeId)
    .map(([id, e]) => ({
      datum: e.am,
      art: t(`ergebnis.${e.code}` as "ergebnis.angebot"),
      text: lang === "de" ? `Ergebnis von ${USERS.find((u) => u.id === e.user)?.kurz ?? ""} protokolliert.` : `Outcome logged by ${USERS.find((u) => u.id === e.user)?.kurz ?? ""}.`,
      own: true,
      id,
    }));

  const merged = [...own, ...events].sort((a, b) => b.datum.localeCompare(a.datum));

  return (
    <ol className="relative pl-5">
      <span className="absolute left-[5px] top-1 bottom-1 w-px bg-line" />
      {merged.map((e, i) => (
        <li key={i} className="relative pb-3 last:pb-0">
          <span
            className="absolute -left-5 top-[5px] w-[11px] h-[11px] rounded-full border-2 border-surface-0"
            style={{ background: "own" in e && e.own ? "var(--color-brand)" : "var(--color-navy-700)" }}
          />
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="tnum text-[11.5px] text-ink-3">{date(e.datum, loc)}</span>
            <span className="text-[12px] font-bold text-navy-800">{e.art}</span>
          </div>
          <p className="text-[13px] text-ink-2 leading-snug">{e.text}</p>
        </li>
      ))}
      {merged.length === 0 && <p className="text-[13px] text-ink-3">{t("k360.keineKontakte")}</p>}
    </ol>
  );
}

/* Real snapshot view for genuine Kundennummern (kunden-index + messmittel-sample).
 * Shown when the id is not part of the synthetic demo model. */
function RealKundeView({ kundeId }: { kundeId: string }) {
  const app = useApp();
  const { t, lang } = useI18n();
  const router = useRouter();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const { rows } = useKundenIndex();
  const { rows: mm } = useMessmittelSample();

  if (!rows) {
    return (
      <div className="h-full overflow-y-auto px-5 py-4">
        <div className="card p-8 max-w-2xl mx-auto anim-fade-up">
          <div className="h-6 w-48 rounded bg-surface-2 animate-pulse mb-3" />
          <div className="h-4 w-full rounded bg-surface-2 animate-pulse" />
        </div>
      </div>
    );
  }

  const row = rows.find((r) => r.kunde === kundeId);
  if (!row) {
    return (
      <div className="h-full grid place-items-center">
        <EmptyState
          title={lang === "de" ? "Kunde nicht gefunden" : "Customer not found"}
          hint={`Kunde ${kundeId}`}
          action={<Btn onClick={() => router.push("/kunden")}>{t("kunden.titel")}</Btn>}
        />
      </div>
    );
  }

  const myMm = (mm ?? [])
    .filter((r) => r.kunde === kundeId)
    .sort((a, b) => a.faelligkeit.localeCompare(b.faelligkeit));

  const copyMail = () => {
    const text =
      lang === "de"
        ? `Sehr geehrte Damen und Herren,\n\nbei der Durchsicht Ihrer Messmittel ist uns aufgefallen, dass für ${row.ueberfaellig} Messmittel (Kunde ${row.kunde}, ${row.branche}) die Kalibrierung überfällig ist.\n\nDamit Ihre Prüfmittelüberwachung auditsicher bleibt, holen wir die Messmittel gerne bei Ihnen ab.\n\nDarf ich die Abholung für die kommende Woche einplanen?\n\nMit freundlichen Grüßen\n${t(app.user.nameKey)}`
        : `Dear Sir or Madam,\n\nwe noticed that ${row.ueberfaellig} of your instruments (customer ${row.kunde}, ${row.branche}) are overdue.\n\nTo keep your equipment audit-proof we can collect the instruments.\n\nMay I schedule the pickup for next week?\n\nKind regards\n${t(app.user.nameKey)}`;
    navigator.clipboard?.writeText(text).then(() => app.toast(lang === "de" ? "E-Mail-Text kopiert." : "Email text copied."));
  };

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="card overflow-hidden anim-fade-up max-w-[1100px] mx-auto">
        <div className="px-5 pt-4 pb-3 border-b border-line">
          <Link href="/kunden" className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-brand-700 font-semibold mb-1.5">
            <ArrowLeft size={12} /> {t("kunden.titel")}
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[20px] font-bold text-navy-800 leading-tight tnum">Kunde {row.kunde}</h2>
          </div>
          <p className="text-[13px] text-ink-2 mt-0.5">{row.branche}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <Figure label={t("k360.aktiveMessmittel")} value={num(row.aktiv, 0, loc)} />
            <Figure label={t("anlass.ueberfaellig")} value={num(row.ueberfaellig, 0, loc)} tone={row.ueberfaellig > 0 ? "overdue" : undefined} />
            <Figure label={lang === "de" ? "Fällig (30 Tage)" : "Due (30 days)"} value={num(row.due30, 0, loc)} />
            <Figure label={t("k360.letzteKal")} value={row.letzteKal ? date(row.letzteKal, loc) : "–"} />
          </div>
        </div>
        <div className="px-4 py-2.5 bg-surface-1 flex items-center gap-1.5 flex-wrap">
          <Btn variant="secondary" onClick={copyMail}>
            <Mail size={14} /> {t("akt.email")}
          </Btn>
          <span className="text-[11.5px] text-ink-3">
            {lang === "de"
              ? "Gezählte Werte (Stand 25.09.2026) – Namen und Kontakte sind Demo."
              : "Counted values (as of 25/09/2026) – names and contacts are demo."}
          </span>
        </div>
      </div>

      <div className="card overflow-hidden mt-4 max-w-[1100px] mx-auto">
        <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.09em] text-ink-2">
            {t("k360.messmittelliste")} <span className="tnum text-ink-3">({myMm.length}{myMm.length >= 40 ? "+" : ""})</span>
          </h3>
        </div>
        {myMm.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-ink-3">
            {lang === "de" ? "Keine weiteren Zeilen für diesen Kunden in diesem Auszug." : "No further rows for this customer in this extract."}
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[52vh]">
            <table className="tbl w-full text-[12.5px] min-w-[680px]">
              <thead className="sticky top-0 z-10">
                <tr className="text-[11px]">
                  <th className="text-left font-bold px-4 py-2">{t("k360.spalten.ident")}</th>
                  <th className="text-left font-bold px-3 py-2">{t("k360.spalten.gruppe")}</th>
                  <th className="text-left font-bold px-3 py-2">{t("k360.spalten.faelligkeit")}</th>
                  <th className="text-left font-bold px-4 py-2">{t("k360.spalten.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {myMm.slice(0, 200).map((r, i) => (
                  <tr key={`${r.ident}-${i}`} className="hover:bg-surface-1">
                    <td className="px-4 py-1.5 tnum text-ink-2">{r.ident || "–"}</td>
                    <td className="px-3 py-1.5 text-ink">{r.gruppe} <span className="text-ink-3">· {r.typ.slice(0, 42)}</span></td>
                    <td className={clsx("px-3 py-1.5 tnum", r.tage > 0 ? "text-overdue font-semibold" : "text-ink-2")}>
                      {date(r.faelligkeit, loc)} <span className="text-ink-3">({r.tage > 0 ? `+${r.tage}` : r.tage} d)</span>
                    </td>
                    <td className="px-4 py-1.5 text-left">
                      <StatusPill status={r.status === "teilabwanderung" ? "teilabwanderung" : r.status === "faellig_bald" ? "faellig_bald" : "ueberfaellig"} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
