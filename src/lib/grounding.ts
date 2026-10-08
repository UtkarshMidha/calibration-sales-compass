/* PeCal-Assistent — grounding context for the live LLM (server-side only).
 *
 * Builds a compact, deterministic summary of exactly the computed data the UI
 * shows (ADR 0002: the assistant narrates, never decides). The model must only
 * repeat figures from this block — it has no other source of truth. */

import {
  ASSISTENT_EVAL,
  ANNAHMEN,
  GRUPPEN,
  HEADLINE,
  getCockpitAggregates,
  getEmpfehlungFuer,
  getKunde,
  getKunden,
  getLuecken,
  getModellguete,
  getPrognoseGesamt,
  getTagesliste,
  type Einstellungen,
} from "./data";
import { date, euro, num, type Lang, type Stichtag } from "./format";
import { reasonText } from "./reasons";

export interface GroundingInput {
  question: string;
  lang: Lang;
  stichtag: Stichtag;
  settings: Einstellungen;
  selectedKunde: string | null;
}

/** Customer id referenced in the question (kundennummer / PE-number / selection). */
export function findReferencedKunde(question: string, selectedKunde: string | null): string | null {
  const m = question.match(/\b(\d{4,6})\b/);
  if (m && getKunde(m[1])) return m[1];
  const pe = question.match(/\bpe\d{3,5}\b/i);
  if (pe && getKunde(pe[0].toUpperCase())) return pe[0].toUpperCase();
  if (selectedKunde && getKunde(selectedKunde)) return selectedKunde;
  return null;
}

export function buildGrounding(input: GroundingInput): string {
  const { lang, stichtag, settings } = input;
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const out: string[] = [];

  /* ---------- header ---------- */
  out.push("# DATENSTAND (verbindlich)");
  out.push(
    `stichtag=${date(stichtag, loc)} · sprache=${lang} · stundensatz=${euro(settings.stundensatz, loc, false)}/h · ` +
      `tageslisten-kapazitaet=${settings.kapazitaet} · erfolgschance-prior=${Object.entries(settings.erfolgschancen)
        .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
        .join(", ")}`,
  );
  out.push(
    `richtpreis-formel: stunden=minuten/60 × stundensatz (DAkkS-Prüfung ×1,35); logistik leihbox ${euro(51.9, loc)}, ` +
      `dhl ${euro(15.75, loc)} je box; ust 19%. erwarteter wert (EV)=stunden × stundensatz × erfolgschance × dringlichkeit.`,
  );
  out.push(
    `Bestand: ${num(HEADLINE.kundenMitMessmittel)} Kunden, ${num(HEADLINE.messmittelGesamt)} Messmittel, ` +
      `${num(HEADLINE.ueberfaellig)} überfällig (${num(HEADLINE.ueberfaelligKunden)} Kunden), ` +
      `${num(HEADLINE.faellig3060)} in 30–60 Tagen fällig (${num(HEADLINE.faellig3060Kunden)} Kunden), ` +
      `${num(HEADLINE.teilabwanderung)} in Teilabwanderung, ${num(HEADLINE.portalKunden12m)} Portal-Kunden (12 M.), ` +
      `${num(HEADLINE.niePortal)} nie im Portal.`,
  );

  /* ---------- cockpit KPIs ---------- */
  const agg = getCockpitAggregates();
  out.push("");
  out.push("# KENNZAHLEN (Cockpit)");
  out.push(
    `umsatz12m=${euro(agg.umsatz12m, loc)} · atRisk=${euro(agg.atRisk, loc)} · ` +
      `faellig_in_3_monaten=${euro(agg.faellig3Monate, loc)} · ueberfaellig_kunden=${num(agg.ueberfaellig)}`,
  );
  out.push(
    `atRisk_nach_branche: ${agg.byBranche.slice(0, 6).map((b) => `${b.key} ${euro(b.wert, loc)}`).join(" | ")}`,
  );
  out.push(
    `atRisk_nach_gebiet: ${agg.byGebiet.slice(0, 6).map((g) => `${g.key} ${euro(g.wert, loc)}`).join(" | ")}`,
  );

  /* ---------- aggregated industry gaps (M5, summed over all customers) ---------- */
  const lueckAgg = new Map<string, { kunden: number; gruppen: number; wert: number }>();
  for (const kk of getKunden()) {
    const ls = getLuecken(kk.id).filter((l) => l.stunden > 0);
    if (ls.length === 0) continue;
    const w = ls.reduce((x, l) => x + l.stunden * settings.stundensatz, 0);
    const e = lueckAgg.get(kk.branche) ?? { kunden: 0, gruppen: 0, wert: 0 };
    e.kunden += 1;
    e.gruppen += ls.length;
    e.wert += w;
    lueckAgg.set(kk.branche, e);
  }
  const lueckTop = [...lueckAgg.entries()].sort((a, b) => b[1].wert - a[1].wert).slice(0, 5);
  out.push(
    `branchenluecken_top5 (gruppe fehlt beim kunden, peers kalibrieren sie bei uns): ${lueckTop.map(([b, v]) => `${b}: ${v.gruppen} Lücken bei ${v.kunden} Kunden ≈ ${euro(v.wert, loc)}`).join(" | ") || "keine"}`,
  );

  /* ---------- daily list ---------- */
  const list = getTagesliste(stichtag, settings, { ergebnisse: {}, wiedervorlagen: {}, done: {} });
  out.push("");
  out.push(`# TAGESLISTE (Top 8 von ${list.length} Plätzen; EV = stunden × stundensatz × erfolgschance × dringlichkeit)`);
  list.slice(0, 8).forEach((i, n) => {
    const k = getKunde(i.kundeId);
    if (!k) return;
    const reasons = i.empfehlung.begruendung
      .slice(0, 2)
      .map((r) => reasonText(r.code, r.params, lang))
      .join(" ");
    out.push(
      `${n + 1}. ${k.nummer} ${k.name} | ${k.branche} | ${k.gebiet} | ` +
        `anlass=${i.empfehlung.anlass} | prioritaet=${i.prioritaet} | ev=${euro(i.ev, loc)} | ` +
        `ueberfaellig=${k.ueberfaellig} | risiko=${Math.round(k.risiko * 100)}% | ${reasons}`,
    );
  });

  /* ---------- forecast ---------- */
  const fore = getPrognoseGesamt(stichtag).filter((p) => !p.historie).slice(0, 4);
  out.push("");
  out.push("# PROGNOSE (nächste 4 Monate; band=80%-Perzentil, baseline=saison-naiv)");
  out.push(
    fore
      .map(
        (p) =>
          `${p.monat}: ${num(p.kalibrierungen)} Kalibrierungen (band ${num(p.p10)}–${num(p.p90)}, baseline ${num(p.baseline ?? 0)}), ${num(p.stunden)} Stunden`,
      )
      .join(" | "),
  );

  /* ---------- model quality ---------- */
  out.push("");
  out.push("# MODELLGUEITE");
  for (const m of getModellguete()) {
    out.push(
      `${m.id} ${m.titel}: ${m.metrikName}=${m.wertLabel} (baseline ${m.baselineName} ${m.baselineLabel}, ziel ${m.ziel}, ${m.erfuellt ? "erfuellt" : "nicht erreicht"})`,
    );
  }
  out.push(`annahmen: ${ANNAHMEN.map((a) => `${a.id} ${a.titel}=${a.wert} [${a.status}]`).join(" | ")}`);
  out.push(`assistent-evaluation golden set: ${ASSISTENT_EVAL.richtig}/${ASSISTENT_EVAL.gesamt} richtig`);

  /* ---------- referenced customer profile ---------- */
  const id = findReferencedKunde(input.question, input.selectedKunde);
  if (id) {
    const k = getKunde(id)!;
    const emp = getEmpfehlungFuer(id, stichtag, settings);
    const pro = getPrognoseGesamt(stichtag).filter((p) => !p.historie);
    out.push("");
    out.push(`# KUNDENPROFIL ${k.nummer}`);
    out.push(
      `${k.name} | ${k.branche} | ${k.gebiet} | ${k.ort} | kunde-seit=${k.seit} | ansprechpartner=${k.ansprech} (${k.anrede}) | ` +
        `kanal portal/intern/api=${k.kanal.portal}/${k.kanal.intern}/${k.kanal.api}% | positions12m=${k.positions12m} | ` +
        `umsatz-schaetzung_12m=${euro(k.umsatzStunden * settings.stundensatz, loc)}`,
    );
    out.push(
      `messmittel aktiv=${k.aktiv} ueberfaellig=${k.ueberfaellig} (>60t=${k.teil}) faellig30_60=${k.faelligBald} | ` +
        `letzte-kalibrierung=${date(k.letzteKal, loc)} (${k.monateSeitKal} Monate her) | risiko=${Math.round(k.risiko * 100)}% (${k.band}) | ` +
        `ruecklauf-quote=${Math.round(k.ruecklauf.quote * 100)}% nach ø ${k.ruecklauf.lag} Tagen (n=${k.ruecklauf.n}) | ` +
        `bearbeitungszeit_ø=${k.stdMin} min je messmittel | dakks-anteil=${Math.round(k.dakksShare * 100)}% nio-anteil=${Math.round(k.nioShare * 100)}%`,
    );
    if (emp) {
      out.push(
        `empfehlung heute: anlass=${emp.empfehlung.anlass} prioritaet=${emp.prioritaet} ev=${euro(emp.ev, loc)} | ` +
          `begruendung: ${emp.empfehlung.begruendung.map((r) => reasonText(r.code, r.params, lang)).join(" ")}`,
      );
    } else {
      out.push("empfehlung heute: keine");
    }
    const sumPro = pro.reduce((s, p) => s + p.kalibrierungen, 0);
    out.push(`kunden-prognose 12 monate: ø ${num(sumPro, 1)} kalibrierungen`);

    const luecken = getLuecken(id).filter((l) => l.stunden > 0).slice(0, 5);
    if (luecken.length) {
      out.push(
        `luecken (gruppe: peer-branche besitzt, wert bei ${euro(settings.stundensatz, loc)}/h): ` +
          luecken
            .map(
              (l) =>
                `${GRUPPEN[l.gruppe].name} ${Math.round(l.peer * 100)}% peers, ${num(l.stunden, 0)} h ≈ ${euro(l.stunden * settings.stundensatz, loc)}`,
            )
            .join(" | "),
      );
    } else {
      out.push("luecken: keine – portfolio vollstaendig abgedeckt");
    }
  }

  /* ---------- overdue ranking (always useful) ---------- */
  const top = getKunden()
    .filter((k) => k.ueberfaellig > 0)
    .sort((a, b) => b.ueberfaellig - a.ueberfaellig)
    .slice(0, 5);
  out.push("");
  out.push("# TOP-UEBERFAELLIGE KUNDEN (alle Gebiete/Branchen)");
  out.push(
    top
      .map((k) => `${k.nummer} ${k.name} (${k.branche}, ${k.gebiet}): ${k.ueberfaellig} überfällig`)
      .join(" | "),
  );

  return out.join("\n");
}
