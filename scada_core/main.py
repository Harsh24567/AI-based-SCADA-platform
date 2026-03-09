"""
AI SCADA Platform — SCADA Core Backend API

Production-hardened FastAPI application providing:
    - Real-time sensor data queries
    - ISA-18.2 alarm lifecycle management
    - Historical trend API with downsampling
    - Health monitoring & metrics
    - JWT-protected endpoints
"""

import sys
import os
import time
from datetime import datetime, timezone
from typing import Optional
from contextlib import asynccontextmanager

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from influxdb_client import InfluxDBClient

from configs.config_loader import get_config
from utils.logger import setup_logging, get_logger
from models.alarm import (
    Alarm, AlarmSeverity, AlarmState, AlarmType,
    AlarmAcknowledgeRequest, AlarmResponse,
)
from scada_core.auth import (
    LoginRequest, TokenResponse, UserInfo,
    authenticate_user, create_token, get_current_user, require_role,
)
from ai_engine.engine import create_engine, get_engine
from scada_core.chatbot_router import router as chatbot_router
from scada_core.reports_router import router as reports_router

# ── Initialize ──────────────────────────────────────────────
config = get_config()
setup_logging(
    level=config.logging.level,
    log_dir=config.logging.log_dir,
    log_format=config.logging.format,
)
logger = get_logger("api")

# ── InfluxDB Client ────────────────────────────────────────
influx_client = InfluxDBClient(
    url=config.influxdb.url,
    token=config.influxdb.token,
    org=config.influxdb.org,
    timeout=config.influxdb.timeout,
)
query_api = influx_client.query_api()
write_api = influx_client.write_api()

# ── Alarm Manager ──────────────────────────────────────────
# In-memory alarm store with deduplication
# Key: dedup_key (machine:param:type) → Alarm
active_alarms: dict[str, Alarm] = {}
alarm_history: list[Alarm] = []

# ── Metrics ────────────────────────────────────────────────
start_time = time.time()
api_metrics = {
    "requests_total": 0,
    "alarms_triggered": 0,
    "alarms_acknowledged": 0,
    "alarms_cleared": 0,
}

# ── App Lifecycle ──────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("=" * 60)
    logger.info("AI SCADA Platform — Core API Starting")
    logger.info(f"  InfluxDB: {config.influxdb.url}")
    logger.info(f"  Bucket:   {config.influxdb.bucket}")
    logger.info(f"  Alarm rules: {len(config.alarms.rules)} configured")
    logger.info("=" * 60)

    # Start AI Engine background task
    ai = create_engine(influx_client)
    ai.start()
    logger.info("AI Anomaly Detection Engine started")

    yield

    # Shutdown
    await ai.stop()
    logger.info("SCADA Core API shutting down")
    influx_client.close()


# ── FastAPI App ────────────────────────────────────────────
app = FastAPI(
    title="AI SCADA Core",
    description="AI-Powered Industrial SCADA Platform API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chatbot_router)
app.include_router(reports_router)


# ══════════════════════════════════════════════════════════
#  PUBLIC ENDPOINTS (No Auth Required)
# ══════════════════════════════════════════════════════════

@app.get("/health")
def health_check():
    """
    System health check — verifies InfluxDB connectivity and service status.
    This endpoint is intentionally public for monitoring tools.
    """
    influx_ok = False
    influx_message = "unknown"

    try:
        health = influx_client.health()
        influx_ok = health.status == "pass"
        influx_message = health.message or "healthy"
    except Exception as e:
        influx_message = str(e)

    uptime = time.time() - start_time

    return {
        "status": "healthy" if influx_ok else "degraded",
        "uptime_seconds": round(uptime, 1),
        "services": {
            "influxdb": {
                "status": "connected" if influx_ok else "disconnected",
                "message": influx_message,
                "url": config.influxdb.url,
            },
            "api": {
                "status": "running",
                "version": "2.0.0",
            },
        },
        "alarms": {
            "active_count": len([a for a in active_alarms.values() if a.is_active]),
        },
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(request: LoginRequest):
    """Authenticate and receive a JWT token."""
    user = authenticate_user(request.username, request.password)
    if not user:
        logger.warning(f"Failed login attempt for user: {request.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_token(user["username"], user["role"])
    logger.info(f"User logged in: {user['username']} (role: {user['role']})")
    return TokenResponse(
        access_token=token,
        expires_in=config.auth.token_expire_minutes * 60,
        role=user["role"],
    )


# ══════════════════════════════════════════════════════════
#  PROTECTED ENDPOINTS (JWT Required)
# ══════════════════════════════════════════════════════════

@app.get("/latest")
def get_latest(user: UserInfo = Depends(get_current_user)):
    """Get the latest sensor readings for all machines."""
    api_metrics["requests_total"] += 1

    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_measurement"] == "{config.scada.measurement}")
      |> last()
    '''

    try:
        tables = query_api.query(query)
    except Exception as e:
        logger.error(f"InfluxDB query failed: {e}")
        raise HTTPException(status_code=503, detail="Database query failed")

    results = []
    for table in tables:
        for record in table.records:
            item = {
                "machine_id": record.values.get("machine_id"),
                "field": record.get_field(),
                "value": record.get_value(),
                "time": str(record.get_time()),
            }
            results.append(item)

    # Evaluate alarms on latest data
    _evaluate_alarms(results)

    return {"data": results, "count": len(results)}


@app.get("/history")
def get_history(
    machine_id: Optional[str] = Query(None, description="Filter by machine ID"),
    field: Optional[str] = Query(None, description="Filter by field (temperature, vibration, pressure)"),
    start: str = Query("-1h", description="Start time (Flux format: -1h, -24h, -7d)"),
    end: str = Query("now()", description="End time"),
    downsample: Optional[str] = Query(None, description="Downsample window (e.g., 5m, 1h)"),
    user: UserInfo = Depends(get_current_user),
):
    """
    Query historical sensor data with optional filtering and downsampling.

    Examples:
        /history?machine_id=MOTOR_1&field=temperature&start=-24h
        /history?start=-7d&downsample=1h
    """
    api_metrics["requests_total"] += 1

    # Build Flux query
    filters = [f'r["_measurement"] == "{config.scada.measurement}"']
    if machine_id:
        filters.append(f'r["machine_id"] == "{machine_id}"')
    if field:
        filters.append(f'r["_field"] == "{field}"')

    filter_clause = " and ".join(filters)

    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: {start}, stop: {end})
      |> filter(fn: (r) => {filter_clause})
    '''

    # Add downsampling if requested
    if downsample:
        query += f'''
      |> aggregateWindow(every: {downsample}, fn: mean, createEmpty: false)
        '''

    query += '  |> sort(columns: ["_time"])'

    try:
        tables = query_api.query(query)
    except Exception as e:
        logger.error(f"History query failed: {e}")
        raise HTTPException(status_code=503, detail="Database query failed")

    results = []
    for table in tables:
        for record in table.records:
            results.append({
                "machine_id": record.values.get("machine_id"),
                "field": record.get_field(),
                "value": record.get_value(),
                "time": str(record.get_time()),
            })

    return {
        "data": results,
        "count": len(results),
        "query_params": {
            "machine_id": machine_id,
            "field": field,
            "start": start,
            "end": end,
            "downsample": downsample,
        },
    }


# ══════════════════════════════════════════════════════════
#  ALARM ENDPOINTS
# ══════════════════════════════════════════════════════════

@app.get("/alarms", response_model=AlarmResponse)
def get_alarms(user: UserInfo = Depends(get_current_user)):
    """Get all active alarms (ACTIVE or ACKNOWLEDGED state)."""
    api_metrics["requests_total"] += 1
    active = [a for a in active_alarms.values() if a.is_active]
    # Sort by severity (CRITICAL first)
    severity_order = {s: i for i, s in enumerate(config.alarms.severity_order)}
    active.sort(key=lambda a: severity_order.get(a.severity.value, 99))
    return AlarmResponse(active_alarms=active, total_count=len(active))


@app.post("/alarms/{alarm_id}/acknowledge")
def acknowledge_alarm(
    alarm_id: str,
    request: AlarmAcknowledgeRequest,
    user: UserInfo = Depends(get_current_user),
):
    """
    Acknowledge an active alarm (ISA-18.2 state transition).
    Transitions alarm from ACTIVE → ACKNOWLEDGED.
    """
    # Find alarm by ID
    target = None
    for alarm in active_alarms.values():
        if alarm.alarm_id == alarm_id:
            target = alarm
            break

    if not target:
        raise HTTPException(status_code=404, detail=f"Alarm {alarm_id} not found")

    if target.state != AlarmState.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail=f"Alarm is in state '{target.state.value}', can only acknowledge ACTIVE alarms",
        )

    target.acknowledge(user=request.acknowledged_by)
    api_metrics["alarms_acknowledged"] += 1
    logger.info(
        f"Alarm {alarm_id} acknowledged by {request.acknowledged_by}",
        extra={"alarm_id": alarm_id},
    )

    return {"message": f"Alarm {alarm_id} acknowledged", "alarm": target}


@app.post("/alarms/{alarm_id}/clear")
def clear_alarm(
    alarm_id: str,
    user: UserInfo = Depends(require_role("ENGINEER", "ADMIN")),
):
    """
    Clear an alarm (ISA-18.2 state transition).
    Only ENGINEER and ADMIN roles can clear alarms.
    """
    target = None
    dedup_key = None
    for key, alarm in active_alarms.items():
        if alarm.alarm_id == alarm_id:
            target = alarm
            dedup_key = key
            break

    if not target:
        raise HTTPException(status_code=404, detail=f"Alarm {alarm_id} not found")

    target.clear()
    alarm_history.append(target)
    del active_alarms[dedup_key]
    api_metrics["alarms_cleared"] += 1

    logger.info(f"Alarm {alarm_id} cleared by {user.username}", extra={"alarm_id": alarm_id})
    return {"message": f"Alarm {alarm_id} cleared", "alarm": target}


@app.post("/alarms/clear-all")
def clear_all_alarms(user: UserInfo = Depends(require_role("ADMIN"))):
    """
    Clear all active alarms. ADMIN only.
    Use with caution — this is an emergency action.
    """
    count = len(active_alarms)
    for alarm in active_alarms.values():
        alarm.clear()
        alarm_history.append(alarm)
    active_alarms.clear()
    api_metrics["alarms_cleared"] += count

    logger.warning(f"All {count} alarms cleared by {user.username} (EMERGENCY ACTION)")
    return {"message": f"All {count} alarms cleared"}


@app.get("/alarms/history")
def get_alarm_history(
    machine_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    user: UserInfo = Depends(get_current_user),
):
    """Query alarm history (cleared alarms)."""
    filtered = alarm_history
    if machine_id:
        filtered = [a for a in filtered if a.machine_id == machine_id]
    if severity:
        filtered = [a for a in filtered if a.severity.value == severity.upper()]

    # Return most recent first
    filtered = sorted(filtered, key=lambda a: a.triggered_at, reverse=True)[:limit]
    return {"history": filtered, "count": len(filtered)}


# ══════════════════════════════════════════════════════════
#  METRICS ENDPOINT
# ══════════════════════════════════════════════════════════

@app.get("/metrics")
def get_metrics(user: UserInfo = Depends(get_current_user)):
    """Get system metrics and counters."""
    return {
        "uptime_seconds": round(time.time() - start_time, 1),
        "api": api_metrics,
        "alarms": {
            "active": len([a for a in active_alarms.values() if a.state == AlarmState.ACTIVE]),
            "acknowledged": len([a for a in active_alarms.values() if a.state == AlarmState.ACKNOWLEDGED]),
            "total_history": len(alarm_history),
        },
    }


# ══════════════════════════════════════════════════════════
#  ALARM ENGINE (Internal)
# ══════════════════════════════════════════════════════════

def _evaluate_alarms(data: list[dict]) -> None:
    """
    Evaluate alarm rules against latest sensor data.
    Implements deduplication to prevent duplicate alarms for the same condition.
    """
    for item in data:
        field = item.get("field")
        value = item.get("value")
        machine_id = item.get("machine_id")

        if field not in config.alarms.rules:
            continue

        rule = config.alarms.rules[field]

        # Check high threshold
        if rule.high is not None and value > rule.high:
            _raise_alarm(
                machine_id=machine_id,
                parameter=field,
                alarm_type=AlarmType.HIGH,
                severity=AlarmSeverity(rule.severity),
                value=value,
                limit=rule.high,
            )

        # Check low threshold
        if rule.low is not None and value < rule.low:
            _raise_alarm(
                machine_id=machine_id,
                parameter=field,
                alarm_type=AlarmType.LOW,
                severity=AlarmSeverity(rule.severity),
                value=value,
                limit=rule.low,
            )


def _raise_alarm(
    machine_id: str,
    parameter: str,
    alarm_type: AlarmType,
    severity: AlarmSeverity,
    value: float,
    limit: float,
) -> None:
    """Create a new alarm if one doesn't already exist for this condition."""
    alarm = Alarm(
        machine_id=machine_id,
        parameter=parameter,
        alarm_type=alarm_type,
        severity=severity,
        value=value,
        limit=limit,
    )

    dedup_key = alarm.dedup_key()

    # Only raise if no active alarm exists for this condition
    if dedup_key not in active_alarms:
        active_alarms[dedup_key] = alarm
        api_metrics["alarms_triggered"] += 1
        logger.warning(
            f"ALARM [{severity.value}] {machine_id}.{parameter} "
            f"{'>' if alarm_type == AlarmType.HIGH else '<'} {limit} "
            f"(actual: {value})",
            extra={
                "alarm_id": alarm.alarm_id,
                "machine_id": machine_id,
                "field": parameter,
                "value": value,
            },
        )


# ══════════════════════════════════════════════════════════
#  AI ENGINE ENDPOINTS
# ══════════════════════════════════════════════════════════

@app.get("/ai/status")
def ai_status(user: UserInfo = Depends(get_current_user)):
    """
    AI Engine status — running state, cycle count, buffer sizes.
    """
    engine = get_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="AI Engine not initialized")
    return engine.status


@app.get("/ai/anomalies")
def ai_anomalies(
    machine_id: Optional[str] = Query(None, description="Filter by machine"),
    user: UserInfo = Depends(get_current_user),
):
    """
    Current AI-detected anomalies with confidence scores.
    Uses Z-Score, Isolation Forest, and Rate-of-Change detection.
    """
    engine = get_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="AI Engine not initialized")

    anomalies = engine.anomalies
    if machine_id:
        anomalies = [a for a in anomalies if a["machine_id"] == machine_id]

    return {
        "anomalies": anomalies,
        "total_count": len(anomalies),
        "detection_methods": ["zscore", "isolation_forest", "rate_of_change"],
    }


@app.get("/ai/predictions")
def ai_predictions(
    machine_id: Optional[str] = Query(None, description="Filter by machine"),
    parameter: Optional[str] = Query(None, description="Filter by parameter"),
    user: UserInfo = Depends(get_current_user),
):
    """
    5-minute sensor value forecasts with trend direction and confidence.
    Includes threshold ETA when a value is trending toward an alarm limit.
    """
    engine = get_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="AI Engine not initialized")

    preds = engine.predictions
    if machine_id:
        preds = [p for p in preds if p["machine_id"] == machine_id]
    if parameter:
        preds = [p for p in preds if p["parameter"] == parameter]

    # Flag predictions that have threshold ETA
    warnings = [p for p in preds if p.get("threshold_eta_seconds") is not None]

    return {
        "predictions": preds,
        "total_count": len(preds),
        "horizon_seconds": 300,
        "threshold_warnings": warnings,
    }


@app.get("/ai/health")
def ai_health(
    machine_id: Optional[str] = Query(None, description="Filter by machine"),
    user: UserInfo = Depends(get_current_user),
):
    """
    Per-machine and system-wide health scores (0-100, grade A-F).
    Weighted composite of threshold distance, anomalies, stability, and rate calmness.
    """
    engine = get_engine()
    if engine is None:
        raise HTTPException(status_code=503, detail="AI Engine not initialized")

    health = engine.health

    if machine_id and "machines" in health:
        machines = [m for m in health["machines"] if m["machine_id"] == machine_id]
        return {
            "machine_count": len(machines),
            "machines": machines,
        }

    return health
