"""Build real-data JSON snapshots from database_tables/*.csv.

Reads the genuine MSSQL export snapshots (see database_tables/_manifest.json)
and writes small, UI-ready aggregates to public/data/:

  - dashboard.json        KPIs, top overdue Kunden, due-next-6-months,
                          12-month calibration history, Anlass mix,
                          top Branchen, KPI sparklines, channel mix
  - kunden-index.json     one row per Kunde (Kundennummer, Branche, aktiv,
                          ueberfaellig, due30, letzteKalibrierung)
  - messmittel-sample.json  2000 most-overdue + 500 due-soon Messmittel rows

Stichtag: 2026-09-25 (same reference date as the PRD).

Usage:
    python scripts/build_real_data.py
"""
import csv
import json
import math
import os
from collections import Counter, defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "database_tables")
OUT = os.path.join(ROOT, "public", "data")
STICHTAG = date(2026, 9, 25)
STUNDENSATZ = 90.0


def parse_day(s):
    if not s:
        return None
    try:
        return date(int(s[0:4]), int(s[5:7]), int(s[8:10]))
    except (ValueError, TypeError):
        return None


def month_key(d):
    return f"{d.year}-{d.month:02d}"


def main():
    os.makedirs(OUT, exist_ok=True)

    # ---------- Kunde -> Branche ----------
    branche_of = {}
    branche_counts = Counter()
    with open(os.path.join(SRC, "Kunde_Branche.csv"), encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            k = (row.get("KundenNr") or "").strip()
            b = (row.get("Branche") or "").strip() or "Sonstiges"
            if k:
                branche_of[k] = b
                branche_counts[b] += 1
    print(f"Kunde_Branche: {len(branche_of)} kunden, {len(branche_counts)} branchen")

    # ---------- Bearbeitungszeit median ----------
    zeiten = []
    with open(os.path.join(SRC, "ArtikelnummerZeit.csv"), encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            try:
                zeiten.append(float((row.get("BearbeitungszeitMin") or "0").replace(",", ".")))
            except ValueError:
                pass
    zeiten = [z for z in zeiten if z > 0]
    zeiten.sort()
    median_min = zeiten[len(zeiten) // 2] if zeiten else 30.0
    print(f"ArtikelnummerZeit: n={len(zeiten)}, median={median_min:.1f} min")

    # ---------- MESSMITTEL scan ----------
    k_aktiv = Counter()
    k_over = Counter()
    k_over_days = Counter()  # sum of overdue days (for avg urgency)
    k_due30 = Counter()
    k_due3060 = Counter()
    k_letzte = {}
    over_kunden = set()
    due30_kunden = set()
    alle_kunden = set()
    gruppe_counts = Counter()
    due_next6 = Counter()
    overdue_rows = []  # (faelligkeit, dict) — 65k rows OK in memory
    duesoon_rows = []
    total = 0
    stopped = 0
    overdue = 0
    teil = 0
    due30 = 0

    with open(os.path.join(SRC, "MESSMITTEL.csv"), encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            total += 1
            k = (row.get("KUNDENNUMMER_SAP") or "").strip()
            if k:
                alle_kunden.add(k)
            gruppe_counts[row.get("MESSMITTELGRUPPE") or "?"] += 1
            lp = parse_day(row.get("DATUM_LETZTE_PRUEFUNG"))
            if k and lp and (k not in k_letzte or lp > k_letzte[k]):
                k_letzte[k] = lp
            if (row.get("FAELLIGKEIT_STOP") or "").strip() == "1":
                stopped += 1
                continue
            if k:
                k_aktiv[k] += 1
            due = parse_day(row.get("DATUM_NAECHSTE_PRUEFUNG"))
            if not due or due.year > 2040:
                continue
            if due < STICHTAG:
                overdue += 1
                d = (STICHTAG - due).days
                if k:
                    over_kunden.add(k)
                    k_over[k] += 1
                    k_over_days[k] += d
                if d > 60:
                    teil += 1
                if len(overdue_rows) < 120000:
                    overdue_rows.append({
                        "kunde": k,
                        "ident": row.get("IDENTNUMMER") or "",
                        "gruppe": row.get("MESSMITTELGRUPPE") or "",
                        "typ": row.get("MESSMITTELTYP") or "",
                        "groesse": (row.get("GROESSE") or "")[:60],
                        "faelligkeit": due.isoformat(),
                        "tage": d,
                        "status": "teilabwanderung" if d > 60 else "ueberfaellig",
                        "bewertung": row.get("LETZTE_BEWERTUNG") or "",
                        "messraum": row.get("MESSRAUM") or "",
                    })
            else:
                ahead = (due - STICHTAG).days
                if ahead <= 30:
                    due30 += 1
                    if k:
                        due30_kunden.add(k)
                        k_due30[k] += 1
                    if len(duesoon_rows) < 30000:
                        duesoon_rows.append({
                            "kunde": k,
                            "ident": row.get("IDENTNUMMER") or "",
                            "gruppe": row.get("MESSMITTELGRUPPE") or "",
                            "typ": row.get("MESSMITTELTYP") or "",
                            "groesse": (row.get("GROESSE") or "")[:60],
                            "faelligkeit": due.isoformat(),
                            "tage": -ahead,
                            "status": "faellig_bald",
                            "bewertung": row.get("LETZTE_BEWERTUNG") or "",
                            "messraum": row.get("MESSRAUM") or "",
                        })
                elif 30 < ahead <= 60 and k:
                    k_due3060[k] += 1
                m = (due.year - STICHTAG.year) * 12 + (due.month - STICHTAG.month)
                if 1 <= m <= 6:
                    due_next6[month_key(due)] += 1

    print(f"MESSMITTEL: total={total} stopped={stopped} overdue={overdue} "
          f"({len(over_kunden)} kunden) teil60={teil} due30={due30} ({len(due30_kunden)} kunden)")

    # ---------- KALIBRIERUNGEN scan ----------
    kal_mon = Counter()
    dakk_share_n = 0
    dakk_share_d = 0
    k_last_kal = {}
    k_kal12m = Counter()
    with open(os.path.join(SRC, "KALIBRIERUNGEN.csv"), encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            b = (row.get("BEGINN") or "")[:7]
            if "2024-01" <= b <= "2026-09":
                kal_mon[b] += 1
            if b >= "2026-01" and b <= "2026-08":
                dakk_share_d += 1
                if (row.get("PRUEFUNGSART") or "") == "DAkkS":
                    dakk_share_n += 1
            k = (row.get("KUNDENNUMMER_SAP") or "").strip()
            bd = parse_day(row.get("BEGINN"))
            if k and bd:
                if b >= "2025-10" and b <= "2026-09":
                    k_kal12m[k] += 1
                if k not in k_last_kal or bd > k_last_kal[k]:
                    k_last_kal[k] = bd
    print(f"KALIBRIERUNGEN: monate={len(kal_mon)} dakk2026={dakk_share_n}/{dakk_share_d}")

    # ---------- AUFTRAGSPOSITIONEN scan ----------
    quellen = Counter()
    k_pos12m = Counter()
    k_hub12m = Counter()
    with open(os.path.join(SRC, "AUFTRAGSPOSITIONEN.csv"), encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            q = (row.get("AUFTRAGSPOSITIONSQUELLE") or "?").strip() or "?"
            quellen[q] += 1
            d = parse_day(row.get("DATUM_ERSTELLT"))
            if d and date(2025, 9, 25) <= d <= STICHTAG:
                # position -> kunde via messmittel uuid? not directly available;
                # count globally only (per-kunde portal share approximated via HUB label is
                # not joinable here, so portal-Anlass stays model-side).
                pass
    print(f"AUFTRAGSPOSITIONEN quellen={dict(quellen)}")

    # ---------- DIENSTLEISTUNGEN status ----------
    dl_status = Counter()
    with open(os.path.join(SRC, "DIENSTLEISTUNGEN.csv"), encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            dl_status[(row.get("STATUS_DIENSTLESTUNG") or "?").strip() or "?"] += 1
    print(f"DIENSTLEISTUNGEN status={dict(dl_status)}")

    # ---------- top Kunden by overdue (EV estimate) ----------
    def ev_for(k):
        n = k_over[k]
        avg_days = k_over_days[k] / max(1, n)
        hours = n * median_min / 60.0
        urgency = math.exp(-avg_days / 180.0)
        return hours * STUNDENSATZ * 0.35 * urgency, avg_days

    ranked = []
    for k, n in k_over.most_common(60):
        ev, avg_days = ev_for(k)
        last = k_last_kal.get(k) or k_letzte.get(k)
        ranked.append({
            "kunde": k,
            "branche": branche_of.get(k, "Sonstiges"),
            "aktiv": k_aktiv.get(k, 0),
            "ueberfaellig": n,
            "due30": k_due30.get(k, 0),
            "tageMedian": round(avg_days),
            "letzteKal": last.isoformat() if last else None,
            "ev": round(ev),
        })
    ranked.sort(key=lambda r: -r["ev"])
    top12 = ranked[:12]
    umsatz_heute = sum(r["ev"] for r in ranked[:12])

    # churn proxy: kunden with last calibration > 6 months ago and overdue > 0
    churn = sum(1 for k in over_kunden
                if ((k_last_kal.get(k) or k_letzte.get(k) or STICHTAG) - STICHTAG).days * -1 > 180)

    # ---------- monthly series (last 12m history for charts) ----------
    hist12 = []
    d = date(2025, 10, 1)
    while d <= date(2026, 9, 1):
        hist12.append({"monat": month_key(d), "anzahl": kal_mon.get(month_key(d), 0)})
        d = date(d.year + (1 if d.month == 12 else 0), 1 if d.month == 12 else d.month + 1, 1)

    # due next 6 months ordered Okt 26 – Mär 27
    due6 = []
    for mm in ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]:
        due6.append({"monat": mm, "anzahl": due_next6.get(mm, 0)})

    # anlass mix (€-weighted, real counts for due/overdue, model proxies for rest)
    over_ev = sum(ev_for(k)[0] for k in k_over)
    due_ev = sum(k_due30[k] * median_min / 60.0 * STUNDENSATZ * 0.60 for k in k_due30)
    mix = [
        {"anlass": "ueberfaellig", "wert": round(over_ev)},
        {"anlass": "faellig_bald", "wert": round(due_ev)},
        {"anlass": "branche", "wert": round(over_ev * 0.18)},
        {"anlass": "abwanderung", "wert": round(over_ev * 0.12)},
        {"anlass": "portal", "wert": round(over_ev * 0.06)},
    ]
    mix_total = sum(m["wert"] for m in mix) or 1
    for m in mix:
        m["pct"] = round(m["wert"] / mix_total * 100)

    # top branchen by overdue value
    br_over = Counter()
    br_kunden = Counter()
    for k in over_kunden:
        ev, _ = ev_for(k)
        b = branche_of.get(k, "Sonstiges")
        br_over[b] += ev
        br_kunden[b] += 1
    br_total = sum(br_over.values()) or 1
    top_branchen = [{"name": b, "wert": round(v), "kunden": br_kunden[b],
                     "pct": round(v / br_total * 100)}
                    for b, v in br_over.most_common(6)]

    # KPI sparklines from monthly history (last 8 full months)
    spark_base = [r["anzahl"] for r in hist12 if r["monat"] < "2026-09"][-8:]
    if len(spark_base) < 8:
        spark_base = (hist12 and [r["anzahl"] for r in hist12])[-8:] or [0] * 8

    dashboard = {
        "stichtag": "2026-09-25",
        "generatedFrom": "database_tables/*.csv (MSSQL snapshot 07.10.2026)",
        "medianMin": round(median_min, 1),
        "kpis": {
            "messmittelTotal": total,
            "kundenTotal": len(alle_kunden),
            "ueberfaellig": overdue,
            "ueberfaelligKunden": len(over_kunden),
            "teilabwanderung": teil,
            "due30": due30,
            "due30Kunden": len(due30_kunden),
            "umsatzHeute": round(umsatz_heute),
            "empfehlungen": 12,
            "churnHoch": churn,
        },
        "topKunden": top12,
        "dueNext6": due6,
        "kalib12m": hist12,
        "anlassMix": mix,
        "topBranchen": top_branchen,
        "sparks": {
            "ueberfaellig": spark_base,
            "umsatz": spark_base,
            "faellig": [due_next6.get(m, 0) for m in ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]][:8] or spark_base,
            "churn": spark_base,
        },
        "dakkSShare2026": round(dakk_share_n / max(1, dakk_share_d) * 100),
        "quellen": dict(quellen),
        "dienstleistungen": dict(dl_status),
        "topGruppen": [{"name": g, "anzahl": c} for g, c in gruppe_counts.most_common(8)],
        "note": "Kennzahlen aus echten CSV-Snapshots (Stichtag 25.09.2026). Ranking/Modelltexte bleiben Demo.",
    }
    with open(os.path.join(OUT, "dashboard.json"), "w", encoding="utf-8") as fh:
        json.dump(dashboard, fh, ensure_ascii=False)
    print(f"wrote dashboard.json (top EV kunde={top12[0]['kunde']} ev={top12[0]['ev']})")

    # ---------- kunden-index ----------
    index = []
    for k in alle_kunden:
        last = k_last_kal.get(k) or k_letzte.get(k)
        index.append({
            "kunde": k,
            "branche": branche_of.get(k, "Sonstiges"),
            "aktiv": k_aktiv.get(k, 0),
            "ueberfaellig": k_over.get(k, 0),
            "due30": k_due30.get(k, 0),
            "letzteKal": last.isoformat() if last else None,
        })
    index.sort(key=lambda r: (-r["ueberfaellig"], -r["aktiv"], r["kunde"]))
    with open(os.path.join(OUT, "kunden-index.json"), "w", encoding="utf-8") as fh:
        json.dump({"stichtag": "2026-09-25", "rows": index}, fh, ensure_ascii=False)
    print(f"wrote kunden-index.json rows={len(index)}")

    # ---------- messmittel-sample (top-EV Kunden first, then earliest) ----------
    by_kunde = defaultdict(list)
    for r in overdue_rows:
        by_kunde[r["kunde"]].append(r)
    for rows in by_kunde.values():
        rows.sort(key=lambda r: r["faelligkeit"])
    top60 = [r["kunde"] for r in ranked[:60]]
    per_kunde = Counter()
    sample = []

    def take(k, limit):
        for r in by_kunde.get(k, []):
            if per_kunde[k] >= limit or len(sample) >= 1600:
                break
            per_kunde[k] += 1
            sample.append(r)

    for k in top60:  # top-EV Kunden zuerst (Dashboard-Liste)
        take(k, 25)
    overdue_rows.sort(key=lambda r: r["faelligkeit"])
    for r in overdue_rows:  # Rest: älteste Fälligkeiten zuerst
        if len(sample) >= 1600:
            break
        if per_kunde[r["kunde"]] >= 40:
            continue
        per_kunde[r["kunde"]] += 1
        sample.append(r)
    per_kunde_soon = Counter()
    soon_n = 0
    for r in sorted(duesoon_rows, key=lambda r: r["faelligkeit"]):
        if soon_n >= 400:
            break
        if per_kunde_soon[r["kunde"]] >= 20:
            continue
        per_kunde_soon[r["kunde"]] += 1
        soon_n += 1
        sample.append(r)
    with open(os.path.join(OUT, "messmittel-sample.json"), "w", encoding="utf-8") as fh:
        json.dump({"stichtag": "2026-09-25", "rows": sample}, fh, ensure_ascii=False)
    print(f"wrote messmittel-sample.json rows={len(sample)}")


if __name__ == "__main__":
    main()
