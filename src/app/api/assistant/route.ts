/* Live assistant endpoint — Groq (openai/gpt-oss-*) with grounded context.
 *
 * The key never reaches the client: the route runs server-side, builds the
 * same computed data the UI shows (src/lib/grounding.ts) and asks the model to
 * narrate strictly from it. On any failure the client falls back to the local
 * answer engine, so the assistant never breaks. */

import type { Einstellungen } from "@/lib/data";
import type { Lang, Stichtag } from "@/lib/format";
import { buildGrounding } from "@/lib/grounding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  question: string;
  lang?: Lang;
  stichtag?: Stichtag;
  settings?: Einstellungen;
  selectedKunde?: string | null;
  history?: { role: "user" | "assistant"; text: string }[];
}

const OFFLINE_MODES = new Set(["off", "local", "none", "offline", "dry"]);
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function systemPrompt(lang: Lang, grounding: string): string {
  const rules =
    lang === "de"
      ? [
          "Du bist der PeCal-Assistent der Perschmann Calibration GmbH – ein Vertriebsassistent für Kalibrierungen (Außendienst-Unterstützung).",
          "Regeln:",
          "1. Nutze AUSSCHLIESSLICH Zahlen aus dem Block DATENSTAND. Niemals erfundenen Werte, keine Schätzungen ohne Kennzeichnung.",
          "2. Du erzählst und begründest (narrate), du entscheidest nie: keine Datenänderungen, keine Löschaufträge, kein SQL schreiben, keine Geräteausmusterung.",
          "3. Anfragen außerhalb Vertrieb/Kalibrierung (Wetter, Privatleben, Politik, Code schreiben) hörst du höflich ab.",
          "4. Trifft die Frage auf die Daten zu, aber die Zahl fehlt: sag ehrlich, welche Zahl nicht vorliegt, und nenne den nächstliegenden Wert, den es wirklich gibt (z. B. Top-Branchen aus BRANCHENLUECKEN oder atRisk_nach_branche) plus den nächsten Schritt (z. B. Kunde in Tagesliste wählen). Antworte NIEMALS nur mit „nicht verfügbar“.",
          "5. Antworte auf Deutsch, kompakt: höchstens 90 Wörter, 2–4 kurze Zeilen oder Stichpunkte, Zahlen mit Einheit. Kein Einleitungs-Header, keine Markdown-Tabellen, keine Emojis.",
          "6. Gib am Ende EXAKT dieses gültige JSON zurück (und sonst nichts): {\"antwort\":\"<dein text>\",\"quelle\":\"<max. 6 worte: woher die zahlen stammen>\"}",
        ]
      : [
          "You are the PeCal assistant of Perschmann Calibration GmbH – a sales assistant for calibrations.",
          "Rules:",
          "1. Use ONLY figures from the DATENSTAND block. Never invent values, never estimate without labelling it.",
          "2. You narrate and explain, you never decide: no data changes, no deletions, no SQL writing.",
          "3. Politely decline anything outside sales/calibration (weather, private life, politics, writing code).",
          "4. If the question fits the data but the figure is missing: say honestly which figure is unavailable, name the closest real value (e.g. top industries from BRANCHENLUECKEN or atRisk_nach_branche) plus the next step (e.g. select a customer in the daily list). NEVER answer with just \u201cnot available\u201d.",
          "5. Answer in English, compact: max 90 words, 2–4 short lines or bullets, figures with units. No header, no markdown tables, no emojis.",
          "6. End with EXACTLY this valid JSON and nothing else: {\"answer\":\"<your text>\",\"source\":\"<max 6 words: where the figures come from>\"}",
        ];
  return rules.join("\n") + "\n\n# DATENSTAND\n" + grounding;
}

/** Lenient JSON extraction: direct parse → first {…} → fenced block. */
function extract(raw: string): { text: string; quelle: string } {
  const clean = raw.trim();
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const o = JSON.parse(s);
      return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  let obj = tryParse(clean);
  if (!obj) {
    const a = clean.indexOf("{");
    const b = clean.lastIndexOf("}");
    if (a >= 0 && b > a) obj = tryParse(clean.slice(a, b + 1));
  }
  if (!obj) {
    const fence = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) obj = tryParse(fence[1]);
  }

  /* models sometimes emit a literal \n inside the JSON string */
  const tidy = (s: string) => s.replace(/\\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();

  if (obj) {
    const text = tidy(String(obj.antwort ?? obj.answer ?? ""));
    const quelle = tidy(String(obj.quelle ?? obj.source ?? ""));
    if (text) return { text, quelle };
  }
  // model answered in plain text despite instructions
  const fallback = clean.replace(/```[a-z]*\n?|```$/g, "").trim();
  return { text: fallback, quelle: "" };
}

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  const mode = (process.env.LLM_MODE ?? "live").toLowerCase();
  if (!key || OFFLINE_MODES.has(mode)) {
    return Response.json({ ok: false, reason: "offline" });
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }
  if (!body?.question?.trim()) {
    return Response.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  const lang: Lang = body.lang === "en" ? "en" : "de";
  const chatModel = process.env.LLM_CHAT_MODEL || "openai/gpt-oss-120b";
  const fastModel = process.env.LLM_FAST_MODEL || "openai/gpt-oss-20b";
  const models = [chatModel, fastModel].filter((m, i, a) => a.indexOf(m) === i);

  const grounding = buildGrounding({
    question: body.question,
    lang,
    stichtag: body.stichtag ?? "2026-09-25",
    settings: body.settings ?? ({ stundensatz: 95, kapazitaet: 20, cooldown: 30, risikoSchwelle: 0.35, erfolgschancen: {} } as unknown as Einstellungen),
    selectedKunde: body.selectedKunde ?? null,
  });

  const history = (body.history ?? [])
    .filter((h) => h && h.text)
    .slice(-4)
    .map((h) => ({ role: h.role, text: h.text.slice(0, 300) }));

  const messages = [
    { role: "system", content: systemPrompt(lang, grounding) },
    ...history.map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: body.question.trim() },
  ];

  /* free-tier keys are TPM-limited per model: if the chat model is throttled,
   * the fast model has its own quota pool and usually still answers. */
  let lastStatus = 0;
  let lastError = "";

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          reasoning_effort: "low",
          max_completion_tokens: 1000,
          /* no response_format: gpt-oss sometimes 400s in JSON mode; the
           * prompt demands JSON and extract() parses leniently. */
        }),
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => null)) as
        | { choices?: { message?: { content?: string } }[]; error?: { message?: string }; usage?: { prompt_tokens?: number; completion_tokens?: number } }
        | null;

      lastStatus = res.status;
      lastError = json?.error?.message ?? "";

      if (res.ok && json?.choices?.[0]?.message?.content?.trim()) {
        const { text, quelle } = extract(json.choices[0].message.content);
        if (text) {
          return Response.json({ ok: true, text, quelle, model, tokens: json.usage ?? null });
        }
        lastError = "empty completion";
      }

      /* try the fallback model only for throttling / transient server errors */
      if (res.status === 429 || res.status >= 500) continue;
      break;
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      console.error("[assistant] fetch failed:", aborted ? "timeout" : err);
      return Response.json({ ok: false, reason: aborted ? "timeout" : "network" }, { status: 504 });
    } finally {
      clearTimeout(timer);
    }
  }

  console.error("[assistant] Groq error", lastStatus, lastError.slice(0, 300));
  if (lastStatus === 429) {
    return Response.json({ ok: false, reason: "rate-limit" }, { status: 429 });
  }
  return Response.json({ ok: false, reason: lastStatus ? "upstream" : "network" }, { status: 502 });
}
