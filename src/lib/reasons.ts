/* Structured reason codes → plain-language templates (§8.9).
 *
 * Deliberately free of "use client": this module is shared by the UI and by
 * server code (the grounding context for the live LLM assistant). */

import type { Lang } from "./format";

export type ReasonCode =
  | "UEBERFAELLIG"
  | "TEILABWANDERUNG"
  | "FAELLIG_BALD"
  | "RECENCY"
  | "TREND_RUECKGANG"
  | "SPAET_RUECKLAUF"
  | "BRANCHE_LUECKE"
  | "DAKKS_LUECKE"
  | "KANAL_PORTAL_NIE"
  | "KANAL_PORTAL_RUECKGANG"
  | "NIO_ANSTIEG"
  | "STORNO";

const REASON_TEMPLATES: Record<ReasonCode, Record<Lang, string>> = {
  UEBERFAELLIG: {
    de: "{n} Messmittel sind seit durchschnittlich {tage} Tagen überfällig.",
    en: "{n} instruments are overdue by an average of {tage} days.",
  },
  TEILABWANDERUNG: {
    de: "{n} davon seit über 60 Tagen – vermutlich anderswo kalibriert oder ausgemustert.",
    en: "{n} of them for more than 60 days – likely calibrated elsewhere or retired.",
  },
  FAELLIG_BALD: {
    de: "{n} Messmittel werden zwischen KW {kwVon} und KW {kwBis} fällig.",
    en: "{n} instruments fall due between week {kwVon} and week {kwBis}.",
  },
  RECENCY: {
    de: "Letzte Kalibrierung vor {monate} Monaten – üblich sind {ueblich}.",
    en: "Last calibration {monate} months ago – {ueblich} is usual.",
  },
  TREND_RUECKGANG: {
    de: "Kalibriervolumen der letzten 6 Monate {prozent} % unter dem Vorhalbjahr.",
    en: "Calibration volume of the last 6 months {prozent}% below the prior half-year.",
  },
  SPAET_RUECKLAUF: {
    de: "Sendet Messmittel typischerweise {tage} Tage nach Fälligkeit.",
    en: "Typically sends instruments {tage} days after the due date.",
  },
  BRANCHE_LUECKE: {
    de: "{prozent} % vergleichbarer Kunden lassen {gruppe} bei uns kalibrieren – dieser Kunde nicht.",
    en: "{prozent}% of comparable customers have {gruppe} calibrated with us – this one does not.",
  },
  DAKKS_LUECKE: {
    de: "DAkkS-Anteil {kunde} % – Branchenüblich sind {peer} %.",
    en: "DAkkS share {kunde}% – {peer}% is typical for the industry.",
  },
  KANAL_PORTAL_NIE: {
    de: "{n} Aufträge im letzten Jahr, keiner über trendic® hub.",
    en: "{n} orders last year, none via trendic® hub.",
  },
  KANAL_PORTAL_RUECKGANG: {
    de: "Portal-Anteil um {prozent} % gesunken.",
    en: "Portal share down {prozent}%.",
  },
  NIO_ANSTIEG: {
    de: "n.i.O.-Quote auf {prozent} % gestiegen – Beratungsbedarf?",
    en: "Failed share rose to {prozent}% – worth a conversation?",
  },
  STORNO: {
    de: "{n} abgesagte Dienstleistungen in 12 Monaten.",
    en: "{n} cancelled services in 12 months.",
  },
};

export function reasonText(code: ReasonCode, params: Record<string, string | number>, lang: Lang): string {
  const tpl = REASON_TEMPLATES[code][lang];
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export const REASON_FACTOR_LABELS: Record<ReasonCode, Record<Lang, string>> = {
  UEBERFAELLIG: { de: "Überfälligkeiten", en: "Overdue instruments" },
  TEILABWANDERUNG: { de: "Teilabwanderung (> 60 Tage)", en: "Partial churn (> 60 days)" },
  FAELLIG_BALD: { de: "Fällig in 30–60 Tagen", en: "Due in 30–60 days" },
  RECENCY: { de: "Letzte Kalibrierung", en: "Last calibration" },
  TREND_RUECKGANG: { de: "Volumentrend", en: "Volume trend" },
  SPAET_RUECKLAUF: { de: "Später Rücklauf", en: "Late returns" },
  BRANCHE_LUECKE: { de: "Branchenlücke", en: "Industry gap" },
  DAKKS_LUECKE: { de: "DAkkS-Lücke", en: "DAkkS gap" },
  KANAL_PORTAL_NIE: { de: "Portal nie genutzt", en: "Portal never used" },
  KANAL_PORTAL_RUECKGANG: { de: "Portal-Nutzung gesunken", en: "Portal usage declining" },
  NIO_ANSTIEG: { de: "n.i.O.-Quote", en: "Failed share" },
  STORNO: { de: "Stornos", en: "Cancellations" },
};
