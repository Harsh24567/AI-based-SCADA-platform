"""
AI SCADA Platform — Structured Logging Utility

Provides JSON-formatted structured logging with rotating file handlers.
Each module gets its own named logger under the 'scada' namespace.
"""

import logging
import logging.handlers
import json
import os
from datetime import datetime, timezone
from pathlib import Path


class JSONFormatter(logging.Formatter):
    """Formats log records as JSON objects for structured log analysis."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        # Include exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        # Include any extra fields passed via the `extra` parameter
        for key in ("machine_id", "alarm_id", "field", "value", "client_id", "endpoint"):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)
        return json.dumps(log_entry)


class TextFormatter(logging.Formatter):
    """Human-readable formatter for console/development use."""

    FORMAT = "%(asctime)s | %(levelname)-8s | %(name)-25s | %(message)s"

    def __init__(self):
        super().__init__(fmt=self.FORMAT, datefmt="%Y-%m-%d %H:%M:%S")


def setup_logging(level: str = "INFO", log_dir: str = "logs",
                  max_file_size_mb: int = 10, backup_count: int = 5,
                  log_format: str = "json") -> None:
    """
    Initialize the logging system for the platform.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: Directory to store log files
        max_file_size_mb: Max size of each log file before rotation
        backup_count: Number of rotated log files to keep
        log_format: "json" for structured logs, "text" for human-readable
    """
    # Create log directory
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)

    # Get root scada logger
    root_logger = logging.getLogger("scada")
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Clear existing handlers to avoid duplicates on reload
    root_logger.handlers.clear()

    # Choose formatter
    if log_format == "json":
        formatter = JSONFormatter()
    else:
        formatter = TextFormatter()

    # Console handler — always uses text format for readability
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(TextFormatter())
    console_handler.setLevel(getattr(logging, level.upper(), logging.INFO))
    root_logger.addHandler(console_handler)

    # File handler — uses configured format (JSON for production)
    file_handler = logging.handlers.RotatingFileHandler(
        filename=str(log_path / "scada.log"),
        maxBytes=max_file_size_mb * 1024 * 1024,
        backupCount=backup_count,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.DEBUG)  # File captures everything
    root_logger.addHandler(file_handler)

    # Error file handler — only ERROR and above
    error_handler = logging.handlers.RotatingFileHandler(
        filename=str(log_path / "scada_errors.log"),
        maxBytes=max_file_size_mb * 1024 * 1024,
        backupCount=backup_count,
        encoding="utf-8",
    )
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)
    root_logger.addHandler(error_handler)

    root_logger.info("Logging initialized — level=%s, format=%s", level, log_format)


def get_logger(name: str) -> logging.Logger:
    """
    Get a named logger under the 'scada' namespace.

    Usage:
        from utils.logger import get_logger
        logger = get_logger("ingestion")
        logger.info("Message received", extra={"machine_id": "MOTOR_1"})
    """
    return logging.getLogger(f"scada.{name}")
