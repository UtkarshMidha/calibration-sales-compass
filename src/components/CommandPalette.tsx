"use client";

import clsx from "clsx";
import { ChartColumn, ListChecks, Search, Settings, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getKunden, type Kunde } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";

type Row =
  | { kind: "page"; id: string; label: string; hint: string; href: string; icon: typeof ListChecks }
  | { kind: "kunde"; id: string; label: string; hint: string; href: string; kunde: Kunde }
  | { kind: "action"; id: string; label: string; hint: string; run: () => void };

export function CommandPalette() {
  const app = useApp();
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (app.paletteOpen) {
      setQ("");
      setIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [app.paletteOpen]);

  const rows = useMemo<Row[]>(() => {
    const query = q.trim().toLowerCase();
    const pages: Row[] = [
      { kind: "page", id: "p1", label: t("nav.heute"), hint: "/", href: "/", icon: ListChecks },
      { kind: "page", id: "p2", label: t("kunden.titel"), hint: "/kunden", href: "/kunden", icon: Users },
      { kind: "page", id: "p3", label: t("cockpit.titel"), hint: "/cockpit", href: "/cockpit", icon: ChartColumn },
      { kind: "page", id: "p4", label: t("modell.titel"), hint: "/modellguete", href: "/modellguete", icon: ShieldCheck },
      { kind: "page", id: "p5", label: t("einst.titel"), hint: "/einstellungen", href: "/einstellungen", icon: Settings },
    ];

    const actions: Row[] = [
      {
        kind: "action",
        id: "a1",
        label: t("assistent.titel"),
        hint: "⌘J",
        run: () => app.setAssistantOpen(true),
      },
      {
        kind: "action",
        id: "a2",
        label: app.pitch ? t("header.pitchReset") : `${t("header.pitch")} · 25.09.2026`,
        hint: "Pitch",
        run: () => (app.pitch ? app.resetPitch() : app.applyPitch()),
      },
      ...(app.selectedKunde
        ? [
            {
              kind: "action" as const,
              id: "a3",
              label: `${t("akt.angebot")} · Kunde ${app.selectedKunde}`,
              hint: "A",
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
  }, [q, t, app, app.selectedKunde, app.pitch]);

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
      <div className="relative w-full max-w-xl bg-surface-0 rounded-[14px] shadow-pop border border-line overflow-hidden anim-pop">
        <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-line">
          <Search size={16} className="text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("palette.placeholder")}
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-ink-3"
          />
          <span className="kbd">Esc</span>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {ordered.length === 0 && (
            <p className="px-3 py-6 text-center text-ink-3 text-[13px]">{t("common.keineTreffer")}</p>
          )}
          {ordered.map((row, i) => {
            const Icon = row.kind === "page" ? row.icon : row.kind === "kunde" ? Users : Sparkles;
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
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left transition-colors",
                  i === idx ? "bg-surface-2" : "hover:bg-surface-1",
                )}
              >
                <span
                  className={clsx(
                    "w-7 h-7 rounded-[7px] grid place-items-center border",
                    row.kind === "kunde"
                      ? "bg-brand-50 border-brand-100 text-brand-700"
                      : "bg-surface-1 border-line text-ink-2",
                  )}
                >
                  <Icon size={14} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink truncate">{row.label}</span>
                  <span className="block text-[11.5px] text-ink-3 truncate">{row.hint}</span>
                </span>
                {row.kind === "action" ? (
                  <span className="kbd">{row.hint}</span>
                ) : (
                  <span className="text-[11px] text-ink-3">↵</span>
                )}
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
  if (label.startsWith(query)) return 2;
  if (label.includes(query)) return 1;
  return 0;
}
