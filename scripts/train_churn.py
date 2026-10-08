"""Real churn model for the Developer tab (Modellguete).

Reads the genuine MSSQL export snapshots in database_tables/ and trains a
churn classifier with a temporal backtest:

  features as of T0 = 2025-09-24  ->  label = silent in (T0, T0 + 180 days]

Temporal split => no leakage: the model never sees the outcome window.
Compares prior baseline, logistic regression and gradient boosting,
then writes metrics + calibration + importances to
public/data/modellguete-real.json for the UI.

Run:  python scripts/train_churn.py   (needs pandas, scikit-learn, numpy)
"""

import json
import time
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

T0 = pd.Timestamp("2025-09-24")
OUTCOME_DAYS = 180
HIST_DAYS = 365
T0_END = T0 + pd.Timedelta(days=OUTCOME_DAYS)
T0_START = T0 - pd.Timedelta(days=HIST_DAYS)
MID = T0 - pd.Timedelta(days=HIST_DAYS // 2)

BASE = "database_tables"
OUT = "public/data/modellguete-real.json"


def load() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    print("loading KALIBRIERUNGEN …", flush=True)
    k = pd.read_csv(
        f"{BASE}/KALIBRIERUNGEN.csv",
        usecols=["KUNDENNUMMER_SAP", "BEGINN", "BEWERTUNG", "PRUEFUNGSART"],
        dtype={"KUNDENNUMMER_SAP": str},
    )
    k["BEGINN"] = pd.to_datetime(k["BEGINN"], errors="coerce")
    k = k.dropna(subset=["BEGINN"])
    print("loading MESSMITTEL + Kunde_Branche …", flush=True)
    m = pd.read_csv(f"{BASE}/MESSMITTEL.csv", usecols=["KUNDENNUMMER_SAP"], dtype={"KUNDENNUMMER_SAP": str})
    kb = pd.read_csv(f"{BASE}/Kunde_Branche.csv", dtype={"KundenNr": str})
    return k, m, kb


def build_features(k: pd.DataFrame, m: pd.DataFrame, kb: pd.DataFrame) -> pd.DataFrame:
    hist = k[(k["BEGINN"] > T0_START) & (k["BEGINN"] <= T0)]
    outc = k[(k["BEGINN"] > T0) & (k["BEGINN"] <= T0_END)]
    print(f"history rows: {len(hist)}, outcome rows: {len(outc)}", flush=True)

    g = hist.groupby("KUNDENNUMMER_SAP")
    feat = pd.DataFrame(
        {
            "n_cal_12m": g.size(),
            "recency_days": (T0 - g["BEGINN"].max()).dt.days,
            "tenure_days": (T0 - g["BEGINN"].min()).dt.days,
            "dakks_share": g["PRUEFUNGSART"].apply(lambda s: float((s == "DAkkS").mean())),
            "fail_share": g["BEWERTUNG"].apply(lambda s: float((s == "NICHT_EINSATZFAEHIG").mean())),
        }
    )
    h2 = hist[hist["BEGINN"] > MID].groupby("KUNDENNUMMER_SAP").size()
    h1 = hist[hist["BEGINN"] <= MID].groupby("KUNDENNUMMER_SAP").size()
    feat["trend"] = (feat.index.map(h2).fillna(0) - feat.index.map(h1).fillna(0)) / feat["n_cal_12m"]

    inst = m.groupby("KUNDENNUMMER_SAP").size().rename("n_instruments")
    feat = feat.join(inst)
    feat["n_instruments"] = feat["n_instruments"].fillna(0).astype(int)

    br = kb.drop_duplicates("KundenNr").set_index("KundenNr")["Branche"]
    feat["branche"] = feat.index.map(br).fillna("Sonstiges")

    silent = set(outc["KUNDENNUMMER_SAP"].unique())
    feat["churn"] = (~feat.index.isin(silent)).astype(int)
    feat = feat.reset_index(names="kunde")
    print(f"customers: {len(feat)}, churn rate: {feat['churn'].mean():.3f}", flush=True)
    return feat


NUM = ["n_cal_12m", "recency_days", "tenure_days", "dakks_share", "fail_share", "trend", "n_instruments"]
CAT = ["branche"]


def make_pipe(model):
    return Pipeline(
        [
            ("prep", ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), CAT)], remainder="passthrough")),
            ("model", model),
        ]
    )


def precision_at_k(y_true: np.ndarray, score: np.ndarray, k: int) -> float:
    order = np.argsort(-score, kind="stable")[:k]
    return float(y_true[order].mean()) if len(order) else 0.0


def calibration_table(y_true: np.ndarray, score: np.ndarray, bins: int = 10):
    qs = np.quantile(score, np.linspace(0, 1, bins + 1))
    out = []
    for b in range(bins):
        lo, hi = qs[b], qs[b + 1]
        mask = (score >= lo) & (score <= hi if b == bins - 1 else score < hi)
        if b == bins - 1:
            mask = (score >= lo) & (score <= hi)
        n = int(mask.sum())
        out.append(
            {
                "bin": b + 1,
                "predicted": round(float(score[mask].mean()) if n else 0.0, 4),
                "observed": round(float(y_true[mask].mean()) if n else 0.0, 4),
                "n": n,
            }
        )
    return out


def main() -> None:
    t0 = time.time()
    k, m, kb = load()
    feat = build_features(k, m, kb)

    X = feat[NUM + CAT]
    y = feat["churn"].to_numpy()
    split = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=7)
    tr, te = next(split.split(X, y))
    Xtr, Xte, ytr, yte = X.iloc[tr], X.iloc[te], y[tr], y[te]
    print(f"train={len(Xtr)} test={len(Xte)} test churn rate={yte.mean():.3f}", flush=True)

    prior = float(ytr.mean())
    logreg = make_pipe(LogisticRegression(max_iter=2000, C=1.0))
    hgb = make_pipe(HistGradientBoostingClassifier(max_iter=300, learning_rate=0.06, max_leaf_nodes=31, random_state=7))
    logreg.fit(Xtr, ytr)
    hgb.fit(Xtr, ytr)
    models = []
    for name, est in [("Prior (Anteil)", None), ("Logistische Regression", logreg), ("Gradient Boosting", hgb)]:
        s = np.full_like(yte, prior, dtype=float) if est is None else est.predict_proba(Xte)[:, 1]
        models.append(
            {
                "id": name,
                "roc_auc": round(float(roc_auc_score(yte, s)), 4),
                "pr_auc": round(float(average_precision_score(yte, s)), 4),
                "precision_at_50": round(precision_at_k(yte, s, 50), 4),
                "precision_at_100": round(precision_at_k(yte, s, 100), 4),
                "precision_at_200": round(precision_at_k(yte, s, 200), 4),
            }
        )
        print(name, models[-1], flush=True)

    s_hgb = hgb.predict_proba(Xte)[:, 1]
    cal = calibration_table(yte, s_hgb)
    print("calibration:", cal, flush=True)

    print("permutation importance …", flush=True)
    imp = permutation_importance(hgb, Xte, yte, n_repeats=3, random_state=7, scoring="average_precision")
    ohe_cats = [str(c) for c in hgb.named_steps["prep"].named_transformers_["cat"].categories_[0]]
    feat_names = NUM + [f"branche:{c}" for c in ohe_cats]
    order = np.argsort(imp.importances_mean)[::-1][:12]
    importances = [{"feature": feat_names[i], "value": round(float(imp.importances_mean[i]), 4)} for i in order]
    print("importances:", importances, flush=True)

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "tables": ["KALIBRIERUNGEN", "MESSMITTEL", "Kunde_Branche"],
        "cutoff": "2025-09-24",
        "outcome_window_days": OUTCOME_DAYS,
        "history_days": HIST_DAYS,
        "n_customers": len(feat),
        "n_train": len(Xtr),
        "n_test": len(Xte),
        "churn_rate": round(float(y.mean()), 4),
        "test_churn_rate": round(float(yte.mean()), 4),
        "models": models,
        "calibration": cal,
        "importances": importances,
        "note": "Temporal backtest: features as of cutoff, label = silent in the following 180 days. No leakage by construction.",
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print(f"wrote {OUT} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
