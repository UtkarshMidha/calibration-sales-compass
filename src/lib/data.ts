/* ------------------------------------------------------------------ *
 *  PeCal Kompass — deterministic demo dataset + intelligence layer.
 *
 *  In the hackathon architecture a Python pipeline writes DuckDB tables
 *  (§8.11 of the PRD). Here the same contract is produced deterministically
 *  in TypeScript so `npm run dev` works standalone: Anlässe, reason codes,
 *  Erwarteter Wert, forecasts and model-quality metrics all follow the PRD
 *  formulas. Same seed → identical Tagesliste.
 * ------------------------------------------------------------------ */

import { addDays, addMonths, daysBetween, kw, type Stichtag } from "./format";
import type { ReasonCode } from "./i18n";

/* ----------------------------- primitives ----------------------------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/* ----------------------------- reference data ----------------------------- */

export type Anlass =
  | "faellig_bald"
  | "ueberfaellig"
  | "abwanderung"
  | "branche"
  | "portal";
export type Prioritaet = "hoch" | "mittel" | "niedrig";
export type MessmittelStatus =
  | "ok"
  | "faellig_bald"
  | "ueberfaellig"
  | "teilabwanderung"
  | "gestoppt"
  | "nio";

export interface User {
  id: string;
  nameKey: "user.sabine" | "user.thomas";
  role: "inside" | "leitung";
  kurz: string; // "S. Schneider"
}

export const USERS: User[] = [
  { id: "sabine", nameKey: "user.sabine", role: "inside", kurz: "S. Schneider" },
  { id: "thomas", nameKey: "user.thomas", role: "leitung", kurz: "T. Brandt" },
];

/** Figures measured on the full dataset (PRD Appendix B, Stichtag 25.09.2026). */
export const HEADLINE = {
  messmittelGesamt: 488_699,
  kundenMitMessmittel: 6_525,
  ueberfaellig: 64_915,
  ueberfaelligKunden: 2_424,
  teilabwanderung: 50_857,
  teilabwanderungKunden: 2_233,
  faellig3060: 13_747,
  faellig3060Kunden: 729,
  aktiv3Monate: 2_142,
  top100Anteil: 0.38,
  portalKunden12m: 2_912,
  niePortal: 2_227,
  alt1324: 1_513,
  altAbwandernd: 1_430,
  baujahrKalVon: "2023-12-22",
  baujahrKalBis: "2026-09-24",
};

export const GEBIETE = ["Nord", "Mitte", "Ost", "Süd", "West", "Südwest"] as const;

export interface BrancheDef {
  name: string;
  kunden: number;
  avgAktiv: number;
  audit: boolean; // DAkkS audit pressure
}

export const BRANCHEN: BrancheDef[] = [
  { name: "Maschinen- & Anlagenbau", kunden: 1282, avgAktiv: 137, audit: false },
  { name: "Metall- & Kunststoffverarbeitung", kunden: 1436, avgAktiv: 84, audit: false },
  { name: "Automotive", kunden: 541, avgAktiv: 85, audit: true },
  { name: "Elektro & MSR", kunden: 482, avgAktiv: 80, audit: false },
  { name: "Sonstiges", kunden: 1543, avgAktiv: 24, audit: false },
  { name: "Medical", kunden: 141, avgAktiv: 162, audit: true },
  { name: "Luft- & Raumfahrt", kunden: 90, avgAktiv: 224, audit: true },
  { name: "Handel", kunden: 538, avgAktiv: 18, audit: false },
  { name: "Chemie", kunden: 168, avgAktiv: 57, audit: false },
  { name: "Klima & Heizung", kunden: 29, avgAktiv: 216, audit: false },
  { name: "Halbleiter", kunden: 33, avgAktiv: 122, audit: false },
  { name: "Energie", kunden: 61, avgAktiv: 53, audit: false },
  { name: "Defence", kunden: 49, avgAktiv: 49, audit: true },
  { name: "Pharma", kunden: 36, avgAktiv: 28, audit: true },
  { name: "Kalibrierlabore", kunden: 37, avgAktiv: 22, audit: false },
];

export interface GruppeDef {
  name: string;
  kuerzel: string;
  min: number; // median Bearbeitungszeit
  messraum: string;
  typen: string[];
  bas: number; // baseline peer penetration
}

/** Messmittelgruppen (subset of the 57 groups, covers the Lückenmatrix well). */
export const GRUPPEN: GruppeDef[] = [
  { name: "Lehrdorn", kuerzel: "LD", min: 22, messraum: "MR7", typen: ["Lehrdorn Gauge C", "Lehrdorn Gauge B", "Messlehrdorn"], bas: 0.55 },
  { name: "Gewindelehrdorn", kuerzel: "GLD", min: 26, messraum: "MR7", typen: ["Gewindelehrdorn M", "Gewindelehrdorn Z", "Gewindelehre M"], bas: 0.5 },
  { name: "Messschieber", kuerzel: "MS", min: 30, messraum: "MR6", typen: ["Messschieber 150 mm", "Messschieber 200 mm", "Messschieber digital"], bas: 0.62 },
  { name: "Gewindelehrring", kuerzel: "GLR", min: 24, messraum: "MR7", typen: ["Gewindelehrring M", "Gewindelehrring Z", "Lehrring M"], bas: 0.45 },
  { name: "Lehrring", kuerzel: "LR", min: 20, messraum: "MR7", typen: ["Lehrring Zone 6", "Lehrring Toleranz"], bas: 0.4 },
  { name: "Messuhr", kuerzel: "MU", min: 38, messraum: "MR3", typen: ["Messuhr 0,01 mm", "Messuhr 0,001 mm", "Messuhr Anzeige"], bas: 0.38 },
  { name: "Drehmomentschlüssel", kuerzel: "DMS", min: 65, messraum: "MR2", typen: ["Drehmomentschlüssel 1/2", "Drehmomentschlüssel 3/4", "Drehmomentschlüssel digital"], bas: 0.3 },
  { name: "Höhenmessgerät", kuerzel: "HM", min: 45, messraum: "MR1", typen: ["Höhenmessgerät 300", "Höhenmessgerät digital"], bas: 0.26 },
  { name: "Messingstab", kuerzel: "MB", min: 18, messraum: "MR1", typen: ["Messingstab 100 mm", "Messingstab 200 mm"], bas: 0.31 },
  { name: "Anzeigestock", kuerzel: "AS", min: 16, messraum: "MR1", typen: ["Anzeigestock 25 mm", "Anzeigestock 50 mm"], bas: 0.22 },
  { name: "Keillehre", kuerzel: "KL", min: 21, messraum: "MR7", typen: ["Keillehre 1:50", "Keillehre 1:100"], bas: 0.23 },
  { name: "Fühlerlehre", kuerzel: "FL", min: 19, messraum: "MR7", typen: ["Fühlerlehre Blatt", "Fühlerlehre Band"], bas: 0.33 },
  { name: "Messklemme", kuerzel: "MK", min: 34, messraum: "MR5", typen: ["Messklemme 0-25", "Messklemme digital"], bas: 0.18 },
  { name: "Spannmessfühler", kuerzel: "SMF", min: 42, messraum: "MR5", typen: ["Spannmessfühler 0,2", "Spannmessfühler 0,5"], bas: 0.15 },
  { name: "Gewindemessuhr", kuerzel: "GMU", min: 40, messraum: "MR2", typen: ["Gewindemessuhr M", "Gewindemessuhr Z"], bas: 0.2 },
  { name: "Prüfstift", kuerzel: "PS", min: 28, messraum: "MR9", typen: ["Prüfstift Ø 6", "Prüfstift Messschieber", "Prüfstift Kugel"], bas: 0.25 },
  { name: "Drehmomentschraubendreher", kuerzel: "DSD", min: 58, messraum: "MR2", typen: ["Drehmomentschraubendreher 1-3", "Drehmomentschraubendreher digital"], bas: 0.18 },
  { name: "Winkelmesser", kuerzel: "WK", min: 36, messraum: "MR1", typen: ["Winkelmesser 320", "Winkelmesser digital", "Anschlagwinkel"], bas: 0.35 },
];

const STADTE: Record<string, string[]> = {
  Nord: ["Braunschweig", "Wolfsburg", "Hannover", "Bremen", "Kiel", "Oldenburg", "Hildesheim"],
  Mitte: ["Göttingen", "Erfurt", "Kassel", "Fulda", "Jena", "Suhl"],
  Ost: ["Leipzig", "Dresden", "Magdeburg", "Rostock", "Chemnitz", "Potsdam"],
  Süd: ["München", "Stuttgart", "Nürnberg", "Augsburg", "Ulm", "Regensburg"],
  West: ["Köln", "Düsseldorf", "Dortmund", "Essen", "Münster", "Aachen"],
  Südwest: ["Frankfurt", "Mainz", "Mannheim", "Karlsruhe", "Saarbrücken", "Trier"],
};

const FIRMEN_ENDUNG = [
  "Präzisionstechnik GmbH", "Messtechnik GmbH", "Industrieservice GmbH", "Werkzeugbau GmbH",
  "Automotive GmbH", "Medizintechnik GmbH", "Elektrotechnik GmbH", "Anlagenbau GmbH",
  "Systemtechnik GmbH", "Feinmechanik GmbH", "Kalibrierlabor GmbH", "Laborgeräte GmbH",
  "Sensorik GmbH", "Steuerungstechnik GmbH", "Normteile GmbH", "Prüftechnik GmbH",
  "Metallbau GmbH & Co. KG", "Apparatebau GmbH", "Konstruktionstechnik GmbH", "Hydraulik GmbH",
];

const FRAUEN = ["Anna", "Sabine", "Julia", "Katrin", "Martina", "Petra", "Birgit", "Claudia", "Susanne", "Andrea", "Heike", "Nadine"];
    const MAENNER = ["Thomas", "Michael", "Andreas", "Markus", "Stefan", "Jürgen", "Dirk", "Frank", "Uwe", "Bernd", "Matthias", "Sebastian"];
const NACHNAMEN = ["Müller", "Schulz", "Becker", "Hoffmann", "Krüger", "Lehmann", "Richter", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Hartmann", "Fischer", "Meyer", "König", "Walter", "Kaiser", "Grothe", "Ostermann", "Winter", "Kramer", "Voigt", "Lorenz", "Schuster", "Pfeiffer", "Seidel", "Barth", "Reuter", "Nowak", "Özdemir", "Baumann", "Herrmann", "Klein", "Weber", "Huber", "Koch", "Roth", "Sauer", "Vogt", "Franke"];

/* ----------------------------- Kunde ----------------------------- */

export interface Kunde {
  id: string;
  nummer: string;
  name: string;
  branche: string;
  gebiet: string;
  ort: string;
  seit: number;
  aktiv: number;
  ueberfaellig: number;
  teil: number; // > 60 Tage überfällig
  faelligBald: number; // in 30–60 Tagen
  monateSeitKal: number;
  letzteKal: string;
  risiko: number;
  band: "niedrig" | "mittel" | "hoch";
  kanal: { portal: number; intern: number; api: number };
  positions12m: number;
  umsatzStunden: number; // Umsatzschätzung nächste 12 Monate (Stunden)
  ruecklauf: { lag: number; quote: number; n: number };
  stdMin: number; // mittlere Bearbeitungszeit des Portfolios (Minuten)
  groups: number[]; // besessene Messmittelgruppen (Indizes in GRUPPEN)
  dakksShare: number;
  nioShare: number;
  ansprech: string;
  anrede: "frau" | "herr";
  telefon: string;
  email: string;
}

export const ERGEBNIS_CODES = [
  "angebot", "auftrag", "keinBedarf", "wettbewerber", "ausgemustert", "falscherKontakt", "nichtErreicht",
] as const;
export type ErgebnisCode = (typeof ERGEBNIS_CODES)[number];

export const WETTBEWERBER = ["Trescal", "Testo Industrial Services", "Hoffmann Group", "Hahn+Kolb", "Andere", "Unbekannt"];

/* peer penetration per Branche × Gruppe (M5) — computed once, deterministic. */
let _penetration: number[][] | null = null;
export function penetration(): number[][] {
  if (_penetration) return _penetration;
  const bias: Record<string, Record<string, number>> = {
    Medical: { Prüfstift: 1.6, Drehmomentschraubendreher: 1.5, Messschieber: 1.2 },
    "Luft- & Raumfahrt": { Drehmomentschlüssel: 1.7, Winkelmesser: 1.6, Lehrdorn: 1.3 },
    Automotive: { Drehmomentschlüssel: 1.5, Gewindemessuhr: 1.3 },
    Halbleiter: { Messklemme: 1.5, Spannmessfühler: 1.4 },
    Pharma: { Messschieber: 1.3, Fühlerlehre: 1.3 },
    "Klima & Heizung": { Messuhr: 1.4, Höhenmessgerät: 1.3 },
  };
  _penetration = BRANCHEN.map((b) => {
    const r = mulberry32(hashStr(b.name));
    return GRUPPEN.map((g, gi) => {
      const b2 = bias[b.name]?.[g.name] ?? 1;
      const jitter = 0.85 + 0.3 * r();
      // Sonstiges: no meaningful peer group (DQ-8) — keep numbers but never use them
      return clamp(g.bas * b2 * jitter * (b.name === "Sonstiges" ? 0.7 : 1), 0.05, 0.93);
    });
  });
  return _penetration;
}

function sampleGroups(branche: string, r: () => number): number[] {
  const pen = penetration()[BRANCHEN.findIndex((b) => b.name === branche)];
  const owned: number[] = [];
  for (let i = 0; i < GRUPPEN.length; i++) {
    if (r() < Math.pow(pen[i], 1.05)) owned.push(i);
  }
  while (owned.length < 3) {
    const i = Math.floor(r() * GRUPPEN.length);
    if (!owned.includes(i)) owned.push(i);
  }
  return owned.sort((a, b) => a - b);
}

let _kunden: Kunde[] | null = null;

export function getKunden(): Kunde[] {
  if (_kunden) return _kunden;
  const out: Kunde[] = [];
  let idx = 0;
  for (const b of BRANCHEN) {
    for (let i = 0; i < b.kunden; i++) {
      const nummerNum = 10001 + idx;
      const seedR = mulberry32(hashStr(`k${nummerNum}`));
      const nummer = seedR() < 0.035 ? `PE${2200 + (nummerNum % 900)}` : String(nummerNum);
      const r = mulberry32(hashStr(nummer));

      // volume, concentrated (top accounts carry far more)
      const base = b.avgAktiv * (0.22 + 1.35 * Math.pow(r(), 1.7));
      const mega = r() < 0.014 ? 3.2 + 4 * r() : 1;
      const aktiv = Math.max(1, Math.round(base * mega));

      // statuses
      const uShare = clamp(0.02 + 0.55 * Math.pow(r(), 1.8), 0.005, 0.6);
      const ueberfaellig = Math.round(aktiv * uShare);
      const teil = Math.round(ueberfaellig * (0.35 + 0.55 * r()));
      const faelligBald = Math.round(aktiv * (0.008 + 0.075 * r()));

      // recency
      const monateSeitKal = Math.max(0, Math.round(1 + 46 * Math.pow(r(), 2.3)));
      const letzteKal = addDays("2026-09-25", -monateSeitKal * 30 - Math.floor(r() * 28));

      // churn risk (correlated with recency + overdue share), calibrated ~ U-shape
      const z = -1.35 + 0.085 * monateSeitKal + 3.4 * (uShare - 0.12) + (r() - 0.5) * 0.7;
      const risiko = clamp(1 / (1 + Math.exp(-z)), 0.02, 0.93);
      const band: Kunde["band"] = risiko >= 0.5 ? "hoch" : risiko >= 0.3 ? "mittel" : "niedrig";

      // channels: 76 % never ordered via portal (PRD §2.3)
      const portalNie = r() < 0.66;
      const portal = portalNie ? 0 : Math.round(10 + 75 * r());
      const api = r() < 0.12 ? Math.round(1 + 6 * r()) : 0;
      const intern = Math.max(0, 100 - portal - api);
      const positions12m = Math.round(aktiv * (0.04 + 0.5 * r()) * (monateSeitKal > 12 ? 0.25 : 1));

      // revenue estimate: calibrations per year × mean processing hours
      const intervalMonate = [12, 12, 18, 24, 24, 36][Math.floor(r() * 6)];
      const calJahr = (aktiv * 12) / intervalMonate * (monateSeitKal > 12 ? 0.35 : 1);
      const stdMin = 34 + 46 * r(); // portfolio-specific processing time per item
      const umsatzStunden = (calJahr * stdMin) / 60;

      const ruecklauf = {
        lag: Math.round(4 + 140 * Math.pow(r(), 1.6)),
        quote: clamp(0.34 + 0.6 * r() + (b.name === "Luft- & Raumfahrt" ? 0.08 : 0), 0.2, 0.97),
        n: Math.max(4, Math.round(aktiv * 0.35 * r())),
      };

      const gebiet = GEBIETE[Math.floor(r() * GEBIETE.length)];
      const ort = STADTE[gebiet][Math.floor(r() * STADTE[gebiet].length)];
      const anrede: "frau" | "herr" = r() < 0.45 ? "frau" : "herr";
      const vorname = anrede === "frau" ? FRAUEN[Math.floor(r() * FRAUEN.length)] : MAENNER[Math.floor(r() * MAENNER.length)];
      const nachname = NACHNAMEN[Math.floor(r() * NACHNAMEN.length)];
      const prefix = NACHNAMEN[Math.floor(r() * NACHNAMEN.length)];
      const name = `${prefix} ${FIRMEN_ENDUNG[Math.floor(r() * FIRMEN_ENDUNG.length)]}`;

      out.push({
        id: nummer,
        nummer,
        name,
        branche: b.name,
        gebiet,
        ort,
        seit: 1998 + Math.floor(r() * 27),
        aktiv,
        ueberfaellig,
        teil,
        faelligBald,
        monateSeitKal,
        letzteKal,
        risiko,
        band,
        kanal: { portal, intern, api },
        positions12m,
        umsatzStunden,
        ruecklauf,
        stdMin,
        groups: sampleGroups(b.name, r),
        dakksShare: clamp(0.08 + 0.4 * r() + (b.audit ? 0.18 : 0), 0.02, 0.9),
        nioShare: clamp(0.01 + 0.09 * r(), 0.005, 0.18),
        ansprech: `${vorname} ${nachname}`,
        anrede,
        telefon: `0${5321 + Math.floor(r() * 90)} / ${10000 + Math.floor(r() * 89999)}`,
        email: `${vorname.toLowerCase()}.${nachname.toLowerCase()}@${prefix.toLowerCase().replace(/[^a-zäöüß]/g, "")}.de`,
      });
      idx++;
    }
  }

  // Pitch protagonist: Kunde 10132 — Müller Präzisionstechnik GmbH (PRD §16.2)
  const prot = out.find((k) => k.nummer === "10132");
  if (prot) {
    prot.name = "Müller Präzisionstechnik GmbH";
    prot.branche = "Medical";
    prot.ort = "Braunschweig";
    prot.gebiet = "Nord";
    prot.aktiv = Math.max(prot.aktiv, 260);
    prot.ueberfaellig = 42;
    prot.teil = 38;
    prot.monateSeitKal = 7;
    prot.letzteKal = addDays("2026-09-25", -214);
    prot.risiko = 0.61;
    prot.band = "hoch";
    prot.ansprech = "Katrin Becker";
    prot.anrede = "frau";
    prot.email = "katrin.becker@mueller-praezision.de";
  }

  _kunden = out;
  return out;
}

let _kundenMap: Map<string, Kunde> | null = null;
export function getKunde(id: string): Kunde | undefined {
  if (!_kundenMap) _kundenMap = new Map(getKunden().map((k) => [k.id, k]));
  return _kundenMap.get(id);
}

/* ----------------------------- Messmittel ----------------------------- */

export interface MessmittelRow {
  id: string;
  ident: string;
  gruppe: number;
  typ: string;
  groesse: string;
  letzteKal: string;
  faelligkeit: string;
  geschaetzt: boolean;
  status: MessmittelStatus;
  pruefungsart: "Werk" | "DAkkS";
  bewertung: string;
  katalog: string;
  minuten: number;
  messraum: string;
}

const BEWERTUNGEN = ["EINSATZFAEHIG", "ISTMASS", "BEDINGT_EINSATZFAEHIG_GELB", "SIEHE_KALIBRIERSCHEIN"];

const _messmittelCache = new Map<string, MessmittelRow[]>();

export function getMessmittel(kundeId: string, stichtag: Stichtag = "2026-09-25"): MessmittelRow[] {
  const key = `${kundeId}@${stichtag}`;
  const cached = _messmittelCache.get(key);
  if (cached) return cached;

  const k = getKunde(kundeId);
  if (!k) return [];

  const r = mulberry32(hashStr(`mm${kundeId}${stichtag}`));
  const cap = Math.min(k.aktiv, 1500);
  const rows: MessmittelRow[] = [];

  const nUeber = Math.round((k.ueberfaellig / Math.max(1, k.aktiv)) * cap);
  const nTeil = Math.round((k.teil / Math.max(1, k.aktiv)) * cap);
  const nBald = Math.round((k.faelligBald / Math.max(1, k.aktiv)) * cap);
  const nNio = Math.max(k.nioShare > 0.06 ? 1 : 0, Math.round(cap * k.nioShare * 0.4));
  const nStopp = Math.round(cap * 0.004);

  for (let i = 0; i < cap; i++) {
    const gruppe = k.groups[Math.floor(r() * k.groups.length)];
    const g = GRUPPEN[gruppe];
    const typ = g.typen[Math.floor(r() * g.typen.length)];
    const groesse = `${Math.round(3 + 47 * r())} mm`;

    let status: MessmittelStatus = "ok";
    if (i < nUeber) status = i < nTeil ? "teilabwanderung" : "ueberfaellig";
    else if (i < nUeber + nBald) status = "faellig_bald";
    else if (i < nUeber + nBald + nNio) status = "nio";
    else if (i < nUeber + nBald + nNio + nStopp) status = "gestoppt";

    let faelligkeit: string;
    let geschaetzt = false;
    if (status === "ueberfaellig" || status === "teilabwanderung") {
      faelligkeit = addDays(stichtag, -(16 + Math.floor(520 * r())));
    } else if (status === "faellig_bald") {
      faelligkeit = addDays(stichtag, 30 + Math.floor(31 * r()));
    } else if (status === "nio" || status === "gestoppt") {
      faelligkeit = addDays(stichtag, -Math.floor(600 * r()));
    } else {
      const ahead = 61 + Math.floor(640 * r());
      faelligkeit = addDays(stichtag, ahead);
      if (r() < 0.09) geschaetzt = true; // DQ-3 imputation
    }

    const intervalMonate = [12, 12, 18, 24, 36][Math.floor(r() * 5)];
    const letzteKal = addMonths(faelligkeit, -intervalMonate);
    const dakks =
      k.branche !== "Sonstiges" && k.branche !== "Handel" && r() < k.dakksShare * (daysBetween(letzteKal, "2026-09-25") < 300 ? 1.4 : 0.7);

    rows.push({
      id: `${kundeId}-${i}`,
      ident: `${g.kuerzel}-${String(100000 + Math.floor(r() * 899999))}`,
      gruppe,
      typ,
      groesse,
      letzteKal,
      faelligkeit,
      geschaetzt,
      status,
      pruefungsart: dakks ? "DAkkS" : "Werk",
      bewertung: status === "nio" ? "NICHT_EINSATZFAEHIG" : BEWERTUNGEN[Math.floor(r() * BEWERTUNGEN.length)],
      katalog: String(10000 + gruppe * 100 + Math.floor(r() * 99)),
      minuten: Math.round(g.min * (0.65 + 0.7 * r())),
      messraum: g.messraum,
    });
  }

  _messmittelCache.set(key, rows);
  return rows;
}

/* ----------------------------- reason codes ----------------------------- */

export interface Reason {
  code: ReasonCode;
  params: Record<string, string | number>;
}

export interface NebenAnlass {
  anlass: Anlass;
  stunden: number;
  dringlichkeit: number;
}

export interface Empfehlung {
  kundeId: string;
  stichtag: Stichtag;
  anlass: Anlass;
  nebenanlaesse: NebenAnlass[];
  stundenBetroffen: number;
  dringlichkeit: number;
  betroffeneAnzahl: number;
  begruendung: Reason[];
  faktoren: { code: ReasonCode; anteil: number }[];
  tageUeberfaellig?: number;
  kwVon?: string;
  kwBis?: number;
  rueckblick?: RueckblickArt;
}

export type RueckblickArt = "teil" | "keine" | "auftrag" | "volumen";

export const RUECKBLICK_TEMPLATES: Record<RueckblickArt, Record<"de" | "en", string>> = {
  teil: {
    de: "Kunde hat {n} von {total} Messmitteln eingeschickt.",
    en: "Customer sent in {n} of {total} instruments.",
  },
  keine: { de: "Keine Kalibrierung seit der Empfehlung.", en: "No calibration since the recommendation." },
  auftrag: { de: "Auftrag über {betrag} zugesagt.", en: "Order of {amount} confirmed." },
  volumen: { de: "Volumen {prozent} % gegenüber der Erwartung.", en: "Volume {prozent}% vs. expectation." },
};

export const ANLASS_ERFOLGSCHANCE: Record<Anlass, number> = {
  faellig_bald: 0.6,
  ueberfaellig: 0.35,
  abwanderung: 0.25,
  branche: 0.15,
  portal: 0.3,
};

export function dringlichkeitFor(a: Anlass, k: Kunde, tageUeberfaellig: number): number {
  switch (a) {
    case "ueberfaellig":
      return Math.exp(-tageUeberfaellig / 180);
    case "abwanderung":
      return k.risiko;
    case "branche":
      return 0.75;
    default:
      return 1;
  }
}

/** peers (active customers of the same Branche with ≥ 20 Messmittel) — M5 */
function peerMedianShare(branche: string, gruppe: number): number {
  const pen = penetration()[BRANCHEN.findIndex((b) => b.name === branche)];
  return pen[gruppe] * 0.18; // typical share of the group among owners
}

function branchenLuecken(k: Kunde): { gruppe: number; peer: number; stunden: number }[] {
  if (k.branche === "Sonstiges" || k.branche === "Ohne Zuordnung") return [];
  const pen = penetration()[BRANCHEN.findIndex((b) => b.name === k.branche)];
  const out: { gruppe: number; peer: number; stunden: number }[] = [];
  for (let g = 0; g < GRUPPEN.length; g++) {
    if (pen[g] >= 0.4 && !k.groups.includes(g)) {
      const erwartet = Math.max(1, Math.round(k.aktiv * peerMedianShare(k.branche, g)));
      out.push({ gruppe: g, peer: pen[g], stunden: (erwartet * GRUPPEN[g].min) / 60 });
    }
  }
  return out.sort((a, b) => b.peer - a.peer);
}

/* ----------------------------- candidates ----------------------------- */

const _candCache = new Map<Stichtag, Map<string, Empfehlung>>();

function buildCandidates(stichtag: Stichtag): Map<string, Empfehlung> {
  const cached = _candCache.get(stichtag);
  if (cached) return cached;

  const out = new Map<string, Empfehlung>();
  const kunden = getKunden();

  for (const k of kunden) {
    const r = mulberry32(hashStr(`c${k.id}${stichtag}`));
    const variant: NebenAnlass[] = [];

    // --- Überfällig (window: 15 days … 18 months)
    const tageUeber = 16 + Math.round(520 * Math.pow(r(), 1.4));
    if (k.ueberfaellig >= 1 && tageUeber <= 548) {
      const stunden = (k.ueberfaellig * k.stdMin) / 60;
      variant.push({ anlass: "ueberfaellig", stunden, dringlichkeit: dringlichkeitFor("ueberfaellig", k, tageUeber) });
    }

    // --- Fällig demnächst (30–60 days)
    if (k.faelligBald >= 1) {
      variant.push({ anlass: "faellig_bald", stunden: (k.faelligBald * k.stdMin) / 60, dringlichkeit: 1 });
    }

    // --- Abwanderungsrisiko
    if (k.risiko >= 0.5) {
      variant.push({ anlass: "abwanderung", stunden: k.umsatzStunden, dringlichkeit: k.risiko });
    }

    // --- Branchenpotenzial
    const luecken = branchenLuecken(k);
    if (luecken.length > 0 && k.aktiv >= 20) {
      const stunden = luecken.reduce((s, l) => s + l.stunden, 0);
      variant.push({ anlass: "branche", stunden, dringlichkeit: dringlichkeitFor("branche", k, 0) });
    }

    // --- Portal-Onboarding
    const portalNie = k.kanal.portal === 0 && k.positions12m >= 20;
    if (portalNie) {
      variant.push({ anlass: "portal", stunden: k.umsatzStunden * 0.05, dringlichkeit: 1 });
    }

    if (variant.length === 0) continue;

    // primary Anlass = highest Erwarteter Wert (Stundensatz & chance applied later,
    // but both are constant scalars per Anlass → rank with them already)
    variant.sort(
      (a, b) =>
        b.stunden * b.dringlichkeit * ANLASS_ERFOLGSCHANCE[b.anlass] -
        a.stunden * a.dringlichkeit * ANLASS_ERFOLGSCHANCE[a.anlass],
    );
    const primary = variant[0];
    const andere = variant.slice(1);

    // --- structured reasons (§8.9)
    const begruendung: Reason[] = [];
    const faktoren: { code: ReasonCode; anteil: number }[] = [];
    const tageMedian = 30 + Math.round(300 * Math.pow(r(), 1.5));

    if (primary.anlass === "ueberfaellig") {
      begruendung.push({ code: "UEBERFAELLIG", params: { n: k.ueberfaellig, tage: tageMedian } });
      if (k.teil > 0) begruendung.push({ code: "TEILABWANDERUNG", params: { n: k.teil } });
      begruendung.push({ code: "RECENCY", params: { monate: k.monateSeitKal, ueblich: 24 } });
      if (k.ruecklauf.lag > 45) begruendung.push({ code: "SPAET_RUECKLAUF", params: { tage: k.ruecklauf.lag } });
      faktoren.push(
        { code: "UEBERFAELLIG", anteil: 0.46 },
        { code: "TEILABWANDERUNG", anteil: 0.27 },
        { code: "RECENCY", anteil: 0.17 },
        { code: "SPAET_RUECKLAUF", anteil: 0.1 },
      );
    } else if (primary.anlass === "faellig_bald") {
      const von = addDays(stichtag, 30);
      const bis = addDays(stichtag, 60);
      begruendung.push({ code: "FAELLIG_BALD", params: { n: k.faelligBald, kwVon: kw(von), kwBis: kw(bis) } });
      begruendung.push({ code: "RECENCY", params: { monate: k.monateSeitKal, ueblich: 24 } });
      if (k.ruecklauf.lag > 45) begruendung.push({ code: "SPAET_RUECKLAUF", params: { tage: k.ruecklauf.lag } });
      faktoren.push(
        { code: "FAELLIG_BALD", anteil: 0.55 },
        { code: "SPAET_RUECKLAUF", anteil: 0.26 },
        { code: "RECENCY", anteil: 0.19 },
      );
    } else if (primary.anlass === "abwanderung") {
      begruendung.push({ code: "RECENCY", params: { monate: k.monateSeitKal, ueblich: 24 } });
      const trend = Math.round(20 + 55 * r());
      begruendung.push({ code: "TREND_RUECKGANG", params: { prozent: trend } });
      if (k.ruecklauf.lag > 45) begruendung.push({ code: "SPAET_RUECKLAUF", params: { tage: k.ruecklauf.lag } });
      if (k.kanal.portal > 0 && r() < 0.5)
        begruendung.push({ code: "KANAL_PORTAL_RUECKGANG", params: { prozent: Math.round(30 + 40 * r()) } });
      faktoren.push(
        { code: "RECENCY", anteil: 0.4 },
        { code: "TREND_RUECKGANG", anteil: 0.31 },
        { code: "SPAET_RUECKLAUF", anteil: 0.18 },
        { code: "KANAL_PORTAL_RUECKGANG", anteil: 0.11 },
      );
    } else if (primary.anlass === "branche") {
      const top = luecken[0];
      begruendung.push({
        code: "BRANCHE_LUECKE",
        params: { gruppe: GRUPPEN[top.gruppe].name, prozent: Math.round(top.peer * 100) },
      });
      const peerDakks = 0.3 + 0.35 * r();
      if (BRANCHEN.find((b) => b.name === k.branche)?.audit && k.dakksShare < peerDakks - 0.2) {
        begruendung.push({
          code: "DAKKS_LUECKE",
          params: { kunde: Math.round(k.dakksShare * 100), peer: Math.round(peerDakks * 100) },
        });
      }
      if (luecken.length > 1)
        begruendung.push({
          code: "BRANCHE_LUECKE",
          params: { gruppe: GRUPPEN[luecken[1].gruppe].name, prozent: Math.round(luecken[1].peer * 100) },
        });
      faktoren.push(
        { code: "BRANCHE_LUECKE", anteil: 0.58 },
        { code: "DAKKS_LUECKE", anteil: 0.24 },
        { code: "RECENCY", anteil: 0.18 },
      );
    } else {
      begruendung.push({ code: "KANAL_PORTAL_NIE", params: { n: k.positions12m } });
      begruendung.push({ code: "RECENCY", params: { monate: k.monateSeitKal, ueblich: 24 } });
      faktoren.push(
        { code: "KANAL_PORTAL_NIE", anteil: 0.62 },
        { code: "SPAET_RUECKLAUF", anteil: 0.21 },
        { code: "RECENCY", anteil: 0.17 },
      );
    }

    let rueckblick: RueckblickArt | undefined;
    if (stichtag === "2026-03-25") {
      const x = r();
      rueckblick = x < 0.34 ? "teil" : x < 0.72 ? "keine" : x < 0.88 ? "auftrag" : "volumen";
    }

    out.set(k.id, {
      kundeId: k.id,
      stichtag,
      anlass: primary.anlass,
      nebenanlaesse: andere,
      stundenBetroffen: primary.stunden,
      dringlichkeit: primary.dringlichkeit,
      betroffeneAnzahl:
        primary.anlass === "ueberfaellig"
          ? k.ueberfaellig
          : primary.anlass === "faellig_bald"
            ? k.faelligBald
            : primary.anlass === "branche"
              ? Math.max(1, Math.round(luecken.reduce((s, l) => s + l.stunden * 60 / GRUPPEN[l.gruppe].min, 0)))
              : k.aktiv,
      begruendung,
      faktoren,
      tageUeberfaellig: primary.anlass === "ueberfaellig" ? tageUeber : undefined,
      kwVon: primary.anlass === "faellig_bald" ? addDays(stichtag, 30) : undefined,
      kwBis: primary.anlass === "faellig_bald" ? kw(addDays(stichtag, 60)) : undefined,
      rueckblick,
    });
  }

  _candCache.set(stichtag, out);
  return out;
}

/* ----------------------------- EV + Tagesliste ----------------------------- */

export interface Einstellungen {
  stundensatz: number;
  kapazitaet: number;
  cooldown: number;
  risikoSchwelle: number;
  erfolgschancen: Record<Anlass, number>;
}

export const DEFAULT_EINSTELLUNGEN: Einstellungen = {
  stundensatz: 90,
  kapazitaet: 12,
  cooldown: 14,
  risikoSchwelle: 0.5,
  erfolgschancen: { ...ANLASS_ERFOLGSCHANCE },
};

export function erwarteterWert(e: Empfehlung, s: Einstellungen): number {
  return e.stundenBetroffen * s.stundensatz * s.erfolgschancen[e.anlass] * e.dringlichkeit;
}

export function prioritaeten(eintraege: { id: string; ev: number }[]): Map<string, Prioritaet> {
  const sorted = [...eintraege].sort((a, b) => b.ev - a.ev || a.id.localeCompare(b.id));
  const m = new Map<string, Prioritaet>();
  const n = sorted.length;
  sorted.forEach((e, i) => {
    m.set(e.id, i < Math.ceil(n * 0.2) ? "hoch" : i < Math.ceil(n * 0.5) ? "mittel" : "niedrig");
  });
  return m;
}

export interface TageslisteItem {
  kundeId: string;
  empfehlung: Empfehlung;
  ev: number;
  prioritaet: Prioritaet;
  wiedervorlage: boolean;
}

/** §8.8 assembly: candidates → cooldown/Wiedervorlage filter → EV sort → top N. */
export function getTagesliste(
  stichtag: Stichtag,
  s: Einstellungen,
  state: {
    ergebnisse: Record<string, { am: string }>;
    wiedervorlagen: Record<string, string>;
    done: Record<string, string>;
  },
): TageslisteItem[] {
  const cands = buildCandidates(stichtag);

  const ready: { id: string; ev: number; e: Empfehlung; wv: boolean }[] = [];
  for (const [id, e] of cands) {
    const ergebnis = state.ergebnisse[id];
    if (ergebnis && daysBetween(ergebnis.am, stichtag) < s.cooldown && daysBetween(ergebnis.am, stichtag) >= 0) continue;
    if (state.done[id]) continue;
    const wv = state.wiedervorlagen[id];
    if (wv && wv > stichtag) continue;
    ready.push({ id, ev: erwarteterWert(e, s), e, wv: Boolean(wv && wv === stichtag) });
  }

  const bands = prioritaeten(ready.map((r) => ({ id: r.id, ev: r.ev })));
  ready.sort((a, b) => b.ev - a.ev || a.id.localeCompare(b.id));

  return ready.slice(0, s.kapazitaet).map((r) => ({
    kundeId: r.id,
    empfehlung: r.e,
    ev: r.ev,
    prioritaet: bands.get(r.id) ?? "niedrig",
    wiedervorlage: r.wv,
  }));
}

/** Priorität for a single Kunde within the full candidate field (used on Kunde-360). */
export function getEmpfehlungFuer(
  kundeId: string,
  stichtag: Stichtag,
  s: Einstellungen,
): { empfehlung: Empfehlung; ev: number; prioritaet: Prioritaet } | undefined {
  const cands = buildCandidates(stichtag);
  const e = cands.get(kundeId);
  if (!e) return undefined;
  const alle = [...cands.entries()].map(([id, x]) => ({ id, ev: erwarteterWert(x, s) }));
  const bands = prioritaeten(alle);
  return { empfehlung: e, ev: erwarteterWert(e, s), prioritaet: bands.get(kundeId) ?? "niedrig" };
}

export function getKandidatenZahl(stichtag: Stichtag): number {
  return buildCandidates(stichtag).size;
}

/* ----------------------------- Zeitstrahl (per Kunde) ----------------------------- */

export interface ZeitstrahlBucket {
  key: string; // YYYY-MM
  ueberfaellig: number;
  faellig: number;
  erwartet: number;
}

export function getZeitstrahl(kundeId: string, stichtag: Stichtag = "2026-09-25"): ZeitstrahlBucket[] {
  const rows = getMessmittel(kundeId, stichtag);
  const k = getKunde(kundeId);
  const buckets = new Map<string, ZeitstrahlBucket>();
  const base = stichtag.slice(0, 7);

  const keyOf = (iso: string) => iso.slice(0, 7);
  const shift = (iso: string, months: number) => keyOf(addMonths(iso, months));

  for (let i = -6; i <= 12; i++) {
    const key = shift(`${base}-01`, i);
    buckets.set(key, { key, ueberfaellig: 0, faellig: 0, erwartet: 0 });
  }

  for (const row of rows) {
    const bUeber = buckets.get(keyOf(row.faelligkeit));
    if (bUeber && row.faelligkeit < stichtag) bUeber.ueberfaellig++;
    else if (bUeber) bUeber.faellig++;

    if (k) {
      const erwartetKey = keyOf(addDays(row.faelligkeit, k.ruecklauf.lag));
      const b = buckets.get(erwartetKey);
      if (b) b.erwartet += k.ruecklauf.quote;
    }
  }

  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/* ----------------------------- Portfolio-Lückenmatrix ----------------------------- */

export interface Luecke {
  gruppe: number;
  peer: number;
  besitzt: number;
  erwartet: number;
  stunden: number;
}

export function getLuecken(kundeId: string): Luecke[] {
  const k = getKunde(kundeId);
  if (!k) return [];
  const rows = getMessmittel(kundeId);
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.gruppe, (counts.get(r.gruppe) ?? 0) + 1);

  const pen = penetration()[BRANCHEN.findIndex((b) => b.name === k.branche)] ?? [];
  const out: Luecke[] = [];
  for (let g = 0; g < GRUPPEN.length; g++) {
    const besitzt = counts.get(g) ?? 0;
    const peer = pen[g] ?? 0;
    const erwartet = Math.max(1, Math.round(k.aktiv * peerMedianShare(k.branche, g)));
    out.push({
      gruppe: g,
      peer,
      besitzt,
      erwartet,
      stunden: besitzt === 0 && peer >= 0.4 ? (erwartet * GRUPPEN[g].min) / 60 : 0,
    });
  }
  return out;
}

/* ----------------------------- Aktivität (24 Monate) ----------------------------- */

export interface AktivitaetsMonat {
  monat: string; // YYYY-MM
  anzahl: number;
  dakks: number;
  nio: number;
}

export function getAktivitaet(kundeId: string, stichtag: Stichtag = "2026-09-25"): AktivitaetsMonat[] {
  const k = getKunde(kundeId);
  if (!k) return [];
  const r = mulberry32(hashStr(`act${kundeId}`));
  const out: AktivitaetsMonat[] = [];
  const monateProJahr = k.aktiv / 16;

  for (let i = 23; i >= 0; i--) {
    const key = addMonths(stichtag, -i).slice(0, 7);
    const seasonal = key.endsWith("-12") ? 0.72 : key.endsWith("-01") ? 0.88 : key.endsWith("-08") ? 0.9 : 1;
    const monatIdx = Number(key.slice(5, 7));
    const alterungsFaktor = i > 12 ? 1.18 : 1; // recency: busier in the past
    const fall = k.monateSeitKal > 12 && i <= Math.min(12, k.monateSeitKal) ? 0.25 : 1;
    const anzahl = Math.max(0, Math.round((monateProJahr / 12) * seasonal * alterungsFaktor * fall * (0.65 + 0.7 * r())));
    out.push({
      monat: key,
      anzahl,
      dakks: Math.round(anzahl * clamp(k.dakksShare + (monatIdx >= 1 && key >= "2026-01" ? 0.07 : 0), 0, 1)),
      nio: Math.round(anzahl * k.nioShare),
    });
  }
  return out;
}

/* ----------------------------- Prognosen (M2/M4) ----------------------------- */

export interface PrognoseMonat {
  monat: string;
  historie: boolean;
  kalibrierungen: number;
  stunden: number;
  p10: number;
  p90: number;
  baseline?: number;
}

const _prognoseCache = new Map<Stichtag, PrognoseMonat[]>();

/** Global series: 24 months history + 12 months forecast (M4). */
export function getPrognoseGesamt(stichtag: Stichtag = "2026-09-25"): PrognoseMonat[] {
  const cached = _prognoseCache.get(stichtag);
  if (cached) return cached;
  const out: PrognoseMonat[] = [];
  const r = mulberry32(hashStr(`prognose${stichtag}`));

  const start = addMonths(stichtag, -23);
  for (let i = 0; i < 36; i++) {
    const key = addMonths(start, i).slice(0, 7);
    const m = Number(key.slice(5, 7));
    const hist = i < 24;
    const saison = m === 12 ? 0.74 : m === 1 ? 0.86 : m === 8 ? 0.9 : m === 11 ? 1.06 : 1;
    const jahresTrend = 1 + (i / 36) * 0.11;
    let kal = Math.round(20200 * saison * jahresTrend * (0.96 + 0.08 * r()));

    if (!hist) {
      kal = Math.round(21400 * saison * jahresTrend * (0.97 + 0.06 * r()));
    }
    if (key === "2026-09") kal = 10_147; // partial month (DQ-9)

    const stunden = Math.round(kal * 0.18);
    const unc = hist ? 0 : 0.09 + 0.012 * (i - 23);
    out.push({
      monat: key,
      historie: hist,
      kalibrierungen: kal,
      stunden,
      p10: Math.round(kal * (1 - unc)),
      p90: Math.round(kal * (1 + unc)),
      baseline: hist ? undefined : Math.round(20200 * saison * jahresTrend),
    });
  }
  _prognoseCache.set(stichtag, out);
  return out;
}

export interface KundenPrognoseMonat {
  monat: string;
  kalibrierungen: number;
  p10: number;
  p90: number;
}

export function getKundenPrognose(kundeId: string, stichtag: Stichtag = "2026-09-25"): KundenPrognoseMonat[] {
  const k = getKunde(kundeId);
  if (!k) return [];
  const rows = getMessmittel(kundeId, stichtag);
  const buckets = new Map<string, number>();
  for (const row of rows) {
    if (row.status === "gestoppt" || row.status === "nio") continue;
    const monat = addDays(row.faelligkeit, k.ruecklauf.lag).slice(0, 7);
    buckets.set(monat, (buckets.get(monat) ?? 0) + k.ruecklauf.quote);
  }
  const neu = (k.aktiv / 24) * 0.08; // Erstkalibrierungen pro Monat
  const out: KundenPrognoseMonat[] = [];
  for (let i = 1; i <= 12; i++) {
    const key = addMonths(stichtag, i).slice(0, 7);
    const v = (buckets.get(key) ?? 0) + neu;
    out.push({
      monat: key,
      kalibrierungen: Math.round(v * 10) / 10,
      p10: Math.round(Math.max(0, v - Math.sqrt(Math.max(v, 1)) * 1.28) * 10) / 10,
      p90: Math.round((v + Math.sqrt(Math.max(v, 1)) * 1.28) * 10) / 10,
    });
  }
  return out;
}

/* ----------------------------- Cockpit aggregates ----------------------------- */

let _riskByBranche: { key: string; wert: number }[] | null = null;
let _riskByGebiet: { key: string; wert: number }[] | null = null;
let _kpi: { umsatz12m: number; atRisk: number } | null = null;

export function getCockpitAggregates() {
  if (!_kpi || !_riskByBranche || !_riskByGebiet) {
    const byB = new Map<string, number>();
    const byG = new Map<string, number>();
    let umsatz12m = 0;
    let atRisk = 0;
    for (const k of getKunden()) {
      const wert = k.umsatzStunden * DEFAULT_EINSTELLUNGEN.stundensatz;
      umsatz12m += wert;
      const risk = wert * k.risiko;
      atRisk += risk;
      byB.set(k.branche, (byB.get(k.branche) ?? 0) + risk);
      byG.set(k.gebiet, (byG.get(k.gebiet) ?? 0) + risk);
    }
    _riskByBranche = [...byB.entries()].map(([key, wert]) => ({ key, wert })).sort((a, b) => b.wert - a.wert);
    _riskByGebiet = [...byG.entries()].map(([key, wert]) => ({ key, wert })).sort((a, b) => b.wert - a.wert);
    _kpi = { umsatz12m, atRisk };
  }
  return {
    umsatz12m: _kpi.umsatz12m,
    atRisk: _kpi.atRisk,
    byBranche: _riskByBranche,
    byGebiet: _riskByGebiet,
    faellig3Monate: 61_842,
    ueberfaellig: HEADLINE.ueberfaellig,
  };
}

/* ----------------------------- Team ----------------------------- */

export interface TeamMember {
  userId: string;
  uebernommen: number;
  erledigt: number;
}

export function getTeam(): TeamMember[] {
  const r = mulberry32(hashStr("team"));
  return USERS.filter((u) => u.role === "inside").map((u) => ({
    userId: u.id,
    uebernommen: 14 + Math.floor(r() * 12),
    erledigt: 9 + Math.floor(r() * 11),
  }));
}

export function getErgebnisVerteilung(): { key: ErgebnisCode; n: number }[] {
  const r = mulberry32(hashStr("ergebnisse"));
  return [
    { key: "angebot", n: 18 + Math.floor(r() * 6) },
    { key: "auftrag", n: 7 + Math.floor(r() * 5) },
    { key: "keinBedarf", n: 5 + Math.floor(r() * 4) },
    { key: "wettbewerber", n: 3 + Math.floor(r() * 3) },
    { key: "ausgemustert", n: 4 + Math.floor(r() * 3) },
    { key: "falscherKontakt", n: 2 + Math.floor(r() * 3) },
    { key: "nichtErreicht", n: 6 + Math.floor(r() * 4) },
  ];
}

export function getVerlust(): { key: string; n: number }[] {
  return [
    { key: "Trescal", n: 7 },
    { key: "Testo Industrial Services", n: 4 },
    { key: "Hoffmann Group", n: 3 },
    { key: "Hahn+Kolb", n: 2 },
    { key: "Andere", n: 3 },
    { key: "Unbekannt", n: 5 },
  ];
}

export function getErfolgsquote(): { anlass: Anlass; versuche: number; erfolge: number }[] {
  const r = mulberry32(hashStr("erfolg"));
  const all: Anlass[] = ["ueberfaellig", "faellig_bald", "abwanderung", "branche", "portal"];
  return all.map((anlass) => {
    const versuche = 12 + Math.floor(r() * 20);
    const quote = ANLASS_ERFOLGSCHANCE[anlass] + (r() - 0.4) * 0.18;
    return { anlass, versuche, erfolge: Math.max(1, Math.round(versuche * quote)) };
  });
}

/* ----------------------------- Modellgüte (§8.10) ----------------------------- */

export interface Modellkarte {
  id: string;
  titel: string;
  was: { de: string; en: string };
  metrikName: string;
  wert: number;
  wertLabel: string;
  baselineName: string;
  baselineWert: number;
  baselineLabel: string;
  ziel: string;
  erfuellt: boolean;
  bedeutet: { de: string; en: string };
  chart: "kalibrierung" | "precision" | "prognose" | "ruecklauf" | "ranking";
}

export function getModellguete(): Modellkarte[] {
  return [
    {
      id: "M1M2",
      titel: "Rücklauf & Fälligkeitsprognose",
      was: {
        de: "Schätzt, wann Kunden ihre fälligen Messmittel tatsächlich einschicken – inklusive Neukalibrierungen.",
        en: "Estimates when customers actually send in due instruments – including first-time calibrations.",
      },
      metrikName: "Treffer im ±1-Monat-Fenster",
      wert: 0.674,
      wertLabel: "67,4 %",
      baselineName: "Fälligkeit ohne Versatz",
      baselineWert: 0.541,
      baselineLabel: "54,1 %",
      ziel: "≥ 60 % und besser als Baseline",
      erfuellt: true,
      bedeutet: {
        de: "Von 10 prognostizierten Eingängen liegen 7 im richtigen Monat – 13 mehr als ohne Rücklaufmodell. Dadurch wird der Engpass in der Planung früher sichtbar.",
        en: "7 of 10 predicted arrivals land in the right month – 13 more than without the return model, making capacity constraints visible earlier.",
      },
      chart: "ruecklauf",
    },
    {
      id: "M3",
      titel: "Abwanderungsrisiko",
      was: {
        de: "LightGBM-Klassifikator mit TreeSHAP-Erklärungen; Wahrscheinlichkeit, dass das Volumen in 6 Monaten unter die Hälfte der Erwartung fällt.",
        en: "LightGBM classifier with TreeSHAP explanations; probability that volume falls below half of expectation within 6 months.",
      },
      metrikName: "PR-AUC (Holdout 10/2025–03/2026)",
      wert: 0.41,
      wertLabel: "0,41",
      baselineName: "Recency-Regel (≥ 6 Monate)",
      baselineWert: 0.28,
      baselineLabel: "0,28",
      ziel: "precision@100 ≥ 1,2 × Baseline",
      erfuellt: true,
      bedeutet: {
        de: "In den 100 riskantesten Kunden liegen 62 tatsächlich im Einbruch – die alte Regel nur 52. Das sind 10 Kunden mehr, die man rechtzeitig anruft.",
        en: "62 of the 100 riskiest customers actually decline – the old rule catches only 52. Ten more customers get a timely call.",
      },
      chart: "precision",
    },
    {
      id: "M4",
      titel: "Auftragsvolumen",
      was: {
        de: "Bottom-up-Prognose: Summe der Einzelwahrscheinlichkeiten je Monat, plus Erstkalibrierungen, mit 80-%-Band.",
        en: "Bottom-up forecast: sum of individual probabilities per month plus first-time calibrations, with an 80% band.",
      },
      metrikName: "WAPE der 12 Monatssummen",
      wert: 0.087,
      wertLabel: "8,7 %",
      baselineName: "Beste Baseline (AutoETS 9,4 % · Saison-naiv 11,9 %)",
      baselineWert: 0.094,
      baselineLabel: "9,4 %",
      ziel: "≤ beste Baseline",
      erfuellt: true,
      bedeutet: {
        de: "Die Prognose trifft die Jahressumme besser als jedes Standardverfahren – die Planung kann sich auf das Band verlassen, nicht auf einen Punktwert.",
        en: "The forecast beats every standard method on the annual total – plan against the band, not a point value.",
      },
      chart: "prognose",
    },
    {
      id: "M5",
      titel: "Branchenpotenzial",
      was: {
        de: "Vergleicht das Portfolio eines Kunden mit aktiven Branchen-Peers und zeigt Gruppen, die der Kunde bei uns noch nicht kalibriert.",
        en: "Compares a customer's portfolio with active industry peers and shows groups not yet calibrated with us.",
      },
      metrikName: "Lücken innerhalb 12 Monaten gefüllt",
      wert: 0.42,
      wertLabel: "42 %",
      baselineName: "Zufällige Gruppe der Branche",
      baselineWert: 0.19,
      baselineLabel: "19 %",
      ziel: "Lift ≥ 2×",
      erfuellt: true,
      bedeutet: {
        de: "Der Vorschlag trifft in 42 % der Fälle – doppelt so oft wie ein Zufallsgriff. Jede gefüllte Lücke ist zusätzlicher Umsatz ohne Neukunden.",
        en: "The suggestion is right 42% of the time – twice as often as a random pick. Every filled gap is revenue without new customers.",
      },
      chart: "ranking",
    },
    {
      id: "Ranking",
      titel: "Ranking-Check · Rückblick 25.03.2026",
      was: {
        de: "Misst, ob Kunden mit hoher Priorität danach tatsächlich unter Erwartung lagen – der ehrlichste Test des Rankings.",
        en: "Measures whether high-priority customers did fall below expectation afterwards – the honest test of the ranking.",
      },
      metrikName: "Volumen unter Erwartung (Hoch)",
      wert: 0.54,
      wertLabel: "54 %",
      baselineName: "Mittel 33 % · Niedrig 19 %",
      baselineWert: 0.33,
      baselineLabel: "33 %",
      ziel: "monoton Hoch > Mittel > Niedrig",
      erfuellt: true,
      bedeutet: {
        de: "Die Prioritätbänder trennen sauber: Was als hoch markiert ist, verschlechtert sich später tatsächlich am häufigsten.",
        en: "The priority bands separate cleanly: what is flagged high does deteriorate most often afterwards.",
      },
      chart: "ranking",
    },
  ];
}

export function getKalibrierungskurve(): { x: number; modell: number; ideal: number }[] {
  const pts: { x: number; modell: number; ideal: number }[] = [];
  const r = mulberry32(hashStr("calib"));
  for (let i = 0; i <= 10; i++) {
    const x = i / 10;
    pts.push({ x, modell: clamp(x + (r() - 0.5) * 0.06, 0, 1), ideal: x });
  }
  return pts;
}

export function getPrecisionKurve(): { k: number; modell: number; baseline: number }[] {
  const out: { k: number; modell: number; baseline: number }[] = [];
  for (let k = 10; k <= 200; k += 10) {
    out.push({
      k,
      modell: clamp(0.72 - 0.11 * Math.log10(k / 8), 0.3, 0.8),
      baseline: clamp(0.52 - 0.1 * Math.log10(k / 8), 0.2, 0.6),
    });
  }
  return out;
}

export const RUECKLAUF_HISTOGRAMM = [
  { bucket: "> 90 T früh", anteil: 0.05 },
  { bucket: "31–90 T früh", anteil: 0.03 },
  { bucket: "±30 T", anteil: 0.55 },
  { bucket: "31–90 T spät", anteil: 0.26 },
  { bucket: "91–180 T spät", anteil: 0.07 },
  { bucket: "> 180 T spät", anteil: 0.04 },
];

export const DQ_REPORT: { regel: string; betroffen: number; beschreibung: { de: string; en: string } }[] = [
  { regel: "DQ-1", betroffen: 189, beschreibung: { de: "Fälligkeit nach 2040 → fehlend behandelt", en: "Due date after 2040 → treated as missing" } },
  { regel: "DQ-3", betroffen: 122_645, beschreibung: { de: "Prüfintervall 0 → Median des Typs", en: "Interval 0 → type median" } },
  { regel: "DQ-3", betroffen: 140_231, beschreibung: { de: "keine Fälligkeit → aus letzter Kalibrierung abgeleitet, als geschätzt markiert", en: "no due date → derived from last calibration, marked estimated" } },
  { regel: "DQ-4", betroffen: 159, beschreibung: { de: "FAELLIGKEIT_STOP → aus Fälligkeit ausgeschlossen", en: "FAELLIGKEIT_STOP → excluded from due logic" } },
  { regel: "DQ-5", betroffen: 27_833, beschreibung: { de: "NICHT_EINSATZFAEHIG → aus Fällig/Überfällig ausgeschlossen", en: "NICHT_EINSATZFAEHIG → excluded from due/overdue" } },
  { regel: "DQ-8", betroffen: 6_457, beschreibung: { de: "Branche Sonstiges → kein Branchenpotenzial", en: "industry Sonstiges → no industry potential" } },
  { regel: "DQ-11", betroffen: 14_031, beschreibung: { de: "ABGESAGT → aus Volumen ausgeschlossen, als Merkmal behalten", en: "ABGESAGT → excluded from volume, kept as feature" } },
];

export const ANNAHMEN: { id: string; titel: string; wert: string; quelle: string; status: "angenommen" | "gelernt" }[] = [
  { id: "A-1", titel: "Stundensatz", wert: "90 €/h", quelle: "Annahme – konservativ gegen 10,8 Mio € Umsatz (2023)", status: "angenommen" },
  { id: "A-2", titel: "Erfolgschance je Anlass", wert: "0,60 / 0,35 / 0,25 / 0,15 / 0,30", quelle: "Prior, wird aus Ergebnissen gelernt", status: "gelernt" },
  { id: "A-3", titel: "Überfällig > 60 Tage ≈ woanders kalibriert", wert: "60 Tage", quelle: "Annahme – quantifiziert über das Ergebnis Messmittel ausgemustert", status: "angenommen" },
  { id: "A-4", titel: "Abwanderungslabel", wert: "< 50 % der Erwartung in 6 Monaten", quelle: "Annahme – im Backtest tunbar", status: "angenommen" },
  { id: "A-5", titel: "Portal-Retentionseffekt", wert: "5 % der 12-Monats-Umsatzschätzung", quelle: "Annahme – mit Perschmann validieren", status: "angenommen" },
  { id: "A-6", titel: "Gebiet je Kunde", wert: "deterministisch aus Kundennummer", quelle: "Fiktiv – Demo-Stammdaten", status: "angenommen" },
];

export const ASSISTENT_EVAL = { richtig: 19, gesamt: 20 };

/* ----------------------------- Pitch state ----------------------------- */

export interface PitchState {
  claims: Record<string, string>; // kundeId -> userId
  ergebnisse: Record<string, { code: ErgebnisCode; am: string; user: string }>;
  wiedervorlagen: Record<string, string>;
  done: Record<string, string>;
}

export function seedPitchState(): PitchState {
  const list = getTagesliste("2026-09-25", DEFAULT_EINSTELLUNGEN, {
    ergebnisse: {},
    wiedervorlagen: {},
    done: {},
  });
  const claims: PitchState["claims"] = {};
  const ergebnisse: PitchState["ergebnisse"] = {};
  const done: PitchState["done"] = {};
  if (list[2]) claims[list[2].kundeId] = "sabine";
  if (list[8]) {
    done[list[8].kundeId] = "2026-09-25";
    ergebnisse[list[8].kundeId] = { code: "angebot", am: "2026-09-25", user: "sabine" };
  }
  if (list[11]) {
    done[list[11].kundeId] = "2026-09-25";
    ergebnisse[list[11].kundeId] = { code: "auftrag", am: "2026-09-25", user: "sabine" };
  }
  return { claims, ergebnisse, wiedervorlagen: {}, done };
}
