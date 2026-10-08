"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Info, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BRANCHEN, getEmpfehlungFuer, getKunden } from "@/lib/data";
import { date, euro, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useKundenIndex } from "@/lib/real-data";
import { useApp } from "@/lib/store";
import { Btn, Chip, DemoBadge, EmptyState } from "@/components/ui";

type Sort = "ueberfaellig" | "aktiv" | "name" | "letzte" | "branche" | "gebiet";
type Dir = "asc" | "desc";

export default function KundenPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full overflow-y-auto px-6 py-4">
          <div className="h-10 rounded-[8px] bg-surface-2 animate-pulse" />
        </div>
      }
    >
      <KundenPageInner />
    </Suspense>
  );
}

function KundenPageInner() {
  const app = useApp();
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const { rows: realRows } = useKundenIndex();
  const sp = useSearchParams();
  const router = useRouter();

  const [q, setQ] = useState("");
  /* Cockpit deep-links (?branche= / ?gebiet=) preselect the filters. */
  const [branche, setBranche] = useState(() => sp.get("branche") ?? "alle");
  const [gebiet, setGebiet] = useState<string | null>(() => sp.get("gebiet"));
  const [sort, setSort] = useState<Sort>("ueberfaellig");
  const [dir, setDir] = useState<Dir>("desc");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setBranche(sp.get("branche") ?? "alle");
    setGebiet(sp.get("gebiet"));
  }, [sp]);

  const clearUrlFilters = () => {
    setQ("");
    setBranche("alle");
    setGebiet(null);
    router.replace("/kunden");
  };

  const pickSort = (key: Sort) => {
    if (key === sort) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir(key === "name" || key === "branche" ? "asc" : "desc");
    }
  };

  const branchen = useMemo(() => {
    if (realRows) return [...new Set(realRows.map((r) => r.branche))].sort();
    return BRANCHEN.map((b) => b.name);
  }, [realRows]);

  /* URL-Branche aus dem Cockpit (Demo-Stamm) passt nicht immer auf echte
   * Branchennamen – dann still auf "alle" fallen, statt leer zu filtern. */
  const brancheEff = branchen.includes(branche) ? branche : "alle";

  const realFiltered = useMemo(() => {
    if (!realRows) return null;
    const query = q.trim().toLowerCase();
    const out = realRows.filter((k) => {
      if (brancheEff !== "alle" && k.branche !== brancheEff) return false;
      if (query && !k.kunde.toLowerCase().includes(query)) return false;
      return true;
    });
    return [...out].sort((a, b) => {
      let cmp: number;
      if (sort === "name") cmp = a.kunde.localeCompare(b.kunde);
      else if (sort === "branche") cmp = a.branche.localeCompare(b.branche, "de");
      else if (sort === "aktiv") cmp = a.aktiv - b.aktiv;
      else if (sort === "letzte") cmp = (a.letzteKal ?? "").localeCompare(b.letzteKal ?? "");
      else cmp = a.ueberfaellig - b.ueberfaellig || a.aktiv - b.aktiv;
      return dir === "asc" ? cmp : -cmp;
    });
  }, [realRows, q, brancheEff, sort, dir]);

  if (realFiltered) {
    const active = q !== "" || brancheEff !== "alle" || gebiet !== null;
    return (
      <div className="h-full overflow-y-auto px-6 py-4">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              {t("kunden.titel")}
            </h1>
            <p className="text-[12.5px] text-ink-3 tnum">
              {t("kunden.treffer", { n: num(realFiltered.length, 0, loc) })}
              {brancheEff !== "alle" ? ` · ${brancheEff}` : ""}
              {" · "}
              {lang === "de" ? "Stand 25.09.2026" : "As of 25/09/2026"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-[8px] border border-line bg-surface-0 focus-within:border-brand-700 transition-colors min-w-[220px]">
              <Search size={14} className="text-ink-3" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={lang === "de" ? "Kundennummer…" : "Customer no.…"}
                className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-ink-3 tnum"
              />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear" className="text-ink-3 hover:text-ink">
                  <X size={13} />
                </button>
              )}
            </label>

            <select
              value={brancheEff}
              onChange={(e) => setBranche(e.target.value)}
              className="h-9 rounded-[8px] border border-line bg-surface-0 px-2.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand-700 cursor-pointer max-w-[260px]"
            >
              <option value="alle">{`${t("heute.branche")}: ${t("heute.alle")}`}</option>
              {branchen.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => { const v = e.target.value as Sort; setSort(v); setDir(v === "name" || v === "branche" ? "asc" : "desc"); }}
              title={t("kunden.sortieren")}
              className="h-9 rounded-[8px] border border-line bg-surface-0 px-2.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand-700 cursor-pointer"
            >
              <option value="ueberfaellig">{t("kunden.sort.ueberfaellig")}</option>
              <option value="aktiv">{t("k360.aktiveMessmittel")}</option>
              <option value="letzte">{t("k360.letzteKal")}</option>
              <option value="name">{t("kunden.sort.name")}</option>
            </select>

            {active && (
              <Btn size="sm" variant="ghost" onClick={clearUrlFilters}>
                {t("heute.filterZuruecksetzen")}
              </Btn>
            )}
          </div>
        </div>

        {gebiet && (
          <div className="mb-3 rounded-[8px] border border-line bg-surface-1 px-4 py-3 flex items-start gap-2.5 anim-fade-up">
            <Info size={15} className="text-navy-800 shrink-0 mt-px" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-navy-800">
                {lang === "de"
                  ? `Region „${gebiet}“ – keine Regionsdaten in diesem Auszug`
                  : `Region "${gebiet}" – no region data in this extract`}
              </p>
              <p className="text-[12.5px] text-ink-2 mt-0.5 leading-relaxed">
                {lang === "de"
                  ? "Die Cockpit-Regionen stammen aus der Modellrechnung (Demo-Stamm) und passen nicht auf echte Kundennummern. Filtern Sie stattdessen nach Branche, Suche oder Sortierung."
                  : "Cockpit regions come from the model (demo data) and don't map to real customer numbers. Filter by industry, search or sorting instead."}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Btn size="sm" variant="ghost" onClick={clearUrlFilters}>
                {t("heute.filterZuruecksetzen")}
              </Btn>
              <Link
                href="/cockpit"
                className="inline-flex items-center justify-center h-8 px-3 rounded-[8px] text-[12.5px] font-semibold border border-line-strong bg-surface-0 text-ink hover:bg-surface-1 transition-colors whitespace-nowrap"
              >
                {t("cockpit.titel")}
              </Link>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl w-full text-[13px] min-w-[760px]">
              <thead>
                <tr className="bg-surface-1 border-b border-line text-[11px] uppercase tracking-wider text-ink-3">
                  <Th label={t("angebot.kundenr")} align="left" active={sort === "name"} dir={dir} onClick={() => pickSort("name")} />
                  <Th label={t("heute.branche")} align="left" active={sort === "branche"} dir={dir} onClick={() => pickSort("branche")} />
                  <Th label={t("k360.aktiveMessmittel")} align="right" active={sort === "aktiv"} dir={dir} onClick={() => pickSort("aktiv")} />
                  <Th label={t("anlass.ueberfaellig")} align="right" active={sort === "ueberfaellig"} dir={dir} onClick={() => pickSort("ueberfaellig")} />
                  <Th label={t("k360.letzteKal")} align="right" active={sort === "letzte"} dir={dir} onClick={() => pickSort("letzte")} last />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {realFiltered.slice(0, limit).map((k) => (
                  <tr key={k.kunde} className="hover:bg-surface-1 transition-colors group">
                    <td className="px-4 py-2.5">
                      <Link href={`/kunden/${k.kunde}`} className="flex items-center gap-1.5 font-semibold text-ink hover:text-brand-700 tnum">
                        <span className={clsx("w-[6px] h-[6px] rounded-full shrink-0", k.ueberfaellig > 50 ? "bg-critical" : k.ueberfaellig > 0 ? "bg-due" : "bg-ok")} />
                        {k.kunde}
                        <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 text-brand-700 transition-opacity" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap max-w-[280px] truncate">{k.branche}</td>
                    <td className="px-3 py-2.5 text-right tnum text-ink-2">{num(k.aktiv, 0, loc)}</td>
                    <td className={clsx("px-3 py-2.5 text-right tnum font-semibold", k.ueberfaellig > 0 ? "text-overdue" : "text-ink-3")}>
                      {k.ueberfaellig > 0 ? num(k.ueberfaellig, 0, loc) : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-right tnum text-ink-2">{k.letzteKal ? date(k.letzteKal, loc) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {realFiltered.length === 0 && <EmptyState title={t("common.keineTreffer")} hint={t("heute.leerFilter")} />}

          {limit < realFiltered.length && (
            <div className="border-t border-line px-4 py-3 flex items-center justify-between bg-surface-1">
              <span className="text-[12px] text-ink-3 tnum">
                {num(Math.min(limit, realFiltered.length), 0, loc)} / {num(realFiltered.length, 0, loc)}
              </span>
              <Btn size="sm" onClick={() => setLimit((l) => l + 50)}>
                {t("common.mehr")}
              </Btn>
            </div>
          )}
        </div>

        <p className="mt-3 text-[12px] text-ink-3">
          {lang === "de"
            ? "Echte Kundennummern und Branchen (Stand 25.09.2026); Namen und Kontakte sind Demo."
            : "Real customer numbers and industries (as of 25/09/2026); names and contacts are demo."}
        </p>
      </div>
    );
  }

  return <SyntheticFallback q={q} setQ={setQ} sort={sort} setSort={setSort} limit={limit} setLimit={setLimit} gebiet={gebiet} setGebiet={setGebiet} />;
}

function Th({ label, align, active, dir, onClick, last }: {
  label: string; align: "left" | "right"; active: boolean; dir: Dir; onClick: () => void; last?: boolean;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={clsx("font-bold p-0", align === "left" ? "text-left" : "text-right", last ? "px-4" : "px-3")} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        onClick={onClick}
        title={label}
        className={clsx(
          "inline-flex items-center gap-1 py-2.5 uppercase tracking-wider transition-colors",
          align === "right" && "flex-row-reverse",
          active ? "text-brand-700" : "text-ink-3 hover:text-ink",
        )}
      >
        {label}
        <Icon size={11} className={active ? "opacity-100" : "opacity-40"} />
      </button>
    </th>
  );
}

function SyntheticFallback({ q, setQ, sort, setSort, limit, setLimit, gebiet, setGebiet }: {
  q: string; setQ: (v: string) => void; sort: Sort; setSort: (v: Sort) => void; limit: number; setLimit: (v: (l: number) => number) => void;
  gebiet: string | null; setGebiet: (v: string | null) => void;
}) {
  const app = useApp();
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const gebiete = useMemo(() => [...new Set(getKunden().map((k) => k.gebiet))].sort(), []);
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out = getKunden().filter((k) => {
      if (query && !k.name.toLowerCase().includes(query) && !k.nummer.toLowerCase().includes(query)) return false;
      if (gebiet && k.gebiet !== gebiet) return false;
      return true;
    });
    return [...out].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "de");
      if (sort === "aktiv") return b.aktiv - a.aktiv;
      if (sort === "gebiet") return a.gebiet.localeCompare(b.gebiet, "de");
      return b.ueberfaellig - a.ueberfaellig;
    });
  }, [q, sort, gebiet]);

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            {t("kunden.titel")} <DemoBadge />
          </h1>
          <p className="text-[12.5px] text-ink-3 tnum">
            {t("kunden.treffer", { n: num(rows.length, 0, loc) })}
            {gebiet ? ` · ${gebiet}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-[8px] border border-line bg-surface-0 min-w-[240px] focus-within:border-brand-700 transition-colors">
            <Search size={14} className="text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("kunden.suche")} className="flex-1 bg-transparent outline-none text-[13px]" />
            {q && <button onClick={() => setQ("")} aria-label="Clear" className="text-ink-3 hover:text-ink"><X size={13} /></button>}
          </label>
          <select
            value={gebiet ?? "alle"}
            onChange={(e) => setGebiet(e.target.value === "alle" ? null : e.target.value)}
            title={t("empf.gebiet")}
            className="h-9 rounded-[8px] border border-line bg-surface-0 px-2.5 text-[12.5px] font-semibold cursor-pointer outline-none focus:border-brand-700 max-w-[200px]"
          >
            <option value="alle">{`${t("empf.gebiet")}: ${t("heute.alle")}`}</option>
            {gebiete.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-[8px] border border-line bg-surface-0 px-2.5 text-[12.5px] font-semibold cursor-pointer outline-none focus:border-brand-700">
            <option value="ueberfaellig">{t("kunden.sort.ueberfaellig")}</option>
            <option value="aktiv">{t("k360.aktiveMessmittel")}</option>
            <option value="name">{t("kunden.sort.name")}</option>
            <option value="gebiet">{t("empf.gebiet")}</option>
          </select>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl w-full text-[13px] min-w-[800px]">
            <thead>
              <tr className="bg-surface-1 border-b border-line text-[11px] uppercase tracking-wider text-ink-3">
                <th className="text-left font-bold px-4 py-2.5">{t("kunden.sort.name")}</th>
                <th className="text-left font-bold px-3 py-2.5">{t("angebot.kundenr")}</th>
                <th className="text-left font-bold px-3 py-2.5">{t("empf.gebiet")}</th>
                <th className="text-right font-bold px-3 py-2.5">{t("k360.aktiveMessmittel")}</th>
                <th className="text-right font-bold px-3 py-2.5">{t("anlass.ueberfaellig")}</th>
                <th className="text-right font-bold px-4 py-2.5">{t("empf.wert")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {rows.slice(0, limit).map((k) => {
                const emp = getEmpfehlungFuer(k.id, app.stichtag, app.settings);
                return (
                  <tr key={k.id} className="hover:bg-surface-1 transition-colors group">
                    <td className="px-4 py-2.5">
                      <Link href={`/kunden/${k.id}`} className="flex items-center gap-1.5 font-semibold text-ink hover:text-brand-700">
                        <span className={clsx("w-[6px] h-[6px] rounded-full shrink-0", k.band === "hoch" ? "bg-critical" : k.band === "mittel" ? "bg-due" : "bg-ok")} />
                        {k.name}
                        <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 text-brand-700 transition-opacity" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tnum text-ink-3">{k.nummer}</td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{k.gebiet}</td>
                    <td className="px-3 py-2.5 text-right tnum text-ink-2">{num(k.aktiv, 0, loc)}</td>
                    <td className={clsx("px-3 py-2.5 text-right tnum font-semibold", k.ueberfaellig > 0 ? "text-overdue" : "text-ink-3")}>
                      {k.ueberfaellig > 0 ? num(k.ueberfaellig, 0, loc) : "–"}
                    </td>
                    <td className="px-4 py-2.5 text-right tnum font-semibold text-navy-800 whitespace-nowrap">
                      {emp ? euro(emp.ev, loc) : <span className="text-ink-3 font-normal">–</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <EmptyState title={t("common.keineTreffer")} hint={t("heute.leerFilter")} />}
        {limit < rows.length && (
          <div className="border-t border-line px-4 py-3 flex items-center justify-between bg-surface-1">
            <span className="text-[12px] text-ink-3 tnum">{num(Math.min(limit, rows.length), 0, loc)} / {num(rows.length, 0, loc)}</span>
            <Btn size="sm" onClick={() => setLimit((l) => l + 50)}>{t("common.mehr")}</Btn>
          </div>
        )}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        {lang === "de" ? "Demo-Stammdaten (fiktiv)." : "Demo master data (fictitious)."} <Chip tone="neutral">{t("demo.badge")}</Chip>
      </p>
    </div>
  );
}
