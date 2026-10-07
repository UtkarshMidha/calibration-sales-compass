"use client";

import clsx from "clsx";
import { Brain, Calendar, Check, Info, Settings } from "lucide-react";
import { type Anlass } from "@/lib/data";
import { STICHTAGE, date, euro, num, pct } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp, useErfolgschance } from "@/lib/store";
import { Btn, Chip, DemoBadge, Progress, Segmented } from "@/components/ui";

const ANLASS_ORDER: Anlass[] = ["faellig_bald", "ueberfaellig", "abwanderung", "branche", "portal"];
const SECTION_HEAD = "text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2";
const INPUT = "rounded-[8px] border border-line px-2.5 py-2 text-[13px] outline-none focus:border-brand-700 tnum";

export default function EinstellungenPage() {
  const app = useApp();
  const { t, lang } = useI18n();
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const learned = useErfolgschance();

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="max-w-5xl mx-auto space-y-4 anim-fade-up">
        {/* ---------------- header ---------------- */}
        <div>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-[8px] bg-navy-800 text-white grid place-items-center shrink-0">
              <Settings size={15} />
            </span>
            <h2 className="text-[17px] font-bold text-navy-800">{t("einst.titel")}</h2>
          </div>
          <p className="text-[12.5px] text-ink-2 mt-1.5 flex items-start gap-1.5 leading-relaxed">
            <Info size={13} className="shrink-0 mt-[3px] text-ink-3" />
            <span>
              {lang === "de"
                ? "Änderungen wirken sofort auf der Tagesliste – die Rangfolge ändert sich nie. Einige Werte greifen erst ab dem nächsten Pipeline-Lauf."
                : "Changes apply immediately to the daily list – the ranking order never changes. A few values only take effect from the next pipeline run."}
            </span>
          </p>
        </div>

        {/* ---------------- Tagesliste / Parameter ---------------- */}
        <section className="card px-4 py-3">
          <h2 className={SECTION_HEAD}>
            {lang === "de" ? "Tagesliste / Parameter" : "Daily list / Parameters"}
          </h2>

          <div className="mt-1.5 divide-y divide-[var(--color-line)]">
            <Row htmlFor="stundensatz" label={t("einst.stundensatz")} hint={t("einst.stundensatzHint")}>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <input
                    id="stundensatz"
                    type="number"
                    step={5}
                    min={40}
                    max={200}
                    value={app.settings.stundensatz}
                    onChange={(e) => app.patchSettings({ stundensatz: Number(e.target.value) })}
                    className={clsx(INPUT, "w-24 text-right")}
                  />
                  <span className="tnum text-[13px] text-ink-2 whitespace-nowrap">{" €/h"}</span>
                </div>
                <p className="tnum text-[11px] text-ink-3">
                  1 h → {euro(app.settings.stundensatz, loc, false)}
                </p>
              </div>
            </Row>

            <Row htmlFor="kapazitaet" label={t("einst.kapazitaet")}>
              <input
                id="kapazitaet"
                type="number"
                min={1}
                max={100}
                value={app.settings.kapazitaet}
                onChange={(e) => app.patchSettings({ kapazitaet: Number(e.target.value) })}
                className={clsx(INPUT, "w-24 text-right")}
              />
            </Row>

            <Row htmlFor="cooldown" label={t("einst.cooldown")}>
              <input
                id="cooldown"
                type="number"
                min={0}
                max={60}
                value={app.settings.cooldown}
                onChange={(e) => app.patchSettings({ cooldown: Number(e.target.value) })}
                className={clsx(INPUT, "w-24 text-right")}
              />
            </Row>

            <Row htmlFor="risikoSchwelle" label={t("einst.risikoSchwelle")}>
              <input
                id="risikoSchwelle"
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={app.settings.risikoSchwelle}
                onChange={(e) => app.patchSettings({ risikoSchwelle: Number(e.target.value) })}
                className="w-44 accent-brand-700"
              />
              <span className="tnum text-[13px] font-semibold text-ink w-12 text-right">
                {pct(app.settings.risikoSchwelle, 0, loc)}
              </span>
            </Row>

            <Row htmlFor="fensterFaellig" label={t("einst.faelligFenster")}>
              <input
                id="fensterFaellig"
                readOnly
                aria-readonly="true"
                value={lang === "de" ? "30–60 Tage" : "30–60 days"}
                className={clsx(INPUT, "w-32 text-right bg-surface-1 text-ink-2")}
              />
            </Row>

            <Row htmlFor="fensterUeberfaellig" label={t("einst.ueberfaelligFenster")}>
              <input
                id="fensterUeberfaellig"
                readOnly
                aria-readonly="true"
                value={lang === "de" ? "15–548 Tage" : "15–548 days"}
                className={clsx(INPUT, "w-32 text-right bg-surface-1 text-ink-2")}
              />
            </Row>
          </div>

          <div className="pt-2.5">
            <Chip tone="due">{t("einst.pipelineWirkung")}</Chip>
          </div>
        </section>

        {/* ---------------- Erfolgschance ---------------- */}
        <section className="card px-4 py-3">
          <h2 className={SECTION_HEAD}>{t("einst.erfolgschance")}</h2>
          <p className="text-[12px] text-ink-3 mt-0.5">{t("einst.erfolgschanceHint")}</p>

          <div className="mt-2.5 overflow-x-auto rounded-[10px] border border-line">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-surface-1 text-[10.5px] uppercase tracking-wider text-ink-3">
                  <th className="text-left font-bold px-3 py-1.5">{t("heute.anlass")}</th>
                  <th className="text-left font-bold px-3 py-1.5">{t("einst.prior")}</th>
                  <th className="text-right font-bold px-3 py-1.5">{t("einst.gelernt")}</th>
                  <th className="text-left font-bold px-3 py-1.5">{lang === "de" ? "Anteil" : "Share"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {ANLASS_ORDER.map((a) => {
                  const label = t(`anlass.${a}` as "anlass.ueberfaellig");
                  const prior = app.settings.erfolgschancen[a];
                  const l = learned[a];
                  const delta = Math.round(l * 100) - Math.round(prior * 100);
                  return (
                    <tr key={a}>
                      <td className="px-3 py-2 font-semibold text-ink whitespace-nowrap">{label}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="tnum text-ink font-semibold w-10 text-right">{pct(prior, 0, loc)}</span>
                          <input
                            type="range"
                            min={0.05}
                            max={0.9}
                            step={0.05}
                            value={prior}
                            aria-label={`${t("einst.prior")} – ${label}`}
                            onChange={(e) =>
                              app.patchSettings({
                                erfolgschancen: { ...app.settings.erfolgschancen, [a]: Number(e.target.value) },
                              })
                            }
                            className="w-24 accent-brand-700"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className={clsx("tnum font-semibold", delta !== 0 ? "text-ok" : "text-ink-2")}>
                          {pct(l, 0, loc)}
                        </span>
                        {delta !== 0 && (
                          <span className="tnum ml-1.5 text-[11px] font-semibold text-ok">
                            {delta > 0 ? `+${delta}` : delta} pp
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 w-[30%]">
                        <div
                          className="h-[7px] w-full rounded-full bg-surface-2 overflow-hidden relative"
                          title={`${t("einst.prior")}: ${pct(prior, 0, loc)} · ${t("einst.gelernt")}: ${pct(l, 0, loc)}`}
                        >
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-navy-700 to-navy-800"
                            style={{ width: `${Math.min(100, Math.max(0, l * 100))}%` }}
                          />
                          <span
                            className="absolute top-0 bottom-0 w-[2px] bg-brand-700"
                            style={{ left: `calc(${prior * 100}% - 1px)` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center gap-3 flex-wrap text-[11.5px] text-ink-3">
            {ANLASS_ORDER.map((a, i) => (
              <span key={a} className="inline-flex items-center gap-1">
                {i > 0 && <span className="text-line-strong">·</span>}
                <span>{t(`anlass.${a}` as "anlass.ueberfaellig")}</span>
                <span className="tnum">n = {app.lernStats[a].versuche}</span>
              </span>
            ))}
          </div>
        </section>

        {/* ---------------- Stichtag ---------------- */}
        <section className="card px-4 py-3">
          <h2 className={SECTION_HEAD}>{t("einst.stichtag")}</h2>
          <p className="text-[12px] text-ink-3 mt-0.5">{t("einst.stichtagHint")}</p>
          <div className="mt-2.5 flex items-center gap-3 flex-wrap">
            <Segmented
              value={app.stichtag}
              options={STICHTAGE.map((s) => ({ value: s, label: date(s, loc) }))}
              onChange={(v) => app.setStichtag(v)}
            />
            <Calendar size={14} className="text-ink-3" />
            <span className="text-[11.5px] text-ink-3">
              {lang === "de"
                ? "Der Wechsel des Stichtags baut die Tagesliste deterministisch neu."
                : "Switching the reference date rebuilds the daily list deterministically."}
            </span>
          </div>
        </section>

        {/* ---------------- LLM ---------------- */}
        <section className="card px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Brain size={13} className="text-ink-3" />
            <h2 className={SECTION_HEAD}>{t("einst.llm")}</h2>
          </div>

          <div className="mt-2.5">
            <Progress value={318} total={1000} label={`${num(318, 0, loc)} / ${num(1000, 0, loc)}`} />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label={t("einst.anfragen")} value={`${num(318, 0, loc)} / ${num(1000, 0, loc)}`} />
            <Stat label={t("einst.tokens")} value={lang === "de" ? "1,24 Mio." : "1.24M"} />
            <Stat label={t("einst.limit")} value={num(1000, 0, loc)} />
          </div>

          <p className="text-[11.5px] text-ink-3 mt-2 flex items-start gap-1.5">
            <Info size={12} className="shrink-0 mt-[2px]" />
            <span>
              {lang === "de"
                ? "Die Quoten sind Demo-Werte – es wird nichts abgerechnet."
                : "The quotas are demo figures – nothing is billed."}
            </span>
          </p>
        </section>

        {/* ---------------- footer ---------------- */}
        <div className="flex items-center gap-3 flex-wrap pb-2">
          <Btn variant="primary" onClick={() => app.toast(t("einst.gespeichert"))}>
            <Check size={14} /> {t("einst.speichern")}
          </Btn>
          <DemoBadge />
          <span className="text-[11.5px] text-ink-3">
            {lang === "de"
              ? "Hackathon-Demo – alle Daten sind fiktiv."
              : "Hackathon demo – all data is fictitious."}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================== helpers ============================== */

function Row({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex justify-between gap-4 py-2.5",
        hint ? "items-start" : "items-center",
      )}
    >
      <div className={clsx("min-w-0", hint && "pt-1")}>
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
          {label}
        </label>
        {hint && <p className="text-[11.5px] text-ink-3 mt-0.5 max-w-[400px] leading-snug">{hint}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-surface-1 px-3 py-2">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="tnum text-[15px] font-bold text-navy-800 mt-0.5">{value}</p>
    </div>
  );
}
