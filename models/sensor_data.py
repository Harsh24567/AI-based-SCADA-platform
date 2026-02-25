from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class SensorReading(BaseModel):
    """Validates incoming sensor data from MQTT or data sources."""

    machine_id: str = Field(..., min_length=1, description="Unique machine identifier")
    temperature: float = Field(..., ge=-50, le=1000, description="Temperature in °C")
    vibration: float = Field(..., ge=0, le=100, description="Vibration in mm/s RMS")
    pressure: float = Field(..., ge=0, le=200, description="Pressure in bar")
    timestamp: float = Field(..., gt=0, description="Unix timestamp (epoch seconds)")

    @field_validator("machine_id")
    @classmethod
    def validate_machine_id(cls, v):
        """Machine IDs should be uppercase alphanumeric with underscores."""
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("machine_id cannot be empty")
        return cleaned


class SensorResponse(BaseModel):
    """API response model for a single sensor reading from InfluxDB."""

    machine_id: Optional[str] = None
    field: str
    value: float
    time: datetime


class LatestDataResponse(BaseModel):
    """API response model for /latest endpoint."""

    data: list[SensorResponse]


class HistoryQuery(BaseModel):
    """Query parameters for /history endpoint."""

    machine_id: Optional[str] = None
    field: Optional[str] = None
    start: str = "-1h"
    end: str = "now()"
    downsample: Optional[str] = None  # e.g., "5m", "1h"