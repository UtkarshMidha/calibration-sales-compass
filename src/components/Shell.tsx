"use client";

import clsx from "clsx";
import {
  ChartColumn,
  CircleHelp,
  Command,
  ListChecks,
  Rocket,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { USERS } from "@/lib/data";
import { dateWeekday, kw } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { Btn, Kbd, Modal, Segmented } from "./ui";

const NAV = [
  { href: "/", icon: ListChecks, key: "nav.heute" as const },
  { href: "/kunden", icon: Users, key: "nav.kunden" as const },
  { href: "/cockpit", icon: ChartColumn, key: "nav.cockpit" as const },
  { href: "/modellguete", icon: ShieldCheck, key: "nav.modellguete" as const },
  { href: "/einstellungen", icon: SettingsIcon, key: "nav.einstellungen" as const },
];

function pageTitle(pathname: string, t: ReturnType<typeof useI18n>["t"]): string {
  if (pathname === "/") return t("nav.heute");
  if (pathname.startsWith("/kunden/")) return t("nav.kunden") + " · 360";
  if (pathname.startsWith("/kunden")) return t("kunden.titel");
  if (pathname.startsWith("/angebote")) return t("angebot.titel");
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

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ---------------- nav rail ---------------- */}
      <nav className="w-[92px] shrink-0 bg-navy-900 text-white flex flex-col items-stretch py-3 relative no-print">
        <Link href="/" className="flex flex-col items-center gap-1 px-2 pb-3 mb-1" aria-label="PeCal Kompass">
          <span className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-brand to-brand-700 grid place-items-center shadow-[0_4px_14px_-4px_rgba(255,112,0,.7)]">
            <span className="font-black text-[15px] tracking-tight text-white">PK</span>
          </span>
          <span className="text-[9.5px] font-bold tracking-[0.14em] text-white/50 uppercase">Kompass</span>
        </Link>

        <div className="flex-1 flex flex-col gap-1 px-2">
          {NAV.map(({ href, icon: Icon, key }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "group relative flex flex-col items-center gap-1 rounded-[10px] py-2.5 transition-colors",
                  active ? "bg-white/10 text-white" : "text-white/55 hover:text-white hover:bg-white/[.06]",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && <span className="absolute left-[-8px] top-2 bottom-2 w-[3px] rounded-full bg-brand" />}
                <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[9.5px] font-semibold leading-none">{t(key)}</span>
              </Link>
            );
          })}
        </div>

        <div className="px-2 flex flex-col gap-1 items-center">
          <button
            onClick={() => app.setAssistantOpen(true)}
            title={`${t("assistent.titel")} (Strg+J)`}
            className="w-full flex flex-col items-center gap-1 rounded-[10px] py-2.5 text-white/55 hover:text-white hover:bg-white/[.06] transition-colors"
          >
            <span className="w-[19px] h-[19px] rounded-full bg-brand/90 grid place-items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </span>
            <span className="text-[9.5px] font-semibold leading-none">Assistent</span>
          </button>
          <button
            onClick={() => app.setHelpOpen(true)}
            title={t("help.titel")}
            className="w-full flex flex-col items-center gap-1 rounded-[10px] py-2.5 text-white/45 hover:text-white hover:bg-white/[.06] transition-colors"
          >
            <CircleHelp size={18} />
            <span className="text-[9.5px] font-semibold leading-none">?</span>
          </button>
        </div>
      </nav>

      {/* ---------------- main column ---------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[54px] shrink-0 bg-surface-0 border-b border-line flex items-center gap-3 px-5 no-print">
          <h1 className="text-[15px] font-bold text-navy-800 whitespace-nowrap">{pageTitle(pathname, t)}</h1>

          <span className="hidden sm:inline-flex items-center gap-2 h-[26px] pl-2 pr-2.5 rounded-full bg-surface-1 border border-line text-[11.5px] text-ink-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-[pulse-soft_2.4s_ease-in-out_infinite]" />
            <span className="text-ink-3 font-semibold uppercase text-[9.5px] tracking-wider">{t("header.stichtag")}</span>
            <span className="tnum font-semibold text-navy-800">
              {dateWeekday(app.stichtag, lang === "de" ? "de-DE" : "en-GB")} · KW {kw(app.stichtag)}
            </span>
          </span>

          <div className="flex-1" />

          <button
            onClick={() => app.setPaletteOpen(true)}
            className="group flex items-center gap-2 h-[32px] pl-2.5 pr-2 rounded-[8px] border border-line bg-surface-1 hover:bg-surface-0 hover:border-line-strong transition-colors text-ink-3 min-w-[220px] max-w-[320px]"
          >
            <Command size={13} />
            <span className="text-[12.5px] flex-1 text-left">{t("header.suche")}</span>
            <Kbd>⌘K</Kbd>
          </button>

          <Segmented
            value={lang}
            onChange={(v) => app.setLang(v)}
            options={[
              { value: "de", label: "DE", title: "Deutsch" },
              { value: "en", label: "EN", title: "English" },
            ]}
          />

          <button
            onClick={() => (app.pitch ? app.resetPitch() : app.applyPitch())}
            title={app.pitch ? t("header.pitchReset") : t("header.pitchAn")}
            className={clsx(
              "flex items-center gap-1.5 h-[28px] px-2.5 rounded-full border text-[11.5px] font-bold uppercase tracking-wide transition-colors",
              app.pitch
                ? "bg-brand-700 border-brand-700 text-white"
                : "border-line-strong text-ink-3 hover:text-brand-700 hover:border-brand-700",
            )}
          >
            <Rocket size={13} />
            Pitch
          </button>

          {/* user */}
          <div className="relative">
            <button
              onClick={() => setUserMenu((v) => !v)}
              className="flex items-center gap-2 h-[34px] pl-1 pr-2.5 rounded-full hover:bg-surface-1 transition-colors"
            >
              <span className="w-[26px] h-[26px] rounded-full bg-navy-800 text-white grid place-items-center text-[11px] font-bold">
                {app.user.kurz.split(" ").map((x) => x[0]).join("").replace(".", "").slice(0, 2)}
              </span>
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-[12.5px] font-semibold text-ink">{t(app.user.nameKey)}</span>
                <span className="block text-[10.5px] text-ink-3">
                  {app.user.role === "inside" ? t("header.rolle.inside") : t("header.rolle.leitung")}
                </span>
              </span>
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 top-[40px] z-40 w-60 card shadow-pop p-1.5 anim-pop no-print">
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
                      }}
                      className={clsx(
                        "w-full text-left px-2 py-2 rounded-[7px] text-[13px] flex items-center justify-between hover:bg-surface-1",
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
        </header>

        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>

      {/* ---------------- toasts ---------------- */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center no-print" aria-live="polite">
        {app.toasts.map((toast) => (
          <div key={toast.id} className="anim-fade-up flex items-center gap-3 bg-navy-900 text-white rounded-[10px] pl-4 pr-2 py-2.5 shadow-pop">
            <span className="text-[13px]">{toast.message}</span>
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
        <ul className="space-y-2.5">
          {([
            ["J / K", t("help.jk")],
            ["Enter", t("help.enter")],
            ["Ü", t("help.ue")],
            ["E", t("help.e")],
            ["A", t("help.a")],
            ["D", t("help.d")],
            ["S", t("help.s")],
            ["⌘K / Strg+K", t("help.k")],
            ["⌘J / Strg+J", t("help.j2")],
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
