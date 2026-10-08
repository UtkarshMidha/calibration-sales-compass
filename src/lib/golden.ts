/* Golden set for the assistant: 20 fixed questions, evaluated live against the
 * local answer engine under pinned conditions (default stichtag + settings).
 * Context-dependent questions derive their context at runtime (first list
 * customer, first customer with real gaps), so the set is stable without
 * hardcoding unknowns. A question passes when the answer carries the
 * expected evidence (key phrases + interactive card), not just any text. */

import { answer, type AnswerCtx, type Part } from "./assistant";
import { DEFAULT_EINSTELLUNGEN, getKunde, getKunden, getLuecken, getTagesliste } from "./data";
import { DEFAULT_STICHTAG, type Lang } from "./format";
import type { TFn } from "./i18n";

export interface GoldenResult {
  id: string;
  question: string;
  evidence: string;
  passed: boolean;
}

interface GoldenItem {
  id: string;
  q: { de: string; en: string };
  evidence: { de: string; en: string };
  sel?: "first" | "gappy";
  check: (parts: Part[], text: string) => boolean;
}

const textOf = (parts: Part[]): string =>
  parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n")
    .toLowerCase();

const hasCard = (parts: Part[], type: Part["type"], kind?: string): boolean =>
  parts.some((p) => p.type === type && (kind === undefined || (p as { kind?: string }).kind === kind));

const ITEMS: GoldenItem[] = [
  {
    id: "call-first",
    q: { de: "Wen sollte ich heute zuerst anrufen?", en: "Who should I call first today?" },
    evidence: { de: "Top-Empfehlung + Kundenkarte", en: "Top recommendation + customer card" },
    check: (parts, t) =>
      (t.includes("ich würde mit") && t.includes("erwarteter wert")) ||
      (t.includes("i would start with") && t.includes("expected value")) ||
      hasCard(parts, "empfehlungen"),
  },
  {
    id: "call-list",
    q: { de: "Zeige mir die Tagesliste", en: "Show me the daily list" },
    evidence: { de: "Top-Empfehlung + Kundenkarte", en: "Top recommendation + customer card" },
    check: (parts, t) => t.includes("erwarteter wert") || t.includes("expected value") || hasCard(parts, "empfehlungen"),
  },
  {
    id: "call-prio",
    q: { de: "Wen zuerst anrufen bei hoher Priorität?", en: "Who to call first with high priority?" },
    evidence: { de: "Top-Empfehlung + Kundenkarte", en: "Top recommendation + customer card" },
    check: (parts, t) => t.includes("erwarteter wert") || t.includes("expected value") || hasCard(parts, "empfehlungen"),
  },
  {
    id: "why-list",
    q: { de: "Warum steht dieser Kunde auf der Liste?", en: "Why is this customer on the list?" },
    evidence: { de: "Begründung + Kundenkarte", en: "Reasoning + customer card" },
    sel: "first",
    check: (parts, t) => (t.includes("kunde") || t.includes("customer")) && hasCard(parts, "kunden"),
  },
  {
    id: "volume-dec",
    q: { de: "Wie viel Volumen erwarten wir im Dezember?", en: "How much volume do we expect in December?" },
    evidence: { de: "Monatswert + Prognosekarte", en: "Monthly value + forecast card" },
    check: (parts, t) =>
      (t.includes("erwarten wir") || t.includes("we expect")) &&
      (t.includes("kalibrierungen") || t.includes("calibrations")) &&
      hasCard(parts, "prognose"),
  },
  {
    id: "volume-jun",
    q: { de: "Wie viel Volumen erwarten wir im Juni?", en: "How much volume do we expect in June?" },
    evidence: { de: "Monatswert + Prognosekarte", en: "Monthly value + forecast card" },
    check: (parts, t) =>
      (t.includes("erwarten wir") || t.includes("we expect")) &&
      (t.includes("kalibrierungen") || t.includes("calibrations")) &&
      hasCard(parts, "prognose"),
  },
  {
    id: "volume-next",
    q: { de: "Wie viel Volumen erwarten wir?", en: "How much volume do we expect?" },
    evidence: { de: "Nächster Monat + Prognosekarte", en: "Next month + forecast card" },
    check: (parts, t) =>
      (t.includes("erwarten wir") || t.includes("we expect")) &&
      (t.includes("kalibrierungen") || t.includes("calibrations")) &&
      hasCard(parts, "prognose"),
  },
  {
    id: "overdue",
    q: { de: "Welche Kunden haben viele überfällige Messmittel?", en: "Which customers have many overdue instruments?" },
    evidence: { de: "Top-Liste + Kundenkarte", en: "Top list + customer card" },
    check: (parts, t) =>
      (t.includes("überfälligkeiten") || t.includes("overdue")) &&
      (t.includes("kunden") || t.includes("customers")) &&
      hasCard(parts, "kunden"),
  },
  {
    id: "overdue-industry",
    q: { de: "Zeige überfällige Kunden aus dem Maschinenbau", en: "Show overdue customers in mechanical engineering" },
    evidence: { de: "Branchenfilter + Kundenkarte", en: "Industry filter + customer card" },
    check: (parts, t) =>
      (t.includes("maschinen") || t.includes("machine") || t.includes("overdue") || t.includes("kunden") || t.includes("customers")) &&
      hasCard(parts, "kunden"),
  },
  {
    id: "region-south",
    q: { de: "Welche Kunden im Gebiet Süd haben viele überfällige Messmittel?", en: "Which customers in region South have many overdue instruments?" },
    evidence: { de: "Regionsfilter + Kundenkarte", en: "Region filter + customer card" },
    check: (parts, t) => (t.includes("süd") || t.includes("south")) && hasCard(parts, "kunden"),
  },
  {
    id: "gaps-one",
    q: { de: "Welche Lücken hat dieser Kunde?", en: "Which gaps does this customer have?" },
    evidence: { de: "Fehlende Gruppen + Messmittelkarte", en: "Missing groups + instrument card" },
    sel: "gappy",
    check: (parts, t) => (t.includes("fehlen") || t.includes("missing")) && hasCard(parts, "messmittel"),
  },
  {
    id: "gaps-branches",
    q: { de: "Wo gibt es die größten Branchenlücken?", en: "Where are the biggest industry gaps?" },
    evidence: { de: "Branchen-Ranking + Kundenkarte", en: "Industry ranking + customer card" },
    check: (parts, t) => (t.includes("branchenlücken") || t.includes("industry gaps")) && hasCard(parts, "kunden"),
  },
  {
    id: "gaps-v5",
    q: { de: "Welche Branchenlücken hat dieser Kunde?", en: "Which industry gaps does this customer have?" },
    evidence: { de: "Ohne Auswahl: Aggregat + Kundenkarte", en: "No selection: aggregate + customer card" },
    check: (parts, t) => (t.includes("branchenlücken") || t.includes("industry gaps")) && hasCard(parts, "kunden"),
  },
  {
    id: "quote",
    q: { de: "Erstelle ein Angebot für diesen Kunden", en: "Create a quote for this customer" },
    evidence: { de: "Bestätigungsdialog Angebot", en: "Quote confirmation dialog" },
    sel: "first",
    check: (parts, t) =>
      (t.includes("angebotsentwurf") || t.includes("quote draft")) && hasCard(parts, "confirm", "angebot"),
  },
  {
    id: "email",
    q: { de: "Schreibe eine E-Mail für diesen Kunden", en: "Write an email for this customer" },
    evidence: { de: "Bestätigungsdialog E-Mail", en: "Email confirmation dialog" },
    sel: "first",
    check: (parts, t) =>
      (t.includes("sie-form") || t.includes("formal draft")) && hasCard(parts, "confirm", "email"),
  },
  {
    id: "team-rate",
    q: { de: "Wie ist die Erfolgsquote im Team?", en: "What is the team success rate?" },
    evidence: { de: "Verweis aufs Cockpit", en: "Reference to the cockpit" },
    check: (parts, t) => t.includes("cockpit"),
  },
  {
    id: "team-per-reason",
    q: { de: "Wie hoch ist die Erfolgsquote je Anlass?", en: "What is the success rate per reason?" },
    evidence: { de: "Verweis aufs Cockpit", en: "Reference to the cockpit" },
    check: (parts, t) => t.includes("cockpit"),
  },
  {
    id: "off-topic",
    q: { de: "Wie wird das Wetter morgen?", en: "What will the weather be like tomorrow?" },
    evidence: { de: "Ehrliche Absage statt Erfindung", en: "Honest decline instead of invention" },
    check: (parts, t) => t.includes("keine belastbare zahl") || t.includes("don't have a reliable figure"),
  },
  {
    id: "unknown-customer",
    q: { de: "Warum steht Kunde 99999 auf der Liste?", en: "Why is customer 99999 on the list?" },
    evidence: { de: "Ehrliche Absage statt Erfindung", en: "Honest decline instead of invention" },
    check: (parts, t) => t.includes("keine belastbare zahl") || t.includes("don't have a reliable figure"),
  },
  {
    id: "thanks",
    q: { de: "Danke!", en: "Thanks!" },
    evidence: { de: "Ehrliche Absage statt Erfindung", en: "Honest decline instead of invention" },
    check: (parts, t) => t.includes("keine belastbare zahl") || t.includes("don't have a reliable figure"),
  },
];

export function evaluateGolden(t: TFn, lang: Lang): GoldenResult[] {
  const base: AnswerCtx = {
    stichtag: DEFAULT_STICHTAG,
    settings: DEFAULT_EINSTELLUNGEN,
    lang,
    selectedKunde: null,
    route: "/",
    t,
  };
  const EMPTY = { ergebnisse: {}, wiedervorlagen: {}, done: {} };
  const list = getTagesliste(DEFAULT_STICHTAG, DEFAULT_EINSTELLUNGEN, EMPTY);
  const firstId = list[0]?.kundeId ?? getKunden()[0]?.id ?? null;
  const gappyId = getKunden().find((k) => getLuecken(k.id).some((l) => l.stunden > 0))?.id ?? firstId;

  return ITEMS.map((item) => {
    const ctx =
      item.sel === "gappy"
        ? { ...base, selectedKunde: gappyId }
        : item.sel === "first"
          ? { ...base, selectedKunde: firstId }
          : base;
    let passed = false;
    try {
      const parts = answer(item.q[lang], ctx);
      passed = item.check(parts, textOf(parts));
    } catch {
      passed = false;
    }
    return {
      id: item.id,
      question: item.q[lang],
      evidence: item.evidence[lang],
      passed,
    };
  });
}
