"""
AI SCADA Platform — Alarm Data Models

ISA-18.2 compliant alarm models with severity levels and state management.
"""

from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime, timezone
import uuid


class AlarmSeverity(str, Enum):
    """Alarm severity levels, ordered from most to least critical."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class AlarmState(str, Enum):
    """
    ISA-18.2 alarm states.

    Lifecycle:
        ACTIVE → ACKNOWLEDGED → CLEARED
        ACTIVE → CLEARED (auto-clear when condition resolves)
    """
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    CLEARED = "CLEARED"


class AlarmType(str, Enum):
    """Whether the alarm was triggered by a high or low threshold."""
    HIGH = "HIGH"
    LOW = "LOW"


class Alarm(BaseModel):
    """Full alarm record with ISA-18.2 lifecycle fields."""

    alarm_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    machine_id: str
    parameter: str          # e.g., "temperature", "vibration", "pressure"
    alarm_type: AlarmType   # HIGH or LOW
    severity: AlarmSeverity
    state: AlarmState = AlarmState.ACTIVE
    value: float            # The reading that triggered the alarm
    limit: float            # The threshold that was breached
    triggered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    cleared_at: Optional[datetime] = None

    def acknowledge(self, user: str) -> None:
        """Mark alarm as acknowledged by an operator."""
        if self.state == AlarmState.ACTIVE:
            self.state = AlarmState.ACKNOWLEDGED
            self.acknowledged_by = user
            self.acknowledged_at = datetime.now(timezone.utc)

    def clear(self) -> None:
        """Mark alarm as cleared."""
        self.state = AlarmState.CLEARED
        self.cleared_at = datetime.now(timezone.utc)

    @property
    def is_active(self) -> bool:
        return self.state in (AlarmState.ACTIVE, AlarmState.ACKNOWLEDGED)

    def dedup_key(self) -> str:
        """Key for deduplication — same machine + parameter + type = same alarm."""
        return f"{self.machine_id}:{self.parameter}:{self.alarm_type}"


class AlarmAcknowledgeRequest(BaseModel):
    """Request body for acknowledging an alarm."""
    acknowledged_by: str = Field(..., min_length=1)


class AlarmResponse(BaseModel):
    """API response model for alarm data."""
    active_alarms: list[Alarm]
    total_count: int
