"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  Mail,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getKunde } from "@/lib/data";
import { addDays, date, euro } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { buildQuotePdf, downloadQuotePdf } from "@/lib/pdf";
import { useApp, type DraftLine } from "@/lib/store";
import { Btn, Chip, DemoBadge, EmptyState } from "@/components/ui";

const LEIHBOX = 51.9;
const DHL_BOX = 15.75;
const UST = 0.19;

/* Richtpreis: Bearbeitungszeit × Stundensatz, DAkkS-Aufschlag 35 %, gerundet auf 0,10 € */
function lineUnit(minuten: number, art: "Werk" | "DAkkS", stundensatz: number): number {
  const raw = (minuten / 60) * stundensatz * (art === "DAkkS" ? 1.35 : 1);
  return Math.round(raw / 0.1) * 0.1;
}

export default function AngebotPage() {
  const params = useParams<{ id: string }>();
  const app = useApp();
  const { t, lang } = useI18n();
  const router = useRouter();
  const loc = lang === "de" ? "de-DE" : "en-GB";

  const draft = app.getDraft(params.id);
  const k = draft ? getKunde(draft.kundeId) : undefined;
  const [openLine, setOpenLine] = useState<string | null>(null);

  if (!draft || !k) {
    return (
      <div className="h-full grid place-items-center">
        <EmptyState
          title={lang === "de" ? "Entwurf nicht gefunden" : "Draft not found"}
          hint={params.id}
          action={<Btn onClick={() => router.push("/")}>{t("angebot.zurueck")}</Btn>}
        />
      </div>
    );
  }

  const stundensatz = app.settings.stundensatz;
  const patch = (p: Parameters<typeof app.updateDraft>[1]) => app.updateDraft(draft.id, p);

  /* ---- totals ---- */
  const lineTotal = (l: DraftLine) =>
    l.items.filter((i) => !i.removed).length * lineUnit(l.minuten, l.pruefungsart, stundensatz);

  const kalibrierung = draft.lines.reduce((s, l) => s + lineTotal(l), 0);
  const logistikSum =
    (draft.logistik.leihbox ? LEIHBOX : 0) + (draft.logistik.dhl ? draft.logistik.dhlBoxes * DHL_BOX : 0);
  const netto = kalibrierung + logistikSum;
  const ust = netto * UST;
  const brutto = netto + ust;
  const menge = draft.lines.reduce((s, l) => s + l.items.filter((i) => !i.removed).length, 0);

  const gueltig = addDays(draft.stichtag, 30);

  const setAllArt = (art: "Werk" | "DAkkS") =>
    patch({ lines: draft.lines.map((l) => ({ ...l, pruefungsart: art })) });

  const removeItem = (li: number, ii: number) =>
    patch({
      lines: draft.lines.map((l, x) =>
        x === li ? { ...l, items: l.items.map((it, y) => (y === ii ? { ...it, removed: !it.removed } : it)) } : l,
      ),
    });

  const downloadPdf = () => {
    const blob = buildQuotePdf({
      draft,
      kunde: k,
      repName: t(app.user.nameKey),
      repKurz: app.user.kurz,
      stundensatz,
      lang,
    });
    downloadQuotePdf(blob, `${lang === "de" ? "Angebotsentwurf" : "Quote-draft"}-${draft.id}.pdf`);
    if (!draft.exportiert) patch({ exportiert: true });
    app.toast(lang === "de" ? "PDF erstellt und heruntergeladen." : "PDF created and downloaded.");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="page grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* ============ document sheet ============ */}
        <div className="print-root">
          <div className="flex items-center gap-2 mb-3 no-print">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-brand-700 font-semibold"
            >
              <ArrowLeft size={12} /> {t("angebot.zurueck")}
            </Link>
            <DemoBadge />
          </div>

          <div className="print-sheet relative bg-white border border-line rounded-[12px] shadow-[0_18px_50px_-30px_rgba(16,42,67,0.5)] p-8 md:p-10 text-[13px] text-ink overflow-hidden anim-fade-up">
            <span className="print-watermark absolute left-[16%] top-[44%] -rotate-[24deg] text-[46px] font-black tracking-tight text-navy-800/[0.07] select-none pointer-events-none whitespace-nowrap">
              {t("angebot.wasserzeichen")}
            </span>

            {/* sender + address */}
            <div className="flex items-start justify-between gap-6 relative">
              <div>
                <p className="text-[10.5px] text-ink-3 leading-snug">{t("angebot.absender")}</p>
                <div className="mt-6 leading-snug">
                  <p className="font-semibold text-[13.5px]">{k.name}</p>
                  <p className="text-ink-2">{k.ort}</p>
                  <p className="text-ink-3 tnum text-[12px] mt-0.5">{lang === "de" ? "Kunden-Nr." : "Customer no."} {k.nummer}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10.5px] text-ink-3">{k.branche}</p>
                <p className="text-[10.5px] text-ink-3">
                  {t("angebot.ansprechpartner")}: {t(app.user.nameKey)}
                </p>
                <p className="text-[10.5px] text-ink-3 tnum">{app.user.kurz} · 05307 933-200</p>
              </div>
            </div>

            {/* title + meta */}
            <div className="mt-7 flex items-end justify-between gap-6 border-b-2 border-navy-800 pb-2">
              <div>
                <h1 className="text-[19px] font-bold text-navy-800 tracking-tight">{t("angebot.titel")}</h1>
                <p className="text-[12px] text-ink-2 tnum">
                  {t("angebot.nr")} {draft.id}
                </p>
              </div>
              <table className="text-[11.5px] tnum">
                <tbody>
                  <tr>
                    <td className="text-ink-3 pr-3">{t("angebot.datum")}</td>
                    <td className="font-semibold text-right">{date(app.stichtag, loc)}</td>
                  </tr>
                  <tr>
                    <td className="text-ink-3 pr-3">{t("angebot.gueltig")}</td>
                    <td className="font-semibold text-right">{date(gueltig, loc)}</td>
                  </tr>
                  <tr>
                    <td className="text-ink-3 pr-3">{t("angebot.kundenr")}</td>
                    <td className="font-semibold text-right">{k.nummer}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* body */}
            <p className="mt-6 leading-relaxed">
              {lang === "de" ? "Sehr geehrte Damen und Herren," : "Dear Sir or Madam,"}
            </p>
            <p className="mt-3 leading-relaxed text-ink-2">
              {lang === "de"
                ? `vielen Dank für Ihr Vertrauen. Für Ihre ${menge} fälligen bzw. überfälligen Messmittel (${k.branche}, ${k.ort}) bieten wir die Kalibrierung wie folgt an. Ab 01.01.2026 gilt die DAkkS-Kalibrierung (Deutsche Akkreditierungsstelle, staatlich akkreditiert) als Standard.`
                : `thank you for your trust. For your ${menge} due or overdue instruments (${k.branche}, ${k.ort}) we offer the calibration as follows. Since 01/01/2026 DAkkS calibration (German accreditation body, state-accredited) is the standard.`}
            </p>

            {/* positions */}
            <div className="mt-5">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 mb-2">
                {t("angebot.positionen")}
              </h2>

              {draft.lines.length === 0 ? (
                <p className="text-ink-3 py-4">{t("angebot.leer")}</p>
              ) : (
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-surface-1 border-y border-line text-[10px] uppercase tracking-wider text-ink-3">
                      <th className="text-left font-bold px-2 py-1.5 w-9">{t("angebot.pos")}</th>
                      <th className="text-left font-bold px-2 py-1.5">{t("angebot.leistung")}</th>
                      <th className="text-left font-bold px-2 py-1.5">{t("angebot.kat")}</th>
                      <th className="text-right font-bold px-2 py-1.5">{t("angebot.menge")}</th>
                      <th className="text-right font-bold px-2 py-1.5">{t("angebot.einzelpreis")}</th>
                      <th className="text-right font-bold px-2 py-1.5 w-[86px]">{t("angebot.gesamt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((l, li) => {
                      const active = l.items.filter((i) => !i.removed).length;
                      const unit = lineUnit(l.minuten, l.pruefungsart, stundensatz);
                      const open = openLine === l.katalog;
                      return (
                        <tr key={l.katalog} className={clsx("border-b border-line align-top", active === 0 && "opacity-45")}>
                          <td className="px-2 py-2 tnum text-ink-3">{li + 1}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-start gap-1.5 group">
                              <button
                                onClick={() => setOpenLine(open ? null : l.katalog)}
                                className="flex items-start gap-1 text-left"
                                aria-expanded={open}
                              >
                                <ChevronDown
                                  size={12}
                                  className={clsx("mt-1 shrink-0 text-ink-3 transition-transform", open && "rotate-180")}
                                />
                                <span>
                                  <span className="font-semibold text-ink group-hover:text-brand-700">{l.titel}</span>
                                  <span className="block text-[10.5px] text-ink-3 tnum">
                                    {l.gruppeName} · {l.minuten} min ·{" "}
                                    <span
                                      className={clsx(
                                        "font-bold underline decoration-dotted underline-offset-2",
                                        l.pruefungsart === "DAkkS" ? "text-azure-800" : "text-ink-2",
                                      )}
                                      title={l.pruefungsart}
                                    >
                                      {l.pruefungsart}
                                    </span>
                                  </span>
                                </span>
                              </button>
                              <button
                                onClick={() =>
                                  patch({ lines: draft.lines.filter((_, i) => i !== li) })
                                }
                                className="text-ink-3 hover:text-critical opacity-60 hover:opacity-100 focus:opacity-100 transition-opacity"
                                title={t("angebot.zeileEntfernen")}
                                aria-label={t("angebot.zeileEntfernen")}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            {open && (
                              <ul className="mt-1.5 ml-4 space-y-0.5 anim-fade-in">
                                {l.items.map((it, ii) => (
                                  <li
                                    key={it.id}
                                    className={clsx(
                                      "flex items-center gap-2 text-[11px] tnum",
                                      it.removed ? "text-ink-3 line-through" : "text-ink-2",
                                    )}
                                  >
                                    <button
                                      onClick={() => removeItem(li, ii)}
                                      className={clsx(
                                        "w-4 h-4 rounded-[6px] border grid place-items-center shrink-0",
                                        it.removed ? "border-line-strong bg-surface-1 text-ink-3" : "border-ok bg-ok text-white",
                                      )}
                                      title={it.removed ? "restore" : "remove"}
                                    >
                                      {it.removed ? <X size={9} /> : <Check size={9} />}
                                    </button>
                                    {it.ident}
                                    <span className="text-ink-3">· {it.typ}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-2 py-2 tnum text-ink-3 align-top">{l.katalog}</td>
                          <td className="px-2 py-2 text-right tnum align-top">{active}</td>
                          <td className="px-2 py-2 text-right tnum align-top">{euro(unit, loc)}</td>
                          <td className="px-2 py-2 text-right tnum font-semibold align-top">{euro(lineTotal(l), loc)}</td>
                        </tr>
                      );
                    })}

                    {/* logistics rows */}
                    {draft.logistik.leihbox && (
                      <LogisticsRow label={t("angebot.leihbox")} qty={1} price={LEIHBOX} loc={loc} />
                    )}
                    {draft.logistik.dhl && (
                      <LogisticsRow
                        label={`${t("angebot.dhl")} × ${draft.logistik.dhlBoxes}`}
                        qty={draft.logistik.dhlBoxes}
                        price={DHL_BOX}
                        loc={loc}
                      />
                    )}
                    {draft.logistik.holbring && (
                      <LogisticsRow label={t("angebot.holbring")} qty={1} price={0} loc={loc} />
                    )}

                    {logistikSum > 0 && (
                      <tr className="border-b border-line">
                        <td colSpan={5} className="px-2 py-1.5 text-right text-[11.5px] text-ink-3">
                          {t("angebot.logistik")}
                        </td>
                        <td className="px-2 py-1.5 text-right tnum font-semibold">{euro(logistikSum, loc)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* totals */}
            <div className="mt-4 flex justify-end">
              <table className="text-[12.5px] w-[260px]">
                <tbody>
                  <tr>
                    <td className="py-1 pr-3 text-ink-2">{t("angebot.summe")}</td>
                    <td className="py-1 text-right tnum font-semibold">{euro(netto, loc)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-3 text-ink-2">{t("angebot.ust")}</td>
                    <td className="py-1 text-right tnum">{euro(ust, loc)}</td>
                  </tr>
                  <tr className="border-t-2 border-navy-800">
                    <td className="pt-1.5 pr-3 font-bold text-navy-800">{t("angebot.brutto")}</td>
                    <td className="pt-1.5 text-right tnum font-bold text-navy-800 text-[15px]">{euro(brutto, loc)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-[11px] text-ink-3 italic text-right tnum">
              {t("angebot.richtpreis")} · {t("einst.stundensatz")}: {euro(stundensatz, loc, false)} / Std.
            </p>

            {/* notes */}
            <ol className="mt-5 space-y-1 text-[11px] text-ink-2 list-none counter-reset-px">
              {(["angebot.notiz1", "angebot.notiz2", "angebot.notiz3", "angebot.notiz4"] as const).map((key, i) => (
                <li key={key} className="flex gap-1.5">
                  <span className="tnum text-ink-3 shrink-0">{i + 1}.</span>
                  <span>{t(key)}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex items-start justify-between gap-6">
              <div>
                <p className="mt-4 text-[12.5px]">{t("angebot.gruss")}</p>
                <p className="mt-4 font-semibold text-[13px]">{t(app.user.nameKey)}</p>
                <p className="text-[11.5px] text-ink-3">
                  {lang === "de" ? "Vertriebsinnendienst" : "Sales support"} · Perschmann Calibration GmbH
                </p>
              </div>
              <p className="text-[11px] text-ink-3 text-right">{t("angebot.anlage")}</p>
            </div>

            <p className="mt-7 pt-3 border-t border-line text-[9.5px] text-ink-3 leading-snug">{t("angebot.fuss")}</p>
          </div>
        </div>

        {/* ============ side panel ============ */}
        <aside className="space-y-3 no-print xl:sticky xl:top-0 anim-fade-up">
          <div className="card p-4">
            <p className="section-label">
              {t("angebot.gesamt")} {lang === "de" ? "netto" : "net"}
            </p>
            <p className="tnum text-[24px] font-bold text-navy-800 leading-tight">{euro(netto, loc)}</p>
            <p className="tnum text-[12.5px] text-ink-3">
              {t("angebot.brutto")}: {euro(brutto, loc)}
            </p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Chip tone="neutral">
                {menge} {lang === "de" ? "Messmittel" : "instruments"}
              </Chip>
              <Chip tone="neutral">
                {draft.lines.length} {lang === "de" ? "Positionen" : "lines"}
              </Chip>
              {draft.exportiert && <Chip tone="ok">{lang === "de" ? "Exportiert" : "Exported"}</Chip>}
            </div>

            <div className="grid grid-cols-1 gap-2 mt-3">
              <Btn variant="primary" onClick={downloadPdf}>
                <Download size={14} /> {t("angebot.pdf")}
              </Btn>
              <Btn variant="secondary" onClick={() => router.push("/")}>
                <ArrowLeft size={14} /> {t("angebot.zurueck")}
              </Btn>
            </div>
            <p className="text-[11px] text-ink-3 mt-2">
              {lang === "de"
                ? "Lädt das vollständige PDF (Anschreiben, Positionen, Messmittel-Anlage, Hinweise)."
                : "Downloads the complete PDF (letter, lines, instrument annex, notes)."}
            </p>
          </div>

          {/* test type */}
          <div className="card p-4">
            <p className="section-label mb-2">
              {t("k360.spalten.pruefungsart")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Btn size="sm" variant="secondary" onClick={() => setAllArt("DAkkS")}>
                {t("angebot.allesDakks")}
              </Btn>
              <Btn size="sm" variant="secondary" onClick={() => setAllArt("Werk")}>
                {t("angebot.allesWerk")}
              </Btn>
            </div>
            <p className="text-[11px] text-ink-3 mt-2" title={lang === "de" ? "DAkkS = Deutsche Akkreditierungsstelle (staatlich akkreditiert)" : "DAkkS = German accreditation body (state-accredited)"}>
              {lang === "de" ? "DAkkS = ×1,35 zum Richtpreis." : "DAkkS = ×1.35 of the guide price."}
            </p>
          </div>

          {/* logistics */}
          <div className="card p-4">
            <p className="section-label mb-2">{t("angebot.logistik")}</p>
            <div className="space-y-2">
              <ToggleRow
                label={t("angebot.leihbox")}
                value={euro(LEIHBOX, loc)}
                checked={draft.logistik.leihbox}
                onChange={(v) => patch({ logistik: { ...draft.logistik, leihbox: v } })}
              />
              <ToggleRow
                label={t("angebot.dhl")}
                value={`${euro(DHL_BOX, loc)} × ${draft.logistik.dhlBoxes}`}
                checked={draft.logistik.dhl}
                onChange={(v) => patch({ logistik: { ...draft.logistik, dhl: v } })}
              />
              {draft.logistik.dhl && (
                <label className="flex items-center justify-between gap-2 text-[12px] text-ink-2 pl-4">
                  <span className="text-ink-3">{lang === "de" ? "Boxen" : "boxes"}</span>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={draft.logistik.dhlBoxes}
                    onChange={(e) =>
                      patch({ logistik: { ...draft.logistik, dhlBoxes: Math.max(1, Number(e.target.value) || 1) } })
                    }
                    className="w-16 h-9 rounded-[8px] border border-line px-2 text-right outline-none focus:border-brand-700 tnum"
                  />
                </label>
              )}
              <ToggleRow
                label={t("angebot.holbring")}
                value={lang === "de" ? "auf Anfrage" : "on request"}
                checked={draft.logistik.holbring}
                onChange={(v) => patch({ logistik: { ...draft.logistik, holbring: v } })}
              />
            </div>
          </div>

          {/* quick actions */}
          <div className="card p-4 space-y-2">
            <p className="section-label">
              {lang === "de" ? "Weiter" : "Next"}
            </p>
            <Btn
              variant="secondary"
              className="w-full"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(`${t("angebot.titel")} ${draft.id} · ${k.name} · ${euro(brutto, loc)}`)
                  .then(() => app.toast(lang === "de" ? "Kopiert" : "Copied"));
              }}
            >
              <Copy size={14} /> {lang === "de" ? "Angebotszeile kopieren" : "Copy quote line"}
            </Btn>
            <Btn
              variant="dark"
              className="w-full"
              onClick={() => {
                const body = encodeURIComponent(
                  lang === "de"
                    ? `Guten Tag,\n\nanbei unser Angebotsentwurf ${draft.id} über ${euro(brutto, loc)} netto für ${menge} Messmittel.\n\nFreundliche Grüße\n${t(app.user.nameKey)}`
                    : `Hello,\n\nplease find attached our quote draft ${draft.id} for ${euro(brutto, loc)} net covering ${menge} instruments.\n\nKind regards\n${t(app.user.nameKey)}`,
                );
                window.location.href = `mailto:${k.email}?subject=${encodeURIComponent(
                  `${t("angebot.titel")} ${draft.id}`,
                )}&body=${body}`;
              }}
            >
              <Mail size={14} /> {lang === "de" ? "Per E-Mail senden" : "Send by e-mail"}
            </Btn>
            <Link href="/kunden" className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:underline pt-1">
              <Sparkles size={13} /> {t("kunden.titel")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- pieces ---------------- */

function LogisticsRow({ label, qty, price, loc }: { label: string; qty: number; price: number; loc: string }) {
  return (
    <tr className="border-b border-line text-[12px]">
      <td className="px-2 py-1.5 tnum text-ink-3">→</td>
      <td className="px-2 py-1.5 text-ink-2">{label}</td>
      <td className="px-2 py-1.5" />
      <td className="px-2 py-1.5 text-right tnum">{qty}</td>
      <td className="px-2 py-1.5 text-right tnum">{euro(price, loc)}</td>
      <td className="px-2 py-1.5 text-right tnum font-semibold">{euro(qty * price, loc)}</td>
    </tr>
  );
}

function ToggleRow({
  label,
  value,
  checked,
  onChange,
}: {
  label: string;
  value: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer group py-0.5">
      <span className="flex items-start gap-2 text-[12.5px] text-ink min-w-0">
        <span
          className={clsx(
            "mt-[1px] w-4 h-4 rounded-[6px] border grid place-items-center transition-colors shrink-0 group-hover:border-brand-700",
            checked ? "bg-brand-700 border-brand-700 text-white" : "border-line-strong bg-surface-0",
          )}
        >
          {checked && <Check size={10} />}
        </span>
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="leading-snug">{label}</span>
      </span>
      <span className="tnum text-[11.5px] text-ink-3 whitespace-nowrap shrink-0 text-right">{value}</span>
    </label>
  );
}
