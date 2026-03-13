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

    def get_latest_reading(self, machine_id: Optional[str] = None) -> list[SensorReading]:
        """
        Get the most recent readings from the PLC mapping using a block read to minimize network latency.
        """
        if not self.is_connected() or not self.modbus_cfg.tags:
            return []

        # Find min and max address to define the block to read
        addresses = [tag.address for tag in self.modbus_cfg.tags]
        min_addr = min(addresses)
        max_addr = max(addresses)
        count = max_addr - min_addr + 1

        if count > 125:
             logger.warning(f"Block read count ({count}) exceeds typical Modbus limit of 125 registers. Splitting may be required in the future.")

        try:
            # subtract 40001, typical 1-based holding register mapping offset
            modbus_address = min_addr - 40001 if min_addr >= 40001 else min_addr
            
            result = self.client.read_holding_registers(
                address=modbus_address,
                count=count,
                device_id=self.modbus_cfg.slave_id
            )
            
            if result.isError():
                logger.error(f"Modbus block read error at {min_addr} (count {count}): {result}")
                return []
                
            registers = result.registers
        except Exception as e:
            logger.error(f"Modbus exception during block read: {e}")
            return []

        # Group tags by machine_id to produce complete SensorReadings
        machine_data = {}
        
        for tag in self.modbus_cfg.tags:
            if machine_id and tag.machine_id != machine_id:
                continue
                
            offset = tag.address - min_addr
            if offset >= len(registers):
                continue
                
            val = registers[offset]
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

