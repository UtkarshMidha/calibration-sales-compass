/* PeCal-Assistent — grounded answer engine (ADR 0002: narrates, never decides).
 * Every figure comes from the same computed data the UI shows; the engine maps
 * natural German (and English) questions onto "tool results" which render as
 * interactive cards. If no tool matches, it says so instead of inventing. */

import {
  GRUPPEN,
  getEmpfehlungFuer,
  getKunde,
  getKunden,
  getLuecken,
  getPrognoseGesamt,
  getTagesliste,
  type Einstellungen,
} from "./data";
import { date, euro, num, type Lang, type Stichtag } from "./format";
import { reasonText, type TFn } from "./i18n";

export type Part =
  | { type: "text"; text: string }
  | {
      type: "empfehlungen";
      items: { kundeId: string; name: string; anlass: string; prioritaet: string; ev: number }[];
    }
  | {
      type: "kunden";
      items: { id: string; name: string; branche: string; gebiet: string; ueberfaellig: number; risiko: number; EV?: number }[];
    }
  | { type: "prognose"; titel: string }
  | { type: "messmittel"; titel: string; rows: { ident: string; typ: string; faelligkeit: string; status: string }[] }
  | { type: "confirm"; kind: "email" | "angebot"; kundeId: string; label: string }
  | { type: "quelle"; text: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: Part[];
}

export interface AnswerCtx {
  stichtag: Stichtag;
  settings: Einstellungen;
  lang: Lang;
  selectedKunde: string | null;
  route: string;
  t: TFn;
}

const MONTH_KEYS: Record<string, string> = {
  januar: "01", februar: "02", märz: "03", marz: "03", april: "04", mai: "05", juni: "06",
  juli: "07", august: "08", september: "09", oktober: "10", november: "11", dezember: "12",
  january: "01", march: "03", may: "05", october: "10", december: "12",
};

function findKundeId(s: string, ctx: AnswerCtx): string | null {
  const m = s.match(/\b(\d{4,6})\b/);
  if (m && getKunde(m[1])) return m[1];
  const pe = s.match(/\bpe\d{3,5}\b/i);
  if (pe && getKunde(pe[0].toUpperCase())) return pe[0].toUpperCase();
  if (ctx.selectedKunde) return ctx.selectedKunde;
  return null;
}

function anlassLabel(key: string, ctx: AnswerCtx): string {
  return ctx.t(`anlass.${key}` as "anlass.ueberfaellig");
}

export function answer(question: string, ctx: AnswerCtx): Part[] {
  const s = question.toLowerCase();
  const { t, lang } = ctx;
  const loc = lang === "de" ? "de-DE" : "en-GB";

  /* --- refusals (golden set) --- */
  if (/(wetter|weather|lösche|delete|remove|schreib.*sql|drop table)/.test(s)) {
    return [{ type: "text", text: t("assistent.refuse") }];
  }

  const list = getTagesliste(ctx.stichtag, ctx.settings, { ergebnisse: {}, wiedervorlagen: {}, done: {} });

  /* --- who to call first --- */
  if (/(wen|who).*(zuerst|anru|call|first)|tagesliste|daily list|priorität|prioriti/.test(s) && !/warum|why/.test(s)) {
    const top = list.slice(0, 5).map((i) => {
      const k = getKunde(i.kundeId)!;
      return {
        kundeId: i.kundeId,
        name: k.name,
        anlass: anlassLabel(i.empfehlung.anlass, ctx),
        prioritaet: i.prioritaet,
        ev: i.ev,
      };
    });
    const best = list[0];
    const text =
      lang === "de"
        ? `Ich würde mit ${getKunde(best.kundeId)!.name} beginnen – ${anlassLabel(best.empfehlung.anlass, ctx).toLowerCase()}, erwarteter Wert ${euro(best.ev, loc)}. Danach die vier Kunden in der Karte.`
        : `I would start with ${getKunde(best.kundeId)!.name} – ${anlassLabel(best.empfehlung.anlass, ctx).toLowerCase()}, expected value ${euro(best.ev, loc)}. Then the four customers in the card.`;
    return [
      { type: "text", text },
      { type: "empfehlungen", items: top },
      { type: "quelle", text: t("assistent.quelle", { datum: date(ctx.stichtag, loc) }) },
    ];
  }

  /* --- why is this customer on the list --- */
  if (/(warum|why|begründ|reason)/.test(s)) {
    const id = findKundeId(s, ctx);
    if (!id) return [{ type: "text", text: t("assistent.keineAntwort") }];
    const k = getKunde(id)!;
    const found = getEmpfehlungFuer(id, ctx.stichtag, ctx.settings);
    if (!found) {
      return [
        { type: "text", text: lang === "de" ? `${k.name} steht aktuell nicht auf der Tagesliste.` : `${k.name} is not on today's list.` },
      ];
    }
    const reasons = found.empfehlung.begruendung.map((r) => reasonText(r.code, r.params, lang));
    const text = reasons.length ? reasons.join(" ") : anlassLabel(found.empfehlung.anlass, ctx);
    return [
      { type: "text", text: `${k.name} (Kunde ${k.nummer}): ${text}` },
      {
        type: "kunden",
        items: [
          { id: k.id, name: k.name, branche: k.branche, gebiet: k.gebiet, ueberfaellig: k.ueberfaellig, risiko: k.risiko, EV: found.ev },
        ],
      },
      { type: "confirm", kind: "email", kundeId: k.id, label: lang === "de" ? "E-Mail-Entwurf für diesen Kunden" : "Email draft for this customer" },
      { type: "quelle", text: t("assistent.quelle", { datum: ctx.stichtag }) },
    ];
  }

  /* --- volume forecast --- */
  if (/(volumen|prognose|dezember|volume|forecast|aufträge|orders|menge)/.test(s)) {
    const prognose = getPrognoseGesamt(ctx.stichtag);
    const fore = prognose.filter((p) => !p.historie);
    let monat = fore.find((m) => {
      const key = Object.keys(MONTH_KEYS).find((k) => s.includes(k));
      return key && m.monat.slice(5, 7) === MONTH_KEYS[key];
    });
    if (!monat) monat = fore[0];
    const text =
      lang === "de"
        ? `Für ${monat.monat.slice(5, 7)}/${monat.monat.slice(2, 4)} erwarten wir ${num(monat.kalibrierungen)} Kalibrierungen (Band ${num(monat.p10)}–${num(monat.p90)}), entspricht ${num(monat.stunden)} Stunden. Die Baseline läge bei ${num(monat.baseline ?? 0)}.`
        : `For ${monat.monat.slice(5, 7)}/${monat.monat.slice(2, 4)} we expect ${num(monat.kalibrierungen)} calibrations (band ${num(monat.p10)}–${num(monat.p90)}), about ${num(monat.stunden)} hours. The baseline would be ${num(monat.baseline ?? 0)}.`;
    return [
      { type: "text", text },
      { type: "prognose", titel: t("cockpit.forecast") },
      { type: "quelle", text: "M4 · Prognose gesamt" },
    ];
  }

  /* --- overdue customers by region/industry --- */
  if (/(überfällig|overdue|verspätet)/.test(s)) {
    const gebiete = ["Nord", "Süd", "Ost", "West", "Mitte", "Südwest"];
    const gebiet = gebiete.find((g) => s.includes(g.toLowerCase()));
    const branchen = ["automotive", "medical", "maschinen", "elektro", "pharma", "luft"];
    const branche = branchen.find((b) => s.includes(b));

    let kunden = getKunden().filter((k) => k.ueberfaellig > 0);
    if (gebiet) kunden = kunden.filter((k) => k.gebiet === gebiet);
    if (branche) kunden = kunden.filter((k) => k.branche.toLowerCase().includes(branche));
    kunden = kunden.sort((a, b) => b.ueberfaellig - a.ueberfaellig).slice(0, 6);

    const summe = kunden.reduce((x, k) => x + k.ueberfaellig, 0);
    const text =
      lang === "de"
        ? `${kunden.length} Kunden${gebiet ? ` im Gebiet ${gebiet}` : ""}${branche ? ` aus ${branche}` : ""} mit den meisten Überfälligkeiten – zusammen ${num(summe)} Messmittel. Spitzenreiter: ${kunden[0]?.name ?? "–"}.`
        : `${kunden.length} customers${gebiet ? ` in region ${gebiet}` : ""} with the most overdue instruments – ${num(summe)} in total. Top: ${kunden[0]?.name ?? "–"}.`;
    return [
      { type: "text", text },
      {
        type: "kunden",
        items: kunden.map((k) => ({ id: k.id, name: k.name, branche: k.branche, gebiet: k.gebiet, ueberfaellig: k.ueberfaellig, risiko: k.risiko })),
      },
      { type: "quelle", text: "Messmittel-Status (DuckDB-Kontrakt)" },
    ];
  }

  /* --- industry gaps --- */
  if (/(lück|lücken|potenzial|gap|portfolio|branchen)/.test(s)) {
    const id = findKundeId(s, ctx);
    if (!id) return [{ type: "text", text: t("assistent.keineAntwort") }];
    const k = getKunde(id)!;
    const luecken = getLuecken(id).filter((l) => l.stunden > 0).slice(0, 4);
    if (luecken.length === 0) {
      return [{ type: "text", text: `${k.name}: ${t("k360.keineLuecke")}` }];
    }
    const text =
      lang === "de"
        ? `Bei ${k.name} fehlen ${luecken.length} Gruppen, die ${Math.round(luecken[0].peer * 100)} % der Branche ${k.branche} bei uns kalibrieren – größte Lücke: ${GRUPPEN[luecken[0].gruppe].name}, Wert ≈ ${euro(luecken.reduce((x, l) => x + l.stunden * ctx.settings.stundensatz, 0), loc)}.`
        : `${k.name} is missing ${luecken.length} groups that ${Math.round(luecken[0].peer * 100)}% of ${k.branche} peers calibrate with us – biggest gap: ${GRUPPEN[luecken[0].gruppe].name}, value ≈ ${euro(luecken.reduce((x, l) => x + l.stunden * ctx.settings.stundensatz, 0), loc)}.`;
    return [
      { type: "text", text },
      {
        type: "messmittel",
        titel: t("k360.luecken"),
        rows: luecken.map((l) => ({
          ident: GRUPPEN[l.gruppe].kuerzel,
          typ: GRUPPEN[l.gruppe].name,
          faelligkeit: `${Math.round(l.peer * 100)} % Peers`,
          status: "gap",
        })),
      },
      { type: "quelle", text: "M5 · Branchenpotenzial" },
    ];
  }

  /* --- quote / email intent --- */
  if (/(angebot|quote|mail|e-mail|entwurf|draft)/.test(s)) {
    const id = findKundeId(s, ctx);
    if (!id) return [{ type: "text", text: t("assistent.keineAntwort") }];
    const k = getKunde(id)!;
    if (/mail|e-mail/.test(s)) {
      return [
        { type: "text", text: lang === "de" ? `Ich habe einen Entwurf in der Sie-Form vorbereitet – bitte bestätigen:` : `I prepared a formal draft – please confirm:` },
        { type: "confirm", kind: "email", kundeId: k.id, label: `${t("akt.email")} · ${k.name}` },
      ];
    }
    return [
      { type: "text", text: lang === "de" ? `Angebotsentwurf für ${k.name} ist vorbereitet – bitte bestätigen:` : `Quote draft for ${k.name} is ready – please confirm:` },
      { type: "confirm", kind: "angebot", kundeId: k.id, label: `${t("akt.angebot")} · ${k.name}` },
    ];
  }

  /* --- team / success numbers --- */
  if (/(team|mitarbeiter|erfolgsquote|kennzahl)/.test(s)) {
    return [
      {
        type: "text",
        text:
          lang === "de"
            ? "Die Kennzahlen stehen im Cockpit: Übernommene und erledigte Empfehlungen je Mitarbeiter, Ergebnisverteilung und Erfolgsquote je Anlass. Dort können Sie auf eine Branche klicken, um die Kunden zu filtern."
            : "The figures live in the cockpit: claimed and completed recommendations per rep, outcome distribution and success rate per reason. Click an industry there to filter customers.",
      },
      { type: "quelle", text: "team_kennzahlen" },
    ];
  }

  return [{ type: "text", text: t("assistent.keineAntwort") }];
}

export const SUGGESTIONS = (t: TFn): string[] => [
  t("assistent.v1"),
  t("assistent.v2"),
  t("assistent.v3"),
  t("assistent.v4"),
  t("assistent.v5"),
];
