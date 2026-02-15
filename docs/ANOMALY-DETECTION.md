# ML-Based Anomaly Detection

Detect abnormal node behavior using Isolation Forest on XDCNet metrics data.

## Setup

```bash
cd ml
pip install -r requirements.txt
```

## Usage

### Train a Model

```bash
# From database
python anomaly_detector.py --train --db-url postgresql://user:pass@localhost/xdcnet

# From CSV
python anomaly_detector.py --train --csv metrics.csv
```

### Detect Anomalies

```bash
python anomaly_detector.py --detect --db-url postgresql://user:pass@localhost/xdcnet

# Train + detect in one pass
python anomaly_detector.py --train --detect --csv metrics.csv
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--db-url` | — | PostgreSQL connection string |
| `--csv` | — | CSV file with metrics data |
| `--train` | false | Train the model |
| `--detect` | false | Run anomaly detection |
| `--contamination` | 0.05 | Expected fraction of anomalies |
| `--hours` | 24 | Hours of data to load from DB |

## How It Works

1. **Features**: cpu_pct, mem_pct, disk_pct, peer_count
2. **Scaling**: StandardScaler normalizes features
3. **Model**: Isolation Forest (100 trees, configurable contamination)
4. **Output**: Each sample gets an anomaly flag + score

Isolation Forest works by randomly partitioning data — anomalies require fewer partitions to isolate, yielding lower scores.

## CSV Format

```csv
time,node_id,cpu_pct,mem_pct,disk_pct,peer_count
2024-01-15T10:00:00Z,node-001,45.2,62.1,55.0,25
```

## Integration

To run detection on a schedule, add a cron job or integrate with the dashboard API:

```bash
# Every hour, detect anomalies and alert
0 * * * * cd /app/ml && python anomaly_detector.py --detect --db-url $DATABASE_URL
```

## Roadmap

- [ ] Real-time streaming detection
- [ ] Dashboard integration (API endpoint + alerts)
- [ ] Multiple model support (per-node baselines)
- [ ] Feature engineering (rolling averages, rate of change)
