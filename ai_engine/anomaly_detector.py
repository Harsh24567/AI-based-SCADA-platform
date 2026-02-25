"""
AI SCADA Platform — Anomaly Detection Module

Three complementary detection strategies:
  1. Z-Score — flags readings > N standard deviations from rolling mean
  2. Isolation Forest — unsupervised ML anomaly detector (scikit-learn)
  3. Rate-of-Change — catches rapid spikes within normal range
"""

import time
import numpy as np
from dataclasses import dataclass, field
from typing import Optional
from sklearn.ensemble import IsolationForest


@dataclass
class AnomalyResult:
    """Single anomaly detection result."""
    machine_id: str
    parameter: str
    value: float
    anomaly_type: str          # "zscore" | "isolation_forest" | "rate_of_change"
    confidence: float          # 0.0 – 1.0
    description: str
    detected_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "machine_id": self.machine_id,
            "parameter": self.parameter,
            "value": round(self.value, 2),
            "anomaly_type": self.anomaly_type,
            "confidence": round(self.confidence, 3),
            "description": self.description,
            "detected_at": self.detected_at,
        }


class ZScoreDetector:
    """
    Statistical anomaly detector using Z-scores on a rolling window.
    Flags readings that deviate beyond `threshold` standard deviations.
    """

    def __init__(self, threshold: float = 2.5, min_samples: int = 20):
        self.threshold = threshold
        self.min_samples = min_samples

    def detect(
        self,
        machine_id: str,
        parameter: str,
        values: list[float],
        current_value: float,
    ) -> Optional[AnomalyResult]:
        if len(values) < self.min_samples:
            return None

        arr = np.array(values)
        mean = np.mean(arr)
        std = np.std(arr)

        if std < 1e-6:
            return None  # constant signal — no anomalies possible

        z_score = abs(current_value - mean) / std

        if z_score > self.threshold:
            direction = "above" if current_value > mean else "below"
            confidence = min(1.0, (z_score - self.threshold) / self.threshold + 0.5)
            return AnomalyResult(
                machine_id=machine_id,
                parameter=parameter,
                value=current_value,
                anomaly_type="zscore",
                confidence=confidence,
                description=(
                    f"{parameter} is {z_score:.1f}σ {direction} normal "
                    f"(value={current_value:.1f}, mean={mean:.1f}, std={std:.1f})"
                ),
            )
        return None


class IsolationForestDetector:
    """
    Unsupervised ML detector using scikit-learn's Isolation Forest.
    Re-fits periodically as new data arrives.
    """

    def __init__(
        self,
        contamination: float = 0.05,
        min_samples: int = 50,
        refit_interval: int = 100,  # refit every N new samples
    ):
        self.contamination = contamination
        self.min_samples = min_samples
        self.refit_interval = refit_interval
        # One model per (machine, parameter) pair
        self._models: dict[str, IsolationForest] = {}
        self._sample_counts: dict[str, int] = {}
        self._last_fit_count: dict[str, int] = {}

    def _key(self, machine_id: str, parameter: str) -> str:
        return f"{machine_id}:{parameter}"

    def detect(
        self,
        machine_id: str,
        parameter: str,
        values: list[float],
        current_value: float,
    ) -> Optional[AnomalyResult]:
        key = self._key(machine_id, parameter)
        n = len(values)

        if n < self.min_samples:
            return None

        # Track sample count for refit decisions
        self._sample_counts[key] = n
        last_fit = self._last_fit_count.get(key, 0)

        # Fit or refit the model when enough new data has arrived
        if key not in self._models or (n - last_fit) >= self.refit_interval:
            X = np.array(values).reshape(-1, 1)
            model = IsolationForest(
                contamination=self.contamination,
                random_state=42,
                n_estimators=100,
            )
            model.fit(X)
            self._models[key] = model
            self._last_fit_count[key] = n

        model = self._models[key]
        score = model.decision_function(np.array([[current_value]]))[0]
        prediction = model.predict(np.array([[current_value]]))[0]

        if prediction == -1:  # anomaly
            # Convert decision function score to confidence (lower = more anomalous)
            confidence = min(1.0, max(0.3, -score * 2))
            return AnomalyResult(
                machine_id=machine_id,
                parameter=parameter,
                value=current_value,
                anomaly_type="isolation_forest",
                confidence=confidence,
                description=(
                    f"ML model flagged {parameter}={current_value:.1f} as anomalous "
                    f"(isolation score={score:.3f})"
                ),
            )
        return None


class RateOfChangeDetector:
    """
    Detects abnormally rapid changes in sensor values.
    Catches scenarios like temperature jumping 15°C in 30 seconds
    even if the absolute value is within normal range.
    """

    # Default max-rate thresholds per parameter (units per second)
    DEFAULT_THRESHOLDS = {
        "temperature": 0.5,   # °C/s — normal drift is ~0.05°C/s
        "vibration": 0.3,     # mm/s per second
        "pressure": 0.4,      # bar/s
    }

    def __init__(self, thresholds: Optional[dict[str, float]] = None):
        self.thresholds = thresholds or self.DEFAULT_THRESHOLDS

    def detect(
        self,
        machine_id: str,
        parameter: str,
        values: list[float],
        timestamps: list[float],
        current_value: float,
        current_time: float,
    ) -> Optional[AnomalyResult]:
        if len(values) < 5 or parameter not in self.thresholds:
            return None

        max_rate = self.thresholds[parameter]

        # Compare with the value from ~10 seconds ago
        lookback_idx = max(0, len(values) - 5)
        prev_value = values[lookback_idx]
        prev_time = timestamps[lookback_idx]

        dt = current_time - prev_time
        if dt < 1.0:
            return None

        rate = abs(current_value - prev_value) / dt
        if rate > max_rate:
            direction = "rising" if current_value > prev_value else "falling"
            confidence = min(1.0, rate / max_rate * 0.6)
            return AnomalyResult(
                machine_id=machine_id,
                parameter=parameter,
                value=current_value,
                anomaly_type="rate_of_change",
                confidence=confidence,
                description=(
                    f"{parameter} is {direction} at {rate:.2f}/s "
                    f"(threshold: {max_rate}/s, Δ={abs(current_value - prev_value):.1f} "
                    f"in {dt:.0f}s)"
                ),
            )
        return None


class AnomalyDetector:
    """
    Composite anomaly detector combining Z-score, Isolation Forest,
    and Rate-of-Change strategies. Deduplicates results.
    """

    def __init__(
        self,
        zscore_threshold: float = 2.5,
        if_contamination: float = 0.05,
    ):
        self.zscore = ZScoreDetector(threshold=zscore_threshold)
        self.isolation_forest = IsolationForestDetector(contamination=if_contamination)
        self.rate_of_change = RateOfChangeDetector()

    def run_all(
        self,
        machine_id: str,
        parameter: str,
        values: list[float],
        timestamps: list[float],
        current_value: float,
        current_time: float,
    ) -> list[AnomalyResult]:
        """Run all detectors and return combined results."""
        results: list[AnomalyResult] = []

        # Z-Score
        r = self.zscore.detect(machine_id, parameter, values, current_value)
        if r:
            results.append(r)

        # Isolation Forest
        r = self.isolation_forest.detect(machine_id, parameter, values, current_value)
        if r:
            results.append(r)

        # Rate of Change
        r = self.rate_of_change.detect(
            machine_id, parameter, values, timestamps, current_value, current_time,
        )
        if r:
            results.append(r)

        return results
