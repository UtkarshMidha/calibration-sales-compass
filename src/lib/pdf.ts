/* Professional multi-page quote PDF (letter + positions + full instrument annex).
 * Built with jsPDF + autotable, no server needed. Standard fonts (WinAnsi)
 * cover German umlauts and the € sign.
 */

import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import { getMessmittel, type Kunde } from "./data";
import type { Lang } from "./format";
import type { Draft } from "./store";

const LEIHBOX = 51.9;
const DHL_BOX = 15.75;
const UST = 0.19;

const NAVY: [number, number, number] = [28, 59, 81];
const BRAND: [number, number, number] = [255, 112, 0];
const INK: [number, number, number] = [46, 48, 49];
const GREY: [number, number, number] = [109, 115, 120];

function lineUnit(minuten: number, art: "Werk" | "DAkkS", stundensatz: number): number {
  const raw = (minuten / 60) * stundensatz * (art === "DAkkS" ? 1.35 : 1);
  return Math.round(raw / 0.1) * 0.1;
}

/* autotable sets doc.lastAutoTable at runtime (see drawTable); read it defensively */
function lastY(doc: jsPDF, fallback: number): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return typeof t?.finalY === "number" ? t.finalY : fallback;
}

function money(v: number, loc: string): string {
  return new Intl.NumberFormat(loc, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function fmtDate(iso: string, loc: string): string {
  return new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const T = (lang: Lang) =>
  lang === "de"
    ? {
        draft: "Angebotsentwurf",
        draftNo: "Entwurf-Nr.",
        date: "Datum",
        valid: "Gültig bis",
        customerNo: "Kunden-Nr.",
        contact: "Ihr Ansprechpartner",
        dear: "Sehr geehrte Damen und Herren,",
        subject: (n: number, branche: string, ort: string) =>
          `Kalibrierung Ihrer ${n} fälligen bzw. überfälligen Messmittel`,
        body: (n: number, branche: string, ort: string) =>
          `vielen Dank für Ihr Vertrauen. Für Ihre ${n} fälligen bzw. überfälligen Messmittel (${branche}, ${ort}) bieten wir die Kalibrierung wie folgt an. Ab 01.01.2026 gilt die DAkkS-Kalibrierung (Deutsche Akkreditierungsstelle, staatlich akkreditiert) als Standard.`,
        positions: "Positionen",
        pos: "Pos.",
        service: "Leistung",
        cat: "Kat.-Nr.",
        qty: "Menge",
        unit: "Einzelpreis",
        total: "Gesamt",
        logistics: "Logistik",
        leihbox: "Leihbox (einmalig)",
        dhl: (b: number) => `DHL-Abholung, ${b} Boxen`,
        holbring: "Hol- und Bringservice (auf Anfrage)",
        subtotal: "Summe netto",
        vat: "zzgl. 19 % USt.",
        gross: "Gesamtbetrag brutto",
        guide: "Richtpreise (Schätzung aus Bearbeitungszeit × Stundensatz).",
        notesTitle: "Hinweise",
        note1: "Es handelt sich um Richtpreise (Schätzung auf Basis von Bearbeitungszeit und Stundensatz).",
        note2: "Seit 01.01.2026 ist die DAkkS-Kalibrierung (Deutsche Akkreditierungsstelle) die Standard-Prüfungsart, sofern nichts anderes vereinbart ist.",
        note3: "Bei Aufträgen unter 200 € netto fällt eine Bearbeitungspauschale an.",
        note4: "Abholung, DHL-Abholung und Leihbox verfügbar. Lieferschein über den trendic® hub.",
        regards: "Mit freundlichen Grüßen",
        role: "Vertriebsinnendienst",
        annex: "Anlage: Messmittelliste",
        annexIntro: (n: number) => `Vollständige Liste aller ${n} berücksichtigten Messmittel, gruppiert nach Position.`,
        ident: "Ident-Nr.",
        type: "Typ",
        due: "Fälligkeit",
        kind: "Prüfungsart",
        draftWatermark: "ENTWURF – UNVERBINDLICH",
        footer: "Perschmann Calibration GmbH · Hauptstraße 46d · 38110 Braunschweig · DAkkS-akkreditiert D-K-15089-01-00",
        page: (p: number, n: number) => `Seite ${p} von ${n}`,
        from: "Angebot",
      }
    : {
        draft: "Quote draft",
        draftNo: "Draft no.",
        date: "Date",
        valid: "Valid until",
        customerNo: "Customer no.",
        contact: "Your contact",
        dear: "Dear Sir or Madam,",
        subject: (n: number, branche: string, ort: string) =>
          `Calibration of your ${n} due or overdue instruments`,
        body: (n: number, branche: string, ort: string) =>
          `thank you for your trust. For your ${n} due or overdue instruments (${branche}, ${ort}) we offer the calibration as follows. Since 01/01/2026 DAkkS calibration (German accreditation body, state-accredited) is the standard.`,
        positions: "Lines",
        pos: "Pos.",
        service: "Service",
        cat: "Cat. no.",
        qty: "Qty",
        unit: "Unit price",
        total: "Total",
        logistics: "Logistics",
        leihbox: "Loan box (one-off)",
        dhl: (b: number) => `DHL pickup, ${b} boxes`,
        holbring: "Pickup & delivery (on request)",
        subtotal: "Subtotal net",
        vat: "plus 19 % VAT",
        gross: "Total gross",
        guide: "Guide prices (estimated from processing time × hourly rate).",
        notesTitle: "Notes",
        note1: "Prices are guide prices (estimated from processing time and hourly rate).",
        note2: "Since 01/01/2026 DAkkS calibration (German accreditation body) has been the standard test type unless agreed otherwise.",
        note3: "A handling fee applies to orders below €200 net.",
        note4: "Pickup, DHL collection and loan boxes available. Delivery note via trendic® hub.",
        regards: "Kind regards",
        role: "Inside sales",
        annex: "Annex: instrument list",
        annexIntro: (n: number) => `Complete list of all ${n} instruments covered, grouped by line.`,
        ident: "Asset ID",
        type: "Type",
        due: "Due date",
        kind: "Test type",
        draftWatermark: "DRAFT – NON-BINDING",
        footer: "Perschmann Calibration GmbH · Hauptstrasse 46d · 38110 Braunschweig · DAkkS accredited D-K-15089-01-00",
        page: (p: number, n: number) => `Page ${p} of ${n}`,
        from: "Quote",
      };

export interface QuotePdfInput {
  draft: Draft;
  kunde: Kunde;
  repName: string;
  repKurz: string;
  stundensatz: number;
  lang: Lang;
}

export function buildQuotePdf({ draft, kunde, repName, repKurz, stundensatz, lang }: QuotePdfInput): Blob {
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const t = T(lang);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 18; // margin
  const gueltig = addDays(draft.stichtag, 30);

  /* ---------- page 1: letterhead band ---------- */
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Perschmann Calibration GmbH", M, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("schnell, einfach, auditsicher · Hauptstrasse 46d · 38110 Braunschweig", M, 17);
  doc.setFontSize(9);
  doc.text(`${t.draft} ${draft.id}`, W - M, 11, { align: "right" });
  doc.text(fmtDate(draft.stichtag, loc), W - M, 17, { align: "right" });
  doc.setFillColor(...BRAND);
  doc.rect(0, 26, W, 1.2, "F");

  /* watermark */
  doc.saveGraphicsState();
  doc.setTextColor(235, 238, 241);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(t.draftWatermark, W / 2, 150, { align: "center", angle: -24 });
  doc.restoreGraphicsState();

  /* ---------- address + meta ---------- */
  let y = 36;
  doc.setTextColor(...INK);
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text("Perschmann Calibration GmbH · Hauptstrasse 46d · 38110 Braunschweig", M, y);
  y += 7;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(kunde.name, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 5;
  doc.text(kunde.ort, M, y);
  y += 5;
  doc.setTextColor(...GREY);
  doc.setFontSize(9);
  doc.text(`${t.customerNo} ${kunde.nummer} · ${kunde.branche}`, M, y);

  /* meta box */
  const meta: [string, string][] = [
    [t.draftNo, draft.id],
    [t.date, fmtDate(draft.stichtag, loc)],
    [t.valid, fmtDate(gueltig, loc)],
    [t.contact, repName],
  ];
  let my = 43;
  doc.setFontSize(9);
  for (const [k, v] of meta) {
    doc.setTextColor(...GREY);
    doc.text(k, W - M - 62, my);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(v, W - M, my, { align: "right" });
    doc.setFont("helvetica", "normal");
    my += 5;
  }
  doc.setTextColor(...GREY);
  doc.text(`${repKurz} · 05307 933-200`, W - M, my, { align: "right" });

  /* ---------- subject + body ---------- */
  const menge = draft.lines.reduce((s, l) => s + l.items.filter((i) => !i.removed).length, 0);
  y += 10;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const subjectLines = doc.splitTextToSize(t.subject(menge, kunde.branche, kunde.ort), W - 2 * M);
  doc.text(subjectLines, M, y);
  y += subjectLines.length * 5 + 3;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(t.dear, M, y);
  y += 6;
  const bodyLines = doc.splitTextToSize(t.body(menge, kunde.branche, kunde.ort), W - 2 * M);
  doc.text(bodyLines, M, y);
  y += bodyLines.length * 4.6 + 4;

  /* ---------- positions ---------- */
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(t.positions, M, y);
  y += 2;

  const lineTotal = (li: number) => {
    const l = draft.lines[li];
    return l.items.filter((i) => !i.removed).length * lineUnit(l.minuten, l.pruefungsart, stundensatz);
  };

  const posBody = draft.lines.map((l, li) => {
    const active = l.items.filter((i) => !i.removed).length;
    const unit = lineUnit(l.minuten, l.pruefungsart, stundensatz);
    return [
      `${li + 1}`,
      `${l.titel}\n${t.cat} ${l.katalog} · ${l.pruefungsart} · ${l.minuten} min`,
      `${active}`,
      money(unit, loc),
      money(active * unit, loc),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 14, bottom: 24 },
    head: [[t.pos, t.service, t.qty, t.unit, t.total]],
    body: posBody,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, textColor: INK, cellPadding: 2.2, lineColor: [220, 227, 234], lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      2: { halign: "right", cellWidth: 14 },
      3: { halign: "right", cellWidth: 26 },
      4: { halign: "right", cellWidth: 28, fontStyle: "bold" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cy = lastY(doc, y + 4) + 4;

  /* logistics */
  const logRows: [string, string][] = [];
  if (draft.logistik.leihbox) logRows.push([t.leihbox, money(LEIHBOX, loc)]);
  if (draft.logistik.dhl) logRows.push([t.dhl(draft.logistik.dhlBoxes), money(draft.logistik.dhlBoxes * DHL_BOX, loc)]);
  if (draft.logistik.holbring) logRows.push([t.holbring, "—"]);
  if (logRows.length > 0) {
    autoTable(doc, {
      startY: cy,
      margin: { left: M, right: M, top: 14, bottom: 24 },
      body: logRows.map(([a, b]) => [`→  ${a}`, b]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 9, textColor: INK },
      columnStyles: { 1: { halign: "right" } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cy = lastY(doc, cy) + 4;
  }

  /* totals */
  const kalibrierung = draft.lines.reduce((s, _, li) => s + lineTotal(li), 0);
  const logistikSum = (draft.logistik.leihbox ? LEIHBOX : 0) + (draft.logistik.dhl ? draft.logistik.dhlBoxes * DHL_BOX : 0);
  const netto = kalibrierung + logistikSum;
  const ust = netto * UST;
  const brutto = netto + ust;

  autoTable(doc, {
    startY: cy,
    margin: { left: W - M - 78, right: M, top: 14, bottom: 24 },
    body: [
      [t.subtotal, money(netto, loc)],
      [t.vat, money(ust, loc)],
      [t.gross, money(brutto, loc)],
    ],
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9.5, textColor: INK },
    columnStyles: { 0: { cellWidth: 44 }, 1: { halign: "right", fontStyle: "bold" } },
    didParseCell: (d) => {
      if (d.row.index === 2) {
        d.cell.styles.fontSize = 11;
        d.cell.styles.textColor = NAVY;
      }
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy = lastY(doc, cy) + 3;
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(t.guide, W - M, cy, { align: "right" });
  cy += 7;

  /* notes */
  const needNotes = (doc: jsPDF, yPos: number) => {
    if (yPos > 248) {
      doc.addPage();
      return 30;
    }
    return yPos;
  };
  cy = needNotes(doc, cy);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(t.notesTitle, M, cy);
  cy += 5;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const [i, note] of [t.note1, t.note2, t.note3, t.note4].entries()) {
    const lines = doc.splitTextToSize(`${i + 1}.  ${note}`, W - 2 * M - 2);
    cy = needNotes(doc, cy + (lines.length - 1) * 4.2);
    doc.text(lines, M + 2, cy);
    cy += lines.length * 4.2 + 1.5;
  }

  /* signature */
  cy = needNotes(doc, cy + 6);
  cy += 4;
  doc.setTextColor(...INK);
  doc.text(t.regards, M, cy);
  cy += 10;
  doc.setFont("helvetica", "bold");
  doc.text(repName, M, cy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  cy += 5;
  doc.text(`${t.role} · Perschmann Calibration GmbH`, M, cy);

  /* ---------- annex: full instrument list ---------- */
  const mmById = new Map(getMessmittel(kunde.id, draft.stichtag).map((r) => [r.id, r]));
  const groups = draft.lines
    .map((l, li) => ({
      title: `${li + 1}.  ${l.titel} (${t.cat} ${l.katalog}, ${l.pruefungsart})`,
      rows: l.items
        .filter((i) => !i.removed)
        .map((it) => {
          const mm = mmById.get(it.id);
          return [it.ident, it.typ, mm ? fmtDate(mm.faelligkeit, loc) : "—", l.pruefungsart];
        }),
    }))
    .filter((g) => g.rows.length > 0);

  if (groups.length > 0) {
    doc.addPage();
    let ay = 24;
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(t.annex, M, ay);
    ay += 6;
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(t.annexIntro(menge), M, ay);
    ay += 4;
    for (const g of groups) {
      if (ay > 258) {
        doc.addPage();
        ay = 24;
      }
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(g.title, M, ay);
      autoTable(doc, {
        startY: ay + 2,
        margin: { left: M, right: M, top: 18, bottom: 22 },
        head: [[t.ident, t.type, t.due, t.kind]],
        body: g.rows,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8.5, textColor: INK, cellPadding: 1.8, lineColor: [220, 227, 234], lineWidth: 0.2 },
        headStyles: { fillColor: [53, 106, 140], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ay = lastY(doc, ay + 2) + 7;
    }
  }

  /* ---------- footers + continuation headers ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setTextColor(...GREY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${t.from} ${draft.id} · ${kunde.name}`, M, 12);
      doc.setDrawColor(220, 227, 234);
      doc.line(M, 14.5, W - M, 14.5);
    }
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(t.footer, M, 290);
    doc.text(t.page(i, pages), W - M, 290, { align: "right" });
  }

  return doc.output("blob");
}

export function downloadQuotePdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
