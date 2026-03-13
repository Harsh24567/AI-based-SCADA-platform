# Database Architecture — InfluxDB (Time-Series Database)

## What is a Time-Series Database?

A database purpose-built for data points that arrive with timestamps — like sensor readings every 2 seconds. Think of it as a hyper-optimized spreadsheet where every row is "at this time, this value was recorded."

---

## Why NOT a Traditional Database (MySQL/PostgreSQL)?

| Factor | MySQL / PostgreSQL | InfluxDB | Winner |
|---|---|---|---|
| **Write speed** | ~5,000 inserts/sec | ~500,000+ inserts/sec | InfluxDB (100x) |
| **Storage efficiency** | Stores every row fully | Compresses timestamps + delta encoding | InfluxDB (10x less disk) |
| **Time-range queries** | Scans entire table or relies on B-tree index | Native time-partitioned storage, instant range queries | InfluxDB |
| **Downsampling** | Manual SQL with GROUP BY + lots of code | Built-in `aggregateWindow()` — one line | InfluxDB |
| **Auto-cleanup** | Must write cron jobs to delete old data | Retention policies delete automatically (e.g., keep 30 days) | InfluxDB |
| **Schema changes** | ALTER TABLE needed for new sensor types | Schema-less — just start writing new fields | InfluxDB |
| **JOINs / Relations** | Excellent (foreign keys, normalization) | Not supported | MySQL/PG |
| **Complex business logic** | Excellent (transactions, constraints) | Not designed for this | MySQL/PG |

**Bottom line:** For our use case (millions of timestamped sensor readings, queried by time range), InfluxDB is 100x faster at writes and uses 10x less storage than traditional databases.

---

## The Math

```
3 machines × 3 parameters × 1 reading every 2 seconds = 4.5 points/sec

Per day:    4.5 × 86,400  =  ~388,800 data points
Per month:  388,800 × 30  =  ~11.6 million data points
Per year:   ~140 million data points
```

In a real factory with 100+ machines, you'd get ~15,000 points/second. Traditional databases choke at this volume. InfluxDB handles it easily.

---

## How InfluxDB Organizes Data

```
┌────────────────────────────────────────────────────────────┐
│  Bucket: "ELEC1"  (like a database in MySQL)              │
│                                                            │
│  Measurement: "machine_metrics"  (like a table)           │
│                                                            │
│  ┌──────────┬──────────────┬─────────┬──────┬──────┬────┐ │
│  │   Time   │  machine_id  │  temp   │ vib  │ pres │    │ │
│  │  (auto)  │   (tag)      │ (field) │(fld) │(fld) │    │ │
│  ├──────────┼──────────────┼─────────┼──────┼──────┼────┤ │
│  │ 14:30:00 │  MOTOR_1     │  72.3   │ 4.1  │ 42.5 │    │ │
│  │ 14:30:02 │  MOTOR_1     │  72.5   │ 4.0  │ 42.3 │    │ │
│  │ 14:30:00 │  PUMP_1      │  55.1   │ 2.8  │ 48.2 │    │ │
│  │ 14:30:02 │  PUMP_1      │  55.3   │ 2.9  │ 48.0 │    │ │
│  └──────────┴──────────────┴─────────┴──────┴──────┴────┘ │
│                                                            │
│  Tags = indexed (fast filtering by machine_id)            │
│  Fields = actual values (not indexed, compressed)         │
│  Time = auto-indexed, partitioned by time range           │
└────────────────────────────────────────────────────────────┘
```

---

## How Data is Generated & Infused

### Complete Data Journey (Step by Step)

```
STEP 1          STEP 2              STEP 3            STEP 4           STEP 5
Simulator ────► MQTT Broker ──────► Ingestor ────────► InfluxDB ──────► API
(generates)     (routes)            (validates)        (stores)         (serves)
   │                                    │                                  │
   │                                    │                                  │
   ▼                                    ▼                                  ▼
Realistic                          Pydantic              ┌──► Dashboard (2s poll)
sensor values                      validation             ├──► AI Engine (5s cycle)
with drift &                       + alarm check          └──► History queries
anomaly injection
```

### Step 1: Data Generation (Sensor Simulator)

```
What happens every 2 seconds for each machine:

1. Base value calculated from configured range
   MOTOR_1 temperature: range [60, 90] → base = 75°C

2. Natural drift applied (sine wave pattern)
   75 + sin(time × 0.01) × 5 → 77.3°C  (slowly oscillates)

3. Random noise added
   77.3 + random(-0.5, 0.5) → 77.6°C  (realistic jitter)

4. Anomaly injection (every ~60 seconds, randomly)
   77.6 × 1.15 → 89.2°C  (sudden spike to test alarms + AI)
```

Output payload (published to MQTT topic `factory/sensors`):
```json
{
  "machine_id": "MOTOR_1",
  "temperature": 77.6,
  "vibration": 4.2,
  "pressure": 42.1,
  "timestamp": "2026-02-24T14:30:02Z"
}
```

### Step 2: MQTT Transport

```
Simulator publishes to topic: "factory/sensors"
                     │
                     ▼
            ┌─────────────┐
            │  Mosquitto   │  (Message broker)
            │  Broker      │  Holds message until subscriber(s) confirm receipt
            └──────┬──────┘
                   │  QoS 1: "at-least-once delivery"
                   ▼
            Ingestor subscribes
```

### Step 3: Validation & Ingestion

```
Ingestor receives MQTT message, then:

1. Parse JSON payload
2. Validate with Pydantic model:
   - machine_id must be a string         ✓
   - temperature must be 0-200°C         ✓  (rejects garbage data)
   - vibration must be 0-50 mm/s         ✓
   - pressure must be 0-100 bar          ✓

3. If invalid → log error, skip (don't corrupt the database)
4. If valid → write to InfluxDB as a time-series point

5. Check alarm rules:
   - temperature > 85°C? → Trigger HIGH alarm
   - vibration > 7 mm/s?  → Trigger HIGH alarm
   - pressure < 32 bar?   → Trigger MEDIUM alarm
```

### Step 4: InfluxDB Storage

```
Incoming write:
  measurement: "machine_metrics"
  tags:        {machine_id: "MOTOR_1"}
  fields:      {temperature: 77.6, vibration: 4.2, pressure: 42.1}
  timestamp:   2026-02-24T14:30:02Z

InfluxDB internally:
  → Appends to time-partitioned shard (organized by hour/day)
  → Compresses using delta encoding (77.6, +0.2, -0.1, +0.3...)
  → Indexes tag values for fast machine_id filtering
```

### Step 5: Data Consumption (3 consumers)

| Consumer | Query | Frequency |
|---|---|---|
| **Dashboard** | "Give me latest reading per machine" | Every 2 seconds |
| **AI Engine** | "Give me last 2 minutes of data" | Every 5 seconds |
| **History Page** | "Give me last 24h, downsampled to 5-min averages" | On-demand |

### Example InfluxDB Query (Flux language):
```
from(bucket: "ELEC1")
  |> range(start: -24h)
  |> filter(fn: (r) => r.machine_id == "MOTOR_1")
  |> filter(fn: (r) => r._field == "temperature")
  |> aggregateWindow(every: 5m, fn: mean)
```
This returns 288 points (24h ÷ 5min) instead of 43,200 raw points — 150x data reduction for the chart.

---

## In a Real Factory (Final Product)

In the final product, the simulator would be replaced by real PLCs/sensors:

```
CURRENT (Demo):
  Simulator ──► MQTT ──► Ingestor ──► InfluxDB

FINAL PRODUCT:
  PLC (Siemens S7) ──► OPC UA Driver ──┐
  PLC (Allen-Bradley) ──► Modbus Driver ──┤──► Ingestor ──► InfluxDB
  IoT Sensor (ESP32) ──► MQTT Direct ────┘
```

The entire AI layer, API, and dashboard remain unchanged — only the data source changes. That's the power of the abstracted architecture.
