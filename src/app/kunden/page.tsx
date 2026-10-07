"use client";

import clsx from "clsx";
import { ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { BRANCHEN, GEBIETE, getEmpfehlungFuer, getKunden } from "@/lib/data";
import { euro, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { Btn, Chip, DemoBadge, EmptyState } from "@/components/ui";

type Sort = "umsatz" | "risiko" | "ueberfaellig" | "name";

export default function KundenPage() {
  return (
    <Suspense fallback={null}>
      <KundenInner />
    </Suspense>
  );
}

function KundenInner() {
  const app = useApp();
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const params = useSearchParams();

  const [q, setQ] = useState("");
  const [branche, setBranche] = useState(params.get("branche") ?? "alle");
  const [gebiet, setGebiet] = useState(params.get("gebiet") ?? "alle");
  const [sort, setSort] = useState<Sort>("umsatz");
  const [limit, setLimit] = useState(50);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = getKunden().filter((k) => {
      if (branche !== "alle" && k.branche !== branche) return false;
      if (gebiet !== "alle" && k.gebiet !== gebiet) return false;
      if (query && !k.name.toLowerCase().includes(query) && !k.nummer.toLowerCase().includes(query)) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "de");
      if (sort === "risiko") return b.risiko - a.risiko;
      if (sort === "ueberfaellig") return b.ueberfaellig - a.ueberfaellig;
      return b.umsatzStunden - a.umsatzStunden;
    });
    return out;
  }, [q, branche, gebiet, sort]);

  const active = q !== "" || branche !== "alle" || gebiet !== "alle";

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      {/* header */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
        <div>
          <h2 className="text-[17px] font-bold text-navy-800 flex items-center gap-2">
            {t("kunden.titel")} <DemoBadge />
          </h2>
          <p className="text-[12.5px] text-ink-3 tnum">
            {t("kunden.treffer", { n: num(rows.length, 0, loc) })}
            {branche !== "alle" ? ` · ${branche}` : ""}
            {gebiet !== "alle" ? ` · ${gebiet}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 h-[34px] pl-2.5 pr-2 rounded-[9px] border border-line bg-surface-0 focus-within:border-brand-700 transition-colors min-w-[240px]">
            <Search size={14} className="text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("kunden.suche")}
              className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-ink-3"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear" className="text-ink-3 hover:text-ink">
                <X size={13} />
              </button>
            )}
          </label>

          <select
            value={branche}
            onChange={(e) => setBranche(e.target.value)}
            className="h-[34px] rounded-[9px] border border-line bg-surface-0 px-2.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand-700 cursor-pointer"
          >
            <option value="alle">{`${t("heute.branche")}: ${t("heute.alle")}`}</option>
            {BRANCHEN.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={gebiet}
            onChange={(e) => setGebiet(e.target.value)}
            className="h-[34px] rounded-[9px] border border-line bg-surface-0 px-2.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand-700 cursor-pointer"
          >
            <option value="alle">{`${t("heute.gebiet")}: ${t("heute.alle")}`}</option>
            {GEBIETE.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            title={t("kunden.sortieren")}
            className="h-[34px] rounded-[9px] border border-line bg-surface-0 px-2.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand-700 cursor-pointer"
          >
            <option value="umsatz">{t("kunden.sort.umsatz")}</option>
            <option value="risiko">{t("kunden.sort.risiko")}</option>
            <option value="ueberfaellig">{t("kunden.sort.ueberfaellig")}</option>
            <option value="name">{t("kunden.sort.name")}</option>
          </select>

          {active && (
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ("");
                setBranche("alle");
                setGebiet("alle");
              }}
            >
              {t("heute.filterZuruecksetzen")}
            </Btn>
          )}
        </div>
      </div>

      {/* table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead>
              <tr className="bg-surface-1 border-b border-line text-[10.5px] uppercase tracking-wider text-ink-3">
                <th className="text-left font-bold px-4 py-2.5">{t("kunden.sort.name")}</th>
                <th className="text-left font-bold px-3 py-2.5">{t("angebot.kundenr")}</th>
                <th className="text-left font-bold px-3 py-2.5">{t("heute.branche")}</th>
                <th className="text-left font-bold px-3 py-2.5">{t("empf.gebiet")}</th>
                <th className="text-right font-bold px-3 py-2.5">{t("k360.aktiveMessmittel")}</th>
                <th className="text-right font-bold px-3 py-2.5">{t("anlass.ueberfaellig")}</th>
                <th className="text-right font-bold px-3 py-2.5">{t("kunden.risikoBand")}</th>
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
                        <span
                          className={clsx(
                            "w-[6px] h-[6px] rounded-full shrink-0",
                            k.band === "hoch" ? "bg-critical" : k.band === "mittel" ? "bg-due" : "bg-ok",
                          )}
                        />
                        {k.name}
                        <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 text-brand-700 transition-opacity" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tnum text-ink-3">{k.nummer}</td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{k.branche}</td>
                    <td className="px-3 py-2.5 text-ink-2 whitespace-nowrap">{k.gebiet}</td>
                    <td className="px-3 py-2.5 text-right tnum text-ink-2">{num(k.aktiv, 0, loc)}</td>
                    <td
                      className={clsx(
                        "px-3 py-2.5 text-right tnum font-semibold",
                        k.ueberfaellig > 0 ? "text-overdue" : "text-ink-3",
                      )}
                    >
                      {k.ueberfaellig > 0 ? num(k.ueberfaellig, 0, loc) : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: k.band === "hoch" ? "var(--color-critical)" : k.band === "mittel" ? "var(--color-due)" : "var(--color-ok)" }}
                        />
                        <span className="tnum text-ink-2">{Math.round(k.risiko * 100)} %</span>
                      </span>
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
            <span className="text-[12px] text-ink-3 tnum">
              {num(Math.min(limit, rows.length), 0, loc)} / {num(rows.length, 0, loc)}
            </span>
            <Btn size="sm" onClick={() => setLimit((l) => l + 50)}>
              {t("common.mehr")}
            </Btn>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11.5px] text-ink-3">
        {lang === "de"
          ? "Demo-Stammdaten (fiktiv). Gebiet und Name sind aus der Kundennummer deterministisch erzeugt – keine Adressdaten im Datensatz."
          : "Demo master data (fictitious). Region and name are derived deterministically from the customer number – no address data in the dataset."}{" "}
        <Chip tone="neutral">{t("demo.badge")}</Chip>
      </p>
    </div>
  );
}
