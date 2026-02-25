"""
AI SCADA Platform — Data Source Abstraction Layer

Abstract interface for data sources. This allows swapping between
simulator, MQTT, OPC UA, or Modbus drivers without changing the
rest of the platform.

When the PLC arrives, create a new driver (e.g., opcua_source.py)
implementing this interface. Everything else stays untouched.
"""

from abc import ABC, abstractmethod
from typing import Optional
from models.sensor_data import SensorReading


class DataSourceBase(ABC):
    """
    Abstract base class for all data sources.

    Implementations:
        - MQTTSource: Subscribes to MQTT broker (current)
        - OPCUASource: Connects to OPC UA server (future - PLC)
        - ModbusSource: Connects via Modbus TCP (future)
    """

    @abstractmethod
    def connect(self) -> None:
        """Establish connection to the data source."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Gracefully close the connection."""
        pass

    @abstractmethod
    def is_connected(self) -> bool:
        """Check if the data source connection is alive."""
        pass

    @abstractmethod
    def get_latest_reading(self, machine_id: Optional[str] = None) -> list[SensorReading]:
        """
        Get the most recent readings.

        Args:
            machine_id: Optional filter for a specific machine.

        Returns:
            List of SensorReading objects.
        """
        pass

    @abstractmethod
    def list_tags(self) -> list[str]:
        """
        List all available data tags/points.

        Returns:
            List of tag names (e.g., ["MOTOR_1.temperature", "PUMP_1.pressure"])
        """
        pass

    @property
    @abstractmethod
    def source_type(self) -> str:
        """Return the source type identifier (e.g., 'mqtt', 'opcua', 'modbus')."""
        pass
