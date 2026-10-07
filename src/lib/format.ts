/* German-first formatting helpers (de-DE default, en-GB when the UI is switched). */

export const STICHTAGE = ["2026-09-25", "2026-03-25"] as const;
export type Stichtag = (typeof STICHTAGE)[number];
export const DEFAULT_STICHTAG: Stichtag = "2026-09-25";

export type Lang = "de" | "en";
export const localeOf = (l: Lang) => (l === "de" ? "de-DE" : "en-GB");

const nf = (loc: string, opts: Intl.NumberFormatOptions) => new Intl.NumberFormat(loc, opts);

export function euro(v: number, loc = "de-DE", approx = true, digits = 0): string {
  const s = nf(loc, {
    style: "currency",
    currency: loc.startsWith("de") ? "EUR" : "GBP",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
  return approx ? `≈ ${s}` : s;
}

export function num(v: number, digits = 0, loc = "de-DE"): string {
  return nf(loc, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

export function pct(v: number, digits = 0, loc = "de-DE"): string {
  return `${nf(loc, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v * 100)} %`;
}

export function date(iso: string, loc = "de-DE"): string {
  return new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

export function dateShort(iso: string, loc = "de-DE"): string {
  return new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

/** "Fr., 25.09.2026" (de) / "Fri, 25/09/2026" (en) */
export function dateWeekday(iso: string, loc = "de-DE"): string {
  const d = new Intl.DateTimeFormat(loc, { weekday: "short" }).format(new Date(`${iso}T00:00:00`));
  const dd = new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${iso}T00:00:00`),
  );
  return `${loc.startsWith("de") ? `${d}.` : d}, ${dd}`;
}

export function monthLabel(iso: string, loc = "de-DE"): string {
  return new Intl.DateTimeFormat(loc, { month: "short", year: "2-digit" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

/** ISO-8601 calendar week */
export function kw(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(`${toIso}T00:00:00`).getTime() - new Date(`${fromIso}T00:00:00`).getTime()) / 86400000,
  );
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`);
  const b = new Date(`${toIso}T00:00:00`);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** First day of the month as YYYY-MM */
export const monthKey = (iso: string) => iso.slice(0, 7);

export function hourMin(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
