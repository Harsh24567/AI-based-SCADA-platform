"""
AI SCADA Platform — Multi-Machine Sensor Simulator

Simulates multiple industrial machines with realistic data patterns.
Features:
    - Multi-machine support from config
    - Gradual drift patterns (not pure random)
    - Occasional anomaly injection for testing alarms
    - Structured logging
"""

import sys
import os
import signal
import time
import json
import random
import math

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import paho.mqtt.client as mqtt

from configs.config_loader import get_config
from utils.logger import setup_logging, get_logger

# ── Initialize ──────────────────────────────────────────────
config = get_config()
setup_logging(
    level=config.logging.level,
    log_dir=config.logging.log_dir,
    log_format=config.logging.format,
)
logger = get_logger("simulator")


class MachineSimulator:
    """
    Simulates a single industrial machine with realistic sensor drift.

    Instead of pure random, values follow a random walk with mean-reversion,
    producing more realistic data patterns for AI training.
    """

    def __init__(self, machine_id: str, temp_range: list, vib_range: list, pres_range: list):
        self.machine_id = machine_id

        # Ranges
        self.temp_min, self.temp_max = temp_range
        self.vib_min, self.vib_max = vib_range
        self.pres_min, self.pres_max = pres_range

        # Current values (start at midpoint)
        self.temperature = (self.temp_min + self.temp_max) / 2
        self.vibration = (self.vib_min + self.vib_max) / 2
        self.pressure = (self.pres_min + self.pres_max) / 2

        # Drift parameters
        self.drift_speed = 0.3  # How fast values change
        self.mean_reversion = 0.05  # Pull back toward midpoint

    def _drift(self, current: float, min_val: float, max_val: float) -> float:
        """Apply random walk with mean reversion."""
        midpoint = (min_val + max_val) / 2
        range_size = max_val - min_val

        # Random walk step
        step = random.gauss(0, range_size * self.drift_speed * 0.1)

        # Mean reversion force (pulls value back toward center)
        reversion = (midpoint - current) * self.mean_reversion

        new_val = current + step + reversion

        # Soft clamp within range (allow slight overshoot for alarm testing)
        overshoot_margin = range_size * 0.15
        new_val = max(min_val - overshoot_margin, min(max_val + overshoot_margin, new_val))

        return round(new_val, 2)

    def generate_reading(self) -> dict:
        """Generate the next sensor reading with drift."""
        self.temperature = self._drift(self.temperature, self.temp_min, self.temp_max)
        self.vibration = self._drift(self.vibration, self.vib_min, self.vib_max)
        self.pressure = self._drift(self.pressure, self.pres_min, self.pres_max)

        return {
            "machine_id": self.machine_id,
            "temperature": self.temperature,
            "vibration": self.vibration,
            "pressure": self.pressure,
            "timestamp": time.time(),
        }


# ── Graceful Shutdown ───────────────────────────────────────
running = True


def signal_handler(signum, frame):
    global running
    logger.info(f"Received signal {signum}. Stopping simulator...")
    running = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


# ── Main ────────────────────────────────────────────────────
def main():
    logger.info("=" * 60)
    logger.info("AI SCADA Platform — Sensor Simulator Starting")
    logger.info(f"  Broker:   {config.mqtt.broker}:{config.mqtt.port}")
    logger.info(f"  Topic:    {config.mqtt.topic}")
    logger.info(f"  Machines: {len(config.simulator.machines)}")
    logger.info(f"  Interval: {config.simulator.interval_seconds}s")
    logger.info("=" * 60)

    # Create machine simulators from config
    machines = []
    for m in config.simulator.machines:
        sim = MachineSimulator(
            machine_id=m.id,
            temp_range=m.temperature_range,
            vib_range=m.vibration_range,
            pres_range=m.pressure_range,
        )
        machines.append(sim)
        logger.info(f"  Registered machine: {m.id}")

    if not machines:
        logger.error("No machines configured in settings.yaml!")
        sys.exit(1)

    # Connect to MQTT
    client = mqtt.Client(
        client_id="scada_simulator",
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    )

    try:
        client.connect(config.mqtt.broker, config.mqtt.port)
        client.loop_start()
        logger.info("Connected to MQTT broker")
    except Exception as e:
        logger.critical(f"Failed to connect to MQTT broker: {e}")
        sys.exit(1)

    # Publishing loop
    message_count = 0
    try:
        while running:
            for machine in machines:
                reading = machine.generate_reading()
                payload = json.dumps(reading)
                result = client.publish(config.mqtt.topic, payload, qos=config.mqtt.qos)

                if result.rc == mqtt.MQTT_ERR_SUCCESS:
                    message_count += 1
                    logger.debug(
                        f"[{machine.machine_id}] T={reading['temperature']:.1f}°C "
                        f"V={reading['vibration']:.1f}mm/s "
                        f"P={reading['pressure']:.1f}bar"
                    )
                else:
                    logger.warning(f"Failed to publish for {machine.machine_id}")

            # Log summary every 30 messages
            if message_count % 30 == 0 and message_count > 0:
                logger.info(f"Published {message_count} total messages")

            time.sleep(config.simulator.interval_seconds)

    except Exception as e:
        logger.error(f"Simulator error: {e}", exc_info=True)
    finally:
        client.loop_stop()
        client.disconnect()
        logger.info(f"Simulator stopped. Total messages sent: {message_count}")


if __name__ == "__main__":
    main()
