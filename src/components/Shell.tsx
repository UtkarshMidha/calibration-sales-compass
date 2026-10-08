"use client";

import clsx from "clsx";
import {
  ChartColumn,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  Ruler,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { USERS } from "@/lib/data";
import { dateWeekday, kw, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useDashboard } from "@/lib/real-data";
import { useApp } from "@/lib/store";
import { Btn, Kbd, Modal, Segmented } from "./ui";

function pageTitle(pathname: string, t: ReturnType<typeof useI18n>["t"]): string {
  if (pathname === "/") return t("nav.dashboard");
  if (pathname.startsWith("/tagesliste")) return t("nav.tagesliste");
  if (pathname.startsWith("/verlauf")) return t("nav.verlauf");
  if (pathname.startsWith("/kunden/")) return `${t("nav.kunden")} · 360`;
  if (pathname.startsWith("/kunden")) return t("kunden.titel");
  if (pathname.startsWith("/messmittel")) return t("nav.messmittel");
  if (pathname.startsWith("/angebote")) return t("nav.angebote");
  if (pathname.startsWith("/cockpit")) return t("cockpit.titel");
  if (pathname.startsWith("/modellguete")) return t("modell.titel");
  if (pathname.startsWith("/einstellungen")) return t("einst.titel");
  return t("app.name");
}

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [userMenu, setUserMenu] = useState(false);
  const isLeitung = app.user.role === "leitung";

  /* global shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setPaletteOpen(!app.paletteOpen);
        return;
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        app.setAssistantOpen(!app.assistantOpen);
        return;
      }
      if (typing) return;
      if (e.key === "?") {
        e.preventDefault();
        app.setHelpOpen(true);
      }
      if (e.key === "Escape") {
        app.setPaletteOpen(false);
        app.setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app]);

  const arbeit = [
    { href: "/", icon: LayoutDashboard, key: "nav.dashboard" as const, match: (p: string) => p === "/" },
    { href: "/tagesliste", icon: ListChecks, key: "nav.tagesliste" as const, match: (p: string) => p.startsWith("/tagesliste") },
    { href: "/verlauf", icon: History, key: "nav.verlauf" as const, match: (p: string) => p.startsWith("/verlauf") },
    { href: "/kunden", icon: Users, key: "nav.kunden" as const, match: (p: string) => p.startsWith("/kunden") },
    { href: "/messmittel", icon: Ruler, key: "nav.messmittel" as const, match: (p: string) => p.startsWith("/messmittel") },
    { href: "/angebote", icon: FileText, key: "nav.angebote" as const, match: (p: string) => p.startsWith("/angebote") },
  ];
  const leitung = [
    { href: "/cockpit", icon: ChartColumn, key: "nav.cockpit" as const, match: (p: string) => p.startsWith("/cockpit") },
  ];
  const system = [
    { href: "/modellguete", icon: ShieldCheck, key: "nav.vertrauen" as const, match: (p: string) => p.startsWith("/modellguete") },
    { href: "/einstellungen", icon: SettingsIcon, key: "nav.einstellungen" as const, match: (p: string) => p.startsWith("/einstellungen") },
  ];

  const renderItem = (item: { href: string; icon: typeof Users; key: Parameters<typeof t>[0]; match: (p: string) => boolean }) => {
    const Icon = item.icon;
    const active = item.match(pathname);
    /* offene Tagesquote = Kapazität minus erledigte (Badge folgt dem Fortschritt) */
    const remaining = app.settings.kapazitaet - Object.keys(app.done).length;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "navitem flex items-center gap-2.5 rounded-[8px] px-3 h-9 text-[13.5px] font-semibold",
          active
            ? "bg-navy-800 text-white shadow-[0_6px_14px_-8px_rgba(11,30,44,.7)]"
            : "text-ink-2 hover:bg-surface-1 hover:text-ink",
        )}
      >
        <Icon size={17} strokeWidth={active ? 2.2 : 1.9} className={clsx(active ? "text-white" : "text-ink-3")} />
        <span className="truncate">{t(item.key)}</span>
        {item.href === "/tagesliste" && !active && remaining > 0 && (
          <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-critical text-white text-[11px] font-bold grid place-items-center tnum">
            {remaining}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ---------------- light sidebar ---------------- */}
      <aside className="w-[248px] shrink-0 bg-white border-r border-line hidden md:flex flex-col no-print">
        <div className="px-4 pt-4 pb-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[10px] bg-navy-800 grid place-items-center shrink-0">
              <Sparkles size={17} className="text-white" />
            </span>
            <span className="leading-tight">
              <span className="block text-[14.5px] font-bold tracking-tight text-navy-800">PeCal Kompass</span>
              <span className="block text-[11px] text-ink-3 font-medium">{t("app.unter")}</span>
            </span>
          </Link>
          <button
            onClick={() => app.setPaletteOpen(true)}
            title={lang === "de" ? "Suchen (Strg+K)" : "Search (Ctrl+K)"}
            className="mt-3.5 w-full flex items-center gap-2 h-9 pl-3 pr-2 rounded-[8px] bg-surface-1 border border-line hover:border-line-strong hover:bg-surface-2 transition-colors text-ink-3 hover:text-ink"
          >
            <Search size={14} className="shrink-0" />
            <span className="text-[12.5px] flex-1 text-left font-medium">{t("header.suche")}</span>
            <Kbd>⌘K</Kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
          <div>
            <p className="px-2 mb-1.5 section-label">{t("nav.arbeit")}</p>
            <div className="space-y-1">{arbeit.map(renderItem)}</div>
          </div>
          {isLeitung && (
            <div>
              <p className="px-2 mb-1.5 section-label">{t("nav.leitung")}</p>
              <div className="space-y-1">{leitung.map(renderItem)}</div>
            </div>
          )}
          {isLeitung && (
            <div>
              <p className="px-2 mb-1.5 section-label">{t("nav.system")}</p>
              <div className="space-y-1">
                {system.map((item) => {
                  const Icon = item.icon;
                  const active = item.match(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "navitem flex items-center gap-2.5 rounded-[8px] px-3 h-9 text-[13px] font-medium",
                        active ? "bg-navy-800 text-white" : "text-ink-2 hover:bg-surface-1 hover:text-ink",
                      )}
                    >
                      <Icon size={16} className={clsx(active ? "text-white" : "text-ink-3")} />
                      <span className="truncate">{t(item.key)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 space-y-2.5 border-t border-line">
          <div className="rounded-[8px] bg-surface-1 border border-line px-3 py-2.5 flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-ok shrink-0" />
            <Datenstand />
          </div>
          <div className="relative">
            <button
              onClick={() => setUserMenu((v) => !v)}
              className="w-full flex items-center gap-2.5 rounded-[8px] hover:bg-surface-1 transition-colors px-2 py-2"
            >
              <span className="w-8 h-8 rounded-full bg-navy-800 text-white grid place-items-center text-[12px] font-bold shrink-0">
                {app.user.kurz.split(" ").map((x) => x[0]).join("").replace(".", "").slice(0, 2)}
              </span>
              <span className="text-left leading-tight min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-ink truncate">{t(app.user.nameKey)}</span>
                <span className="block text-[11px] text-ink-3">
                  {app.user.role === "inside" ? t("header.rolle.inside") : t("header.rolle.leitung")}
                </span>
              </span>
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserMenu(false)} />
                <div className="absolute left-0 right-0 bottom-[52px] z-40 card shadow-pop p-1.5 anim-pop no-print">
                  <p className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
                    {t("header.wechseln")}
                  </p>
                  {USERS.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        app.setUser(u.id);
                        setUserMenu(false);
                        if (u.role === "leitung") router.push("/cockpit");
                        else router.push("/");
                      }}
                      className={clsx(
                        "w-full text-left px-2 py-2 rounded-[10px] text-[13px] flex items-center justify-between hover:bg-surface-1",
                        u.id === app.user.id ? "font-bold text-navy-800" : "text-ink",
                      )}
                    >
                      <span>{t(u.nameKey)}</span>
                      <span className="text-[11px] text-ink-3">
                        {u.role === "inside" ? t("header.rolle.inside") : t("header.rolle.leitung")}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ---------------- main column ---------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white/90 backdrop-blur border-b border-line flex items-center gap-3 px-6 no-print">
          <h1 className="text-[15px] font-bold text-navy-800 whitespace-nowrap">{pageTitle(pathname, t)}</h1>

          <span className="hidden sm:inline-flex items-center gap-2 h-7 pl-2.5 pr-3 rounded-full bg-surface-1 border border-line text-[12px] text-ink-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-[pulse-soft_2.4s_ease-in-out_infinite]" />
            <span className="text-ink-3 font-semibold uppercase text-[10px] tracking-wider">{t("header.stichtag")}</span>
            <span className="tnum font-semibold text-navy-800">
              {dateWeekday(app.stichtag, lang === "de" ? "de-DE" : "en-GB")} · KW {kw(app.stichtag)}
            </span>
          </span>

          <div className="flex-1" />

          <button
            onClick={() => app.setAssistantOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-navy-800 text-white text-[12.5px] font-semibold hover:bg-navy-700 transition-colors"
          >
            <Sparkles size={14} className="text-brand-100" /> {t("assistent.titel")}
          </button>

          <Segmented
            value={lang}
            onChange={(v) => app.setLang(v)}
            options={[
              { value: "de", label: "DE", title: "Deutsch" },
              { value: "en", label: "EN", title: "English" },
            ]}
          />
        </header>

        {/* mobile nav */}
        <nav className="md:hidden shrink-0 bg-white border-b border-line flex items-center gap-1 px-3 py-2 overflow-x-auto no-print">
          {[
            { href: "/", label: t("nav.dashboard") },
            { href: "/tagesliste", label: t("nav.tagesliste") },
            { href: "/verlauf", label: t("nav.verlauf") },
            { href: "/kunden", label: t("kunden.titel") },
            { href: "/messmittel", label: t("nav.messmittel") },
            { href: "/angebote", label: t("nav.angebote") },
            ...(isLeitung ? [{ href: "/cockpit", label: t("cockpit.titel") }] : []),
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "h-8 px-3 rounded-[8px] text-[12.5px] font-semibold whitespace-nowrap grid place-items-center transition-colors",
                pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href))
                  ? "bg-navy-800 text-white"
                  : "text-ink-2 hover:bg-surface-1",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>

      {/* ---------------- toasts ---------------- */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center no-print" aria-live="polite">
        {app.toasts.map((toast) => (
          <div key={toast.id} className="anim-fade-up flex items-center gap-3 bg-navy-900 text-white rounded-[12px] pl-4 pr-2 py-2.5 shadow-pop max-w-[min(92vw,480px)]">
            <span className="text-[13px] leading-snug">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.();
                  app.dismissToast(toast.id);
                }}
                className="text-brand font-bold text-[12.5px] hover:underline"
              >
                {toast.actionLabel}
              </button>
            )}
            <button onClick={() => app.dismissToast(toast.id)} aria-label="Close" className="p-1 text-white/50 hover:text-white">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* ---------------- help ---------------- */}
      <Modal open={app.helpOpen} onClose={() => app.setHelpOpen(false)} title={t("help.titel")}>
        <p className="text-[13px] text-ink-2 mb-4">
          {lang === "de"
            ? "Demo-Flow (4–5 Min): Dashboard → Tagesliste → Kunde → Angebot → Cockpit (Leitung) → Assistent."
            : "Demo flow (4–5 min): Dashboard → Daily list → Customer → Quote → Cockpit (management) → Assistant."}
        </p>
        <ul className="space-y-2.5">
          {([
            ["J / K", t("help.jk")],
            ["Enter", t("help.enter")],
            ["Ü", t("help.ue")],
            ["E", t("help.e")],
            ["A", t("help.a")],
            ["D", t("help.d")],
            ["S", t("help.s")],
            ["Strg+K", t("help.k")],
            ["Strg+J", t("help.j2")],
            ["?", t("help.hilfe")],
          ] as const).map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-4 text-[13.5px]">
              <span className="text-ink-2">{label}</span>
              <span className="flex gap-1">
                {key.split(" / ").map((part) => (
                  <Kbd key={part}>{part}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <Btn variant="primary" onClick={() => app.setHelpOpen(false)}>
            {t("common.schliessen")}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

function Datenstand() {
  const { lang } = useI18n();
  const { data: real } = useDashboard();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const n = real?.kpis.ueberfaellig ?? 64915;
  return (
    <div className="leading-tight min-w-0">
      <p className="text-[12px] font-bold text-navy-800">{lang === "de" ? "Datenstand 25.09.2026" : "Data as of 25/09/2026"}</p>
      <p className="tnum text-[11px] text-ink-3">
        {num(n, 0, loc)} {lang === "de" ? "überfällige Messmittel" : "overdue instruments"}
      </p>
    </div>
  );
}
