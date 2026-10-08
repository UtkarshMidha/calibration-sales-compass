"use client";

import clsx from "clsx";
import { ChartColumn, FileText, History, LayoutDashboard, ListChecks, Ruler, Search, Settings, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getKunden, type Kunde } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { useKundenIndex } from "@/lib/real-data";
import { useApp } from "@/lib/store";

type Row =
  | { kind: "page"; id: string; label: string; hint: string; href: string; icon: typeof ListChecks }
  | { kind: "kunde"; id: string; label: string; hint: string; href: string; kunde: Kunde }
  | { kind: "kunde-real"; id: string; label: string; hint: string; href: string; nummer: string }
  | { kind: "action"; id: string; label: string; hint: string; run: () => void };

export function CommandPalette() {
  const app = useApp();
  const { t, lang } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { rows: realRows } = useKundenIndex();

  const hintFor = (de: string, en: string) => (lang === "de" ? de : en);

  useEffect(() => {
    if (app.paletteOpen) {
      setQ("");
      setIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [app.paletteOpen]);

  const rows = useMemo<Row[]>(() => {
    const query = q.trim().toLowerCase();
    const isLeitung = app.user.role === "leitung";
    const pages: Row[] = [
      { kind: "page", id: "p0", label: t("nav.dashboard"), hint: hintFor("Übersicht mit Kennzahlen", "Overview with KPIs"), href: "/", icon: LayoutDashboard },
      { kind: "page", id: "p1", label: t("nav.tagesliste"), hint: hintFor("Priorisierte Empfehlungen für heute", "Today's prioritized recommendations"), href: "/tagesliste", icon: ListChecks },
      { kind: "page", id: "p2", label: t("nav.verlauf"), hint: hintFor("Abwanderung bisher und Potenzial", "Churn so far and potential"), href: "/verlauf", icon: History },
      { kind: "page", id: "p2", label: t("kunden.titel"), hint: hintFor("Kunden suchen und öffnen", "Search and open customers"), href: "/kunden", icon: Users },
      { kind: "page", id: "p3", label: t("nav.messmittel"), hint: hintFor("Fälligkeiten und Status", "Due dates and status"), href: "/messmittel", icon: Ruler },
      { kind: "page", id: "p4", label: t("nav.angebote"), hint: hintFor("Entwürfe und PDF", "Drafts and PDF"), href: "/angebote", icon: FileText },
      ...(isLeitung
        ? [
            { kind: "page" as const, id: "p5", label: t("cockpit.titel"), hint: hintFor("Prognose, Risiko und Team", "Forecast, risk and team"), href: "/cockpit", icon: ChartColumn },
            { kind: "page" as const, id: "p6", label: t("modell.titel"), hint: hintFor("Modelle und Datenqualität", "Models and data quality"), href: "/modellguete", icon: ShieldCheck },
            { kind: "page" as const, id: "p7", label: t("einst.titel"), hint: hintFor("Anzeige und Stichtag", "Display and reference date"), href: "/einstellungen", icon: Settings },
          ]
        : []),
    ];

    const actions: Row[] = [
      {
        kind: "action",
        id: "a1",
        label: t("assistent.titel"),
        hint: hintFor("Fragen zu Kunden und Prognosen", "Questions on customers and forecasts"),
        run: () => app.setAssistantOpen(true),
      },
      ...(app.selectedKunde
        ? [
            {
              kind: "action" as const,
              id: "a3",
              label: `${t("akt.angebot")} · Kunde ${app.selectedKunde}`,
              hint: hintFor("Entwurf aus fälligen Messmitteln", "Draft from due instruments"),
              run: () => {
                const id = app.createDraft(app.selectedKunde!);
                router.push(`/angebote/${id}`);
              },
            },
          ]
        : []),
    ];

    if (!query) return [...pages, ...actions];

    const pagesF = pages.filter((p) => p.label.toLowerCase().includes(query) || p.hint.includes(query));
    const actionsF = actions.filter((p) => p.label.toLowerCase().includes(query));

    const kunden: Row[] = [];
    /* real Kundennummern zuerst (Dashboard/Kunden-Seiten), dann Demo-Modell */
    if (realRows) {
      for (const r of realRows) {
        if (kunden.length >= 4) break;
        if (r.kunde.includes(query)) {
          kunden.push({
            kind: "kunde-real",
            id: `r${r.kunde}`,
            label: lang === "de" ? `Kunde ${r.kunde}` : `Customer ${r.kunde}`,
            hint: `${r.branche} · ${r.ueberfaellig} ${lang === "de" ? "überfällig" : "overdue"}`,
            href: `/kunden/${r.kunde}`,
            nummer: r.kunde,
          });
        }
      }
    }
    for (const k of getKunden()) {
      if (kunden.length >= 7) break;
      const num = k.nummer.toLowerCase().includes(query);
      const name = k.name.toLowerCase().includes(query);
      if (num || name) {
        kunden.push({
          kind: "kunde",
          id: `k${k.id}`,
          label: k.name,
          hint: `Kunde ${k.nummer} · ${k.branche}`,
          href: `/kunden/${k.id}`,
          kunde: k,
        });
      }
    }

    return [...kunden, ...pagesF, ...actionsF];
  }, [q, t, lang, app, app.selectedKunde, realRows]);

  // simple fuzzy-ish score reorder for exact prefix matches
  const ordered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return [...rows].sort((a, b) => score(b, query) - score(a, query));
  }, [rows, q]);

  useEffect(() => setIdx(0), [q]);

  if (!app.paletteOpen) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, ordered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = ordered[idx];
      if (!row) return;
      app.setPaletteOpen(false);
      if (row.kind === "action") row.run();
      else router.push(row.href);
    } else if (e.key === "Escape") {
      app.setPaletteOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[14vh] px-4 anim-fade-in no-print">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-[3px]" onClick={() => app.setPaletteOpen(false)} />
      <div className="cmdk relative w-full max-w-xl bg-surface-0 rounded-[16px] shadow-pop border border-line overflow-hidden anim-pop">
        <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-line focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/15 transition-all">
          <Search size={16} className="text-[#2563eb] shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("palette.placeholder")}
            style={{ outline: "none" }}
            className="flex-1 min-w-0 bg-transparent text-[15px] placeholder:text-ink-3"
          />
          <span className="text-[11px] font-semibold text-ink-3 bg-surface-1 border border-line rounded-md px-1.5 py-0.5 shrink-0">Esc</span>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {ordered.length === 0 && (
            <p className="px-3 py-6 text-center text-ink-3 text-[13px]">{t("common.keineTreffer")}</p>
          )}
          {ordered.map((row, i) => {
            const Icon = row.kind === "page" ? row.icon : row.kind === "action" ? Sparkles : Users;
            return (
              <button
                key={row.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => {
                  app.setPaletteOpen(false);
                  if (row.kind === "action") row.run();
                  else router.push(row.href);
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left transition-colors",
                  i === idx ? "bg-blue-50/80 ring-1 ring-[#2563eb]/20" : "hover:bg-surface-1",
                )}
              >
                <span
                  className={clsx(
                    "w-8 h-8 rounded-[10px] grid place-items-center shrink-0 transition-colors",
                    row.kind === "kunde" || row.kind === "kunde-real"
                      ? "bg-brand-50 text-brand-700"
                      : i === idx
                        ? "bg-[#2563eb] text-white"
                        : "bg-surface-1 text-ink-2",
                  )}
                >
                  <Icon size={15} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink truncate">{row.label}</span>
                  <span className="block text-[11.5px] text-ink-3 truncate">{row.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function score(row: Row, query: string): number {
  const label = row.label.toLowerCase();
  if (row.kind === "kunde" && row.kunde.nummer.toLowerCase().startsWith(query)) return 3;
  if (row.kind === "kunde-real" && row.nummer.toLowerCase().startsWith(query)) return 3;
  if (label.startsWith(query)) return 2;
  if (label.includes(query)) return 1;
  return 0;
}
