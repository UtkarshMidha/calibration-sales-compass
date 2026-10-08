"use client";

import clsx from "clsx";
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  Download,
  FileText,
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
  getEmpfehlungFuer,
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
  const [fokus, setFokus] = useState(false);
  const [ansicht, setAnsicht] = useState<"offen" | "erledigt">("offen");

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

  /* Erledigte verschwinden aus der offenen Liste (der Done-Tab zeigt sie separat). */
  const openList = useMemo(() => filtered.filter((i) => !app.done[i.kundeId]), [filtered, app.done]);

  const selectedId = app.selectedKunde ?? openList[0]?.kundeId ?? null;
  const selectedItem = list.find((i) => i.kundeId === selectedId) ?? openList[0] ?? null;
  const kunde = selectedItem ? getKunde(selectedItem.kundeId) : undefined;

  useEffect(() => {
    if (!app.selectedKunde && openList[0]) app.setSelectedKunde(openList[0].kundeId);
  }, [openList, app]);

  /* ---- keyboard triage ---- */
  const move = useCallback(
    (delta: number) => {
      if (openList.length === 0) return;
      const idx = openList.findIndex((i) => i.kundeId === selectedId);
      const next = openList[Math.min(openList.length - 1, Math.max(0, (idx === -1 ? 0 : idx) + delta))];
      if (next) app.setSelectedKunde(next.kundeId);
    },
    [openList, selectedId, app],
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
        const rest = openList.filter((i) => i.kundeId !== id);
        app.setSelectedKunde(rest[0]?.kundeId ?? null);
      }, 260);
    },
    [selectedItem, app, t, openList],
  );

  const claimIt = useCallback(() => {
    if (!selectedItem) return;
    if (app.claims[selectedItem.kundeId]) return;
    app.claim(selectedItem.kundeId);
    app.toast(t("toast.uebernommen"));
  }, [selectedItem, app, t]);

  const openDetail = useCallback(
    (kundeId: string) => {
      app.setSelectedKunde(kundeId);
      setFokus(true);
    },
    [app],
  );

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
        setFokus(true);
      } else if (key === "escape") {
        if (!ergebnisOpen && !emailOpen && !spaeterOpen) setFokus(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, claimIt, openEmail, openQuote, selectedItem, ergebnisOpen, emailOpen, spaeterOpen]);

  const high = openList.filter((i) => i.prioritaet === "hoch").length;
  const doneCount = Object.keys(app.done).length;
  const doneItems = useMemo(
    () =>
      Object.keys(app.done)
        .map((kundeId) => ({
          kundeId,
          erg: app.ergebnisse[kundeId],
          wv: app.wiedervorlagen[kundeId],
          emp: getEmpfehlungFuer(kundeId, app.stichtag, app.settings),
        }))
        .sort((a, b) => a.kundeId.localeCompare(b.kundeId)),
    [app.done, app.ergebnisse, app.wiedervorlagen, app.stichtag, app.settings],
  );
  const top = openList[0];
  const topKunde = top ? getKunde(top.kundeId) : undefined;
  const activeFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ---------------- Kopfzeile ---------------- */}
      <div className="px-6 pt-4 pb-3 shrink-0">
        <div className="card px-5 py-3 anim-fade-up">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-[8px] bg-surface-1 border border-line grid place-items-center shrink-0">
                <Target size={15} className="text-navy-800" />
              </span>
              <p className="text-[13px] leading-snug text-ink truncate">
                <strong className="font-bold">
                  {lang === "de"
                    ? `Guten Morgen, ${ANREDE_NAME[app.user.id] ?? app.user.kurz}.`
                    : `Good morning, ${t(app.user.nameKey).split(" ")[0]}.`}
                </strong>{" "}
                <span className="text-ink-2">
                  {lang === "de"
                    ? `${openList.length} Empfehlungen für heute, davon ${high} mit hoher Priorität.`
                    : `${openList.length} recommendations for today, ${high} of them high priority.`}
                </span>
                {topKunde && (
                  <span className="text-ink-2">
                    {" "}
                    {lang === "de" ? "Größter Hebel:" : "Biggest lever:"}{" "}
                    <strong className="font-bold text-navy-800">
                      {topKunde.name} ({top!.empfehlung.betroffeneAnzahl} {lang === "de" ? "überfällige Messmittel" : "overdue instruments"})
                    </strong>
                    .
                  </span>
                )}
              </p>
            </div>
            <div className="flex-1" />
            <div className="hidden md:flex items-center gap-2 text-[11.5px]">
              <span className="tnum inline-flex items-center h-7 px-2.5 rounded-full bg-surface-1 border border-line text-ink-2">
                {lang === "de" ? "Vorschlagsliste" : "Candidates"}:{" "}
                <strong className="text-navy-800 ml-1">{numDE(getKandidatenZahl(app.stichtag))}</strong>
              </span>
              <span className="tnum inline-flex items-center h-7 px-2.5 rounded-full bg-surface-1 border border-line text-ink-2">
                {lang === "de" ? "Überfällig gesamt" : "Overdue total"}:{" "}
                <strong className="text-navy-800 ml-1">{numDE(64915)}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- toolbar (nur in der Listenansicht) ---------------- */}
      {!fokus && (
      <div className="px-6 pb-3 flex items-center gap-2 flex-wrap shrink-0">
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
          {openList.length} / {list.length - doneCount} {lang === "de" ? "Empfehlungen" : "recommendations"}
        </span>
      </div>
      )}

      {/* ---------------- Liste (vollflächig) oder Fokus-Ansicht ---------------- */}
      {!fokus ? (
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
        <div className="max-w-4xl mx-auto card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line bg-surface-1 flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-1 rounded-[8px] bg-surface-0 border border-line p-[3px]">
              <button
                onClick={() => setAnsicht("offen")}
                className={clsx(
                  "h-[26px] px-3 rounded-[7px] text-[12px] font-bold transition-colors",
                  ansicht === "offen" ? "bg-navy-800 text-white" : "text-ink-3 hover:text-ink",
                )}
              >
                {lang === "de" ? "Offen" : "Open"} <span className="tnum opacity-70">{openList.length}</span>
              </button>
              <button
                onClick={() => setAnsicht("erledigt")}
                className={clsx(
                  "h-[26px] px-3 rounded-[7px] text-[12px] font-bold transition-colors",
                  ansicht === "erledigt" ? "bg-navy-800 text-white" : "text-ink-3 hover:text-ink",
                )}
              >
                {t("akt.erledigt")} <span className="tnum opacity-70">{doneCount}</span>
              </button>
            </div>
            {ansicht === "offen" ? (
              <>
                <div className="flex-1 max-w-[220px]">
                  <Progress
                    value={doneCount}
                    total={app.settings.kapazitaet}
                    label={t("heute.fortschritt", { done: doneCount, total: app.settings.kapazitaet })}
                  />
                </div>
                <div className="flex-1" />
                <span className="hidden sm:block text-[11px] text-ink-3">
                  {lang === "de" ? "Klicken oder Enter für Details" : "Click or Enter for details"}
                </span>
              </>
            ) : (
              <>
                <div className="flex-1" />
                <span className="hidden sm:block text-[11px] text-ink-3">
                  {lang === "de" ? "Protokollierte Ergebnisse – zurückholbar" : "Logged outcomes – restorable"}
                </span>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const ok = window.confirm(
                      lang === "de"
                        ? "Wirklich alles zurücksetzen? Claims, Ergebnisse, Entwürfe und Lernwerte werden gelöscht."
                        : "Really reset everything? Claims, outcomes, drafts and learned values will be deleted.",
                    );
                    if (ok) {
                      app.resetDemo();
                      app.toast(lang === "de" ? "Zurückgesetzt – frischer POC-Stand." : "Reset – fresh POC state.");
                    }
                  }}
                >
                  {lang === "de" ? "Demo zurücksetzen" : "Reset demo"}
                </Btn>
              </>
            )}
          </div>

          {ansicht === "offen" ? (
          <div className="divide-y divide-[var(--color-line)]">
            {openList.length === 0 && (
              <EmptyState
                title={!activeFilters && !query ? t("heute.allesErledigt") : t("heute.leerFilter")}
                hint={!activeFilters && !query ? t("heute.wiedervorlagen") : undefined}
                action={
                  activeFilters || query ? (
                    <Btn onClick={() => { setFilters(EMPTY_FILTERS); setQuery(""); }}>{t("heute.filterZuruecksetzen")}</Btn>
                  ) : undefined
                }
              />
            )}
            {openList.map((item) => {
              const k = getKunde(item.kundeId)!;
              const isSel = item.kundeId === selectedId;
              const claim = app.claims[item.kundeId];
              const isLeaving = leaving === item.kundeId;
              return (
                <button
                  key={item.kundeId}
                  onClick={() => openDetail(item.kundeId)}
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
                    <span className="text-[13px] font-bold text-ink truncate">{k.name}</span>
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
          ) : (
          /* ---------------- Erledigt: alle bearbeiteten mit Ergebnis + Rückholen ---------------- */
          <div className="divide-y divide-[var(--color-line)]">
            {doneItems.length === 0 && (
              <EmptyState
                title={lang === "de" ? "Noch nichts erledigt" : "Nothing done yet"}
                hint={lang === "de" ? "Erledigte Empfehlungen landen hier mit Ergebnis." : "Completed recommendations land here with their outcome."}
              />
            )}
            {doneItems.map((d) => {
              const k = getKunde(d.kundeId);
              if (!k) return null;
              return (
                <div key={d.kundeId} className="w-full px-4 py-3 flex items-center gap-2.5 flex-wrap">
                  <span className="w-[7px] h-[7px] rounded-full bg-ok shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-ink truncate">{k.name}</span>
                      <span className="tnum text-[11.5px] text-ink-3 shrink-0">{k.nummer}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {d.emp && <Chip tone={toneOf(d.emp.empfehlung.anlass)}>{t(`anlass.${d.emp.empfehlung.anlass}` as "anlass.ueberfaellig")}</Chip>}
                      {d.erg ? (
                        <Chip tone="navy">{t(`ergebnis.${d.erg.code}` as "ergebnis.angebot")}</Chip>
                      ) : (
                        <Chip tone="brand">{t("heute.wiedervorlage")}{d.wv ? ` · ${date(d.wv, loc)}` : ""}</Chip>
                      )}
                      {d.erg?.note && <span className="text-[11.5px] text-ink-3 truncate max-w-[40%]">„{d.erg.note}“</span>}
                    </div>
                  </div>
                  <span className="tnum text-[13px] font-bold text-navy-800 shrink-0">{d.emp ? euro(d.emp.ev, loc) : "–"}</span>
                  <Btn size="sm" variant="secondary" onClick={() => { app.undo(d.kundeId); app.toast(lang === "de" ? "Zurückgeholt – wieder auf der Liste." : "Restored – back on the list."); }}>
                    {lang === "de" ? "Zurückholen" : "Restore"}
                  </Btn>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>
      ) : selectedItem && kunde ? (
      /* ---------------- Fokus-Ansicht: ein Kunde, vollflächig ---------------- */
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
        <div className="max-w-5xl mx-auto card overflow-hidden anim-fade-in">
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
            onBack={() => setFokus(false)}
          />
        </div>
      </div>
      ) : null}

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
  onBack,
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
  onBack: () => void;
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
      {/* zurück */}
      <div className="px-5 pt-3 flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-bold text-ink-2 hover:bg-surface-1 hover:text-brand-700 transition-colors">
          <ArrowRight size={13} className="rotate-180" /> {lang === "de" ? "Tagesliste" : "Daily list"}
        </button>
        <span className="flex-1" />
        <Link href={`/kunden/${k.id}`} className="text-[12px] font-bold text-brand-700 hover:underline inline-flex items-center gap-1">
          {t("empf.kunde360")} <ArrowRight size={12} />
        </Link>
      </div>
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
            <p className="section-label mt-1">{t("empf.wert")}</p>
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

      <div className="px-5 py-4">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] items-start">
          <div className="space-y-5 min-w-0">
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
              <li key={i} className="text-[13px] leading-relaxed text-ink flex gap-2">
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
            <div className="mt-3 card-section p-4 anim-pop">
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
          <div className="card-section p-4">
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
          <div className="rounded-[8px] border border-line bg-surface-0 overflow-hidden">
            <table className="tbl w-full text-[12.5px]">
              <thead>
                <tr className="bg-surface-1 text-[11px] uppercase tracking-wider text-ink-3">
                  <th className="text-left font-bold px-3 py-1.5">{t("k360.spalten.ident")}</th>
                  <th className="text-left font-bold px-3 py-1.5">{t("k360.spalten.gruppe")}</th>
                  <th className="text-right font-bold px-3 py-1.5">{t("k360.spalten.faelligkeit")}</th>
                  <th className="text-left font-bold px-3 py-1.5">{t("k360.spalten.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {betroffen.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-3 py-1.5 tnum text-ink-2">{r.ident}</td>
                    <td className="px-3 py-1.5 text-ink">
                      {r.typ}
                      {r.geschaetzt && <span className="ml-1.5 text-[10px] text-due font-semibold">≈ {t("empf.geschaetzt").slice(0, 18)}…</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tnum text-ink-2">{date(r.faelligkeit, loc)}</td>
                    <td className="px-3 py-1.5 text-left">
                      <StatusPill status={r.status} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

          </div>
          <aside className="space-y-4 min-w-0">
        {/* Kontakt */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 mb-2">
            {t("empf.ansprechpartner")} <DemoBadge />
          </h3>
          <div className="rounded-[8px] border border-line bg-surface-0 p-4 grid grid-cols-2 gap-y-2 gap-x-4 text-[13px]">
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

        {/* Details */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 mb-2">
            {lang === "de" ? "Details" : "Details"}
          </h3>
          <dl className="rounded-[8px] border border-line bg-surface-0 p-4 space-y-2 text-[12.5px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-3">{t("k360.kundeSeit")}</dt>
              <dd className="tnum font-semibold text-ink">{k.seit}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-3">{t("k360.aktiveMessmittel")}</dt>
              <dd className="tnum font-semibold text-ink">{k.aktiv}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-3">{t("k360.ruecklauf")}</dt>
              <dd className="tnum font-semibold text-ink">{Math.round(k.ruecklauf.quote * 100)} %</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-3">{lang === "de" ? "Versand nach Fälligkeit" : "Dispatch after due date"}</dt>
              <dd className="tnum font-semibold text-ink">+{k.ruecklauf.lag} d</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-3">{t("k360.kanalMix")}</dt>
              <dd className="tnum font-semibold text-ink">{k.kanal.portal} % Portal</dd>
            </div>
          </dl>
        </div>
          </aside>
        </div>
      </div>

      {/* action bar: eine einzige, klar gewichtete Zeile */}
      <div className="sticky bottom-0 border-t border-line px-4 py-3 bg-surface-1/95 backdrop-blur flex items-center gap-1.5 overflow-x-auto">
        {!claim ? (
          <Btn variant="primary" onClick={onClaim} title="Ü" className="shrink-0">
            <UserCheck size={14} /> {t("akt.uebernehmen")}
          </Btn>
        ) : (
          <Btn variant="secondary" disabled title="Ü" className="shrink-0">
            <Check size={14} /> {claim === app.user.id ? t("akt.uebernehmen") : t("akt.uebernommen", { name: USERS.find((u) => u.id === claim)?.kurz ?? "–" })}
          </Btn>
        )}
        <a
          href={`tel:${k.telefon.replace(/[^0-9+]/g, "")}`}
          className="shrink-0 inline-flex items-center justify-center h-9 px-4 rounded-[8px] text-[13px] font-semibold border border-line-strong bg-surface-0 text-ink hover:bg-surface-1"
        >
          <Phone size={14} /> {t("akt.anrufen")}
        </a>
        <Btn variant="secondary" onClick={onEmail} title="E" className="shrink-0">
          <Mail size={14} /> {t("akt.email")}
        </Btn>
        <Btn variant="secondary" onClick={onQuote} title="A" className="shrink-0">
          <FileText size={14} /> {t("akt.angebot")}
        </Btn>
        <div className="flex-1 min-w-2" />
        <Btn variant="ghost" onClick={onLater} title="S" className="shrink-0">
          <Timer size={14} /> {t("akt.spaeter")}
        </Btn>
        <Btn variant="ghost" onClick={onField} className="shrink-0">
          <MapPin size={14} /> <span className="hidden xl:inline">{t("akt.aussendienst")}</span>
        </Btn>
        <Btn variant="secondary" onClick={onDone} title="D" className="shrink-0">
          <Check size={14} /> {t("akt.erledigt")}
        </Btn>
      </div>
    </>
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
              "h-[42px] rounded-[8px] border text-[13px] font-semibold transition-all text-left px-3",
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
            className="h-[64px] rounded-[8px] border border-line hover:border-brand-700 hover:bg-brand-50 transition-colors flex flex-col items-center justify-center gap-1"
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
        <span className="text-[11px] text-ink-3">{tab === "mail" ? t("email.sieForm") : lang === "de" ? "≤ 150 Wörter" : "≤ 150 words"}</span>
      </div>

      {tab === "mail" && (
        <div className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1">{t("email.betreff")}</p>
          <p className="text-[13px] font-semibold text-ink bg-surface-1 border border-line rounded-[8px] px-3 py-2">{mail.betreff}</p>
        </div>
      )}

      <div className="rounded-[8px] border border-line bg-surface-1 p-4 text-[13px] leading-relaxed text-ink whitespace-pre-wrap max-h-[46vh] overflow-y-auto">
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


