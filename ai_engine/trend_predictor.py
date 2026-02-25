"""
AI SCADA Platform — Trend Prediction Module

Provides:
  1. Linear regression forecasting — predicts values N minutes ahead
  2. Threshold ETA — estimates when a rising metric will cross its alarm limit
"""

import time
import numpy as np
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PredictionResult:
    """Forecast for a single machine/parameter."""
    machine_id: str
    parameter: str
    current_value: float
    predicted_value: float      # forecasted value at horizon
    horizon_seconds: int        # how far ahead (default 300s = 5 min)
    trend_direction: str        # "rising" | "falling" | "stable"
    trend_rate: float           # units per second
    confidence: float           # 0.0 – 1.0 (R² of the fit)
    threshold_eta_seconds: Optional[float] = None  # seconds until alarm threshold
    threshold_value: Optional[float] = None
    predicted_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        d = {
            "machine_id": self.machine_id,
            "parameter": self.parameter,
            "current_value": round(self.current_value, 2),
            "predicted_value": round(self.predicted_value, 2),
            "horizon_seconds": self.horizon_seconds,
            "trend_direction": self.trend_direction,
            "trend_rate": round(self.trend_rate, 4),
            "confidence": round(self.confidence, 3),
            "predicted_at": self.predicted_at,
        }
        if self.threshold_eta_seconds is not None:
            d["threshold_eta_seconds"] = round(self.threshold_eta_seconds, 0)
            d["threshold_eta_minutes"] = round(self.threshold_eta_seconds / 60, 1)
            d["threshold_value"] = self.threshold_value
        return d


# Alarm thresholds (must stay in sync with configs/settings.yaml)
ALARM_THRESHOLDS = {
    "temperature": {"high": 85},
    "vibration": {"high": 7},
    "pressure": {"low": 32},
}


class TrendPredictor:
    """
    Predicts future sensor values using polynomial regression on recent data.
    """

    def __init__(
        self,
        horizon_seconds: int = 300,   # predict 5 minutes ahead
        min_samples: int = 15,
        poly_degree: int = 1,         # 1 = linear, 2 = quadratic
    ):
        self.horizon_seconds = horizon_seconds
        self.min_samples = min_samples
        self.poly_degree = poly_degree

    def predict(
        self,
        machine_id: str,
        parameter: str,
        values: list[float],
        timestamps: list[float],
    ) -> Optional[PredictionResult]:
        n = len(values)
        if n < self.min_samples:
            return None

        # Normalize timestamps to seconds-from-start for numerical stability
        t0 = timestamps[0]
        t_arr = np.array([t - t0 for t in timestamps])
        v_arr = np.array(values)

        # Fit polynomial
        try:
            coeffs = np.polyfit(t_arr, v_arr, self.poly_degree)
            poly = np.poly1d(coeffs)
        except (np.linalg.LinAlgError, ValueError):
            return None

        # R² for confidence
        predicted_hist = poly(t_arr)
        ss_res = np.sum((v_arr - predicted_hist) ** 2)
        ss_tot = np.sum((v_arr - np.mean(v_arr)) ** 2)
        r_squared = max(0.0, 1.0 - ss_res / ss_tot) if ss_tot > 1e-10 else 0.0

        # Forecast
        current_t = t_arr[-1]
        future_t = current_t + self.horizon_seconds
        current_value = float(v_arr[-1])
        predicted_value = float(poly(future_t))

        # Trend direction from slope (linear coefficient)
        slope = float(coeffs[-2]) if len(coeffs) >= 2 else 0.0
        if abs(slope) < 0.001:
            direction = "stable"
        elif slope > 0:
            direction = "rising"
        else:
            direction = "falling"

        # Threshold ETA calculation
        eta_seconds = None
        threshold_val = None
        if parameter in ALARM_THRESHOLDS:
            limits = ALARM_THRESHOLDS[parameter]
            if "high" in limits and direction == "rising":
                target = limits["high"]
                if current_value < target and slope > 0.0001:
                    eta_seconds = (target - current_value) / slope
                    threshold_val = target
            elif "low" in limits and direction == "falling":
                target = limits["low"]
                if current_value > target and slope < -0.0001:
                    eta_seconds = (current_value - target) / abs(slope)
                    threshold_val = target

        return PredictionResult(
            machine_id=machine_id,
            parameter=parameter,
            current_value=current_value,
            predicted_value=predicted_value,
            horizon_seconds=self.horizon_seconds,
            trend_direction=direction,
            trend_rate=slope,
            confidence=r_squared,
            threshold_eta_seconds=eta_seconds,
            threshold_value=threshold_val,
        )
