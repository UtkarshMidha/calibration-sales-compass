/* E-Mail-Entwurf (§12) and Gesprächsleitfaden templates — German Sie-form first. */

import { getMessmittel, type Anlass, type Empfehlung, type Kunde, type User } from "./data";
import { addDays, kw, type Lang } from "./format";
import type { TFn } from "./i18n";

const ANREDE = (k: Kunde, lang: Lang) => {
  if (lang === "en") return "Dear Sir or Madam,";
  if (k.anrede === "frau") return `Sehr geehrte Frau ${k.ansprech.split(" ").slice(1).join(" ")},`;
  if (k.anrede === "herr") return `Sehr geehrter Herr ${k.ansprech.split(" ").slice(1).join(" ")},`;
  return "Sehr geehrte Damen und Herren,";
};

export function topGruppen(kundeId: string, n = 3): { name: string; anzahl: number }[] {
  const rows = getMessmittel(kundeId).filter((r) => r.status === "ueberfaellig" || r.status === "teilabwanderung");
  const m = new Map<string, number>();
  for (const r of rows) {
    const g = r.typ.split(" ")[0];
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, anzahl]) => ({ name, anzahl })).sort((a, b) => b.anzahl - a.anzahl).slice(0, n);
}

export interface Entwurf {
  betreff: string;
  text: string;
}

export function buildEmail(
  kunde: Kunde,
  emp: Empfehlung | undefined,
  anlass: Anlass,
  lang: Lang,
  rep: User,
  repName: string,
  t: TFn,
): Entwurf {
  const n = emp?.betroffeneAnzahl ?? kunde.aktiv;
  const gruppen = topGruppen(kunde.id);
  const gruppenText = gruppen.map((g) => `${g.anzahl} ${g.name}`).join(", ");
  const stichtag = "2026-09-25";
  const kwVon = kw(addDays(stichtag, 30));
  const kwBis = kw(addDays(stichtag, 60));
  const signature = `${repName}\nVertriebsinnendienst · Perschmann Calibration GmbH\nTel. 05307 933-200 · kalibrieren@perschmann-calibration.de`;

  if (lang === "en") {
    const betreff =
      anlass === "ueberfaellig"
        ? `Your instruments – calibration overdue since week ${kwVon}`
        : anlass === "faellig_bald"
          ? `Your instruments fall due in weeks ${kwVon}–${kwBis}`
          : anlass === "portal"
            ? "trendic® hub – your certificates online"
            : `Calibration of your instruments – a quick note`;
    const body = [
      ANREDE(kunde, lang),
      "",
      anlass === "ueberfaellig"
        ? `While reviewing your instruments we found that ${n} of them (${gruppenText}) are past their calibration due date.`
        : anlass === "faellig_bald"
          ? `${n} of your instruments (${gruppenText}) fall due between weeks ${kwVon} and ${kwBis}.`
          : anlass === "abwanderung"
            ? `We noticed that your calibration volume has been declining and would like to check whether everything is working for you.`
            : anlass === "branche"
              ? `Many companies in your industry also have their measuring equipment calibrated by us – we would be happy to prepare an offer for your portfolio.`
              : `You placed ${kunde.positions12m} orders with us in the past year, none of them via trendic® hub. Certificates and due-date reminders are available online there.`,
      "",
      `To keep your measurement equipment audit-proof we can collect your instruments. A draft quote with all positions is attached.`,
      "",
      `May we schedule a pickup for next week?`,
      "",
      "Kind regards",
      signature,
    ].join("\n");
    return { betreff, text: body };
  }

  const betreff =
    anlass === "ueberfaellig"
      ? `Ihre Messmittel – Kalibrierung überfällig seit KW ${kwVon}`
      : anlass === "faellig_bald"
        ? `Ihre Messmittel werden in KW ${kwVon}–${kwBis} fällig`
        : anlass === "portal"
          ? "trendic® hub – Ihre Prüfmittel online"
          : "Ihre Messmittel – kurze Rückfrage zur Kalibrierung";

  const body = [
    ANREDE(kunde, lang),
    "",
    anlass === "ueberfaellig"
      ? `bei der Durchsicht Ihrer Messmittel ist uns aufgefallen, dass für ${n} Messmittel${gruppenText ? ` – darunter ${gruppenText}` : ""} die Kalibrierung seit KW ${kwVon} überfällig ist.`
      : anlass === "faellig_bald"
        ? `für ${n} Ihrer Messmittel${gruppenText ? ` – darunter ${gruppenText}` : ""} steht die Kalibrierung in den KW ${kwVon} bis ${kwBis} an. Damit Sie rechtzeitig planen können, melden wir uns jetzt schon.`
        : anlass === "abwanderung"
          ? `uns ist aufgefallen, dass Ihr Kalibriervolumen in den letzten Monaten zurückgegangen ist. Gibt es etwas, das wir an unserer Zusammenarbeit verbessern können?`
          : anlass === "branche"
            ? `viele Unternehmen Ihrer Branche lassen auch ihre übrigen Messmittel bei uns kalibrieren – gerne unterbreiten wir Ihnen ein Angebot für Ihr gesamtes Portfolio.`
            : `Sie haben uns im letzten Jahr ${kunde.positions12m} Aufträge erteilt, keinen davon über den trendic® hub. Zertifikate und Fälligkeitserinnerungen stehen dort jederzeit online bereit.`,
    "",
    `Damit Ihre Prüfmittelüberwachung auditsicher bleibt, holen wir die Messmittel gerne bei Ihnen ab. Ein Angebotsentwurf mit allen Positionen liegt bei.`,
    "",
    `Darf ich die Abholung für die kommende Woche einplanen?`,
    "",
    `Mit freundlichen Grüßen`,
    signature,
  ].join("\n");

  return { betreff, text: body };
}

export function buildLeitfaden(
  kunde: Kunde,
  emp: Empfehlung | undefined,
  anlass: Anlass,
  lang: Lang,
  t: TFn,
): { titel: string; absatz: { label: string; text: string }[] } {
  const n = emp?.betroffeneAnzahl ?? kunde.aktiv;
  const gruppen = topGruppen(kunde.id, 2);
  const gruppenText = gruppen.map((g) => `${g.anzahl} ${g.name}`).join(" und ");

  const de = [
    {
      label: "Opener",
      text: `${kunde.ansprech}, guten Tag hier ${kunde.name} – ich melde mich wegen Ihrer Kalibrierungen.`,
    },
    {
      label: "Anlass",
      text:
        anlass === "ueberfaellig"
          ? `${n} Messmittel sind überfällig${gruppenText ? `, darunter ${gruppenText}` : ""}. Dafür brauchen wir Sie nur einmal.`
          : anlass === "faellig_bald"
            ? `${n} Messmittel werden in KW ${kw(addDays("2026-09-25", 30))} bis KW ${kw(addDays("2026-09-25", 60))} fällig – jetzt ist der beste Zeitpunkt für die Abholung.`
            : anlass === "abwanderung"
              ? "Ihr Volumen ist spürbar zurückgegangen – ich wollte nachfragen, woran das liegt."
              : anlass === "branche"
                ? "Viele Unternehmen Ihrer Branche kalibrieren weitere Gruppen bei uns – dafür haben wir ein Angebot vorbereitet."
                : "Sie arbeiten bisher überwiegend intern – der trendic® hub spart Ihnen jeden Anruf.",
    },
    {
      label: "Werte",
      text: "Auditsicher nach DIN EN ISO/IEC 17025, Abholung und Rücksendung über unseren Hol- und Bringservice, Zertifikate sofort über den trendic® hub.",
    },
    {
      label: "Einwände",
      text: "»Wir kalibrieren intern« → wir übernehmen die Spitzenskalen und DAkkS-Positionen. »Ein anderer Anbieter ist günstiger« → Richtpreis plus Pauschale transparent, im Zweifel Positionsliste vergleichen. »Die Messmittel sind ausgemustert« → wir räumen die Liste gemeinsam auf.",
    },
    {
      label: "Abschluss",
      text: "Abholung nächste Woche buchen oder Angebotsentwurf per E-Mail senden – was passt Ihnen besser?",
    },
  ];

  const en = [
    { label: "Opener", text: `${kunde.ansprech}, good day – I am calling about your calibrations.` },
    {
      label: "Reason",
      text:
        anlass === "ueberfaellig"
          ? `${n} instruments are overdue${gruppenText ? `, including ${gruppenText}` : ""}.`
          : `${n} instruments fall due shortly – now is the best time for a pickup.`,
    },
    { label: "Value", text: "Audit-proof per DIN EN ISO/IEC 17025, pickup and return, certificates instantly via trendic® hub." },
    {
      label: "Objections",
      text: "“We calibrate in-house” → we take peak scales and DAkkS items. “Cheaper elsewhere” → compare line by line, guide prices are transparent. “Instruments are retired” → we clean up the list together.",
    },
    { label: "Close", text: "Book a pickup for next week or send the draft quote by email – which works better?" },
  ];

  const arr = lang === "en" ? en : de;
  return { titel: t("leitfaden.titel"), absatz: arr };
}

/** Minimal RFC-822 .eml for the Outlook download. */
export function buildEml(kunde: Kunde, entwurf: Entwurf): string {
  const von = "kalibrieren@perschmann-calibration.de";
  const an = kunde.email;
  const header = [
    `From: ${von}`,
    `To: ${an}`,
    `Subject: ${entwurf.betreff}`,
    `Date: Tue, 06 Oct 2026 07:30:00 +0200`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
  ].join("\r\n");
  return `${header}${entwurf.text.replace(/\n/g, "\r\n")}\r\n`;
}
