"use client";

import { ArrowRight, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { getKunde } from "@/lib/data";
import { date, euro } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { Btn, Chip, EmptyState } from "@/components/ui";

export default function AngebotePage() {
  const app = useApp();
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";

  return (
    <div className="h-full overflow-y-auto">
      <div className="page">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div>
            <h1 className="page-title">{t("nav.angebote")}</h1>
            <p className="page-sub">
              {lang === "de"
                ? "Entwürfe aus fälligen Messmitteln – in unter 2 Minuten versandfertig."
                : "Drafts from due instruments – ready to send in under 2 minutes."}
            </p>
          </div>
          <Link href="/tagesliste">
            <Btn variant="primary">
              <Plus size={15} /> {lang === "de" ? "Neuer Entwurf aus Tagesliste" : "New draft from daily list"}
            </Btn>
          </Link>
        </div>

        {app.drafts.length === 0 ? (
          <div className="card">
            <EmptyState
              title={lang === "de" ? "Noch keine Angebotsentwürfe" : "No quote drafts yet"}
              hint={lang === "de" ? "Wählen Sie in der Tagesliste einen Kunden und klicken Sie auf „Angebot vorbereiten“." : "Pick a customer in the daily list and click “Prepare quote”."}
              action={
                <Link href="/tagesliste">
                  <Btn variant="primary">{t("dash.alleAnsehen")} <ArrowRight size={14} /></Btn>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="tbl w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider">
                  <th className="text-left font-bold px-4 py-2.5">Nr.</th>
                  <th className="text-left font-bold px-4 py-2.5">{lang === "de" ? "Kunde" : "Customer"}</th>
                  <th className="text-right font-bold px-4 py-2.5">{lang === "de" ? "Positionen" : "Lines"}</th>
                  <th className="text-right font-bold px-4 py-2.5">{lang === "de" ? "Summe netto" : "Net total"}</th>
                  <th className="text-left font-bold px-4 py-2.5">{lang === "de" ? "Stand" : "Status"}</th>
                  <th className="text-right font-bold px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {app.drafts.map((d) => {
                  const k = getKunde(d.kundeId);
                  const menge = d.lines.reduce((s, l) => s + l.items.filter((i) => !i.removed).length, 0);
                  const netto = d.lines.reduce((s, l) => {
                    const unit = Math.round(((l.minuten / 60) * app.settings.stundensatz * (l.pruefungsart === "DAkkS" ? 1.35 : 1)) / 0.1) * 0.1;
                    return s + l.items.filter((i) => !i.removed).length * unit;
                  }, 0);
                  return (
                    <tr key={d.id}>
                      <td className="px-4 py-2.5 tnum font-bold text-navy-800 whitespace-nowrap">
                        <Link href={`/angebote/${d.id}`} className="hover:text-action inline-flex items-center gap-1.5">
                          <FileText size={14} className="text-ink-3" /> {d.id}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-ink">{k?.name ?? d.kundeId}</td>
                      <td className="px-4 py-2.5 text-right tnum text-ink-2">{menge}</td>
                      <td className="px-4 py-2.5 text-right tnum font-bold text-navy-800 whitespace-nowrap">{euro(netto, loc)}</td>
                      <td className="px-4 py-2.5">
                        <Chip tone={d.exportiert ? "ok" : "due"}>
                          {d.exportiert ? (lang === "de" ? "Exportiert" : "Exported") : (lang === "de" ? "Entwurf" : "Draft")}
                        </Chip>
                        <span className="ml-2 text-[11.5px] text-ink-3 tnum">{date(d.stichtag, loc)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/angebote/${d.id}`} className="text-[12.5px] font-bold text-action hover:underline inline-flex items-center gap-1">
                          {lang === "de" ? "Öffnen" : "Open"} <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[12px] text-ink-3">
          {lang === "de"
            ? "Richtpreise (Schätzung aus Bearbeitungszeit × Stundensatz). DAkkS (Deutsche Akkreditierungsstelle) ist seit 01.01.2026 Standard."
            : "Guide prices (processing time × hourly rate). DAkkS (German accreditation body) is the default since 01/01/2026."}{" "}
          {euro(app.settings.stundensatz, loc, false)}/h.
        </p>
      </div>
    </div>
  );
}
