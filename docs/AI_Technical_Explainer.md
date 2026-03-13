# AI SCADA Platform — Technical AI/ML Explainer

> **TL;DR:** No, the AI insights are **not gimmicky**. Every number, trend, anomaly flag, health score, and prediction shown on the dashboard is computed using **real statistical and machine learning techniques** running against **real sensor data** stored in InfluxDB. Nothing is hardcoded, faked, or randomly generated for display purposes.

---

## 1. "Are the AI Insights Gimmicky?"

**Absolutely not.** Here is a complete breakdown of every AI/ML technique used in the platform, mapped to the exact source file where it runs:

### 1.1 Anomaly Detection — Three Independent Detectors

The system runs **three complementary anomaly detection strategies** simultaneously. Each one catches different types of problems:

| Detector | Technique | What It Catches | Source File |
|---|---|---|---|
| **Z-Score Detector** | Statistical hypothesis testing | Values that deviate more than 2.5σ (standard deviations) from the rolling mean | `ai_engine/anomaly_detector.py` → `ZScoreDetector` |
| **Isolation Forest** | Unsupervised ML (scikit-learn) | Complex multi-dimensional anomalies that statistical methods miss | `ai_engine/anomaly_detector.py` → `IsolationForestDetector` |
| **Rate-of-Change** | First-derivative analysis | Sudden spikes/drops even when the absolute value is still "normal" | `ai_engine/anomaly_detector.py` → `RateOfChangeDetector` |

#### Z-Score Detection (Statistical)
- Computes the **rolling mean (μ)** and **standard deviation (σ)** of the last N sensor readings.
- Calculates: `Z = (current_value − μ) / σ`
- If `|Z| > 2.5`, the reading is flagged as anomalous.
- **Why it's real:** Z-score is a foundational statistical technique used in quality control (Six Sigma), financial risk analysis, and clinical diagnostics. It is the standard method for detecting outliers in normally-distributed data.

#### Isolation Forest (Machine Learning)
- Uses **scikit-learn's `IsolationForest`** algorithm — a genuine unsupervised ML model.
- The model is trained (fitted) on the rolling buffer of sensor data and periodically re-fitted as new data arrives (every 100 samples).
- It works by randomly partitioning data points. Anomalies are "isolated" in fewer partitions (shorter path length in the decision tree), giving them a higher anomaly score.
- Contamination ratio is set to 5% (`if_contamination: 0.05`).
- **Why it's real:** Isolation Forest is a peer-reviewed algorithm published by Fei Tony Liu et al. (2008). It is one of the most widely-used anomaly detection algorithms in production industrial systems, including predictive maintenance at companies like GE Digital and Siemens MindSphere.

#### Rate-of-Change Detection (First Derivative)
- Computes the instantaneous rate of change: `ΔV/Δt = (current_value − previous_value) / time_delta`
- Compares against parameter-specific thresholds (e.g., temperature change > 5°C/sec).
- **Why it's real:** Rate-of-change monitoring is a fundamental technique in process control engineering. It catches "silent killers" — scenarios where a motor heats up from 60°C to 80°C in 30 seconds (still under the alarm limit) but at a dangerously fast rate that indicates imminent failure.

---

### 1.2 Trend Prediction — Linear/Polynomial Regression

| Technique | What It Does | Source File |
|---|---|---|
| **Polynomial Regression** | Forecasts future values N minutes ahead | `ai_engine/trend_predictor.py` → `TrendPredictor` |
| **Linear Regression (polyfit)** | Estimates Time-To-Failure (TTF) | `chatbot_engine/predictive_tools.py` → `predict_time_to_failure()` |

#### How the Trend Predictor Works
1. Takes the rolling buffer of timestamped sensor values.
2. Normalizes timestamps to seconds-from-start for numerical stability.
3. Fits a **numpy polynomial** (`np.polyfit`) to the data — degree 1 (linear) by default, configurable to degree 2 (quadratic).
4. Computes **R² (coefficient of determination)** as a confidence metric:
   - `R² = 1 − (SS_res / SS_tot)` where SS_res = sum of squared residuals, SS_tot = total sum of squares.
   - R² = 1.0 means perfect fit; R² = 0.0 means the model explains nothing.
5. Extrapolates the fitted polynomial forward by `horizon_seconds` (default: 300s = 5 minutes) to produce a **predicted future value**.
6. Calculates **Threshold ETA** — the estimated number of seconds/minutes until the metric crosses its alarm limit.

- **Why it's real:** Polynomial regression is a workhorse of predictive analytics. The R² confidence metric ensures the system does not blindly trust predictions from noisy data. This is the same mathematical foundation used in industrial predictive maintenance systems.

#### Time-To-Failure (TTF) Estimation
1. Fetches historical data from InfluxDB for the last N minutes.
2. Fits a linear regression using `np.polyfit(x, y, 1)` to get slope and intercept.
3. Solves for the time at which the regression line crosses the alarm threshold:
   - `t_breach = (threshold − intercept) / slope`
4. Converts readings-until-breach to minutes based on the polling interval.

---

### 1.3 Health Scoring — Weighted Composite Score

| Factor | Weight | What It Measures |
|---|---|---|
| Threshold Distance | **40%** | How far current values are from alarm limits |
| Anomaly Penalty | **30%** | Number of active anomalies detected |
| Signal Stability | **20%** | Coefficient of variation (CV) of the last 30 readings |
| Rate Calmness | **10%** | Average absolute first-difference of the last 20 readings |

- The final score is a **0–100 weighted composite** mapped to grades (A/B/C/D/F).
- System-wide score is the **mean of all machine scores**, with the worst machine flagged.

- **Why it's real:** Multi-factor weighted scoring is used in production systems like OSIsoft PI (now AVEVA), Honeywell's PHD, and Siemens XHQ. The specific factors mirror industry standards for Overall Equipment Effectiveness (OEE).

---

### 1.4 AI Chatbot Tools — Real Queries, Not Canned Responses

The AI Assistant (Gemini) does **not** generate fake numbers. It calls real tools that execute real InfluxDB queries:

| Tool | What It Does | Data Source |
|---|---|---|
| `query_latest_metrics()` | Returns the most recent sensor reading per machine | **Live InfluxDB query** (`|> last()`) |
| `query_historical_stats()` | Computes mean, max, min over a time window | **Live InfluxDB query** + Python aggregation |
| `query_time_series()` | Returns time-series data points for charting | **Live InfluxDB query** with `aggregateWindow(every: 1m, fn: mean)` |
| `analyse_health()` | Runs Z-score + trend slope + threshold proximity analysis | **Live InfluxDB query** → numpy processing |
| `predict_time_to_failure()` | Linear regression TTF estimation | **Live InfluxDB query** → numpy polyfit |
| `generate_shift_report()` | Builds a PDF with charts and tables | **Live InfluxDB query** → matplotlib + ReportLab |
| `get_active_alarms()` | Returns currently active alarms | **Live InfluxDB query** on `alarms` measurement |

---

## 2. "Are the Trends Real?"

**Yes — 100% real.** Here is the data pipeline that proves it:

```
Physical PLC / Simulator
       │
       ▼ (Modbus TCP or MQTT)
  Modbus Ingestor / MQTT Ingestor
       │
       ▼ (writes every 2 seconds)
    InfluxDB (time-series database)
       │
       ▼ (queried by AI Engine every 5 seconds)
  AI Engine Background Task
       │
       ├─► Anomaly Detection (Z-Score, Isolation Forest, RoC)
       ├─► Trend Prediction (Polynomial Regression, R² confidence)
       └─► Health Scoring (4-factor weighted composite)
       │
       ▼ (served via FastAPI REST API)
  Next.js Dashboard + AI Assistant
```

### When a Real PLC is Connected
- The `modbus_ingestor.py` physically reads Modbus TCP holding registers from the PLC at the configured IP address (e.g., `192.168.1.15:502`).
- Each register maps to a specific machine and metric (configured in `settings.yaml`).
- Raw register values are scaled (e.g., `register_value × 0.1 = temperature_in_celsius`).
- The scaled values are written directly to InfluxDB with a `machine_id` tag.
- **Every trend line, every chart, and every prediction is computed from these real register values.**

### When the Simulator is Running
- The `sensor_simulator.py` generates data using a **random walk with mean reversion** — a mathematically rigorous model that produces realistic sensor drift patterns (not pure random noise).
- This data is published to MQTT, picked up by `mqtt_ingestor.py`, and written to the same InfluxDB bucket.
- **The AI engine treats simulated data exactly the same way as real PLC data** — the same algorithms run, the same predictions are made.

### Key Point for Stakeholders
> When connected to a real PLC, every number on the dashboard comes directly from the factory floor. The AI does not "make up" or "smooth" the data — it analyzes the raw readings using the same statistical and ML techniques that Fortune 500 manufacturers use in their predictive maintenance systems.

---

## Summary Table: Technique Legitimacy

| Feature | Technique | Industry Standard? | Libraries Used |
|---|---|---|---|
| Anomaly Detection | Z-Score | ✅ Six Sigma, SPC | numpy |
| Anomaly Detection | Isolation Forest | ✅ Published ML algorithm (2008) | scikit-learn |
| Anomaly Detection | Rate-of-Change | ✅ Process control engineering | numpy |
| Trend Prediction | Polynomial Regression | ✅ Predictive analytics standard | numpy |
| Confidence Metric | R² (Coefficient of Determination) | ✅ Statistical standard | numpy |
| Time-to-Failure | Linear Extrapolation | ✅ Reliability engineering | numpy |
| Health Scoring | Weighted Composite (4-factor) | ✅ OEE / KPI methodology | numpy |
| AI Reasoning | Gemini LLM with tool-calling | ✅ Agentic AI architecture | google-genai |
