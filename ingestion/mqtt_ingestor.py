"""
AI SCADA Platform — MQTT Ingestion Service

Subscribes to MQTT broker, validates payloads, and writes to InfluxDB.
Features:
    - Auto-reconnect with exponential backoff
    - Pydantic payload validation
    - Dead-letter logging for malformed messages
    - Structured JSON logging
    - Graceful shutdown handling
"""

import sys
import os
import signal
import json
import time
import threading

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
import paho.mqtt.client as mqtt
from pydantic import ValidationError

from configs.config_loader import get_config
from models.sensor_data import SensorReading
from utils.logger import setup_logging, get_logger

# ── Initialize ──────────────────────────────────────────────
config = get_config()
setup_logging(
    level=config.logging.level,
    log_dir=config.logging.log_dir,
    max_file_size_mb=config.logging.max_file_size_mb,
    backup_count=config.logging.backup_count,
    log_format=config.logging.format,
)
logger = get_logger("ingestion")

# ── Metrics ─────────────────────────────────────────────────
metrics = {
    "messages_received": 0,
    "messages_stored": 0,
    "messages_failed": 0,
    "validation_errors": 0,
    "last_message_time": None,
}
metrics_lock = threading.Lock()


# ── InfluxDB Connection ────────────────────────────────────
def connect_influxdb(max_retries: int = 5, base_delay: float = 2.0):
    """Connect to InfluxDB with retry logic."""
    for attempt in range(1, max_retries + 1):
        try:
            client = InfluxDBClient(
                url=config.influxdb.url,
                token=config.influxdb.token,
                org=config.influxdb.org,
                timeout=config.influxdb.timeout,
            )
            # Test connection
            health = client.health()
            if health.status == "pass":
                logger.info(f"InfluxDB connected (attempt {attempt})")
                return client
            else:
                logger.warning(f"InfluxDB health check failed: {health.message}")
        except Exception as e:
            delay = min(base_delay * (2 ** (attempt - 1)), 60)
            logger.error(
                f"InfluxDB connection failed (attempt {attempt}/{max_retries}): {e}"
            )
            if attempt < max_retries:
                logger.info(f"Retrying in {delay}s...")
                time.sleep(delay)

    logger.critical("Failed to connect to InfluxDB after all retries. Exiting.")
    sys.exit(1)


influx_client = connect_influxdb()
write_api = influx_client.write_api(write_options=SYNCHRONOUS)


# ── MQTT Callbacks ──────────────────────────────────────────
def on_connect(client, userdata, flags, rc, properties=None):
    """Called when MQTT connection is established."""
    if rc == 0:
        logger.info(f"MQTT connected to {config.mqtt.broker}:{config.mqtt.port}")
        client.subscribe(config.mqtt.topic, qos=config.mqtt.qos)
        logger.info(f"Subscribed to topic: {config.mqtt.topic}")
    else:
        logger.error(f"MQTT connection failed with code: {rc}")


def on_disconnect(client, userdata, flags, rc, properties=None):
    """Called when MQTT connection is lost."""
    if rc != 0:
        logger.warning(f"MQTT unexpected disconnect (code: {rc}). Auto-reconnecting...")
    else:
        logger.info("MQTT disconnected gracefully")


def on_message(client, userdata, msg):
    """Process incoming MQTT message with validation and error handling."""
    with metrics_lock:
        metrics["messages_received"] += 1

    try:
        # Parse JSON payload
        raw_payload = msg.payload.decode("utf-8")
        data = json.loads(raw_payload)

        # Validate against Pydantic model
        reading = SensorReading(**data)

        # Build InfluxDB point
        point = (
            Point(config.scada.measurement)
            .tag("machine_id", reading.machine_id)
            .field("temperature", reading.temperature)
            .field("vibration", reading.vibration)
            .field("pressure", reading.pressure)
            .time(int(reading.timestamp * 1e9), WritePrecision.NS)
        )

        # Write to InfluxDB
        write_api.write(
            bucket=config.influxdb.bucket,
            org=config.influxdb.org,
            record=point,
        )

        with metrics_lock:
            metrics["messages_stored"] += 1
            metrics["last_message_time"] = time.time()

        logger.debug(
            f"Stored reading from {reading.machine_id}",
            extra={"machine_id": reading.machine_id},
        )

    except json.JSONDecodeError as e:
        with metrics_lock:
            metrics["messages_failed"] += 1
        logger.error(f"Invalid JSON payload: {e}", extra={"raw": msg.payload[:200]})

    except ValidationError as e:
        with metrics_lock:
            metrics["validation_errors"] += 1
        logger.error(
            f"Payload validation failed: {e.error_count()} errors",
            extra={"errors": str(e.errors())},
        )

    except Exception as e:
        with metrics_lock:
            metrics["messages_failed"] += 1
        logger.error(f"Failed to process message: {e}", exc_info=True)


# ── MQTT Client Setup ──────────────────────────────────────
def create_mqtt_client():
    """Create and configure the MQTT client."""
    mqtt_client = mqtt.Client(
        client_id=config.mqtt.client_id,
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    )

    # Set callbacks
    mqtt_client.on_connect = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message = on_message

    # Set authentication if configured
    if config.mqtt.username and config.mqtt.password:
        mqtt_client.username_pw_set(config.mqtt.username, config.mqtt.password)
        logger.info("MQTT authentication configured")

    # Set reconnect delays
    mqtt_client.reconnect_delay_set(
        min_delay=config.mqtt.reconnect_min_delay,
        max_delay=config.mqtt.reconnect_max_delay,
    )

    return mqtt_client


# ── Graceful Shutdown ───────────────────────────────────────
shutdown_event = threading.Event()


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info(f"Received signal {signum}. Shutting down...")
    shutdown_event.set()


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


# ── Main Loop ──────────────────────────────────────────────
def main():
    """Start the MQTT ingestion service."""
    logger.info("=" * 60)
    logger.info("AI SCADA Platform — MQTT Ingestion Service Starting")
    logger.info(f"  Broker:  {config.mqtt.broker}:{config.mqtt.port}")
    logger.info(f"  Topic:   {config.mqtt.topic}")
    logger.info(f"  InfluxDB: {config.influxdb.url} → {config.influxdb.bucket}")
    logger.info("=" * 60)

    mqtt_client = create_mqtt_client()

    try:
        mqtt_client.connect(config.mqtt.broker, config.mqtt.port)
        mqtt_client.loop_start()

        # Keep running until shutdown signal
        while not shutdown_event.is_set():
            shutdown_event.wait(timeout=1.0)

    except Exception as e:
        logger.critical(f"Fatal error: {e}", exc_info=True)
    finally:
        logger.info("Stopping MQTT client...")
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        influx_client.close()
        logger.info("Ingestion service stopped")

        # Print final metrics
        with metrics_lock:
            logger.info(f"Final metrics: {metrics}")


if __name__ == "__main__":
    main()
