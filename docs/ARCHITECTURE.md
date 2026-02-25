# AI SCADA Platform — Technical Architecture & Implementation Report

**Author:** Harsh  
**Date:** February 2026  
**Version:** 2.0 (AI-Powered)

---

## 1. Executive Summary

The AI SCADA (Supervisory Control and Data Acquisition) Platform is a full-stack industrial monitoring system designed for real-time factory equipment surveillance. It ingests sensor telemetry from industrial machines via MQTT, stores time-series data in InfluxDB, applies AI-driven anomaly detection and trend prediction, and presents actionable intelligence through a modern web dashboard.

**Key differentiator:** Unlike traditional SCADA systems that rely solely on static threshold alarms, this platform employs **machine learning (Isolation Forest)**, **statistical analysis (Z-Score)**, and **regression-based forecasting** to detect anomalies before they become critical failures — enabling predictive maintenance rather than reactive firefighting.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Next.js 16 Dashboard (React 19 + Tailwind CSS 4 + shadcn/ui) │    │
│  │  • Real-time metrics grid          • AI health gauge           │    │
│  │  • Live system charts              • AI insights panel         │    │
│  │  • Machine monitoring cards        • Historical trend charts   │    │
│  │  • ISA-18.2 alarm management       • Role-based UI controls   │    │
│  └──────────────────────────┬──────────────────────────────────────┘    │
│                             │ HTTPS / JWT Auth                          │
├─────────────────────────────┼───────────────────────────────────────────┤
│                        API LAYER                                        │
│  ┌──────────────────────────┴──────────────────────────────────────┐    │
│  │              FastAPI REST Server (Uvicorn ASGI)                 │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │    │
│  │  │ /auth/*    │  │ /latest    │  │ /alarms/*  │  │ /ai/*    │ │    │
│  │  │ /health    │  │ /history   │  │ /metrics   │  │          │ │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │    │
│  └──────────────────────────┬──────────────────────────────────────┘    │
│                             │                                           │
├─────────────────────────────┼───────────────────────────────────────────┤
│                      INTELLIGENCE LAYER                                 │
│  ┌──────────────────────────┴──────────────────────────────────────┐    │
│  │                  AI Anomaly Detection Engine                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │    │
│  │  │ Z-Score      │  │ Isolation    │  │ Rate-of-Change       │ │    │
│  │  │ Detector     │  │ Forest (ML)  │  │ Spike Detector       │ │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │    │
│  │  ┌──────────────┐  ┌──────────────────────────────────────────┐│    │
│  │  │ Trend        │  │ Health Scorer (0-100, Grades A-F)        ││    │
│  │  │ Predictor    │  │ Weighted: Threshold + Anomaly + Stability││    │
│  │  └──────────────┘  └──────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                      DATA LAYER                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  InfluxDB    │◄───│    MQTT      │◄───│   Sensor Simulator      │  │
│  │  (Time-      │    │  Ingestor    │    │   (3 Machines,          │  │
│  │   Series DB) │    │  (Pydantic   │    │    Realistic Drift,     │  │
│  │              │    │   Validated) │    │    Anomaly Injection)   │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────────────┘  │
│                             │                                           │
│                      ┌──────┴───────┐                                   │
│                      │  Mosquitto   │                                   │
│                      │  MQTT Broker │                                   │
│                      └──────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Pipeline

```
Step 1: GENERATE     Step 2: TRANSPORT     Step 3: VALIDATE     Step 4: STORE
  Simulator ──────►  MQTT Broker  ──────►  Ingestor  ──────►  InfluxDB
  (2s interval)      (Mosquitto)           (Pydantic)         (Time-series)
       │                                                           │
       │                                                           │
Step 7: DISPLAY      Step 6: ENRICH       Step 5: ANALYZE         │
  Dashboard  ◄────── API Server  ◄────── AI Engine  ◄─────────────┘
  (2s polling)       (FastAPI)            (5s cycle)
```

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Recharts | Interactive dashboard with real-time visualization |
| **API Server** | FastAPI (Python), Uvicorn | High-performance async REST API |
| **AI Engine** | scikit-learn, NumPy, Pandas | ML-based anomaly detection and forecasting |
| **Message Broker** | Mosquitto (MQTT v5) | Reliable pub/sub sensor telemetry transport |
| **Time-Series DB** | InfluxDB 2.7 | Optimized storage for high-frequency sensor data |
| **Authentication** | JWT (PyJWT), bcrypt | Stateless auth with role-based access control |
| **Containerization** | Docker, Docker Compose | Reproducible deployment across environments |
| **Data Validation** | Pydantic v2 | Type-safe request/response models with constraints |

---

## 4. Implementation Phases

### Phase 1: Foundation (Data Pipeline & Simulation)

**Objective:** Establish the core data pipeline from simulated sensors to persistent storage.

**What we built:**
- **Sensor Simulator** (`data_simulator/sensor_simulator.py`) — Generates realistic telemetry for 3 industrial machines (Motor, Pump, Compressor) with configurable ranges, natural drift patterns, and periodic anomaly injection.
- **MQTT Broker** — Mosquitto container handling pub/sub message routing.
- **MQTT Ingestor** (`ingestion/mqtt_ingestor.py`) — Subscribes to `factory/sensors`, validates each payload with Pydantic, and writes to InfluxDB with automatic reconnection and exponential backoff.
- **InfluxDB** — Time-series database storing `machine_metrics` measurements with fields for temperature, vibration, and pressure.
- **Centralized Config** (`configs/settings.yaml` + `config_loader.py`) — Single YAML file governs all service parameters with environment variable overrides for production deployments.

**Machines simulated:**

| Machine | Temperature (°C) | Vibration (mm/s) | Pressure (bar) |
|---|---|---|---|
| MOTOR_1 | 60 – 90 | 2 – 8 | 30 – 50 |
| PUMP_1 | 40 – 75 | 1 – 6 | 35 – 55 |
| COMPRESSOR_1 | 50 – 95 | 3 – 10 | 25 – 60 |

---

### Phase 2: Production Hardening (Security, Alarms, API)

**Objective:** Transform the prototype into a production-quality backend with authentication, alarm management, and a full REST API.

**What we built:**

#### Authentication & RBAC
- **JWT token system** with configurable expiry (8-hour shift default)
- **3 user roles:** Admin, Engineer, Operator — each with different permissions
- **Secure password hashing** using bcrypt via passlib
- Role-based endpoint protection via FastAPI dependency injection

#### ISA-18.2 Alarm Lifecycle
Implemented the industrial-standard alarm lifecycle:
```
     ACTIVE  ──►  ACKNOWLEDGED  ──►  CLEARED
     (auto)       (operator)         (operator/auto)
```
- Configurable alarm rules: temperature > 85°C, vibration > 7 mm/s, pressure < 32 bar
- Alarm deduplication prevents duplicate alerts for the same condition
- Alarm history retained for audit trail

#### REST API Endpoints (11 total)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | No | System health + InfluxDB connectivity |
| `/auth/login` | POST | No | JWT token generation |
| `/latest` | GET | Yes | Latest sensor readings per machine |
| `/history` | GET | Yes | Historical data with downsampling |
| `/alarms` | GET | Yes | Active alarms list |
| `/alarms/{id}/acknowledge` | POST | Yes | Acknowledge an alarm |
| `/alarms/{id}/clear` | POST | Yes | Clear an alarm |
| `/alarms/clear-all` | POST | Admin | Clear all alarms (admin only) |
| `/alarms/history` | GET | Yes | Historical alarm log |
| `/metrics` | GET | Yes | API performance metrics |

#### Structured Logging
- JSON-formatted logs for production, human-readable for development
- Log rotation (10MB files, 5 backups)
- Separate error log file for quick triage

#### Docker Deployment
- 5 Dockerfiles for containerized deployment
- `docker-compose.yml` orchestrates all services with health checks and dependency ordering

---

### Phase 3: Frontend Integration

**Objective:** Connect the Next.js dashboard to the real backend API, replacing all mock data.

**What we built:**
- **Centralized API client** (`lib/api.ts`) — Single HTTP wrapper with JWT management, auto-refresh, and typed responses for all endpoints.
- **AuthContext** rewritten to authenticate against `/auth/login` with token persistence and session restoration.
- **Real-time data hook** (`useRealTimeData.ts`) — Polls `/latest`, `/alarms`, and `/health` every 2 seconds, transforming server responses into UI-ready data structures.
- **All 6 pages** integrated with live backend data:
  - Dashboard, Machines, Alarms, History, Settings, Login
- **CORS proxy** via Next.js rewrites for seamless development
- Build verified: all 8 routes compile successfully

---

### Phase 4: AI Anomaly Detection Engine (Current)

**Objective:** Add intelligent anomaly detection, trend prediction, and system health scoring — making the platform genuinely AI-powered.

#### 4.1 Architecture

```
                    InfluxDB
                       │
                 ┌─────┴─────┐
                 │  AI Engine │  (Background asyncio task, 5s cycle)
                 │  Orchestr. │
                 └─────┬─────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌───────────┐ ┌──────────┐ ┌──────────┐
    │ Anomaly   │ │ Trend    │ │ Health   │
    │ Detector  │ │ Predictor│ │ Scorer   │
    └───────────┘ └──────────┘ └──────────┘
          │            │            │
          ▼            ▼            ▼
    /ai/anomalies /ai/predictions /ai/health
```

#### 4.2 Anomaly Detection (3 Complementary Strategies)

| Strategy | Algorithm | What It Catches | Example |
|---|---|---|---|
| **Z-Score** | Statistical (mean ± 2.5σ) | Values far from recent mean | Temperature suddenly at 95°C when mean is 72°C |
| **Isolation Forest** | ML (scikit-learn) | Multivariate outliers | Unusual combination of readings the model hasn't seen |
| **Rate-of-Change** | Differential | Rapid spikes within normal range | Temperature rising at 0.8°C/s (normal drift is 0.05°C/s) |

Each detection produces a **confidence score (0-100%)** and a **human-readable description** explaining why it was flagged.

#### 4.3 Trend Prediction

- **Algorithm:** Linear regression (NumPy polyfit) on rolling data window
- **Horizon:** 5-minute forecast for each sensor parameter
- **Threshold ETA:** If temperature is rising toward 85°C, reports "will reach alarm threshold in ~3 minutes"
- **Confidence:** Based on R² goodness-of-fit — higher R² = more reliable forecast

#### 4.4 Health Scoring

Each machine receives a 0-100 health score with letter grade (A-F), computed as a weighted composite:

| Factor | Weight | Measures |
|---|---|---|
| Threshold Distance | 40% | How close current values are to alarm limits |
| Anomaly Count | 30% | Active anomaly detections for this machine |
| Signal Stability | 20% | Coefficient of variation (low = stable = healthy) |
| Rate Calmness | 10% | Average rate-of-change (low = calm = healthy) |

**System-wide health** aggregates all machine scores, reports worst-performing machine.

#### 4.5 New API Endpoints (4 added)

| Endpoint | Returns |
|---|---|
| `GET /ai/status` | Engine running state, cycle count, buffer sizes |
| `GET /ai/anomalies` | Active anomalies with type, confidence, description |
| `GET /ai/predictions` | 5-min forecasts with trend and threshold ETA |
| `GET /ai/health` | Per-machine + system health scores (0-100, A-F) |

#### 4.6 Frontend Integration

- **AI Health Gauge** — Animated SVG ring showing system-wide health score with color-coded grade
- **AI Insights Panel** — Combined view of:
  - Detected anomalies (with detection method badges: Z-Score / ML / Spike)
  - Threshold warnings with countdown timers
  - 5-minute trend predictions with direction arrows

---

## 5. Project Structure

```
ai_scada_platform/
├── ai_engine/                    # AI/ML Layer
│   ├── anomaly_detector.py       #   Z-Score + Isolation Forest + Rate-of-Change
│   ├── trend_predictor.py        #   Linear regression forecasting
│   ├── health_scorer.py          #   Weighted health scoring (0-100)
│   └── engine.py                 #   Background orchestrator
│
├── scada_core/                   # API Layer
│   ├── main.py                   #   FastAPI app (15 endpoints)
│   └── auth.py                   #   JWT authentication + RBAC
│
├── ingestion/
│   └── mqtt_ingestor.py          #   MQTT → InfluxDB pipeline
│
├── data_simulator/
│   └── sensor_simulator.py       #   Realistic sensor data generator
│
├── models/
│   ├── sensor_data.py            #   Pydantic models for sensor data
│   └── alarm.py                  #   ISA-18.2 alarm models
│
├── configs/
│   ├── settings.yaml             #   Centralized configuration
│   └── config_loader.py          #   Config parser with env overrides
│
├── utils/
│   └── logger.py                 #   Structured JSON logging
│
├── data_sources/
│   └── base.py                   #   Abstract driver interface (future OPC UA)
│
├── frontend/                     #   Next.js 16 Dashboard
│   ├── app/                      #     Pages (dashboard, machines, alarms, etc.)
│   ├── components/               #     UI components (charts, gauges, panels)
│   ├── hooks/                    #     Real-time data polling hook
│   ├── lib/                      #     API client with JWT management
│   └── context/                  #     Auth context provider
│
├── docker-compose.yml            #   Full-stack orchestration
├── Dockerfile.api                #   API container
├── Dockerfile.ingestor           #   Ingestor container
├── Dockerfile.simulator          #   Simulator container
└── requirements.txt              #   Python dependencies
```

---

## 6. Security Architecture

| Measure | Implementation |
|---|---|
| **Authentication** | JWT tokens with HS256 signing, 8-hour expiry |
| **Password Security** | bcrypt hashing via passlib |
| **Role-Based Access** | 3 roles (Admin/Engineer/Operator) with per-endpoint enforcement |
| **Session Management** | Token stored in localStorage, auto-redirect on expiry |
| **Input Validation** | Pydantic models on all API inputs with range constraints |
| **CORS** | Configurable allowed origins |

---

## 7. Deployment Architecture

```
┌──────────── Docker Compose ─────────────┐
│                                          │
│  ┌────────┐  ┌──────────┐  ┌─────────┐ │
│  │Mosquitto│  │ InfluxDB │  │  SCADA  │ │
│  │ :1883   │  │  :8086   │  │  API    │ │
│  │         │  │          │  │  :8000  │ │
│  └────────┘  └──────────┘  └─────────┘ │
│  ┌─────────┐  ┌───────────┐             │
│  │Ingestor │  │ Simulator │             │
│  │         │  │           │             │
│  └─────────┘  └───────────┘             │
└──────────────────────────────────────────┘
         │
    ┌────┴─────┐
    │ Frontend │  (Next.js dev server or static build)
    │  :3000   │
    └──────────┘
```

---

## 8. Key Design Decisions

| Decision | Rationale |
|---|---|
| **InfluxDB over PostgreSQL** | Native time-series optimization with built-in downsampling and retention policies |
| **MQTT over HTTP polling** | Industry-standard IoT protocol with QoS guarantees and low overhead |
| **FastAPI over Flask/Django** | Native async support, automatic OpenAPI docs, Pydantic integration |
| **In-memory alarms** | Eliminates DB latency for real-time alarm processing — suitable for current scale |
| **Isolation Forest over supervised ML** | Unsupervised = no labeled training data needed — works immediately with new machine types |
| **Polling over WebSocket (frontend)** | Simpler implementation, sufficient for 2s update intervals across dashboards |
| **Centralized YAML config** | Single source of truth with env var overrides for dev/staging/prod environments |

---

## 9. Performance Characteristics

| Metric | Value |
|---|---|
| Data ingestion rate | 3 machines × 3 params × 0.5 Hz = **4.5 data points/second** |
| API response time | < 50ms (latest), < 200ms (history with downsampling) |
| AI engine cycle | Every **5 seconds** |
| Dashboard refresh | Every **2 seconds** |
| Rolling buffer | **200 readings** per machine/parameter |
| Frontend build | **4.9 seconds** (Turbopack) |

---

## 10. Future Roadmap

| Phase | Feature | Status |
|---|---|---|
| Phase 1 | Data pipeline + simulation | ✅ Complete |
| Phase 2 | Production hardening + alarms | ✅ Complete |
| Phase 3 | Frontend API integration | ✅ Complete |
| Phase 4 | AI anomaly detection engine | ✅ Complete |
| Phase 5 | OPC UA / Modbus PLC integration | 🔜 Planned |
| Phase 6 | TLS encryption + hardened auth | 🔜 Planned |
| Phase 7 | Persistent alarm storage | 🔜 Planned |
| Phase 8 | Email/SMS alarm notifications | 🔜 Planned |
| Phase 9 | Multi-site / multi-tenant support | 🔜 Planned |

---

*This document describes the complete implementation as of February 2026.*
