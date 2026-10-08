"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ANLASS_ERFOLGSCHANCE,
  DEFAULT_EINSTELLUNGEN,
  USERS,
  getMessmittel,
  getTagesliste,
  seedPitchState,
  type Anlass,
  type ErgebnisCode,
  type Einstellungen,
  type User,
} from "./data";
import { DEFAULT_STICHTAG, STICHTAGE, type Lang, type Stichtag } from "./format";
import { I18nContext, makeT, type MsgKey } from "./i18n";

/* ----------------------------- types ----------------------------- */

export interface DraftLine {
  katalog: string;
  titel: string;
  gruppeName: string;
  pruefungsart: "Werk" | "DAkkS";
  minuten: number; // Bearbeitungszeit je Messmittel
  items: { id: string; ident: string; typ: string; removed: boolean }[];
}

export interface Draft {
  id: string; // AE-2026-000123
  kundeId: string;
  stichtag: Stichtag;
  createdAt: string;
  lines: DraftLine[];
  logistik: { leihbox: boolean; dhl: boolean; dhlBoxes: number; holbring: boolean };
  exportiert: boolean;
}

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

export interface PersistedState {
  userId: string;
  lang: Lang;
  stichtag: Stichtag;
  claims: Record<string, string>;
  ergebnisse: Record<string, { code: ErgebnisCode; am: string; user: string; note?: string; wettbewerber?: string }>;
  wiedervorlagen: Record<string, string>;
  done: Record<string, string>;
  drafts: Draft[];
  draftCounter: number;
  settings: Einstellungen;
  lernStats: Record<Anlass, { versuche: number; erfolge: number }>;
  pitch: boolean;
}

interface AppCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
  user: User;
  setUser: (id: string) => void;
  stichtag: Stichtag;
  setStichtag: (s: Stichtag) => void;
  stichtage: readonly Stichtag[];
  settings: Einstellungen;
  patchSettings: (p: Partial<Einstellungen>) => void;
  claims: Record<string, string>;
  ergebnisse: PersistedState["ergebnisse"];
  wiedervorlagen: Record<string, string>;
  done: Record<string, string>;
  claim: (kundeId: string) => void;
  unclaim: (kundeId: string) => void;
  erledigt: (kundeId: string, code: ErgebnisCode, opts?: { note?: string; wettbewerber?: string; wiedervorlage?: string }) => void;
  setWiedervorlage: (kundeId: string, bis: string) => void;
  undo: (kundeId: string) => void;
  tagesliste: ReturnType<typeof getTagesliste>;
  selectedKunde: string | null;
  setSelectedKunde: (id: string | null) => void;
  toasts: Toast[];
  toast: (message: string, opts?: { actionLabel?: string; action?: () => void }) => void;
  dismissToast: (id: number) => void;
  pitch: boolean;
  applyPitch: () => void;
  resetPitch: () => void;
  /** POC-Reset: Arbeitsstand (Claims, Ergebnisse, Wiedervorlagen, Entwürfe, Lernwerte) löschen, Identität/Einstellungen behalten. */
  resetDemo: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  assistantOpen: boolean;
  setAssistantOpen: (v: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  drafts: Draft[];
  createDraft: (kundeId: string) => string;
  getDraft: (id: string) => Draft | undefined;
  updateDraft: (id: string, patch: Partial<Draft>) => void;
  lernStats: Record<Anlass, { versuche: number; erfolge: number }>;
}

const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

const STORAGE_KEY = "pecal-kompass-v1";

function initialPersisted(): PersistedState {
  return {
    userId: "sabine",
    lang: "de",
    stichtag: DEFAULT_STICHTAG,
    claims: {},
    ergebnisse: {},
    wiedervorlagen: {},
    done: {},
    drafts: [],
    draftCounter: 123,
    settings: { ...DEFAULT_EINSTELLUNGEN },
    lernStats: {
      faellig_bald: { versuche: 0, erfolge: 0 },
      ueberfaellig: { versuche: 0, erfolge: 0 },
      abwanderung: { versuche: 0, erfolge: 0 },
      branche: { versuche: 0, erfolge: 0 },
      portal: { versuche: 0, erfolge: 0 },
    },
    pitch: false,
  };
}

/* ----------------------------- provider ----------------------------- */

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialPersisted);
  const [hydrated, setHydrated] = useState(false);
  const [selectedKunde, setSelectedKunde] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const toastId = useRef(1);

  // hydrate from localStorage (client only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initialPersisted(), ...(JSON.parse(raw) as PersistedState) });
    } catch {
      /* fresh start */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota – demo state only */
    }
  }, [state, hydrated]);

  const user = USERS.find((u) => u.id === state.userId) ?? USERS[0];

  const t = useMemo(() => makeT(state.lang), [state.lang]);

  const patch = useCallback((p: Partial<PersistedState>) => setState((s) => ({ ...s, ...p })), []);

  const toast = useCallback((message: string, opts?: { actionLabel?: string; action?: () => void }) => {
    const id = toastId.current++;
    setToasts((list) => [...list, { id, message, ...opts }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  const claim = useCallback(
    (kundeId: string) =>
      setState((s) => (s.claims[kundeId] ? s : { ...s, claims: { ...s.claims, [kundeId]: s.userId } })),
    [],
  );

  const unclaim = useCallback(
    (kundeId: string) =>
      setState((s) => {
        const c = { ...s.claims };
        delete c[kundeId];
        return { ...s, claims: c };
      }),
    [],
  );

  const undo = useCallback((kundeId: string) => {
    setState((s) => {
      const done = { ...s.done };
      const ergebnisse = { ...s.ergebnisse };
      const wiedervorlagen = { ...s.wiedervorlagen };
      delete done[kundeId];
      delete ergebnisse[kundeId];
      delete wiedervorlagen[kundeId];
      return { ...s, done, ergebnisse, wiedervorlagen };
    });
  }, []);

  const erledigt = useCallback<AppCtx["erledigt"]>((kundeId, code, opts) => {
    setState((s) => {
      const empf = getTagesliste(s.stichtag, s.settings, {
        ergebnisse: s.ergebnisse,
        wiedervorlagen: s.wiedervorlagen,
        done: s.done,
      });
      const anlass = empf.find((e) => e.kundeId === kundeId)?.empfehlung.anlass;

      const lernStats = { ...s.lernStats };
      if (anlass && (code === "angebot" || code === "auftrag")) {
        const prev = lernStats[anlass];
        lernStats[anlass] = { versuche: prev.versuche + 1, erfolge: prev.erfolge + 1 };
      } else if (anlass && code !== "nichtErreicht") {
        const prev = lernStats[anlass];
        lernStats[anlass] = { versuche: prev.versuche + 1, erfolge: prev.erfolge };
      }

      return {
        ...s,
        done: { ...s.done, [kundeId]: s.stichtag },
        ergebnisse: {
          ...s.ergebnisse,
          [kundeId]: { code, am: s.stichtag, user: s.userId, note: opts?.note, wettbewerber: opts?.wettbewerber },
        },
        wiedervorlagen: opts?.wiedervorlage
          ? { ...s.wiedervorlagen, [kundeId]: opts.wiedervorlage }
          : s.wiedervorlagen,
        lernStats,
      };
    });
  }, []);

  const setWiedervorlage = useCallback((kundeId: string, bis: string) => {
    setState((s) => ({
      ...s,
      wiedervorlagen: { ...s.wiedervorlagen, [kundeId]: bis },
      done: { ...s.done, [kundeId]: s.stichtag },
    }));
  }, []);

  const patchSettings = useCallback((p: Partial<Einstellungen>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...p } }));
  }, []);

  const applyPitch = useCallback(() => {
    setState((s) => ({ ...s, stichtag: "2026-09-25", ...seedPitchState(), pitch: true }));
    toast("Pitch-Modus aktiv – Stichtag 25.09.2026.");
  }, [toast]);

  const resetPitch = useCallback(() => {
    setState((s) => ({ ...s, claims: {}, ergebnisse: {}, wiedervorlagen: {}, done: {}, pitch: false }));
    toast("Pitch-Modus zurückgesetzt.");
  }, [toast]);

  const resetDemo = useCallback(() => {
    setState((s) => ({
      ...s,
      claims: {},
      ergebnisse: {},
      wiedervorlagen: {},
      done: {},
      drafts: [],
      draftCounter: 123,
      lernStats: {
        faellig_bald: { versuche: 0, erfolge: 0 },
        ueberfaellig: { versuche: 0, erfolge: 0 },
        abwanderung: { versuche: 0, erfolge: 0 },
        branche: { versuche: 0, erfolge: 0 },
        portal: { versuche: 0, erfolge: 0 },
      },
    }));
    try {
      localStorage.removeItem("pecal-assistant-v1");
    } catch {
      /* noop */
    }
    setSelectedKunde(null);
  }, []);

  /* Tages-Fixierung: die 12 des Tages stehen fest. Erledigte verschwinden
   * (12 → 10 bei 2 done), es rücken keine neuen nach. Deterministisch aus
   * (Stichtag, Einstellungen) abgeleitet – kein Extra-State nötig.
   * Prioritäten bleiben die des Tages (kein Nachrutschen in den Bändern). */
  const tagesliste = useMemo(() => {
    const EMPTY: {
      ergebnisse: Record<string, { am: string }>;
      wiedervorlagen: Record<string, string>;
      done: Record<string, string>;
    } = { ergebnisse: {}, wiedervorlagen: {}, done: {} };
    const tag = getTagesliste(state.stichtag, state.settings, EMPTY);
    const prio = new Map(tag.map((i) => [i.kundeId, i.prioritaet]));
    return getTagesliste(state.stichtag, state.settings, {
      ergebnisse: state.ergebnisse,
      wiedervorlagen: state.wiedervorlagen,
      done: state.done,
    })
      .filter((i) => prio.has(i.kundeId))
      .map((i) => ({ ...i, prioritaet: prio.get(i.kundeId) ?? i.prioritaet }));
  }, [state.stichtag, state.settings, state.ergebnisse, state.wiedervorlagen, state.done]);

  /* ---- quotes ---- */
  const createDraft = useCallback(
    (kundeId: string) => {
      const rows = getMessmittel(kundeId, state.stichtag).filter(
        (r) =>
          (r.status === "ueberfaellig" || r.status === "teilabwanderung" || r.status === "faellig_bald") &&
          r.bewertung !== "NICHT_EINSATZFAEHIG",
      );
      const groups = new Map<string, DraftLine>();
      for (const r of rows) {
        let line = groups.get(r.katalog);
        if (!line) {
          line = {
            katalog: r.katalog,
            titel: `${r.typ} kalibrieren`,
            gruppeName: r.typ,
            pruefungsart: r.pruefungsart,
            minuten: r.minuten,
            items: [],
          };
          groups.set(r.katalog, line);
        }
        line.items.push({ id: r.id, ident: r.ident, typ: r.typ, removed: false });
      }

      const nummer = `AE-2026-${String(state.draftCounter).padStart(6, "0")}`;
      const draft: Draft = {
        id: nummer,
        kundeId,
        stichtag: state.stichtag,
        createdAt: new Date().toISOString(),
        lines: [...groups.values()].sort((a, b) => b.items.length - a.items.length),
        logistik: { leihbox: false, dhl: false, dhlBoxes: Math.max(1, Math.ceil(rows.length / 25)), holbring: false },
        exportiert: false,
      };
      setState((s) => ({ ...s, drafts: [draft, ...s.drafts], draftCounter: s.draftCounter + 1 }));
      return nummer;
    },
    [state.stichtag, state.draftCounter],
  );

  const getDraft = useCallback((id: string) => state.drafts.find((d) => d.id === id), [state.drafts]);

  const updateDraft = useCallback((id: string, p: Partial<Draft>) => {
    setState((s) => ({ ...s, drafts: s.drafts.map((d) => (d.id === id ? { ...d, ...p } : d)) }));
  }, []);

  const ctx: AppCtx = {
    lang: state.lang,
    setLang: (l) => patch({ lang: l }),
    t,
    user,
    setUser: (id) => patch({ userId: id }),
    stichtag: state.stichtag,
    setStichtag: (s) => patch({ stichtag: s }),
    stichtage: STICHTAGE,
    settings: state.settings,
    patchSettings,
    claims: state.claims,
    ergebnisse: state.ergebnisse,
    wiedervorlagen: state.wiedervorlagen,
    done: state.done,
    claim,
    unclaim,
    erledigt,
    setWiedervorlage,
    undo,
    tagesliste,
    selectedKunde,
    setSelectedKunde,
    toasts,
    toast,
    dismissToast,
    pitch: state.pitch,
    applyPitch,
    resetPitch,
    resetDemo,
    paletteOpen,
    setPaletteOpen,
    assistantOpen,
    setAssistantOpen,
    helpOpen,
    setHelpOpen,
    drafts: state.drafts,
    createDraft,
    getDraft,
    updateDraft,
    lernStats: state.lernStats,
  };

  return (
    <I18nContext.Provider value={{ lang: state.lang, t }}>
      <AppContext.Provider value={ctx}>{children}</AppContext.Provider>
    </I18nContext.Provider>
  );
}

/** Beta-Binomial learned success chance per Anlass (§8.7). */
export function useErfolgschance(): Record<Anlass, number> {
  const { settings, lernStats } = useApp();
  const out = {} as Record<Anlass, number>;
  for (const a of Object.keys(ANLASS_ERFOLGSCHANCE) as Anlass[]) {
    const prior = settings.erfolgschancen[a];
    const s = lernStats[a];
    const alpha0 = prior * 10;
    const beta0 = (1 - prior) * 10;
    out[a] = s.versuche > 0 ? (alpha0 + s.erfolge) / (alpha0 + beta0 + s.versuche) : prior;
  }
  return out;
}
