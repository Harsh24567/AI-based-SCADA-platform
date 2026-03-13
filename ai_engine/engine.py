"""
AI SCADA Platform — AI Engine Orchestrator

Runs as a background asyncio task inside the FastAPI lifespan:
  1. Pulls latest data from InfluxDB on a configurable interval
  2. Maintains a rolling buffer (last N readings per machine/parameter)
  3. Runs anomaly detection, trend prediction, and health scoring
  4. Publishes results to an in-memory store consumed by API endpoints
"""

import sys
import os
import asyncio
import time
from collections import defaultdict
from typing import Optional

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from influxdb_client import InfluxDBClient
from configs.config_loader import get_config
from utils.logger import get_logger

from ai_engine.anomaly_detector import AnomalyDetector, AnomalyResult
from ai_engine.trend_predictor import TrendPredictor, PredictionResult
from ai_engine.health_scorer import HealthScorer, HealthScore
from ai_engine.trainable_agent import TrainableAgent

logger = get_logger("ai_engine")
config = get_config()

# ── Configuration defaults ──────────────────────────────

DEFAULT_AI_CONFIG = {
    "cycle_seconds": 5,
    "buffer_size": 200,
    "zscore_threshold": 2.5,
    "if_contamination": 0.05,
    "prediction_horizon": 300,
    "anomaly_ttl_seconds": 60,   # keep anomalies for 60s after detection
}


class AIEngine:
    """
    Main AI engine that orchestrates all detection and prediction modules.
    Designed to run as a singleton background task.
    """

    def __init__(self, influx_client: InfluxDBClient):
        self.influx_client = influx_client
        self.query_api = influx_client.query_api()

        # Load AI config from settings.yaml or use defaults
        ai_cfg = getattr(config, 'ai_engine', None)
        if ai_cfg and isinstance(ai_cfg, dict):
            self._cfg = {**DEFAULT_AI_CONFIG, **ai_cfg}
        else:
            self._cfg = DEFAULT_AI_CONFIG.copy()

        # Rolling buffer: {machine_id: {parameter: {"values": [], "timestamps": []}}}
        self._buffer: dict[str, dict[str, dict]] = defaultdict(
            lambda: defaultdict(lambda: {"values": [], "timestamps": []})
        )

        # Detection modules
        self._anomaly_detector = AnomalyDetector(
            zscore_threshold=self._cfg["zscore_threshold"],
            if_contamination=self._cfg["if_contamination"],
        )
        self._trend_predictor = TrendPredictor(
            horizon_seconds=self._cfg["prediction_horizon"],
        )
        self._health_scorer = HealthScorer()
        self._trainable_agent = TrainableAgent()

        # Results store (consumed by API endpoints)
        self.anomalies: list[dict] = []
        self.predictions: list[dict] = []
        self.health: dict = {"system_score": 0, "system_grade": "F", "machines": []}
        self.latest_insight: Optional[str] = None

        # Engine state
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._cycle_count = 0
        self._last_cycle_time = 0.0
        self._errors = 0

    @property
    def status(self) -> dict:
        buffer_sizes = {}
        for machine_id, params in self._buffer.items():
            buffer_sizes[machine_id] = {
                p: len(d["values"]) for p, d in params.items()
            }
        return {
            "running": self._running,
            "cycle_count": self._cycle_count,
            "cycle_interval_seconds": self._cfg["cycle_seconds"],
            "last_cycle_time": self._last_cycle_time,
            "buffer_sizes": buffer_sizes,
            "active_anomalies": len(self.anomalies),
            "errors": self._errors,
        }

    # ── Data fetching ───────────────────────────────────

    def _fetch_latest(self) -> list[dict]:
        """Pull latest sensor readings from InfluxDB."""
        query = f'''
        from(bucket: "{config.influxdb.bucket}")
            |> range(start: -2m)
            |> filter(fn: (r) => r._measurement == "{config.scada.measurement}")
            |> last()
        '''
        try:
            tables = self.query_api.query(query, org=config.influxdb.org)
            results = []
            for table in tables:
                for record in table.records:
                    results.append({
                        "machine_id": record.values.get("machine_id", "unknown"),
                        "field": record.get_field(),
                        "value": float(record.get_value()),
                        "time": record.get_time().timestamp(),
                    })
            return results
        except Exception as e:
            logger.warning(f"InfluxDB query failed: {e}")
            self._errors += 1
            return []

    # ── Buffer management ───────────────────────────────

    def _update_buffer(self, readings: list[dict]):
        """Append new readings to the rolling buffer, evicting old entries."""
        max_size = self._cfg["buffer_size"]
        for r in readings:
            buf = self._buffer[r["machine_id"]][r["field"]]
            buf["values"].append(r["value"])
            buf["timestamps"].append(r["time"])
            # Evict oldest if over capacity
            if len(buf["values"]) > max_size:
                buf["values"] = buf["values"][-max_size:]
                buf["timestamps"] = buf["timestamps"][-max_size:]

    # ── Analysis cycle ──────────────────────────────────

    def _run_cycle(self):
        """One full analysis cycle: fetch → buffer → detect → predict → score."""
        readings = self._fetch_latest()
        if not readings:
            return

        self._update_buffer(readings)
        now = time.time()
        ttl = self._cfg["anomaly_ttl_seconds"]

        # ── Anomaly detection ───────────────────────────
        new_anomalies: list[dict] = []
        for machine_id, params in self._buffer.items():
            for param, buf in params.items():
                if not buf["values"]:
                    continue
                current_value = buf["values"][-1]
                current_time = buf["timestamps"][-1] if buf["timestamps"] else now

                results = self._anomaly_detector.run_all(
                    machine_id=machine_id,
                    parameter=param,
                    values=buf["values"],
                    timestamps=buf["timestamps"],
                    current_value=current_value,
                    current_time=current_time,
                )
                for r in results:
                    new_anomalies.append(r.to_dict())

        # Merge with existing — keep old ones within TTL, add new ones
        existing = [a for a in self.anomalies if (now - a["detected_at"]) < ttl]
        # Deduplicate by (machine_id, parameter, anomaly_type)
        seen = set()
        merged = []
        for a in new_anomalies + existing:
            key = (a["machine_id"], a["parameter"], a["anomaly_type"])
            if key not in seen:
                seen.add(key)
                merged.append(a)
        self.anomalies = merged

        # ── Trend prediction ────────────────────────────
        predictions: list[dict] = []
        for machine_id, params in self._buffer.items():
            for param, buf in params.items():
                result = self._trend_predictor.predict(
                    machine_id=machine_id,
                    parameter=param,
                    values=buf["values"],
                    timestamps=buf["timestamps"],
                )
                if result:
                    predictions.append(result.to_dict())
        self.predictions = predictions

        # ── Health scoring ──────────────────────────────
        machine_scores: list[HealthScore] = []
        for machine_id, params in self._buffer.items():
            param_values = {p: buf["values"] for p, buf in params.items()}
            anomaly_count = sum(
                1 for a in self.anomalies if a["machine_id"] == machine_id
            )
            score = self._health_scorer.score_machine(
                machine_id=machine_id,
                parameter_values=param_values,
                anomaly_count=anomaly_count,
            )
            machine_scores.append(score)

        self.health = self._health_scorer.score_system(machine_scores)

        # ── Trainable Agent Insights ────────────────────
        # Trigger insight generation periodically, or if critical events happen
        insight = self._trainable_agent.generate_insights(
            machine_data=self._buffer,
            anomalies=self.anomalies,
            health=self.health
        )
        if insight is not None:
             self.latest_insight = insight

    # ── Background task ─────────────────────────────────

    async def _loop(self):
        """Main async loop — runs analysis cycles at configured intervals."""
        logger.info(
            f"AI Engine started — cycle every {self._cfg['cycle_seconds']}s, "
            f"buffer size {self._cfg['buffer_size']}"
        )
        while self._running:
            try:
                cycle_start = time.time()
                self._run_cycle()
                self._cycle_count += 1
                self._last_cycle_time = time.time() - cycle_start

                if self._cycle_count % 12 == 1:  # log every ~60s
                    logger.info(
                        f"AI Engine cycle #{self._cycle_count}: "
                        f"{len(self.anomalies)} anomalies, "
                        f"{len(self.predictions)} predictions, "
                        f"system health={self.health.get('system_score', 0):.0f}"
                    )

            except Exception as e:
                logger.error(f"AI Engine cycle error: {e}", exc_info=True)
                self._errors += 1

            await asyncio.sleep(self._cfg["cycle_seconds"])

    def start(self):
        """Start the AI engine as a background asyncio task."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("AI Engine background task created")

    async def stop(self):
        """Gracefully stop the engine."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("AI Engine stopped")


# ── Singleton ─────────────────────────────────────────────

_engine_instance: Optional[AIEngine] = None


def get_engine() -> Optional[AIEngine]:
    """Get the singleton AI engine instance (created by the API lifespan)."""
    return _engine_instance


def create_engine(influx_client: InfluxDBClient) -> AIEngine:
    """Create and return the singleton AI engine."""
    global _engine_instance
    _engine_instance = AIEngine(influx_client)
    return _engine_instance

