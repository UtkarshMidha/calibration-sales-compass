"use client";

/* PeCal Kompass design system — precise, calm, metrology-flavoured. */

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type { Anlass, MessmittelStatus, Prioritaet } from "@/lib/data";
import type { Lang } from "@/lib/format";
import { num } from "@/lib/format";

/* ----------------------------- primitives ----------------------------- */

export function Btn({
  children,
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "dark" | "danger";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-all duration-150 select-none disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "h-7 px-2.5 text-[12px]", md: "h-9 px-3.5 text-[13px]" }[size];
  const variants = {
    primary: "bg-brand-700 text-white hover:bg-[#9c4200] active:translate-y-px shadow-[0_6px_16px_-8px_rgba(184,78,0,.7)]",
    secondary: "bg-surface-0 text-ink border border-line-strong hover:bg-surface-1 hover:border-ink-3 active:translate-y-px shadow-[0_1px_2px_rgba(16,41,58,.06)]",
    ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
    dark: "bg-navy-800 text-white hover:bg-navy-700 active:translate-y-px shadow-[0_6px_16px_-10px_rgba(11,30,44,.8)]",
    danger: "bg-critical text-white hover:brightness-90 active:translate-y-px",
  }[variant];
  return (
    <button className={clsx(base, sizes, variants, className)} {...rest}>
      {children}
    </button>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "ok" | "due" | "overdue" | "violet" | "azure" | "navy";
  className?: string;
  title?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2 border-line",
    brand: "bg-brand-50 text-brand-700 border-brand-100",
    ok: "bg-[#e7f6ef] text-[#1c6e4a] border-[#c4e8d8]",
    due: "bg-[#fdf3dc] text-[#8a5d00] border-[#f2e0b0]",
    overdue: "bg-[#fdece4] text-overdue border-[#f7d3c2]",
    violet: "bg-[#efeafe] text-[#5936c9] border-[#ddd3fb]",
    azure: "bg-azure-100 text-azure-800 border-[#c4e2f7]",
    navy: "bg-navy-800/8 text-navy-800 border-navy-800/20",
  }[tone];
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 h-[20px] text-[11.5px] font-semibold leading-none",
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

export const ANLASS_TONE: Record<Anlass, "overdue" | "due" | "violet" | "azure" | "ok"> = {
  ueberfaellig: "overdue",
  faellig_bald: "due",
  abwanderung: "violet",
  branche: "azure",
  portal: "ok",
};

export function PrioritaetsBadge({ p, lang }: { p: Prioritaet; lang?: Lang }) {
  const label =
    p === "hoch" ? (lang === "en" ? "High" : "Hoch") : p === "mittel" ? (lang === "en" ? "Medium" : "Mittel") : lang === "en" ? "Low" : "Niedrig";
  if (p === "hoch")
    return (
      <span className="inline-flex items-center h-[20px] px-2 rounded-[5px] bg-brand-700 text-white text-[10.5px] font-bold tracking-[0.08em] uppercase">
        {label}
      </span>
    );
  if (p === "mittel")
    return (
      <span className="inline-flex items-center h-[20px] px-2 rounded-[5px] border border-navy-800/40 text-navy-800 text-[10.5px] font-bold tracking-[0.08em] uppercase">
        {label}
      </span>
    );
  return (
    <span className="inline-flex items-center h-[20px] px-2 rounded-[5px] border border-line-strong text-ink-3 text-[10.5px] font-bold tracking-[0.08em] uppercase">
      {label}
    </span>
  );
}

export const STATUS_META: Record<MessmittelStatus, { de: string; en: string; dot: string; text: string }> = {
  ok: { de: "Ok", en: "Ok", dot: "#2F9E6E", text: "text-[#1c6e4a]" },
  faellig_bald: { de: "Fällig bald", en: "Due soon", dot: "#B97A00", text: "text-[#8a5d00]" },
  ueberfaellig: { de: "Überfällig", en: "Overdue", dot: "#D9480F", text: "text-overdue" },
  teilabwanderung: { de: "Teilabwanderung", en: "Partial churn", dot: "#C92A2A", text: "text-critical" },
  gestoppt: { de: "Gestoppt", en: "Stopped", dot: "#6D7378", text: "text-ink-3" },
  nio: { de: "n.i.O.", en: "Failed", dot: "#7048E8", text: "text-violet" },
};

export function StatusPill({ status, lang }: { status: MessmittelStatus; lang?: Lang }) {
  const m = STATUS_META[status];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-[12px] font-medium", m.text)}>
      <span className="w-[7px] h-[7px] rounded-full" style={{ background: m.dot }} />
      {lang === "en" ? m.en : m.de}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span
      title="Fiktive Stammdaten für die Demo / Fictitious master data"
      className="inline-flex items-center h-[18px] px-1.5 rounded border border-dashed border-ink-3/50 text-ink-3 text-[10px] font-bold uppercase tracking-wider"
    >
      Demo
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  actions,
  hint,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
  hint?: string;
}) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.09em] text-ink-2">{title}</h2>
            {hint && <p className="text-[12px] text-ink-3 mt-0.5">{hint}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-[7px] border border-line bg-surface-1 p-[2px] gap-[2px]">
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            "h-[26px] px-2.5 rounded-[5px] text-[12px] font-semibold transition-colors",
            o.value === value ? "bg-surface-0 text-ink shadow-[0_1px_2px_rgba(16,41,58,.12)]" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-[6px] flex-1 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tnum text-[12px] text-ink-2 font-semibold">{label}</span>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 anim-fade-in no-print">
      <div className="absolute inset-0 bg-navy-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className={clsx(
          "relative bg-surface-0 rounded-[14px] shadow-pop border border-line anim-pop w-full overflow-hidden",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h2 className="text-[15px] font-bold text-navy-800">{title}</h2>
          <button onClick={onClose} aria-label="Close / Schließen" className="text-ink-3 hover:text-ink p-1 rounded hover:bg-surface-2">
            <X size={16} />
          </button>
        </header>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-12 h-12 rounded-full bg-surface-2 border border-line grid place-items-center mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-brand" />
      </div>
      <p className="text-[15px] font-semibold text-navy-800">{title}</p>
      {hint && <p className="text-[13px] text-ink-3 mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ----------------------------- signature: Fälligkeits-Zeitstrahl ----------------------------- */

export interface ZeitstrahlBucket {
  key: string;
  ueberfaellig: number;
  faellig: number;
  erwartet: number;
}

export function Zeitstrahl({
  buckets,
  stichtag,
  lang = "de",
  compact = false,
}: {
  buckets: ZeitstrahlBucket[];
  stichtag: string;
  lang?: Lang;
  compact?: boolean;
}) {
  if (buckets.length === 0) return null;
  const needleIdx = Math.max(0, buckets.findIndex((b) => b.key >= stichtag.slice(0, 7)));
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.ueberfaellig + b.faellig, b.erwartet)));
  const height = compact ? 64 : 104;
  const sumOver = buckets.reduce((s, b) => s + b.ueberfaellig, 0);
  const sumDue = buckets.reduce((s, b) => s + b.faellig, 0);
  const L = {
    over: lang === "en" ? "Overdue" : "Überfällig",
    due: lang === "en" ? "Due" : "Fällig",
    erw: lang === "en" ? "Expected" : "Erwartet",
    heute: lang === "en" ? "Today" : "Heute",
  };

  const monthShort = (key: string) => {
    const m = key.slice(5, 7);
    const names = lang === "en"
      ? { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" }
      : { "01": "Jan", "02": "Feb", "03": "Mär", "04": "Apr", "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dez" };
    return (names as Record<string, string>)[m] ?? m;
  };

  return (
    <div className="select-none">
      <div className="relative rounded-[10px] bg-gradient-to-b from-surface-1 to-surface-0 border border-line/70 px-2 pt-2" style={{ height: height + 34 }}>
        {/* gridlines */}
        {[0.33, 0.66].map((f) => (
          <div key={f} className="absolute left-2 right-2 border-t border-dashed border-line" style={{ top: 8 + f * height }} />
        ))}
        <div className="relative flex items-end gap-[4px]" style={{ height }}>
          {buckets.map((b, i) => {
            const over = b.ueberfaellig;
            const due = b.faellig;
            const hOver = (over / max) * (height - 6);
            const hDue = (due / max) * (height - 6);
            const hErw = (b.erwartet / max) * (height - 6);
            const isNeedle = i === needleIdx;
            const title = `${b.key}: ${num(over)} ${L.over.toLowerCase()}, ${num(due)} ${L.due.toLowerCase()}, ≈${Math.round(b.erwartet)} ${L.erw.toLowerCase()}`;
            return (
              <div key={b.key} title={title} className="relative flex-1 h-full flex flex-col justify-end">
                <div
                  className="bar-grow w-full rounded-[4px] overflow-hidden flex flex-col justify-end"
                  style={{ height: Math.max(hOver + hDue, 2), animationDelay: `${Math.min(i * 35, 600)}ms` }}
                >
                  {hDue > 0 && (
                    <div style={{ height: `${(hDue / Math.max(hOver + hDue, 0.01)) * 100}%`, background: "linear-gradient(180deg,#fbbf24,#d97706)" }} />
                  )}
                  {hOver > 0 && (
                    <div style={{ height: `${(hOver / Math.max(hOver + hDue, 0.01)) * 100}%`, background: "linear-gradient(180deg,#f87171,#dc2626)", opacity: isNeedle || i < needleIdx ? 1 : 0.85 }} />
                  )}
                </div>
                {hErw > 1 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 w-[7px] h-[7px] rounded-full bg-[#3b9ee3] ring-2 ring-white shadow"
                    style={{ bottom: Math.min(hErw, height - 8) }}
                  />
                )}
                {isNeedle && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-brand px-1.5 py-px text-[8.5px] font-bold text-white shadow whitespace-nowrap">
                    {L.heute}
                  </span>
                )}
              </div>
            );
          })}
          {/* Stichtag needle */}
          <div
            className="absolute top-[-4px] bottom-0 border-l-2 border-dashed pointer-events-none"
            style={{ left: `calc(${(needleIdx / buckets.length) * 100}% )`, borderColor: "var(--color-brand)" }}
          />
        </div>
        {/* month labels */}
        <div className="flex gap-[4px] mt-1">
          {buckets.map((b, i) => {
            const show = compact ? i % 3 === 0 || i === needleIdx : true;
            const jan = b.key.endsWith("-01");
            return (
              <div key={b.key} className="flex-1 min-w-0 text-center leading-none">
                {show && (
                  <>
                    <span className={i === needleIdx ? "text-[9.5px] font-bold text-brand-700" : "text-[9.5px] text-ink-3"}>
                      {monthShort(b.key)}
                    </span>
                    {jan && !compact && <span className="block text-[8px] text-ink-3/70 tnum">’{b.key.slice(2, 4)}</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap text-[10.5px] text-ink-2">
        <LegendPill color="linear-gradient(180deg,#f87171,#dc2626)" label={`${L.over} · ${num(sumOver)}`} />
        <LegendPill color="linear-gradient(180deg,#fbbf24,#d97706)" label={`${L.due} · ${num(sumDue)}`} />
        <LegendPill color="#3b9ee3" dot label={L.erw} />
      </div>
    </div>
  );
}

function LegendPill({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-0 px-2 py-[3px] font-semibold">
      <span className={dot ? "w-2 h-2 rounded-full" : "w-2.5 h-2.5 rounded-[3px]"} style={{ background: color }} />
      {label}
    </span>
  );
}

/* ----------------------------- signature: Risiko-Messuhr ----------------------------- */

export function Gauge({
  value,
  band,
  size = 132,
  label,
}: {
  value: number;
  band: "niedrig" | "mittel" | "hoch";
  size?: number;
  label?: string;
}) {
  const r = 52;
  const cx = 64;
  const cy = 60;
  const start = Math.PI * 0.86;
  const end = Math.PI * 2.14;
  const angle = start + (end - start) * value;
  const color = band === "hoch" ? "var(--color-critical)" : band === "mittel" ? "var(--color-due)" : "var(--color-ok)";
  /* Math.cos/sin differ by a few ULPs between Node and Chrome – round so SSR
   * and client hydration produce byte-identical path/attribute strings. */
  const n = (v: number) => Math.round(v * 100) / 100;

  const arc = (from: number, to: number, radius: number) => {
    const x1 = n(cx + radius * Math.cos(from));
    const y1 = n(cy + radius * Math.sin(from));
    const x2 = n(cx + radius * Math.cos(to));
    const y2 = n(cy + radius * Math.sin(to));
    const large = to - from > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center" title={label ? `${label}: ${Math.round(value * 100)} %` : undefined}>
      <svg width={size} height={size * 0.82} viewBox="0 0 128 104" aria-hidden>
        <path d={arc(start, end, r)} fill="none" stroke="var(--color-surface-3)" strokeWidth="9" strokeLinecap="round" />
        <path d={arc(start, angle, r)} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
        {/* ticks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = start + ((end - start) * i) / 10;
          const inner = r - 7;
          const outer = r + 7;
          return (
            <line
              key={i}
              x1={n(cx + inner * Math.cos(a))}
              y1={n(cy + inner * Math.sin(a))}
              x2={n(cx + outer * Math.cos(a))}
              y2={n(cy + outer * Math.sin(a))}
              stroke="var(--color-line-strong)"
              strokeWidth={i % 5 === 0 ? 1.6 : 0.9}
            />
          );
        })}
        {/* needle */}
        <line
          x1={n(cx + (r - 16) * Math.cos(angle))}
          y1={n(cy + (r - 16) * Math.sin(angle))}
          x2={n(cx + (r + 4) * Math.cos(angle))}
          y2={n(cy + (r + 4) * Math.sin(angle))}
          stroke="var(--color-navy-900)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill="var(--color-navy-900)" />
        <text x={cx} y={cy + 30} textAnchor="middle" className="tnum" fontSize="22" fontWeight="700" fill="var(--color-navy-800)">
          {Math.round(value * 100)} %
        </text>
      </svg>
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
        {band === "hoch" ? "hoch" : band === "mittel" ? "mittel" : "niedrig"}
      </span>
    </div>
  );
}

/* ----------------------------- signature: Prognose-Sparkline ----------------------------- */

export function Sparkline({
  data,
  height = 170,
  showBaseline,
  lang = "de",
}: {
  data: { monat: string; historie: boolean; kalibrierungen: number; p10: number; p90: number; baseline?: number }[];
  height?: number;
  showBaseline?: boolean;
  lang?: Lang;
}) {
  const w = 760;
  const h = height;
  const pad = { l: 38, r: 8, t: 10, b: 20 };
  const values = data.flatMap((d) => [d.kalibrierungen, d.p10, ...(showBaseline && d.baseline ? [d.baseline] : [])]);
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.05;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

  const hist = data.filter((d) => d.historie);
  const fore = data.filter((d) => !d.historie);
  const histPath = hist.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.kalibrierungen)}`).join(" ");
  const foreStart = hist.length - 1;
  const forePath = fore
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(foreStart + i)} ${y(d.kalibrierungen)}`)
    .join(" ");
  const band = [
    ...fore.map((d, i) => `${i === 0 ? "M" : "L"} ${x(foreStart + i)} ${y(d.p90)}`),
    ...[...fore].reverse().map((d, i) => `L ${x(foreStart + fore.length - 1 - i)} ${y(d.p10)}`),
    "Z",
  ].join(" ");
  const basePath = fore
    .filter((d) => d.baseline != null)
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(foreStart + i)} ${y(d.baseline!)}`)
    .join(" ");

  const splitX = x(foreStart);
  const ticks = [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={lang === "en" ? "Forecast chart" : "Prognosediagramm"}>
      <defs>
        <linearGradient id="spark-hist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c3b51" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#1c3b51" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spark-fore" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b9ee3" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.l}
          x2={w - pad.r}
          y1={pad.t + f * (h - pad.t - pad.b)}
          y2={pad.t + f * (h - pad.t - pad.b)}
          stroke="var(--color-line)"
          strokeDasharray={f === 1 ? "" : "2 4"}
        />
      ))}
      {[max, (max + min) / 2, min].map((v, i) => (
        <text key={i} x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" className="tnum" fill="var(--color-ink-3)">
          {Math.round(v / 1000)}k
        </text>
      ))}
      {/* forecast region */}
      <rect x={splitX} y={pad.t} width={w - pad.r - splitX} height={h - pad.t - pad.b} fill="var(--color-azure-100)" opacity="0.5" rx="6" />
      <path d={band} fill="var(--color-azure)" opacity="0.2" />
      {showBaseline && basePath && <path d={basePath} fill="none" stroke="var(--color-ink-3)" strokeWidth="1.2" strokeDasharray="5 4" />}
      <path d={`${histPath} L ${x(hist.length - 1)} ${h - pad.b} L ${x(0)} ${h - pad.b} Z`} fill="url(#spark-hist)" />
      <path d={histPath} fill="none" stroke="var(--color-navy-800)" strokeWidth="2.2" strokeLinecap="round" />
      <path d={forePath} fill="none" stroke="url(#spark-fore)" strokeWidth="2.6" strokeDasharray="7 4" strokeLinecap="round" />
      <line x1={splitX} x2={splitX} y1={pad.t} y2={h - pad.b} stroke="var(--color-brand)" strokeWidth="1.4" strokeDasharray="3 3" />
      <circle cx={splitX} cy={y(data[foreStart]?.kalibrierungen ?? min)} r="3.5" fill="var(--color-brand)" stroke="#fff" strokeWidth="1.5" />
      <text x={splitX + 6} y={pad.t + 10} fontSize="9.5" fontWeight="700" fill="var(--color-brand-700)">
        {lang === "en" ? "Forecast" : "Prognose"}
      </text>
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="9.5" className="tnum" fill="var(--color-ink-3)">
          {data[i]?.monat.slice(2)}
        </text>
      ))}
    </svg>
  );
}

/* ----------------------------- factor bars (Warum?-Popover) ----------------------------- */

export function FactorBars({
  items,
  lang,
}: {
  items: { label: string; anteil: number; detail?: string }[];
  lang?: Lang;
}) {
  const max = Math.max(...items.map((i) => i.anteil), 0.01);
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={idx}>
          <div className="flex items-baseline justify-between gap-2 mb-[3px]">
            <span className="text-[12.5px] text-ink font-medium">{it.label}</span>
            <span className="tnum text-[11px] text-ink-3">{Math.round((it.anteil / max) * 100)} %</span>
          </div>
          <div className="h-[7px] rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(it.anteil / max) * 100}%`,
                background:
                  idx === 0
                    ? "linear-gradient(90deg, var(--color-brand-700), var(--color-brand))"
                    : "linear-gradient(90deg, var(--color-navy-700), var(--color-navy-600))",
              }}
            />
          </div>
          {it.detail && <p className="text-[11.5px] text-ink-3 mt-1">{it.detail}</p>}
        </div>
      ))}
      <p className="text-[11px] text-ink-3 pt-1 border-t border-line">
        {lang === "en" ? "Relative contribution to the score." : "Anteil am Score, sortiert nach Wirkung."}
      </p>
    </div>
  );
}
