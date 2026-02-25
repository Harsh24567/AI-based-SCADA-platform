"""
AI SCADA Platform — Modbus TCP Data Source

Connects to a Modbus PLC and reads holding registers, mapped to tags.
"""

import time
import logging
from typing import Optional

from pymodbus.client import ModbusTcpClient

from configs.config_loader import get_config
from models.sensor_data import SensorReading
from data_sources.base import DataSourceBase

logger = logging.getLogger("ingestion")

class ModbusDataSource(DataSourceBase):
    """
    Data source implementation for Modbus TCP.
    Reads mapped holding registers periodically.
    """

    def __init__(self):
        self.config = get_config()
        self.modbus_cfg = self.config.modbus
        self.client = ModbusTcpClient(
            host=self.modbus_cfg.host,
            port=self.modbus_cfg.port,
            timeout=3.0
        )
        self.connected = False

    def connect(self) -> None:
        """Establish connection to the Modbus PLC."""
        try:
            self.connected = self.client.connect()
            if self.connected:
                logger.info(f"Modbus connected to {self.modbus_cfg.host}:{self.modbus_cfg.port}")
            else:
                logger.error(f"Modbus connection failed to {self.modbus_cfg.host}:{self.modbus_cfg.port}")
        except Exception as e:
            logger.error(f"Error connecting to Modbus PLC: {e}")
            self.connected = False

    def disconnect(self) -> None:
        """Gracefully close the connection."""
        self.client.close()
        self.connected = False
        logger.info("Modbus disconnected")

    def is_connected(self) -> bool:
        """Check if the Modbus connection is alive."""
        # A simple check; more robust would be a test read
        return self.connected

    def _read_register(self, address: int) -> Optional[int]:
        """Read a single holding register."""
        if not self.is_connected():
            return None
        
        try:
            # subtract 40001, typical 1-based holding register mapping offset
            # (or use 0-based if specified address is already 0-based).
            # Assuming 4000X format, address = 40001 -> Modbus offset 0
            modbus_address = address - 40001 if address >= 40001 else address
            
            result = self.client.read_holding_registers(
                address=modbus_address,
                count=1,
                device_id=self.modbus_cfg.slave_id
            )
            
            if result.isError():
                logger.error(f"Modbus read error at {address}: {result}")
                return None
                
            return result.registers[0]
            
        except Exception as e:
            logger.error(f"Modbus exception reading {address}: {e}")
            return None

    def get_latest_reading(self, machine_id: Optional[str] = None) -> list[SensorReading]:
        """
        Get the most recent readings from the PLC mapping.
        """
        if not self.is_connected():
            return []

        # Group tags by machine_id to produce complete SensorReadings
        machine_data = {}
        
        for tag in self.modbus_cfg.tags:
            if machine_id and tag.machine_id != machine_id:
                continue
                
            val = self._read_register(tag.address)
            if val is None:
                continue
                
            scaled_val = float(val) * tag.scaling
            
            if tag.machine_id not in machine_data:
                machine_data[tag.machine_id] = {
                    "temperature": 0.0,
                    "vibration": 0.0,
                    "pressure": 0.0,
                    "timestamp": time.time(),
                }
            
            # Update the specific parameter
            if tag.name in ["temperature", "vibration", "pressure"]:
                machine_data[tag.machine_id][tag.name] = scaled_val

        readings = []
        for m_id, data in machine_data.items():
            try:
                reading = SensorReading(
                    machine_id=m_id,
                    temperature=data["temperature"],
                    vibration=data["vibration"],
                    pressure=data["pressure"],
                    timestamp=data["timestamp"]
                )
                readings.append(reading)
            except Exception as e:
                 logger.error(f"Validation error creating SensorReading for {m_id}: {e}")
                 
        return readings

    def list_tags(self) -> list[str]:
        """List all configured Modbus tags."""
        return [f"{tag.machine_id}.{tag.name}@{tag.address}" for tag in self.modbus_cfg.tags]

    @property
    def source_type(self) -> str:
        return "modbus"
