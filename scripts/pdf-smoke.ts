import { buildQuotePdf } from "../src/lib/pdf";

async function main() {
  const draft = {
    id: "AE-2026-000123",
    kundeId: "10132",
    stichtag: "2026-09-25",
    createdAt: "2026-10-07T00:00:00.000Z",
    lines: [
      {
        katalog: "011035 200",
        titel: "Messschieber kalibrieren",
        gruppeName: "Messschieber",
        pruefungsart: "DAkkS",
        minuten: 30,
        items: [
          { id: "a-1", ident: "MS-001001", typ: "Messschieber 150 mm", removed: false },
          { id: "a-2", ident: "MS-001002", typ: "Messschieber 200 mm", removed: false },
          { id: "a-3", ident: "MS-001003", typ: "Messschieber digital", removed: true },
        ],
      },
    ],
    logistik: { leihbox: true, dhl: true, dhlBoxes: 2, holbring: false },
    exportiert: false,
  } as any;

  const kunde = {
    id: "10132",
    nummer: "10132",
    name: "Müller Präzisionstechnik GmbH",
    branche: "Medical",
    gebiet: "Nord",
    ort: "Braunschweig",
    seit: 2005,
    aktiv: 260,
  } as any;

  for (const lang of ["de", "en"] as const) {
    const blob = buildQuotePdf({ draft, kunde, repName: "Sabine Schneider", repKurz: "S. Schneider", stundensatz: 90, lang });
    const buf = Buffer.from(await blob.arrayBuffer());
    const header = buf.subarray(0, 8).toString();
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(lang, "bytes:", buf.length, "header:", header, "pages~", pages);
    if (!header.startsWith("%PDF")) throw new Error("not a pdf");
    if (pages < 2) throw new Error("expected letter + annex pages");
    require("fs").writeFileSync(`./smoke-${lang}.pdf`, buf);
  }
  console.log("PDF SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
