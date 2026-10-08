/* Real-data layer — aggregates built from database_tables/*.csv.
 *
 * `python scripts/build_real_data.py` (npm run data:build) scans the genuine
 * MSSQL snapshots and writes public/data/*.json. The UI fetches those files at
 * runtime; before the first build (or if the files are missing) every hook
 * returns null and callers fall back to the synthetic demo model in data.ts.
 */

"use client";

import { useEffect, useState } from "react";

export interface RealTopKunde {
  kunde: string;
  branche: string;
  aktiv: number;
  ueberfaellig: number;
  due30: number;
  tageMedian: number;
  letzteKal: string | null;
  ev: number;
}

export interface RealDashboard {
  stichtag: string;
  generatedFrom: string;
  medianMin: number;
  kpis: {
    messmittelTotal: number;
    kundenTotal: number;
    ueberfaellig: number;
    ueberfaelligKunden: number;
    teilabwanderung: number;
    due30: number;
    due30Kunden: number;
    umsatzHeute: number;
    empfehlungen: number;
    churnHoch: number;
  };
  topKunden: RealTopKunde[];
  dueNext6: { monat: string; anzahl: number }[];
  kalib12m: { monat: string; anzahl: number }[];
  anlassMix: { anlass: string; wert: number; pct: number }[];
  topBranchen: { name: string; wert: number; kunden: number; pct: number }[];
  sparks: Record<string, number[]>;
  dakkSShare2026: number;
  quellen: Record<string, number>;
  topGruppen: { name: string; anzahl: number }[];
  note: string;
}

export interface RealKundenRow {
  kunde: string;
  branche: string;
  aktiv: number;
  ueberfaellig: number;
  due30: number;
  letzteKal: string | null;
}

export interface VerlaufTop {
  kunde: string;
  branche: string;
  letzteKal: string | null;
  ueberfaellig: number;
  volumen6m: number;
  wert: number;
}

export interface VerlaufMonat {
  monat: string;
  kalibrierungen: number;
  aktiveKunden: number;
  neuStill: number;
  stillKumuliert: number;
  stillWert: number;
  top: VerlaufTop[];
}

export interface Potenzial {
  kommend: { kunde: string; branche: string; due30: number; aktiv: number; letzteKal: string | null; wert: number }[];
  portal: { kunde: string; branche: string; auftraege12m: number; aktiv: number; wert: number }[];
  luecken: { kunde: string; branche: string; gruppe: string; peerPct: number; erwartet: number; wert: number }[];
}

export interface RealMessmittelRow {
  kunde: string;
  ident: string;
  gruppe: string;
  typ: string;
  groesse: string;
  faelligkeit: string;
  tage: number;
  status: string;
  bewertung: string;
  messraum: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useDashboard(): { data: RealDashboard | null } {
  const [data, setData] = useState<RealDashboard | null>(null);
  useEffect(() => {
    let live = true;
    fetchJson<RealDashboard>("/data/dashboard.json").then((d) => {
      if (live && d) setData(d);
    });
    return () => {
      live = false;
    };
  }, []);
  return { data };
}

export function useKundenIndex(): { rows: RealKundenRow[] | null } {
  const [rows, setRows] = useState<RealKundenRow[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchJson<{ rows: RealKundenRow[] }>("/data/kunden-index.json").then((d) => {
      if (live && d) setRows(d.rows);
    });
    return () => {
      live = false;
    };
  }, []);
  return { rows };
}

export function useMessmittelSample(): { rows: RealMessmittelRow[] | null } {
  const [rows, setRows] = useState<RealMessmittelRow[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchJson<{ rows: RealMessmittelRow[] }>("/data/messmittel-sample.json").then((d) => {
      if (live && d) setRows(d.rows);
    });
    return () => {
      live = false;
    };
  }, []);
  return { rows };
}

export function useVerlauf(): { monate: VerlaufMonat[] | null } {
  const [monate, setMonate] = useState<VerlaufMonat[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchJson<{ monate: VerlaufMonat[] }>("/data/verlauf.json").then((d) => {
      if (live && d) setMonate(d.monate);
    });
    return () => {
      live = false;
    };
  }, []);
  return { monate };
}

export function usePotenzial(): { data: Potenzial | null } {
  const [data, setData] = useState<Potenzial | null>(null);
  useEffect(() => {
    let live = true;
    fetchJson<Potenzial>("/data/potenzial.json").then((d) => {
      if (live && d) setData(d);
    });
    return () => {
      live = false;
    };
  }, []);
  return { data };
}
