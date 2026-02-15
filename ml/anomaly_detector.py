"""
XDCNetOwn ML-Based Anomaly Detection

Uses scikit-learn's Isolation Forest to detect anomalous node behavior
from metrics data (CPU, memory, disk, peer count).

Usage:
    python anomaly_detector.py --db-url postgresql://user:pass@localhost/xdcnet
    python anomaly_detector.py --csv metrics.csv
"""

import argparse
import logging
import sys
from datetime import datetime, timedelta

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

FEATURE_COLS = ["cpu_pct", "mem_pct", "disk_pct", "peer_count"]
MODEL_PATH = "anomaly_model.joblib"
SCALER_PATH = "anomaly_scaler.joblib"


def load_from_db(db_url: str, hours: int = 24) -> pd.DataFrame:
    """Load recent metrics from PostgreSQL/TimescaleDB."""
    import psycopg2

    query = """
        SELECT time, node_id, cpu_pct, mem_pct, disk_pct, peer_count
        FROM node_metrics
        WHERE time > NOW() - INTERVAL '%s hours'
        ORDER BY time DESC
    """
    conn = psycopg2.connect(db_url)
    df = pd.read_sql(query, conn, params=(hours,))
    conn.close()
    logger.info(f"Loaded {len(df)} rows from database")
    return df


def load_from_csv(path: str) -> pd.DataFrame:
    """Load metrics from a CSV file."""
    df = pd.read_csv(path)
    logger.info(f"Loaded {len(df)} rows from {path}")
    return df


def train(df: pd.DataFrame, contamination: float = 0.05) -> tuple:
    """Train an Isolation Forest model on metrics data."""
    features = df[FEATURE_COLS].dropna()
    if len(features) < 10:
        logger.error("Not enough data to train (need at least 10 rows)")
        sys.exit(1)

    scaler = StandardScaler()
    X = scaler.fit_transform(features)

    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    logger.info(f"Model saved to {MODEL_PATH}, scaler to {SCALER_PATH}")

    return model, scaler


def detect(df: pd.DataFrame, model=None, scaler=None) -> pd.DataFrame:
    """Run anomaly detection on metrics data. Returns rows flagged as anomalies."""
    if model is None:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)

    features = df[FEATURE_COLS].dropna()
    X = scaler.transform(features)

    predictions = model.predict(X)
    scores = model.decision_function(X)

    result = df.loc[features.index].copy()
    result["anomaly"] = predictions == -1
    result["anomaly_score"] = scores

    anomalies = result[result["anomaly"]]
    logger.info(f"Detected {len(anomalies)} anomalies out of {len(result)} samples")

    return result


def main():
    parser = argparse.ArgumentParser(description="XDCNetOwn Anomaly Detection")
    parser.add_argument("--db-url", help="PostgreSQL connection string")
    parser.add_argument("--csv", help="Path to CSV file with metrics")
    parser.add_argument("--train", action="store_true", help="Train the model")
    parser.add_argument("--detect", action="store_true", help="Run detection")
    parser.add_argument(
        "--contamination",
        type=float,
        default=0.05,
        help="Expected anomaly ratio (default: 0.05)",
    )
    parser.add_argument("--hours", type=int, default=24, help="Hours of data to load from DB")
    args = parser.parse_args()

    if not args.db_url and not args.csv:
        parser.error("Provide --db-url or --csv")

    # Load data
    if args.csv:
        df = load_from_csv(args.csv)
    else:
        df = load_from_db(args.db_url, args.hours)

    if args.train or not args.detect:
        model, scaler = train(df, args.contamination)

    if args.detect or not args.train:
        result = detect(df)
        anomalies = result[result["anomaly"]]
        if not anomalies.empty:
            print("\n⚠️  Anomalies detected:")
            print(anomalies[["time", "node_id"] + FEATURE_COLS + ["anomaly_score"]].to_string())
        else:
            print("\n✅ No anomalies detected")


if __name__ == "__main__":
    main()
