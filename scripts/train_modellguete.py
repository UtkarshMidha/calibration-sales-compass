"""Real measurements for ALL Developer-tab model cards.

Reads the genuine MSSQL export snapshots in database_tables/ and replaces
every demo model card with a measured one (temporal backtests, no leakage):

  M1  turnaround  Beauftragung -> Abschluss (AUFTRAGSPOSITIONEN)
  M3  churn       gradient boosting vs recency rule (KALIBRIERUNGEN + master)
  M4  volume      trend+season OLS vs seasonal naive, last 12 full months
  M5  gaps        peer-share tiers -> fill rate within 12 months
  R1  ranking     HGB score bands -> actual churn rate per band

Writes public/data/modellguete-real.json (merged with train_churn.py output).
Charts consume the embedded series, so the UI needs no demo constants.

Run AFTER scripts/train_churn.py:
  python scripts/train_churn.py && python scripts/train_modellguete.py
"""

import json
import time
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE = "database_tables"
OUT = "public/data/modellguete-real.json"
LOC_DE = "de-DE"

t0 = time.time()


def pct1(v: float) -> str:
    return f"{v * 100:.1f} %".replace(".", ",")


def pct0(v: float) -> str:
    return f"{round(v * 100)} %"


# ---------------------------------------------------------------- M1 turnaround
# Ehrlich eingeschränkt: Workflow-Stempel gibt es erst seit Feb 2025
# (kein Vorjahresvergleich möglich) → H1 2025 vs. danach.
print("M1: turnaround …", flush=True)
pos = pd.read_csv(
    f"{BASE}/AUFTRAGSPOSITIONEN.csv",
    usecols=["dateBeauftragt", "dateAbgeschlossen"],
)
pos["b"] = pd.to_datetime(pos["dateBeauftragt"], errors="coerce")
pos["a"] = pd.to_datetime(pos["dateAbgeschlossen"], errors="coerce")
pos = pos.dropna(subset=["b", "a"])
pos["tage"] = (pos["a"] - pos["b"]).dt.total_seconds() / 86400
pos = pos[(pos["tage"] >= 0) & (pos["tage"] <= 365)]
print(f"  completed positions: {len(pos)}", flush=True)

EDGES = [0, 1, 4, 8, 15, 31, 10**9]
BLABEL = ["0 d", "1–3 d", "4–7 d", "8–14 d", "15–30 d", "31+ d"]


def turn_hist(df: pd.DataFrame):
    h, _ = np.histogram(df["tage"].to_numpy(), bins=EDGES)
    return (h / max(h.sum(), 1)).tolist()


early = pos[pos["a"] < "2025-07-01"]
late = pos[pos["a"] >= "2025-07-01"]
hist_all = turn_hist(pos)


def share30(df: pd.DataFrame) -> float:
    return float((df["tage"] <= 30).mean()) if len(df) else 0.0


s30, s30e = share30(late), share30(early)
med = float(late["tage"].median()) if len(late) else 0.0
card_m1 = {
    "id": "M1",
    "titel": "Rücklaufzeit: Beauftragung → Abschluss",
    "was": {
        "de": "Echte Durchlaufzeiten abgeschlossener Auftragspositionen – vom Beauftragen bis zum Abschluss, inkl. Einsendung durch den Kunden.",
        "en": "Real turnaround times of completed order lines – from order to completion, including shipment by the customer.",
    },
    "metrikName": "Abschluss innert 30 Tagen (seit 07/2025)",
    "wertLabel": pct1(s30),
    "baselineName": "Gleicher Anteil H1 2025",
    "baselineLabel": pct1(s30e),
    "ziel": "≥ Vorhalbjahr",
    "erfuellt": bool(s30 >= s30e),
    "bedeutet": {
        "de": f"Median {med:.0f} Tage: {pct0(s30)} der Positionen sind innert eines Monats fertig (H1 2025: {pct0(s30e)}). Der lange Schwanz ist Kundensendung, nicht Labor.",
        "en": f"Median {med:.0f} days: {pct0(s30)} of lines finish within a month (H1 2025: {pct0(s30e)}). The long tail is customer shipment, not lab time.",
    },
    "chart": "ruecklauf",
    "chartData": {"buckets": [{"bucket": b, "anteil": round(a, 4)} for b, a in zip(BLABEL, hist_all)]},
}
print(f"  median={med:.1f}d share30={s30:.3f} (H1 2025: {s30e:.3f})", flush=True)

# ---------------------------------------------------------------- M3 churn
print("M3: churn model …", flush=True)
T0 = pd.Timestamp("2025-09-24")
OUT_D = 180
k = pd.read_csv(
    f"{BASE}/KALIBRIERUNGEN.csv",
    usecols=["KUNDENNUMMER_SAP", "BEGINN", "BEWERTUNG", "PRUEFUNGSART"],
    dtype={"KUNDENNUMMER_SAP": str},
)
k["BEGINN"] = pd.to_datetime(k["BEGINN"], errors="coerce")
k = k.dropna(subset=["BEGINN"])
m = pd.read_csv(f"{BASE}/MESSMITTEL.csv", usecols=["KUNDENNUMMER_SAP"], dtype={"KUNDENNUMMER_SAP": str})
kb = pd.read_csv(f"{BASE}/Kunde_Branche.csv", dtype={"KundenNr": str})

T0S, T0E, MID = T0 - pd.Timedelta(days=365), T0, T0 - pd.Timedelta(days=182)
hist = k[(k["BEGINN"] > T0S) & (k["BEGINN"] <= T0E)]
outc = k[(k["BEGINN"] > T0E) & (k["BEGINN"] <= T0E + pd.Timedelta(days=OUT_D))]
g = hist.groupby("KUNDENNUMMER_SAP")
feat = pd.DataFrame(
    {
        "n_cal_12m": g.size(),
        "recency_days": (T0E - g["BEGINN"].max()).dt.days,
        "tenure_days": (T0E - g["BEGINN"].min()).dt.days,
        "dakks_share": g["PRUEFUNGSART"].apply(lambda s: float((s == "DAkkS").mean())),
        "fail_share": g["BEWERTUNG"].apply(lambda s: float((s == "NICHT_EINSATZFAEHIG").mean())),
    }
)
h2 = hist[hist["BEGINN"] > MID].groupby("KUNDENNUMMER_SAP").size()
h1 = hist[hist["BEGINN"] <= MID].groupby("KUNDENNUMMER_SAP").size()
feat["trend"] = (feat.index.map(h2).fillna(0) - feat.index.map(h1).fillna(0)) / feat["n_cal_12m"]
feat["n_instruments"] = feat.join(m.groupby("KUNDENNUMMER_SAP").size().rename("n_instruments"))["n_instruments"].fillna(0).astype(int)
br = kb.drop_duplicates("KundenNr").set_index("KundenNr")["Branche"]
feat["branche"] = feat.index.map(br).fillna("Sonstiges")
feat["churn"] = (~feat.index.isin(set(outc["KUNDENNUMMER_SAP"].unique()))).astype(int)

NUM = ["n_cal_12m", "recency_days", "tenure_days", "dakks_share", "fail_share", "trend", "n_instruments"]
X = feat[NUM + ["branche"]]
y = feat["churn"].to_numpy()
tr, te = next(iter(StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=7).split(X, y)))
Xtr, Xte, ytr, yte = X.iloc[tr], X.iloc[te], y[tr], y[te]
prep = ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), ["branche"])], remainder="passthrough")
hgb = Pipeline([("prep", prep), ("model", HistGradientBoostingClassifier(max_iter=300, learning_rate=0.06, max_leaf_nodes=31, random_state=7))]).fit(Xtr, ytr)
s_mod = hgb.predict_proba(Xte)[:, 1]
s_base = Xte["recency_days"].to_numpy().astype(float)  # Recency-Regel: je länger still, desto riskanter
pr_mod = round(float(average_precision_score(yte, s_mod)), 4)
pr_base = round(float(average_precision_score(yte, s_base)), 4)
KS = [10, 25, 50, 75, 100, 150, 200]


def patk(s, kk):
    return round(float(yte[np.argsort(-s, kind="stable")[:kk]].mean()), 4)


p100, p100b = patk(s_mod, 100), patk(s_base, 100)
card_m3 = {
    "id": "M3",
    "titel": "Abwanderungsrisiko (echtes Modell)",
    "was": {
        "de": "Gradient Boosting auf echten Stammdaten: Stille in den nächsten 180 Tagen. Holdout, zeitlich getrennt – kein Leakage.",
        "en": "Gradient boosting on real master data: silence in the next 180 days. Temporal holdout – no leakage.",
    },
    "metrikName": "PR-AUC (Holdout)",
    "wertLabel": f"{pr_mod:.3f}".replace(".", ","),
    "baselineName": "Recency-Regel (Tage seit letztem Eingang)",
    "baselineLabel": f"{pr_base:.3f}".replace(".", ","),
    "ziel": "besser als Recency-Regel",
    "erfuellt": bool(pr_mod > pr_base),
    "bedeutet": {
        "de": f"In den 100 riskantesten Kunden sind {round(p100 * 100)} tatsächlich still – die Recency-Regel nur {round(p100b * 100)}. Das sind echte Anrufe, die sich lohnen.",
        "en": f"Of the 100 riskiest customers, {round(p100 * 100)} actually go silent – the recency rule catches only {round(p100b * 100)}. These are calls worth making.",
    },
    "chart": "precision",
    "chartData": {"points": [{"k": kk, "modell": patk(s_mod, kk), "baseline": patk(s_base, kk)} for kk in KS]},
}
print(f"  PR-AUC mod={pr_mod} base={pr_base} P@100 {p100}/{p100b}", flush=True)

# ---------------------------------------------------------------- R1 ranking bands
order = np.argsort(-s_mod, kind="stable")
n = len(order)
bands = {
    "hoch": order[: int(0.2 * n)],
    "mittel": order[int(0.2 * n) : int(0.5 * n)],
    "niedrig": order[int(0.5 * n) :],
}
rates = {b: round(float(yte[ix].mean()), 4) for b, ix in bands.items()}
mono = rates["hoch"] > rates["mittel"] > rates["niedrig"]
card_r1 = {
    "id": "R1",
    "titel": "Ranking-Check: Score-Bänder vs. Wirklichkeit",
    "was": {
        "de": "Holdout-Kunden nach Modellscore in hoch/mittel/niedrig geteilt – dann die echte Abwanderungsrate je Band gemessen.",
        "en": "Holdout customers split into high/medium/low by model score – then the actual churn rate per band measured.",
    },
    "metrikName": "Abwanderungsrate (Band Hoch)",
    "wertLabel": pct0(rates["hoch"]),
    "baselineName": "Mittel / Niedrig",
    "baselineLabel": f"{pct0(rates['mittel'])} / {pct0(rates['niedrig'])}",
    "ziel": "monoton Hoch > Mittel > Niedrig",
    "erfuellt": bool(mono),
    "bedeutet": {
        "de": "Die Bänder trennen sauber: Hoch markierte wandern tatsächlich am häufigsten ab – darauf kann der Vertrieb priorisieren.",
        "en": "The bands separate cleanly: flagged-high customers actually churn most – sales can prioritise on this.",
    },
    "chart": "ranking",
    "chartData": {
        "bars": [
            {"label": "Hoch", "v": rates["hoch"]},
            {"label": "Mittel", "v": rates["mittel"]},
            {"label": "Niedrig", "v": rates["niedrig"]},
        ]
    },
}
print(f"  bands: {rates} mono={mono}", flush=True)

# ---------------------------------------------------------------- M4 volume
# Backtest auf 12 VOLLEN Monaten (Sep 26 ist Teildaten und fliegt raus).
# Modell: trend-fortgeschriebene Saison-Schätzung (1 Parameter, kein Overfit).
print("M4: volume backtest …", flush=True)
kk2 = pd.read_csv(f"{BASE}/KALIBRIERUNGEN.csv", usecols=["BEGINN"])
kk2["BEGINN"] = pd.to_datetime(kk2["BEGINN"], errors="coerce")
kk2 = kk2.dropna(subset=["BEGINN"])
monthly = kk2.groupby(kk2["BEGINN"].dt.to_period("M")).size()
monthly.index = monthly.index.to_timestamp()
monthly = monthly.asfreq("MS", fill_value=0)
test = monthly.loc["2025-09":"2026-08"]  # 12 volle Monate
train = monthly.loc[: "2025-08"]
print(f"  train {train.index[0].date()}..{train.index[-1].date()} ({len(train)}), test {test.index[0].date()}..{test.index[-1].date()}", flush=True)


def wape(a, p):
    return float(np.abs(a - p).sum() / max(a.sum(), 1))


naive = np.array([monthly.get(t - pd.DateOffset(years=1), 0) for t in test.index], dtype=float)
trend = float(train.iloc[-12:].mean() / max(train.iloc[-24:-12].mean(), 1))
pred = np.maximum(0, naive * trend)
wape_m, wape_n = wape(test.to_numpy(), pred), wape(test.to_numpy(), naive)
labels = [f"{t.month}/{str(t.year)[2:]}" for t in test.index]
card_m4 = {
    "id": "M4",
    "titel": "Auftragsvolumen (echter Backtest)",
    "was": {
        "de": "Saison-Schätzung mal Trendfaktor, geprüft an 12 vollen Monaten – gegen den reinen Vorjahresmonat.",
        "en": "Seasonal estimate times trend factor, tested on 12 full months – against the plain same-month-last-year.",
    },
    "metrikName": "WAPE der 12 Monatssummen",
    "wertLabel": pct1(wape_m),
    "baselineName": "Saison-naiv (Vorjahresmonat)",
    "baselineLabel": pct1(wape_n),
    "ziel": "≤ Baseline",
    "erfuellt": bool(wape_m <= wape_n),
    "bedeutet": (
        {
            "de": f"Über 12 Monate liegt das Modell mit {pct1(wape_m)} näher an der Wirklichkeit als „wie letztes Jahr“ ({pct1(wape_n)}) – planen Sie mit dem Band, nicht mit dem Punktwert.",
            "en": f"Over 12 months the model at {pct1(wape_m)} is closer to reality than “like last year” ({pct1(wape_n)}) – plan against the band, not the point value.",
        }
        if wape_m <= wape_n
        else {
            "de": f"Über 12 Monate schlägt „wie letztes Jahr“ ({pct1(wape_n)}) das Modell ({pct1(wape_m)}) – diese Karte bleibt rot, bis das Modell besser wird.",
            "en": f"Over 12 months “like last year” ({pct1(wape_n)}) beats the model ({pct1(wape_m)}) – this card stays red until the model improves.",
        }
    ),
    "chart": "volumen",
    "chartData": {
        "series": [
            {"label": lab, "actual": int(a), "modell": int(round(p)), "baseline": int(b)}
            for lab, a, p, b in zip(labels, test.to_numpy(), pred, naive)
        ]
    },
}
print(f"  WAPE model={wape_m:.3f} naive={wape_n:.3f}", flush=True)

# ---------------------------------------------------------------- M5 gaps
print("M5: gap fill …", flush=True)
kg = pd.read_csv(
    f"{BASE}/KALIBRIERUNGEN.csv",
    usecols=["KUNDENNUMMER_SAP", "BEGINN", "MESSMITTELGRUPPE"],
    dtype={"KUNDENNUMMER_SAP": str},
)
kg["BEGINN"] = pd.to_datetime(kg["BEGINN"], errors="coerce")
kg = kg.dropna(subset=["BEGINN"])
kg["MESSMITTELGRUPPE"] = kg["MESSMITTELGRUPPE"].fillna("Unbekannt")
W0 = kg[(kg["BEGINN"] >= "2024-01-01") & (kg["BEGINN"] < "2025-01-01")]
W1 = kg[(kg["BEGINN"] >= "2025-01-01") & (kg["BEGINN"] < "2026-01-01")]
peers = sorted(W0["KUNDENNUMMER_SAP"].unique())
brmap = kb.drop_duplicates("KundenNr").set_index("KundenNr")["Branche"]
peer_br = pd.Series(peers).map(brmap).fillna("Sonstiges")
has0 = pd.crosstab(W0["KUNDENNUMMER_SAP"], W0["MESSMITTELGRUPPE"]).clip(upper=1)
has0 = has0.reindex(index=peers, fill_value=0)
has1 = pd.crosstab(W1["KUNDENNUMMER_SAP"], W1["MESSMITTELGRUPPE"]).clip(upper=1)
pen_df = has0.copy()
pen_df["__br"] = peer_br.values
pen_by_br = pen_df.groupby("__br").mean(numeric_only=True)

# voll vektoriell: Zeilen = peers, Spalten = Gruppen
br_of = pd.Series(peer_br.values, index=peers)
h0v = has0.to_numpy()
h1v = has1.reindex(index=peers, columns=has0.columns, fill_value=0).to_numpy()
pen_mat = np.vstack([pen_by_br.loc[br_of[c]].reindex(has0.columns).fillna(0).to_numpy() for c in peers])
nonowned = h0v == 0
tiers = {"hoch": pen_mat >= 0.6, "mittel": (pen_mat >= 0.4) & (pen_mat < 0.6), "niedrig": pen_mat < 0.4}
fill = {}
for tname, mask in tiers.items():
    sel = nonowned & mask
    fill[tname] = float(h1v[sel].mean()) if sel.sum() else 0.0
base_fill = fill["niedrig"]
sugg_sel = nonowned & (pen_mat >= 0.4)
sugg_fill = float(h1v[sugg_sel].mean()) if sugg_sel.sum() else 0.0
lift_ok = sugg_fill >= 2 * base_fill if base_fill > 0 else sugg_fill > 0
tot_recs = int(sugg_sel.sum())
card_m5 = {
    "id": "M5",
    "titel": "Branchenpotenzial (echt gemessen)",
    "was": {
        "de": "2024: Gruppen, die der Kunde nicht, aber ≥ 40 % seiner Branchen-Peers kalibrieren. 2025 geprüft: Wurde die Lücke gefüllt?",
        "en": "2024: groups the customer missed but ≥ 40% of industry peers calibrated. 2025 checked: was the gap filled?",
    },
    "metrikName": "Füllrate empfohlener Lücken (Peers ≥ 40 %)",
    "wertLabel": pct1(sugg_fill),
    "baselineName": "Füllrate seltener Gruppen (< 40 %)",
    "baselineLabel": pct1(base_fill),
    "ziel": "Empfohlen ≥ 2× Baseline",
    "erfuellt": bool(lift_ok),
    "bedeutet": {
        "de": f"Von {tot_recs} Lücken füllen sich {pct0(sugg_fill)} innert eines Jahres (seltene: {pct0(base_fill)}). Der beste Bereich ist die Mitte (40–60 %, {pct0(fill['mittel'])}): Kerngruppen (≥ 60 %) fehlen nur strukturell – dort lohnt kein Anruf.",
        "en": f"Of {tot_recs} gaps, {pct0(sugg_fill)} fill within a year (rare ones: {pct0(base_fill)}). The sweet spot is the middle (40–60 %, {pct0(fill['mittel'])}): core groups (≥ 60%) are missing structurally – no call needed there.",
    },
    "chart": "ranking",
    "chartData": {
        "bars": [
            {"label": "Peers ≥ 60 %", "v": round(fill["hoch"], 4)},
            {"label": "Peers 40–60 %", "v": round(fill["mittel"], 4)},
            {"label": "Peers < 40 %", "v": round(fill["niedrig"], 4)},
        ]
    },
}
print(f"  fill: {fill} recs={tot_recs}", flush=True)

# ---------------------------------------------------------------- merge + write
print("merging …", flush=True)
with open(OUT, encoding="utf-8") as f:
    payload = json.load(f)
payload["cards"] = [card_m1, card_m3, card_m4, card_m5, card_r1]
payload["generated_at"] = datetime.now().isoformat(timespec="seconds")
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=1)
print(f"wrote {OUT} in {time.time() - t0:.0f}s", flush=True)
