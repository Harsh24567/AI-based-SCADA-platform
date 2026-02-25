"""
AI SCADA Platform — Health Scoring Module

Computes a 0-100 health score per machine and system-wide.
Score is a weighted composite of:
  - Distance from alarm thresholds (40%)
  - Anomaly count (30%)
  - Trend stability / variance (20%)
  - Rate-of-change calmness (10%)
"""

import numpy as np
from dataclasses import dataclass, field
import time
from typing import Optional


# Alarm thresholds (synced with settings.yaml)
THRESHOLDS = {
    "temperature": {"high": 85, "nominal": 70},
    "vibration": {"high": 7, "nominal": 4},
    "pressure": {"low": 32, "high": 60, "nominal": 42},
}


@dataclass
class HealthScore:
    """Health score for a single machine."""
    machine_id: str
    score: float                 # 0 – 100
    grade: str                   # A / B / C / D / F
    factors: dict                # breakdown of contributing factors
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "machine_id": self.machine_id,
            "score": round(self.score, 1),
            "grade": self.grade,
            "factors": self.factors,
            "timestamp": self.timestamp,
        }


def _grade(score: float) -> str:
    if score >= 90:
        return "A"
    elif score >= 75:
        return "B"
    elif score >= 60:
        return "C"
    elif score >= 40:
        return "D"
    else:
        return "F"


class HealthScorer:
    """Compute per-machine and system-wide health scores."""

    def __init__(self):
        pass

    def score_machine(
        self,
        machine_id: str,
        parameter_values: dict[str, list[float]],
        anomaly_count: int = 0,
    ) -> HealthScore:
        """
        Compute health for one machine.

        Args:
            machine_id: Machine identifier
            parameter_values: {"temperature": [...], "vibration": [...], ...}
            anomaly_count: active anomaly count for this machine
        """
        factors = {}

        # ── Factor 1: Distance from thresholds (0-100) ──────
        threshold_scores = []
        for param, values in parameter_values.items():
            if not values or param not in THRESHOLDS:
                continue
            current = values[-1]
            limits = THRESHOLDS[param]
            nominal = limits.get("nominal", (limits.get("high", 100) + limits.get("low", 0)) / 2)

            # How close are we to a dangerous threshold?
            if "high" in limits:
                headroom_high = max(0, limits["high"] - current) / max(1, limits["high"] - nominal)
            else:
                headroom_high = 1.0

            if "low" in limits:
                headroom_low = max(0, current - limits["low"]) / max(1, nominal - limits["low"])
            else:
                headroom_low = 1.0

            threshold_scores.append(min(headroom_high, headroom_low) * 100)

        threshold_factor = np.mean(threshold_scores) if threshold_scores else 50.0
        threshold_factor = float(np.clip(threshold_factor, 0, 100))
        factors["threshold_distance"] = round(threshold_factor, 1)

        # ── Factor 2: Anomaly penalty (0-100) ───────────────
        anomaly_factor = max(0, 100 - anomaly_count * 25)
        factors["anomaly_penalty"] = round(anomaly_factor, 1)

        # ── Factor 3: Signal stability (0-100) ──────────────
        stability_scores = []
        for param, values in parameter_values.items():
            if len(values) < 10:
                continue
            recent = np.array(values[-30:])
            cv = np.std(recent) / max(np.mean(recent), 1e-6)  # coefficient of variation
            # Low CV = stable = high score
            stability = max(0, 100 - cv * 500)
            stability_scores.append(stability)

        stability_factor = float(np.mean(stability_scores)) if stability_scores else 70.0
        stability_factor = float(np.clip(stability_factor, 0, 100))
        factors["stability"] = round(stability_factor, 1)

        # ── Factor 4: Rate calmness (0-100) ─────────────────
        rate_scores = []
        for param, values in parameter_values.items():
            if len(values) < 5:
                continue
            diffs = np.abs(np.diff(values[-20:]))
            avg_rate = np.mean(diffs) if len(diffs) > 0 else 0
            # Lower rate = calmer = higher score
            rate_score = max(0, 100 - avg_rate * 20)
            rate_scores.append(rate_score)

        rate_factor = float(np.mean(rate_scores)) if rate_scores else 80.0
        rate_factor = float(np.clip(rate_factor, 0, 100))
        factors["rate_calmness"] = round(rate_factor, 1)

        # ── Weighted composite ──────────────────────────────
        score = (
            threshold_factor * 0.40
            + anomaly_factor * 0.30
            + stability_factor * 0.20
            + rate_factor * 0.10
        )
        score = float(np.clip(score, 0, 100))

        return HealthScore(
            machine_id=machine_id,
            score=score,
            grade=_grade(score),
            factors=factors,
        )

    def score_system(self, machine_scores: list[HealthScore]) -> dict:
        """Aggregate machine scores into a system-wide health summary."""
        if not machine_scores:
            return {
                "system_score": 0,
                "system_grade": "F",
                "machine_count": 0,
                "worst_machine": None,
            }

        scores = [m.score for m in machine_scores]
        worst = min(machine_scores, key=lambda m: m.score)

        return {
            "system_score": round(float(np.mean(scores)), 1),
            "system_grade": _grade(float(np.mean(scores))),
            "machine_count": len(machine_scores),
            "worst_machine": worst.machine_id,
            "worst_score": round(worst.score, 1),
            "machines": [m.to_dict() for m in machine_scores],
        }
