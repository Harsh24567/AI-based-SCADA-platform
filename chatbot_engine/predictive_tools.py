"""
AI SCADA Platform — Predictive Maintenance Tools

Provides statistical health analysis and time-to-failure prediction
for connected factory machines. Called by the AI Agent as tools.
"""

from typing import Dict, Optional
from configs.config_loader import get_config
from influxdb_client import InfluxDBClient
import numpy as np

config = get_config()

# Alarm thresholds matched to settings.yaml
THRESHOLDS = {
    "temperature": {"high": 85.0, "low": None},
    "vibration":   {"high": 7.0,  "low": None},
    "pressure":    {"high": None, "low": 32.0},
}


def _get_influx_client():
    return InfluxDBClient(
        url=config.influxdb.url,
        token=config.influxdb.token,
        org=config.influxdb.org,
    )


def _fetch_series(machine_id: str, metric: str, minutes: int) -> list[float]:
    """Fetch a list of float values for a metric from InfluxDB."""
    client = _get_influx_client()
    query_api = client.query_api()
    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: -{minutes}m)
      |> filter(fn: (r) => r["_measurement"] == "{config.scada.measurement}")
      |> filter(fn: (r) => r["machine_id"] == "{machine_id}")
      |> filter(fn: (r) => r["_field"] == "{metric}")
      |> sort(columns: ["_time"], desc: false)
    '''
    result = query_api.query(query)
    values = []
    for table in result:
        for record in table.records:
            v = record.get_value()
            if v is not None:
                values.append(float(v))
    client.close()
    return values


def analyse_health(machine_id: str, minutes: int = 60) -> Dict:
    """
    Performs a statistical health analysis for a machine over the last N minutes.

    Returns:
        A dict containing trend info, Z-score, threshold proximity, and a risk level
        for each monitored metric: temperature, vibration, pressure.
    """
    metrics_to_check = ["temperature", "vibration", "pressure"]
    report = {
        "machine_id": machine_id,
        "analysis_window_minutes": minutes,
        "metrics": {},
        "overall_risk": "NORMAL",
    }

    risk_levels = []

    for metric in metrics_to_check:
        values = _fetch_series(machine_id, metric, minutes)
        if len(values) < 3:
            report["metrics"][metric] = {"status": "INSUFFICIENT_DATA", "data_points": len(values)}
            continue

        arr = np.array(values)
        current = arr[-1]
        mean_val = float(np.mean(arr))
        std_val = float(np.std(arr))

        # Z-score: how many standard deviations is the latest reading from the mean?
        z_score = float((current - mean_val) / std_val) if std_val > 0 else 0.0

        # Trend slope (degrees per data point) via linear regression
        x = np.arange(len(arr))
        slope, _ = np.polyfit(x, arr, 1)
        slope = float(slope)

        # Threshold proximity
        th = THRESHOLDS.get(metric, {})
        proximity = {}
        risk = "NORMAL"

        if th.get("high") is not None:
            gap_to_high = th["high"] - current
            proximity["high_threshold"] = th["high"]
            proximity["gap_to_high"] = round(gap_to_high, 2)
            if gap_to_high < 0:
                risk = "CRITICAL"
            elif gap_to_high < (th["high"] * 0.10):  # within 10% of breach
                risk = "HIGH"
            elif gap_to_high < (th["high"] * 0.20):
                risk = "MEDIUM"

        if th.get("low") is not None:
            gap_to_low = current - th["low"]
            proximity["low_threshold"] = th["low"]
            proximity["gap_to_low"] = round(gap_to_low, 2)
            if gap_to_low < 0:
                risk = "CRITICAL"
            elif gap_to_low < abs(th["low"] * 0.10):
                risk = "HIGH" if risk != "CRITICAL" else risk

        risk_levels.append(risk)

        report["metrics"][metric] = {
            "current_value": round(current, 3),
            "mean": round(mean_val, 3),
            "std_dev": round(std_val, 3),
            "z_score": round(z_score, 3),
            "trend_slope_per_reading": round(slope, 4),
            "trend_direction": "RISING" if slope > 0.01 else ("FALLING" if slope < -0.01 else "STABLE"),
            "threshold_info": proximity,
            "risk_level": risk,
            "data_points": len(values),
        }

    # Overall risk is highest across all metrics
    priority = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "NORMAL": 1}
    report["overall_risk"] = max(risk_levels, key=lambda r: priority.get(r, 0), default="NORMAL")

    return report


def predict_time_to_failure(machine_id: str, metric: str, minutes: int = 60) -> Dict:
    """
    Estimates how many minutes until a machine metric breaches its alarm threshold,
    based on projecting the current linear trend forward.

    Args:
        machine_id: The machine ID (e.g., MOTOR_1)
        metric: The field to forecast (e.g., temperature, vibration, pressure)
        minutes: Historical window to base the trend on

    Returns:
        A dict with the estimated time-to-failure in minutes, or a status
        if no breach is predicted.
    """
    values = _fetch_series(machine_id, metric, minutes)

    if len(values) < 5:
        return {
            "machine_id": machine_id,
            "metric": metric,
            "status": "INSUFFICIENT_DATA",
            "message": f"Need at least 5 data points to predict. Got {len(values)}.",
        }

    arr = np.array(values)
    x = np.arange(len(arr))
    slope, intercept = np.polyfit(x, arr, 1)

    current = arr[-1]
    th = THRESHOLDS.get(metric, {})

    results = []

    # Check for high threshold breach
    if th.get("high") is not None and slope > 0:
        # Solve: intercept + slope * t = threshold  =>  t = (threshold - intercept) / slope
        t_breach = (th["high"] - intercept) / slope
        readings_until_breach = t_breach - len(arr)
        # Assuming ~2s per reading (polling interval from config)
        poll_interval = getattr(config.modbus, "interval_seconds", 2)
        minutes_until_breach = (readings_until_breach * poll_interval) / 60.0

        if minutes_until_breach > 0:
            results.append({
                "threshold_type": "HIGH",
                "threshold_value": th["high"],
                "estimated_minutes_to_breach": round(minutes_until_breach, 1),
                "estimated_hours_to_breach": round(minutes_until_breach / 60, 2),
                "trend_slope": round(float(slope), 4),
            })

    # Check for low threshold breach
    if th.get("low") is not None and slope < 0:
        t_breach = (th["low"] - intercept) / slope
        readings_until_breach = t_breach - len(arr)
        poll_interval = getattr(config.modbus, "interval_seconds", 2)
        minutes_until_breach = (readings_until_breach * poll_interval) / 60.0

        if minutes_until_breach > 0:
            results.append({
                "threshold_type": "LOW",
                "threshold_value": th["low"],
                "estimated_minutes_to_breach": round(minutes_until_breach, 1),
                "estimated_hours_to_breach": round(minutes_until_breach / 60, 2),
                "trend_slope": round(float(slope), 4),
            })

    if not results:
        direction = "RISING" if slope > 0.01 else ("FALLING" if slope < -0.01 else "STABLE")
        return {
            "machine_id": machine_id,
            "metric": metric,
            "status": "NO_BREACH_PREDICTED",
            "current_value": round(float(current), 3),
            "trend_direction": direction,
            "message": f"{metric} is {direction.lower()} but not predicted to breach any alarm threshold soon.",
        }

    return {
        "machine_id": machine_id,
        "metric": metric,
        "status": "BREACH_PREDICTED",
        "current_value": round(float(current), 3),
        "predictions": results,
    }
