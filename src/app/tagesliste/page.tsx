"use client";

import clsx from "clsx";
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  Download,
  Mail,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Target,
  Timer,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildEmail, buildEml, buildLeitfaden } from "@/lib/content";
import {
  USERS,
  getKandidatenZahl,
  getKunde,
  getMessmittel,
  getZeitstrahl,
  type Anlass,
  type Empfehlung,
  type ErgebnisCode,
  type Prioritaet,
} from "@/lib/data";
import { addDays, date, euro } from "@/lib/format";
import { REASON_FACTOR_LABELS, reasonText, useI18n } from "@/lib/i18n";
import { useApp, useErfolgschance } from "@/lib/store";
import { Btn, Chip, DemoBadge, EmptyState, FactorBars, Kbd, Modal, PrioritaetsBadge, Progress, StatusPill, Zeitstrahl } from "@/components/ui";

const ANLASS_ORDER: Anlass[] = ["ueberfaellig", "faellig_bald", "abwanderung", "branche", "portal"];
const ANREDE_NAME: Record<string, string> = {
  sabine: "Frau Schneider",
  thomas: "Herr Brandt",
};

interface Filters {
  anlass: Anlass | "alle";
  prioritaet: Prioritaet | "alle";
  nurMeine: boolean;
}

const EMPTY_FILTERS: Filters = {
  anlass: "alle",
  prioritaet: "alle",
  nurMeine: false,
};

export default function HeutePage() {
  const app = useApp();
  const { t, lang } = useI18n();
  const router = useRouter();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [leaving, setLeaving] = useState<string | null>(null);
  const [ergebnisOpen, setErgebnisOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [spaeterOpen, setSpaeterOpen] = useState(false);
  const [warum, setWarum] = useState(false);

  const list = app.tagesliste;
  const success = useErfolgschance();

  const filtered = useMemo(
    () => {
      const q = query.trim().toLowerCase();
      return list.filter((item) => {
        const k = getKunde(item.kundeId);
        if (!k) return false;
        if (filters.anlass !== "alle" && item.empfehlung.anlass !== filters.anlass) return false;
        if (filters.prioritaet !== "alle" && item.prioritaet !== filters.prioritaet) return false;
        if (filters.nurMeine && app.claims[item.kundeId] !== app.user.id) return false;
        if (q && !k.name.toLowerCase().includes(q) && !k.nummer.toLowerCase().includes(q)) return false;
        return true;
      });
    },
    [list, filters, query, app.claims, app.user.id],
  );

  const selectedId = app.selectedKunde ?? filtered[0]?.kundeId ?? null;
  const selectedItem = list.find((i) => i.kundeId === selectedId) ?? filtered[0] ?? null;
  const kunde = selectedItem ? getKunde(selectedItem.kundeId) : undefined;

  useEffect(() => {
    if (!app.selectedKunde && filtered[0]) app.setSelectedKunde(filtered[0].kundeId);
  }, [filtered, app]);

  /* ---- keyboard triage ---- */
  const move = useCallback(
    (delta: number) => {
      if (filtered.length === 0) return;
      const idx = filtered.findIndex((i) => i.kundeId === selectedId);
      const next = filtered[Math.min(filtered.length - 1, Math.max(0, (idx === -1 ? 0 : idx) + delta))];
      if (next) app.setSelectedKunde(next.kundeId);
    },
    [filtered, selectedId, app],
  );

  const finish = useCallback(
    (code: ErgebnisCode, opts?: { note?: string; wettbewerber?: string; wiedervorlage?: string }) => {
      if (!selectedItem) return;
      const id = selectedItem.kundeId;
      setLeaving(id);
      window.setTimeout(() => {
        app.erledigt(id, code, opts);
        setLeaving(null);
        app.toast(t("toast.erledigt"), { actionLabel: t("toast.rueckgaengig"), action: () => app.undo(id) });
        const rest = filtered.filter((i) => i.kundeId !== id);
        app.setSelectedKunde(rest[0]?.kundeId ?? null);
      }, 260);
    },
    [selectedItem, app, t, filtered],
  );

  const claimIt = useCallback(() => {
    if (!selectedItem) return;
    if (app.claims[selectedItem.kundeId]) return;
    app.claim(selectedItem.kundeId);
    app.toast(t("toast.uebernommen"));
  }, [selectedItem, app, t]);

  const openEmail = useCallback(() => {
    if (selectedItem) setEmailOpen(true);
  }, [selectedItem]);

  const openQuote = useCallback(() => {
    if (!selectedItem) return;
    const id = app.createDraft(selectedItem.kundeId);
    app.toast(t("toast.angebotErstellt"));
    router.push(`/angebote/${id}`);
  }, [selectedItem, app, t, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable || el.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "j") { e.preventDefault(); move(1); }
      else if (key === "k") { e.preventDefault(); move(-1); }
      else if (key === "ü") { e.preventDefault(); claimIt(); }
      else if (key === "e") { e.preventDefault(); openEmail(); }
      else if (key === "a") { e.preventDefault(); openQuote(); }
      else if (key === "d") { e.preventDefault(); if (selectedItem) setErgebnisOpen(true); }
      else if (key === "s") { e.preventDefault(); if (selectedItem) setSpaeterOpen(true); }
      else if (key === "enter" && selectedItem) {
        e.preventDefault();
        router.push(`/kunden/${selectedItem.kundeId}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, claimIt, openEmail, openQuote, selectedItem, router]);

  const high = list.filter((i) => i.prioritaet === "hoch").length;
  const doneCount = Object.keys(app.done).length;
  const top = list[0];
  const topKunde = top ? getKunde(top.kundeId) : undefined;
  const activeFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ---------------- briefing ---------------- */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        <div className="relative overflow-hidden rounded-[14px] bg-gradient-to-r from-navy-900 via-navy-800 to-navy-850 text-white px-5 py-3.5 grain anim-fade-up">
          <div className="relative flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-[8px] bg-brand grid place-items-center shrink-0">
                <Sparkles size={15} />
              </span>
              <p className="text-[13.5px] leading-snug">
                <strong className="font-bold">
                  {lang === "de"
                    ? `Guten Morgen, ${ANREDE_NAME[app.user.id] ?? app.user.kurz}.`
                    : `Good morning, ${t(app.user.nameKey).split(" ")[0]}.`}
                </strong>{" "}
                {lang === "de"
                  ? `${list.length} Empfehlungen für heute, davon ${high} mit hoher Priorität.`
                  : `${list.length} recommendations for today, ${high} of them high priority.`}
                {topKunde && (
                  <>
                    {" "}
                    {lang === "de" ? "Größter Hebel:" : "Biggest lever:"}{" "}
                    <strong className="font-bold text-brand">
                      {topKunde.name} ({top!.empfehlung.betroffeneAnzahl} {lang === "de" ? "überfällige Messmittel" : "overdue instruments"})
                    </strong>
                    .
                  </>
                )}
              </p>
            </div>
            <div className="flex-1" />
            <div className="hidden md:flex items-center gap-5 text-[11.5px] text-white/70">
              <span className="tnum">
                {lang === "de" ? "Vorschlagsliste" : "Candidates"}:{" "}
                <strong className="text-white">{numDE(getKandidatenZahl(app.stichtag))}</strong>
              </span>
              <span className="tnum">
                {lang === "de" ? "Überfällig gesamt" : "Overdue total"}:{" "}
                <strong className="text-white">{numDE(64915)}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- toolbar: Suche + Anlass + Priorität + Nur meine ---------------- */}
      <div className="px-5 pb-3 flex items-center gap-2 flex-wrap shrink-0">
        <label className="inline-flex items-center gap-1.5 h-[30px] pl-2 pr-1.5 rounded-[8px] border border-line bg-surface-0 focus-within:border-brand-700 transition-colors w-[190px]">
          <Search size={13} className="text-ink-3 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "de" ? "Kunde suchen…" : "Search customers…"}
            className="flex-1 min-w-0 bg-transparent outline-none text-[12px] placeholder:text-ink-3"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear" className="text-ink-3 hover:text-ink">
              <X size={12} />
            </button>
          )}
        </label>
        <Select
          value={filters.anlass}
          onChange={(v) => setFilters((f) => ({ ...f, anlass: v as Filters["anlass"] }))}
          label={t("heute.anlass")}
          options={[{ value: "alle", label: t("heute.alle") }, ...ANLASS_ORDER.map((a) => ({ value: a, label: t(`anlass.${a}` as "anlass.ueberfaellig") }))]}
        />
        <Select
          value={filters.prioritaet}
          onChange={(v) => setFilters((f) => ({ ...f, prioritaet: v as Filters["prioritaet"] }))}
          label={t("heute.prioritaet")}
          options={[
            { value: "alle", label: t("heute.alle") },
            { value: "hoch", label: t("prioritaet.hoch") },
            { value: "mittel", label: t("prioritaet.mittel") },
            { value: "niedrig", label: t("prioritaet.niedrig") },
          ]}
        />
        <Toggle active={filters.nurMeine} onClick={() => setFilters((f) => ({ ...f, nurMeine: !f.nurMeine }))}>
          {t("heute.nurMeine")}
        </Toggle>
        {(activeFilters || query) && (
          <button onClick={() => { setFilters(EMPTY_FILTERS); setQuery(""); }} className="text-[12px] text-brand-700 font-semibold hover:underline px-1">
            {t("heute.filterZuruecksetzen")}
          </button>
        )}
        <div className="flex-1" />
        <span className="text-[12px] text-ink-3 tnum">
          {filtered.length} / {list.length} {lang === "de" ? "Empfehlungen" : "recommendations"}
        </span>
      </div>

      {/* ---------------- split view ---------------- */}
      <div className="flex-1 min-h-0 flex px-5 pb-4 gap-4">
        {/* list */}
        <section className="w-full lg:w-[52%] xl:w-[48%] min-w-0 flex flex-col card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line bg-surface-1 flex items-center gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">{t("heute.tagesliste")}</h2>
            <div className="flex-1 max-w-[220px]">
              <Progress
                value={doneCount}
                total={app.settings.kapazitaet}
                label={t("heute.fortschritt", { done: doneCount, total: app.settings.kapazitaet })}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-line)]">
            {filtered.length === 0 && (
              <EmptyState
                title={list.length === 0 ? t("heute.allesErledigt") : t("heute.leerFilter")}
                hint={list.length === 0 ? t("heute.wiedervorlagen") : undefined}
                action={
                  activeFilters || query ? (
                    <Btn onClick={() => { setFilters(EMPTY_FILTERS); setQuery(""); }}>{t("heute.filterZuruecksetzen")}</Btn>
                  ) : undefined
                }
              />
            )}
            {filtered.map((item) => {
              const k = getKunde(item.kundeId)!;
              const isSel = item.kundeId === selectedId;
              const claim = app.claims[item.kundeId];
              const isLeaving = leaving === item.kundeId;
              return (
                <button
                  key={item.kundeId}
                  onClick={() => app.setSelectedKunde(item.kundeId)}
                  className={clsx(
                    "w-full text-left px-4 py-3 relative transition-colors",
                    isSel ? "bg-brand-50/70" : "hover:bg-surface-1",
                    isLeaving && "anim-row-out",
                  )}
                >
                  {isSel && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand" />}
                  <div className="flex items-center gap-2.5">
                    <span
                      className={clsx(
                        "w-[7px] h-[7px] rounded-full shrink-0",
                        item.prioritaet === "hoch" ? "bg-brand-700" : item.prioritaet === "mittel" ? "bg-navy-800" : "bg-line-strong",
                      )}
                    />
                    <span className="text-[13.5px] font-bold text-ink truncate">{k.name}</span>
                    <span className="tnum text-[11.5px] text-ink-3 shrink-0">{k.nummer}</span>
                    <span className="flex-1" />
                    <span className="tnum text-[13px] font-bold text-navy-800 shrink-0">{euro(item.ev, loc)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 pl-[17px] flex-wrap">
                    <Chip tone={toneOf(item.empfehlung.anlass)}>{t(`anlass.${item.empfehlung.anlass}` as "anlass.ueberfaellig")}</Chip>
                    {item.wiedervorlage && <Chip tone="brand">{t("heute.wiedervorlage")}</Chip>}
                    {claim && (
                      <span className="text-[11px] text-ink-3 italic">
                        · {claim === app.user.id ? t(app.user.nameKey) : (USERS.find((u) => u.id === claim)?.kurz ?? "–")}
                      </span>
                    )}
                    <span className="flex-1" />
                    <span className="hidden sm:block text-[11.5px] text-ink-3 truncate max-w-[46%] text-right leading-tight">
                      {reasonText(item.empfehlung.begruendung[0].code, item.empfehlung.begruendung[0].params, lang)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* detail pane */}
        <section className="hidden lg:flex flex-1 min-w-0 flex-col card overflow-hidden anim-fade-in">
          {selectedItem && kunde ? (
            <DetailPane
              key={selectedItem.kundeId}
              item={selectedItem}
              warum={warum}
              setWarum={setWarum}
              onClaim={claimIt}
              onEmail={() => setEmailOpen(true)}
              onQuote={openQuote}
              onDone={() => setErgebnisOpen(true)}
              onLater={() => setSpaeterOpen(true)}
              onField={() => app.toast(lang === "de" ? `Übergabe an Gebiet ${kunde.gebiet} erstellt.` : `Handed over to region ${kunde.gebiet}.`)}
            />
          ) : (
            <EmptyState title={t("heute.keineAuswahl")} hint={t("heute.keineAuswahlHint")} />
          )}
        </section>
      </div>

      {/* ---------------- dialogs ---------------- */}
      {selectedItem && kunde && (
        <>
          <ErgebnisDialog
            open={ergebnisOpen}
            onClose={() => setErgebnisOpen(false)}
            onSave={(code, opts) => {
              setErgebnisOpen(false);
              finish(code, opts);
            }}
          />
          <SpaeterDialog
            open={spaeterOpen}
            onClose={() => setSpaeterOpen(false)}
            onPick={(bis) => {
              setSpaeterOpen(false);
              if (!selectedItem) return;
              const id = selectedItem.kundeId;
              app.setWiedervorlage(id, bis);
              app.toast(t("toast.wiedervorlage", { datum: date(bis, loc) }));
            }}
          />
          <EmailDialog open={emailOpen} onClose={() => setEmailOpen(false)} kundeId={selectedItem.kundeId} emp={selectedItem.empfehlung} />
        </>
      )}
    </div>
  );
}

/* ============================== helpers ============================== */

function numDE(v: number) {
  return new Intl.NumberFormat("de-DE").format(v);
}

function toneOf(a: Anlass) {
  return a === "ueberfaellig" ? "overdue" : a === "faellig_bald" ? "due" : a === "abwanderung" ? "violet" : a === "branche" ? "azure" : "ok";
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center h-[30px] rounded-[8px] border border-line bg-surface-0 pl-2 pr-1 gap-1 text-[11.5px] hover:border-line-strong transition-colors">
      <span className="text-ink-3 font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none font-semibold text-ink py-0.5 max-w-[150px] cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "h-[30px] px-2.5 rounded-[8px] border text-[12px] font-semibold transition-all",
        active ? "bg-navy-800 border-navy-800 text-white" : "bg-surface-0 border-line text-ink-2 hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

/* ============================== detail pane ============================== */

function DetailPane({
  item,
  warum,
  setWarum,
  onClaim,
  onEmail,
  onQuote,
  onDone,
  onLater,
  onField,
}: {
  item: { kundeId: string; empfehlung: Empfehlung; ev: number; prioritaet: Prioritaet };
  warum: boolean;
  setWarum: (v: boolean) => void;
  onClaim: () => void;
  onEmail: () => void;
  onQuote: () => void;
  onDone: () => void;
  onLater: () => void;
  onField: () => void;
}) {
  const app = useApp();
  const { t, lang } = useI18n();
  const k = getKunde(item.kundeId)!;
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const rows = getMessmittel(k.id, app.stichtag);
  const betroffen = rows
    .filter(
      (r) =>
        item.empfehlung.anlass === "ueberfaellig"
          ? r.status === "ueberfaellig" || r.status === "teilabwanderung"
          : item.empfehlung.anlass === "faellig_bald"
            ? r.status === "faellig_bald"
            : r.status !== "ok",
    )
    .slice(0, 5);
  const buckets = getZeitstrahl(k.id, app.stichtag);
  const claim = app.claims[k.id];
  const [mehr, setMehr] = useState(false);
  const gruende = mehr ? item.empfehlung.begruendung : item.empfehlung.begruendung.slice(0, 2);

  return (
    <>
      {/* header */}
      <div className="px-5 pt-4 pb-3 border-b border-line">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[17px] font-bold text-navy-800 leading-tight truncate">{k.name}</h2>
              <span className="tnum text-[12.5px] text-ink-3">{k.nummer}</span>
              <DemoBadge />
            </div>
            <p className="text-[12.5px] text-ink-2 mt-0.5">
              {k.branche} · {k.ort} · {t("empf.gebiet")} {k.gebiet}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="tnum text-[19px] font-bold text-navy-800 leading-none" title={t("empf.wertHint")}>
              {euro(item.ev, loc)}
            </p>
            <p className="text-[10.5px] text-ink-3 uppercase tracking-wider font-semibold mt-1">{t("empf.wert")}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          <Chip tone={toneOf(item.empfehlung.anlass)}>{t(`anlass.${item.empfehlung.anlass}` as "anlass.ueberfaellig")}</Chip>
          <PrioritaetsBadge p={item.prioritaet} lang={lang} />
          <Chip>
            <Target size={11} /> {t("empf.messmittelAnzahl", { n: item.empfehlung.betroffeneAnzahl })}
          </Chip>
          {claim && (
            <Chip tone="navy">
              <UserCheck size={11} />{" "}
              {claim === app.user.id ? t("akt.uebernommen", { name: t(app.user.nameKey) }) : t("akt.uebernommen", { name: USERS.find((u) => u.id === claim)?.kurz ?? "–" })}
            </Chip>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Begründung */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">{t("empf.begruendung")}</h3>
            <button
              onClick={() => setWarum(!warum)}
              className="text-[12px] font-bold text-brand-700 hover:underline inline-flex items-center gap-1"
            >
              <Sparkles size={12} /> {t("empf.warum")}
            </button>
          </div>
          <ul className="space-y-1.5">
            {gruende.map((r, i) => (
              <li key={i} className="text-[13.5px] leading-relaxed text-ink flex gap-2">
                <span className="text-brand-700 mt-[7px] w-1 h-1 rounded-full bg-brand-700 shrink-0" />
                <span>{reasonText(r.code, r.params, lang)}</span>
              </li>
            ))}
          </ul>
          {item.empfehlung.begruendung.length > 2 && (
            <button onClick={() => setMehr((v) => !v)} className="mt-1.5 text-[12px] font-bold text-brand-700 hover:underline">
              {mehr
                ? (lang === "de" ? "Weniger anzeigen" : "Show less")
                : (lang === "de" ? `+ ${item.empfehlung.begruendung.length - 2} weitere` : `+ ${item.empfehlung.begruendung.length - 2} more`)}
            </button>
          )}
          {warum && (
            <div className="mt-3 card p-3.5 anim-pop">
              <p className="text-[12px] font-bold text-navy-800 mb-2.5">{t("empf.warumTitel")}</p>
              <FactorBars
                lang={lang}
                items={item.empfehlung.faktoren.map((f) => ({
                  label: REASON_FACTOR_LABELS[f.code][lang],
                  anteil: f.anteil,
                }))}
              />
            </div>
          )}
        </div>

        {/* Zeitstrahl */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 mb-2">{t("empf.zeitstrahl")}</h3>
          <div className="card p-3">
            <Zeitstrahl buckets={buckets} stichtag={app.stichtag} lang={lang} compact />
          </div>
        </div>

        {/* betroffene Messmittel */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">{t("empf.messmittel")}</h3>
            <Link href={`/kunden/${k.id}`} className="text-[12px] font-bold text-brand-700 hover:underline inline-flex items-center gap-1">
              {t("empf.alleAnzeigen")} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-surface-1 text-[10.5px] uppercase tracking-wider text-ink-3">
                  <th className="text-left font-bold px-3 py-1.5">{t("k360.spalten.ident")}</th>
                  <th className="text-left font-bold px-3 py-1.5">{t("k360.spalten.gruppe")}</th>
                  <th className="text-right font-bold px-3 py-1.5">{t("k360.spalten.faelligkeit")}</th>
                  <th className="text-right font-bold px-3 py-1.5">{t("k360.spalten.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {betroffen.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5 tnum text-ink-2">{r.ident}</td>
                    <td className="px-3 py-1.5 text-ink">
                      {r.typ}
                      {r.geschaetzt && <span className="ml-1.5 text-[10px] text-due font-semibold">≈ {t("empf.geschaetzt").slice(0, 18)}…</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tnum text-ink-2">{date(r.faelligkeit, loc)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <StatusPill status={r.status} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kontakt */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 mb-2">
            {t("empf.ansprechpartner")} <DemoBadge />
          </h3>
          <div className="card p-3.5 grid grid-cols-2 gap-y-2 gap-x-4 text-[13px]">
            <div>
              <p className="font-semibold text-ink">{k.ansprech}</p>
              <p className="text-ink-3 text-[12px]">{k.ort} · {k.gebiet}</p>
            </div>
            <div className="text-right space-y-1">
              <a href={`tel:${k.telefon.replace(/[^0-9+]/g, "")}`} className="flex items-center justify-end gap-1.5 text-ink-2 hover:text-brand-700">
                <Phone size={12} /> <span className="tnum">{k.telefon}</span>
              </a>
              <a href={`mailto:${k.email}`} className="flex items-center justify-end gap-1.5 text-ink-2 hover:text-brand-700 truncate">
                <Mail size={12} /> <span className="truncate">{k.email}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* action bar */}
      <div className="border-t border-line px-4 py-3 bg-surface-1 flex items-center gap-1.5 flex-wrap">
        {!claim ? (
          <Btn variant="primary" onClick={onClaim} title="Ü">
            <UserCheck size={14} /> {t("akt.uebernehmen")}
          </Btn>
        ) : (
          <Btn variant="secondary" disabled title="Ü">
            <Check size={14} /> {claim === app.user.id ? t("akt.uebernehmen") : t("akt.uebernommen", { name: USERS.find((u) => u.id === claim)?.kurz ?? "–" })}
          </Btn>
        )}
        <a
          href={`tel:${k.telefon.replace(/[^0-9+]/g, "")}`}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[7px] text-[13px] font-semibold bg-surface-0 text-ink border border-line-strong hover:bg-surface-1 hover:border-ink-3 transition-all"
        >
          <Phone size={14} /> {t("akt.anrufen")}
        </a>
        <Btn variant="secondary" onClick={onEmail} title="E">
          <Mail size={14} /> {t("akt.email")}
        </Btn>
        <Btn variant="dark" onClick={onQuote} title="A">
          <FileTextIcon /> {t("akt.angebot")}
        </Btn>
        <div className="flex-1" />
        <Btn variant="ghost" onClick={onLater} title="S">
          <Timer size={14} /> {t("akt.spaeter")}
        </Btn>
        <Btn variant="ghost" onClick={onField}>
          <MapPin size={14} /> <span className="hidden xl:inline">{t("akt.aussendienst")}</span>
        </Btn>
        <Btn variant="primary" onClick={onDone} title="D">
          <Check size={14} /> {t("akt.erledigt")}
        </Btn>
      </div>
    </>
  );
}

function FileTextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

/* ============================== dialogs ============================== */

function ErgebnisDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (code: ErgebnisCode, opts?: { note?: string; wettbewerber?: string; wiedervorlage?: string }) => void;
}) {
  const { t, lang } = useI18n();
  const [code, setCode] = useState<ErgebnisCode | null>(null);
  const [wettbewerber, setWettbewerber] = useState("");
  const [note, setNote] = useState("");
  const [wiedervorlage, setWiedervorlage] = useState("");

  useEffect(() => {
    if (open) {
      setCode(null);
      setWettbewerber("");
      setNote("");
      setWiedervorlage("");
    }
  }, [open]);

  const options: { code: ErgebnisCode; label: string }[] = [
    { code: "angebot", label: t("ergebnis.angebot") },
    { code: "auftrag", label: t("ergebnis.auftrag") },
    { code: "keinBedarf", label: t("ergebnis.keinBedarf") },
    { code: "wettbewerber", label: t("ergebnis.wettbewerber") },
    { code: "ausgemustert", label: t("ergebnis.ausgemustert") },
    { code: "falscherKontakt", label: t("ergebnis.falscherKontakt") },
    { code: "nichtErreicht", label: t("ergebnis.nichtErreicht") },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t("ergebnis.titel")}>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.code}
            onClick={() => setCode(o.code)}
            className={clsx(
              "h-[42px] rounded-[9px] border text-[13px] font-semibold transition-all text-left px-3",
              code === o.code
                ? "border-brand-700 bg-brand-50 text-brand-700 shadow-[0_0_0_1px_var(--color-brand-700)]"
                : "border-line hover:border-line-strong bg-surface-0 text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {code === "wettbewerber" && (
        <div className="mt-3 anim-fade-up">
          <p className="text-[12px] font-bold text-ink-2 mb-1.5">{t("ergebnis.wettbewerberFrage")}</p>
          <div className="flex gap-1.5 flex-wrap">
            {["Trescal", "Testo Industrial Services", "Hoffmann Group", "Hahn+Kolb", "Andere", "Unbekannt"].map((w) => (
              <button
                key={w}
                onClick={() => setWettbewerber(w)}
                className={clsx(
                  "h-[26px] px-2.5 rounded-full border text-[12px] font-semibold transition-colors",
                  wettbewerber === w ? "bg-navy-800 border-navy-800 text-white" : "border-line text-ink-2 hover:border-line-strong",
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-[12px] font-bold text-ink-2">{t("ergebnis.notiz")}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-[8px] border border-line px-2.5 py-2 text-[13px] outline-none focus:border-brand-700 resize-none"
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-bold text-ink-2">{t("ergebnis.wiedervorlage")}</span>
          <input
            type="date"
            value={wiedervorlage}
            onChange={(e) => setWiedervorlage(e.target.value)}
            className="mt-1 block w-full rounded-[8px] border border-line px-2.5 py-2 text-[13px] tnum outline-none focus:border-brand-700"
          />
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          {t("ergebnis.abbrechen")}
        </Btn>
        <Btn
          variant="primary"
          disabled={!code}
          onClick={() => code && onSave(code, { note: note || undefined, wettbewerber: wettbewerber || undefined, wiedervorlage: wiedervorlage || undefined })}
        >
          {t("ergebnis.speichern")}
        </Btn>
      </div>
      <p className="mt-3 text-[11px] text-ink-3">
        {lang === "de" ? "In zwei Klicks erledigt: Option wählen, speichern." : "Two clicks: pick an outcome, save."}
      </p>
    </Modal>
  );
}

function SpaeterDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (bis: string) => void }) {
  const { t } = useI18n();
  const app = useApp();
  const presets = [
    { label: t("ergebnis.spaeterMorgen"), date: addDays(app.stichtag, 1) },
    { label: t("ergebnis.spaeterWoche"), date: addDays(app.stichtag, 7) },
    { label: t("ergebnis.spaeter4Wochen"), date: addDays(app.stichtag, 28) },
  ];
  return (
    <Modal open={open} onClose={onClose} title={t("ergebnis.spaeterBis")}>
      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => onPick(p.date)}
            className="h-[64px] rounded-[10px] border border-line hover:border-brand-700 hover:bg-brand-50 transition-colors flex flex-col items-center justify-center gap-1"
          >
            <Calendar size={15} className="text-brand-700" />
            <span className="text-[12.5px] font-semibold text-ink">{p.label}</span>
            <span className="tnum text-[11px] text-ink-3">{p.date.slice(8)}.{p.date.slice(5, 7)}.</span>
          </button>
        ))}
      </div>
      <label className="block mt-4">
        <span className="text-[12px] font-bold text-ink-2">{t("ergebnis.spaeterDatum")}</span>
        <input
          type="date"
          onChange={(e) => e.target.value && onPick(e.target.value)}
          className="mt-1 block w-full rounded-[8px] border border-line px-2.5 py-2 text-[13px] tnum outline-none focus:border-brand-700"
        />
      </label>
    </Modal>
  );
}

function EmailDialog({ open, onClose, kundeId, emp }: { open: boolean; onClose: () => void; kundeId: string; emp: Empfehlung }) {
  const app = useApp();
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<"mail" | "leitfaden">("mail");
  const [copied, setCopied] = useState(false);
  const k = getKunde(kundeId);
  if (!k) return null;

  const mail = buildEmail(k, emp, emp.anlass, lang, app.user, t(app.user.nameKey), t);
  const guide = buildLeitfaden(k, emp, emp.anlass, lang, t);
  const body = tab === "mail" ? mail.text : guide.absatz.map((a) => `${a.label}:\n${a.text}`).join("\n\n");

  const copy = () => {
    navigator.clipboard?.writeText(tab === "mail" ? `Betreff: ${mail.betreff}\n\n${mail.text}` : body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([buildEml(k, mail)], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Entwurf-${k.nummer}.eml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mailto = `mailto:${k.email}?subject=${encodeURIComponent(mail.betreff)}&body=${encodeURIComponent(mail.text)}`;

  return (
    <Modal open={open} onClose={onClose} title={tab === "mail" ? t("email.titel") : t("leitfaden.titel")} wide>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTab("mail")}
          className={clsx("h-[30px] px-3 rounded-[8px] text-[12.5px] font-semibold border transition-colors", tab === "mail" ? "bg-navy-800 text-white border-navy-800" : "border-line text-ink-2")}
        >
          {t("akt.email")}
        </button>
        <button
          onClick={() => setTab("leitfaden")}
          className={clsx("h-[30px] px-3 rounded-[8px] text-[12.5px] font-semibold border transition-colors", tab === "leitfaden" ? "bg-navy-800 text-white border-navy-800" : "border-line text-ink-2")}
        >
          {t("leitfaden.titel")}
        </button>
        <span className="flex-1" />
        <span className="text-[11px] text-ink-3">{tab === "mail" ? t("email.sieForm") : "≤ 150 Wörter"}</span>
      </div>

      {tab === "mail" && (
        <div className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1">{t("email.betreff")}</p>
          <p className="text-[13.5px] font-semibold text-ink bg-surface-1 border border-line rounded-[8px] px-3 py-2">{mail.betreff}</p>
        </div>
      )}

      <div className="rounded-[10px] border border-line bg-surface-1 p-4 text-[13.5px] leading-relaxed text-ink whitespace-pre-wrap max-h-[46vh] overflow-y-auto">
        {body}
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <Btn variant="primary" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("email.kopiert") : t("email.kopieren")}
        </Btn>
        {tab === "mail" && (
          <>
            <Btn variant="secondary" onClick={() => window.open(mailto, "_blank")}>
              <Mail size={14} /> {t("email.outlook")}
            </Btn>
            <Btn variant="secondary" onClick={download}>
              <Download size={14} /> {t("email.eml")}
            </Btn>
          </>
        )}
        <span className="flex-1" />
        <span className="text-[11.5px] text-ink-3">{t("email.hinweis")}</span>
      </div>
    </Modal>
  );
}


