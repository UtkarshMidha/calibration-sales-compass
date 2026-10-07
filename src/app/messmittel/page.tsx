"use client";

import clsx from "clsx";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { date, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useDashboard, useMessmittelSample } from "@/lib/real-data";
import { Btn, EmptyState, StatusPill } from "@/components/ui";

const FILTERS = ["alle", "ueberfaellig", "teilabwanderung", "faellig_bald"] as const;

const FILTER_META: Record<(typeof FILTERS)[number], { de: string; en: string; hintDe: string; hintEn: string }> = {
  alle: { de: "Alle", en: "All", hintDe: "Alle Zeilen im Auszug", hintEn: "All rows in the extract" },
  ueberfaellig: { de: "Überfällig", en: "Overdue", hintDe: "Fälligkeit überschritten – inkl. über 60 Tage", hintEn: "Past due – incl. over 60 days" },
  teilabwanderung: { de: "Über 60 Tage", en: "Over 60 days", hintDe: "Seit über 60 Tagen überfällig – vermutlich anderswo kalibriert", hintEn: "Overdue for 60+ days – probably calibrated elsewhere" },
  faellig_bald: { de: "Fällig bald", en: "Due soon", hintDe: "Wird in den nächsten 30 Tagen fällig", hintEn: "Falls due within the next 30 days" },
};

function matchesStatus(status: string, f: (typeof FILTERS)[number]): boolean {
  if (f === "alle") return true;
  if (f === "ueberfaellig") return status === "ueberfaellig" || status === "teilabwanderung";
  return status === f;
}

export default function MessmittelPage() {
  const { lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const { rows } = useMessmittelSample();
  const { data } = useDashboard();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("alle");
  const [limit, setLimit] = useState(100);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesStatus(r.status, status)) return false;
      if (query && !r.ident.toLowerCase().includes(query) && !r.kunde.includes(query) && !r.gruppe.toLowerCase().includes(query) && !r.typ.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [rows, q, status]);

  const counts = useMemo(() => {
    const m = new Map<(typeof FILTERS)[number], number>();
    for (const r of rows ?? []) {
      m.set("alle", (m.get("alle") ?? 0) + 1);
      if (r.status === "ueberfaellig" || r.status === "teilabwanderung") m.set("ueberfaellig", (m.get("ueberfaellig") ?? 0) + 1);
      if (r.status === "teilabwanderung") m.set("teilabwanderung", (m.get("teilabwanderung") ?? 0) + 1);
      if (r.status === "faellig_bald") m.set("faellig_bald", (m.get("faellig_bald") ?? 0) + 1);
    }
    return m;
  }, [rows]);

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
        <div>
          <h2 className="text-[17px] font-bold text-navy-800 flex items-center gap-2">
            {lang === "de" ? "Messmittel" : "Instruments"}
          </h2>
          <p className="text-[12.5px] text-ink-3 tnum">
            {data
              ? num(data.kpis.ueberfaellig, 0, loc)
              : num(65282, 0, loc)}{" "}
            {lang === "de" ? "überfällig" : "overdue"}
            {" · "}
            {lang === "de" ? "Auszug: 2.000 älteste Zeilen" : "Extract: 2,000 oldest rows"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              title={lang === "de" ? FILTER_META[s].hintDe : FILTER_META[s].hintEn}
              className={clsx(
                "h-[27px] px-2.5 rounded-full border text-[12px] font-semibold transition-colors",
                status === s ? "bg-navy-800 border-navy-800 text-white" : "border-line text-ink-2 bg-surface-0 hover:border-line-strong",
              )}
            >
              {lang === "de" ? FILTER_META[s].de : FILTER_META[s].en}{" "}
              <span className="tnum opacity-70">{num(counts.get(s) ?? 0, 0, loc)}</span>
            </button>
          ))}
          <label className="flex items-center gap-2 h-[29px] pl-2.5 pr-2 rounded-[8px] border border-line bg-surface-0 w-[190px]">
            <Search size={13} className="text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ident / Kunde / Gruppe…"
              className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px]"
            />
            {q && <button onClick={() => setQ("")} aria-label="Clear" className="text-ink-3 hover:text-ink"><X size={12} /></button>}
          </label>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!rows ? (
          <div className="p-8 space-y-2">
            <div className="h-4 rounded bg-surface-2 animate-pulse" />
            <div className="h-4 rounded bg-surface-2 animate-pulse w-2/3" />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[64vh]">
            <table className="w-full text-[12.5px] min-w-[780px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface-1 border-b border-line text-[10.5px] uppercase tracking-wider text-ink-3">
                  <th className="text-left font-bold px-4 py-2">Ident-Nr.</th>
                  <th className="text-left font-bold px-3 py-2">{lang === "de" ? "Kunde" : "Customer"}</th>
                  <th className="text-left font-bold px-3 py-2">{lang === "de" ? "Gruppe / Typ" : "Group / type"}</th>
                  <th className="text-left font-bold px-3 py-2">{lang === "de" ? "Fälligkeit" : "Due date"}</th>
                  <th className="text-right font-bold px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {filtered.slice(0, limit).map((r, i) => (
                  <tr key={`${r.kunde}-${r.ident}-${i}`} className="hover:bg-surface-1">
                    <td className="px-4 py-1.5 tnum text-ink-2">{r.ident || "–"}</td>
                    <td className="px-3 py-1.5">
                      <Link href={`/kunden/${r.kunde}`} className="tnum font-semibold text-ink hover:text-brand-700">{r.kunde}</Link>
                    </td>
                    <td className="px-3 py-1.5 text-ink">{r.gruppe} <span className="text-ink-3">· {r.typ.slice(0, 40)}</span></td>
                    <td className={clsx("px-3 py-1.5 tnum", r.tage > 0 ? "text-overdue font-semibold" : "text-ink-2")}>
                      {date(r.faelligkeit, loc)} <span className="text-ink-3">({r.tage > 0 ? `+${r.tage}` : r.tage} d)</span>
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <StatusPill status={r.status === "teilabwanderung" ? "teilabwanderung" : r.status === "faellig_bald" ? "faellig_bald" : "ueberfaellig"} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows && filtered.length === 0 && <EmptyState title={lang === "de" ? "Keine Treffer" : "No matches"} />}
        {rows && limit < filtered.length && (
          <div className="border-t border-line px-4 py-3 flex items-center justify-between bg-surface-1">
            <span className="text-[12px] text-ink-3 tnum">{num(Math.min(limit, filtered.length), 0, loc)} / {num(filtered.length, 0, loc)}</span>
            <Btn size="sm" onClick={() => setLimit((l) => l + 100)}>{lang === "de" ? "Mehr anzeigen" : "Show more"}</Btn>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11.5px] text-ink-3">
        {lang === "de" ? "Stand 25.09.2026 – Auszug der ältesten Fälligkeiten." : "As of 25/09/2026 – extract of the oldest due dates."}
      </p>
    </div>
  );
}
