"use client";

import clsx from "clsx";
import { Check, ChevronRight, Send, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { answer, SUGGESTIONS, type ChatMessage, type Part } from "@/lib/assistant";
import { getKunde, getPrognoseGesamt, type Anlass } from "@/lib/data";
import { date, euro, num } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { buildEmail } from "@/lib/content";
import { useApp } from "@/lib/store";
import { ANLASS_TONE, Btn, Chip, Sparkline } from "./ui";

const ASSISTANT_STORAGE_KEY = "pecal-assistant-v1";

function loadAssistantHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed.slice(-50) : [];
  } catch {
    return [];
  }
}

export function AssistantDrawer() {
  const app = useApp();
  const { t, lang } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  /* history persists locally until the user resets it */
  useEffect(() => {
    setMessages(loadAssistantHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      /* quota – history stays in memory */
    }
  }, [messages, hydrated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, app.assistantOpen]);

  const resetHistory = () => {
    setMessages([]);
    try {
      localStorage.removeItem(ASSISTANT_STORAGE_KEY);
    } catch {
      /* noop */
    }
  };

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setInput("");
    const userMsg: ChatMessage = { id: `u${idRef.current++}`, role: "user", parts: [{ type: "text", text: q }] };

    /* conversation history for follow-up questions (LLM path only) */
    const history = [...messages, userMsg]
      .map((m) => ({
        role: m.role,
        text: m.parts
          .map((p) => (p.type === "text" ? p.text : ""))
          .join(" ")
          .trim(),
      }))
      .filter((h) => h.text);

    setMessages((m) => [...m, userMsg]);
    setTyping(true);

    const ctx = {
      stichtag: app.stichtag,
      settings: app.settings,
      lang,
      selectedKunde: app.selectedKunde,
      route: window.location.pathname,
      t,
    };
    const localParts = answer(q, ctx);
    const noFigure =
      localParts.length === 1 &&
      localParts[0].type === "text" &&
      localParts[0].text === t("assistent.keineAntwort");

    const push = (parts: Part[]) => {
      setTyping(false);
      setMessages((m) => [...m, { id: `a${idRef.current++}`, role: "assistant", parts }]);
    };

    /* structured intents (cards) answer instantly from the local engine … */
    if (!noFigure) {
      window.setTimeout(() => push(localParts), 380);
      return;
    }

    /* … everything else goes to the grounded Groq model */
    askLive(q, history).then(push);
  };

  const askLive = async (
    q: string,
    history: { role: "user" | "assistant"; text: string }[],
  ): Promise<Part[]> => {
    const loc = lang === "de" ? "de-DE" : "en-GB";
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          lang,
          stichtag: app.stichtag,
          settings: app.settings,
          selectedKunde: app.selectedKunde,
          history,
        }),
        signal: AbortSignal.timeout(35_000),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        text?: string;
        quelle?: string;
        model?: string;
        reason?: string;
      };

      if (data?.ok && data.text) {
        const quelle = [data.quelle, data.model, `Datenstand ${date(app.stichtag, loc)}`]
          .filter(Boolean)
          .join(" · ");
        return [
          { type: "text", text: data.text },
          { type: "quelle", text: `Groq · ${quelle}` },
        ];
      }
      /* no key / LLM disabled → keep the honest local answer */
      /* no key / LLM disabled → keep the honest local answer */
      if (data?.reason === "offline" || data?.reason === "bad-request") {
        return [{ type: "text", text: t("assistent.keineAntwort") }];
      }
      /* throttled, timeout, upstream trouble → honest "busy" message */
      return [{ type: "text", text: t("assistent.busy") }];
    } catch {
      return [{ type: "text", text: t("assistent.busy") }];
    }
  };

  const ctxLabel =
    typeof window === "undefined"
      ? t("app.name")
      : app.selectedKunde
        ? `Kunde ${app.selectedKunde}${getKunde(app.selectedKunde)?.name ? ` · ${getKunde(app.selectedKunde)!.name}` : ""}`
        : window.location.pathname === "/"
          ? t("nav.dashboard")
          : t("app.name");

  const open = app.assistantOpen;

  return (
    <aside
      aria-hidden={!open}
      className={`fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-[65] bg-surface-0 border-l border-line shadow-pop flex flex-col no-print transition-transform duration-200 ease-out ${open ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
    >
      <header className="px-4 py-3 border-b border-line flex items-start gap-3">
        <span className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-brand to-brand-700 grid place-items-center shrink-0 shadow-[0_3px_10px_-3px_rgba(255,112,0,.7)]">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-bold text-navy-800 leading-tight">{t("assistent.titel")}</h2>
          <p className="text-[11.5px] text-ink-3 leading-tight">{t("assistent.unter")}</p>
        </div>
        <button
          onClick={resetHistory}
          title={lang === "de" ? "Verlauf löschen" : "Clear history"}
          aria-label={lang === "de" ? "Verlauf löschen" : "Clear history"}
          className="p-1.5 text-ink-3 hover:text-critical hover:bg-surface-1 rounded-[7px] transition-colors"
        >
          <Trash2 size={15} />
        </button>
        <button onClick={() => app.setAssistantOpen(false)} aria-label={t("common.schliessen")} className="p-1 text-ink-3 hover:text-ink">
          <X size={16} />
        </button>
      </header>

      <div className="px-3 py-2 border-b border-line flex items-center gap-2 bg-surface-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{t("assistent.kontext")}</span>
        <Chip tone="navy">{ctxLabel}</Chip>
        <Chip tone="brand">{date(app.stichtag, lang === "de" ? "de-DE" : "en-GB")}</Chip>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-2 leading-relaxed">
              {lang === "de"
                ? "Ich beantworte Fragen ausschließlich aus den berechneten Daten. Zahlen, die ich nenne, stammen aus der Tagesliste, dem Kundenstamm oder der Prognose."
                : "I answer strictly from the computed data. Every figure I mention comes from the daily list, the customer base or the forecast."}
            </p>
            <p className="text-[11.5px] text-ink-3 leading-relaxed">
              {lang === "de"
                ? "Fragen ohne passenden Kennzahlen-Router beantwortet das Sprachmodell (Groq · gpt-oss) – ebenfalls nur aus diesem Datenstand."
                : "Questions without a matching figure router are answered by the language model (Groq · gpt-oss) – still only from this data snapshot."}
            </p>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">{t("assistent.vorschlaege")}</p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS(t).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-[13px] px-3 py-2 rounded-[9px] border border-line bg-surface-0 hover:border-brand-700 hover:bg-brand-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "user" ? (
              <p className="max-w-[85%] bg-navy-800 text-white text-[13.5px] rounded-[12px_12px_3px_12px] px-3.5 py-2.5 leading-snug">
                {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
              </p>
            ) : (
              <div className="w-full space-y-2.5 anim-fade-up">
                {m.parts.map((part, i) => (
                  <PartView key={i} part={part} />
                ))}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="flex items-center gap-1.5 text-ink-3 text-[12.5px]">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-[pulse-soft_1s_ease-in-out_infinite]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand/70 animate-[pulse-soft_1s_ease-in-out_.2s_infinite]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand/40 animate-[pulse-soft_1s_ease-in-out_.4s_infinite]" />
            <span className="ml-1">…</span>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-line flex items-end gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("assistent.placeholder")}
          className="flex-1 h-[38px] px-3 rounded-[9px] border border-line bg-surface-1 focus:bg-surface-0 outline-none focus:border-brand-700 text-[13.5px] placeholder:text-ink-3 transition-colors"
        />
        <Btn variant="primary" type="submit" aria-label="Senden" disabled={!input.trim()}>
          <Send size={14} />
        </Btn>
      </form>
    </aside>
  );
}

/* ----------------------------- generative UI ----------------------------- */

function PartView({ part }: { part: Part }) {
  const app = useApp();
  const { t, lang } = useI18n();
  const router = useRouter();
  const loc = lang === "de" ? "de-DE" : "en-GB";

  if (part.type === "text")
    return <p className="text-[13.5px] leading-relaxed text-ink whitespace-pre-line">{part.text}</p>;

  if (part.type === "quelle")
    return <p className="text-[10.5px] text-ink-3 italic flex items-center gap-1">⌁ {part.text}</p>;

  if (part.type === "empfehlungen")
    return (
      <div className="space-y-1.5">
        {part.items.map((i) => (
          <div key={i.kundeId} className="card p-2.5 flex items-center gap-2.5 hover:border-line-strong transition-colors">
            <span
              className={clsx(
                "w-1.5 h-8 rounded-full",
                i.prioritaet === "hoch" ? "bg-brand-700" : i.prioritaet === "mittel" ? "bg-navy-800" : "bg-line-strong",
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate">{i.name}</p>
              <p className="text-[11.5px] text-ink-3">{i.anlass}</p>
            </div>
            <span className="tnum text-[12.5px] font-bold text-navy-800">{euro(i.ev, loc)}</span>
            <button
              onClick={() => router.push(`/kunden/${i.kundeId}`)}
              className="text-ink-3 hover:text-brand-700"
              aria-label={t("akt.oeffnen")}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        ))}
      </div>
    );

  if (part.type === "kunden")
    return (
      <div className="card overflow-hidden">
        <table className="w-full text-[12.5px]">
          <tbody>
            {part.items.map((k) => (
              <tr
                key={k.id}
                onClick={() => router.push(`/kunden/${k.id}`)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-1"
              >
                <td className="px-2.5 py-2 font-semibold text-ink">{k.name}</td>
                <td className="px-1 py-2 text-ink-3 whitespace-nowrap">{k.branche}</td>
                <td className="px-1 py-2 text-right tnum text-overdue font-semibold whitespace-nowrap">
                  {num(k.ueberfaellig)} ✓
                </td>
                <td className="px-2.5 py-2 text-right tnum text-ink-2 whitespace-nowrap">
                  {k.EV != null ? euro(k.EV, loc) : `${Math.round(k.risiko * 100)} %`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  if (part.type === "prognose") {
    const data = getPrognoseGesamt(app.stichtag);
    return (
      <div className="card p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-2 mb-1">{part.titel}</p>
        <Sparkline data={data} height={120} lang={lang} />
      </div>
    );
  }

  if (part.type === "messmittel")
    return (
      <div className="card p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-2 mb-2">{part.titel}</p>
        <table className="w-full text-[12.5px]">
          <tbody>
            {part.rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="py-1.5 tnum text-ink-3">{r.ident}</td>
                <td className="py-1.5 text-ink font-medium">{r.typ}</td>
                <td className="py-1.5 text-right text-brand-700 font-semibold">{r.faelligkeit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  if (part.type === "confirm") {
    const kunde = getKunde(part.kundeId);
    return (
      <div className="card p-3 border-brand-100 bg-brand-50/60">
        <p className="text-[13px] font-semibold text-navy-800 mb-2">{part.label}</p>
        <div className="flex gap-2">
          <Btn
            variant="primary"
            size="sm"
            onClick={() => {
              if (!kunde) return;
              if (part.kind === "angebot") {
                const id = app.createDraft(kunde.id);
                app.setAssistantOpen(false);
                router.push(`/angebote/${id}`);
              } else {
                const emp = app.tagesliste.find((x) => x.kundeId === kunde.id);
                const mail = buildEmail(kunde, emp?.empfehlung, emp?.empfehlung.anlass ?? "ueberfaellig", lang, app.user, t(app.user.nameKey), t);
                navigator.clipboard?.writeText(`Betreff: ${mail.betreff}\n\n${mail.text}`);
                app.toast(t("assistent.ausgefuehrt"));
              }
            }}
          >
            <Check size={13} /> {t("assistent.bestaetigen")}
          </Btn>
          <Btn variant="ghost" size="sm">
            {t("assistent.verwerfen")}
          </Btn>
        </div>
      </div>
    );
  }

  return null;
}

export function anlassTone(a: Anlass) {
  return ANLASS_TONE[a];
}
