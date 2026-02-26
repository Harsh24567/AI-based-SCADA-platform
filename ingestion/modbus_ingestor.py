import sys
import os
import signal
import time
import threading

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from pydantic import ValidationError

from configs.config_loader import get_config
from data_sources.modbus_source import ModbusDataSource
from utils.logger import setup_logging, get_logger

config = get_config()
setup_logging(
    level=config.logging.level,
    log_dir=config.logging.log_dir,
    max_file_size_mb=config.logging.max_file_size_mb,
    backup_count=config.logging.backup_count,
    log_format=config.logging.format,
)
logger = get_logger("modbus_ingestion")

metrics = {
    "polls_attempted": 0,
    "polls_successful": 0,
    "points_stored": 0,
    "polls_failed": 0,
    "validation_errors": 0,
    "last_poll_time": None,
}
metrics_lock = threading.Lock()

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

shutdown_event = threading.Event()

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info(f"Received signal {signum}. Shutting down...")
    shutdown_event.set()

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    """Start the Modbus ingestion loop."""
    logger.info("=" * 60)
    logger.info("AI SCADA Platform — Modbus Ingestion Service Starting")
    logger.info(f"  PLC:     {config.modbus.host}:{config.modbus.port} (ID: {config.modbus.slave_id})")
    logger.info(f"  Rate:    Every {config.modbus.interval_seconds}s")
    logger.info(f"  InfluxDB: {config.influxdb.url} → {config.influxdb.bucket}")
    logger.info("=" * 60)

    source = ModbusDataSource()
    source.connect()

    if not source.is_connected():
         logger.warning("Could not establish initial PLC connection. Will keep trying in background.")

    try:
        while not shutdown_event.is_set():
             start_time = time.time()
             
             with metrics_lock:
                 metrics["polls_attempted"] += 1
             
             if not source.is_connected():
                  source.connect()
                  
             print(f"DEBUG: Poll attempt... Connected: {source.is_connected()}")
             if source.is_connected():
                 try:
                     print("DEBUG: Reading from PLC...")
                     readings = source.get_latest_reading()
                     print(f"DEBUG: Received {len(readings) if readings else 0} readings")
                     if readings:
                          points = []
                          for reading in readings:
                               point = (
                                    Point(config.scada.measurement)
                                    .tag("machine_id", reading.machine_id)
                                    .field("temperature", reading.temperature)
                                    .field("vibration", reading.vibration)
                                    .field("pressure", reading.pressure)
                                    .time(int(reading.timestamp * 1e9), WritePrecision.NS)
                                )
                               points.append(point)
                               
                          write_api.write(
                                bucket=config.influxdb.bucket,
                                org=config.influxdb.org,
                                record=points,
                          )
                          
                          with metrics_lock:
                               metrics["polls_successful"] += 1
                               metrics["points_stored"] += len(points)
                               metrics["last_poll_time"] = time.time()
                               
                          logger.info(f"Stored {len(points)} readings from PLC")
                               
                 except ValidationError as e:
                     with metrics_lock:
                         metrics["validation_errors"] += 1
                     logger.error(f"Payload validation failed: {e.error_count()} errors", extra={"errors": str(e.errors())})
                 except Exception as e:
                     with metrics_lock:
                         metrics["polls_failed"] += 1
                     logger.error(f"Error reading/writing Modbus data: {e}", exc_info=True)
             else:
                 with metrics_lock:
                     metrics["polls_failed"] += 1
             
             elapsed = time.time() - start_time
             sleep_time = max(0, config.modbus.interval_seconds - elapsed)
             shutdown_event.wait(timeout=sleep_time)

    except Exception as e:
        logger.critical(f"Fatal error: {e}", exc_info=True)
    finally:
        logger.info("Stopping Modbus client...")
        source.disconnect()
        influx_client.close()
        logger.info("Modbus ingestion service stopped")

        with metrics_lock:
            logger.info(f"Final metrics: {metrics}")


if __name__ == "__main__":
    main()
