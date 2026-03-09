"""
AI SCADA Platform — Centralized Configuration Loader

Loads settings from configs/settings.yaml and allows environment variable overrides.
Environment variables take precedence over YAML values.
"""

import os
import yaml
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)

# Resolve project root (two levels up from configs/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_FILE = PROJECT_ROOT / "configs" / "settings.yaml"


def _load_yaml() -> dict:
    """Load the YAML configuration file."""
    if not CONFIG_FILE.exists():
        raise FileNotFoundError(f"Configuration file not found: {CONFIG_FILE}")
    with open(CONFIG_FILE, "r") as f:
        return yaml.safe_load(f)


def _env(key: str, default=None, cast=None):
    """Get an environment variable with optional type casting."""
    value = os.getenv(key, default)
    if value is None:
        return None
    if cast is not None and value is not default:
        return cast(value)
    return value


class InfluxDBConfig:
    def __init__(self, cfg: dict):
        self.url = _env("INFLUXDB_URL", cfg.get("url", "http://localhost:8086"))
        self.token = _env("INFLUX_TOKEN", cfg.get("token", ""))
        self.org = _env("INFLUXDB_ORG", cfg.get("org", "ELECSOL"))
        self.bucket = _env("INFLUXDB_BUCKET", cfg.get("bucket", "ELEC1"))
        self.timeout = int(cfg.get("timeout", 10000))


class MQTTConfig:
    def __init__(self, cfg: dict):
        self.broker = _env("MQTT_BROKER", cfg.get("broker", "localhost"))
        self.port = int(_env("MQTT_PORT", cfg.get("port", 1883)))
        self.topic = cfg.get("topic", "factory/sensors")
        self.client_id = cfg.get("client_id", "scada_ingestor")
        self.qos = int(cfg.get("qos", 1))
        self.reconnect_min_delay = int(cfg.get("reconnect_min_delay", 1))
        self.reconnect_max_delay = int(cfg.get("reconnect_max_delay", 60))
        self.username = _env("MQTT_USER")
        self.password = _env("MQTT_PASS")


class AlarmRule:
    def __init__(self, field: str, rule_cfg: dict):
        self.field = field
        self.high = rule_cfg.get("high")
        self.low = rule_cfg.get("low")
        self.severity = rule_cfg.get("severity", "HIGH")


class AlarmConfig:
    def __init__(self, cfg: dict):
        self.rules = {}
        rules_cfg = cfg.get("rules", {})
        for field, rule_data in rules_cfg.items():
            self.rules[field] = AlarmRule(field, rule_data)
        self.severity_order = cfg.get("severity_order", [
            "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"
        ])


class AuthConfig:
    def __init__(self, cfg: dict):
        self.secret_key = _env("AUTH_SECRET_KEY", cfg.get("secret_key", "change-me-in-production"))
        self.algorithm = cfg.get("algorithm", "HS256")
        self.token_expire_minutes = int(cfg.get("token_expire_minutes", 480))
        admin_cfg = cfg.get("default_admin", {})
        self.default_admin_user = admin_cfg.get("username", "admin")
        self.default_admin_password = _env("ADMIN_PASSWORD", "admin123")
        self.default_admin_role = admin_cfg.get("role", "ADMIN")


class SCADAConfig:
    def __init__(self, cfg: dict):
        self.host = cfg.get("host", "0.0.0.0")
        self.port = int(cfg.get("port", 8000))
        self.measurement = cfg.get("measurement", "machine_metrics")
        self.alarm_measurement = cfg.get("alarm_measurement", "alarms")


class SimulatorMachine:
    def __init__(self, machine_cfg: dict):
        self.id = machine_cfg["id"]
        self.temperature_range = machine_cfg.get("temperature_range", [60, 90])
        self.vibration_range = machine_cfg.get("vibration_range", [2, 8])
        self.pressure_range = machine_cfg.get("pressure_range", [30, 50])


class SimulatorConfig:
    def __init__(self, cfg: dict):
        self.machines = [SimulatorMachine(m) for m in cfg.get("machines", [])]
        self.interval_seconds = int(cfg.get("interval_seconds", 2))


class ModbusTag:
    def __init__(self, tag_cfg: dict):
        self.name = tag_cfg["name"]
        self.address = int(tag_cfg["address"])
        self.machine_id = tag_cfg["machine_id"]
        self.scaling = float(tag_cfg.get("scaling", 1.0))


class ModbusConfig:
    def __init__(self, cfg: dict):
        self.host = _env("MODBUS_HOST", cfg.get("host", "127.0.0.1"))
        self.port = int(_env("MODBUS_PORT", cfg.get("port", 502)))
        self.slave_id = int(cfg.get("slave_id", 1))
        self.interval_seconds = int(cfg.get("interval_seconds", 2))
        self.tags = [ModbusTag(t) for t in cfg.get("tags", [])]


class LoggingConfig:
    def __init__(self, cfg: dict):
        self.level = _env("LOG_LEVEL", cfg.get("level", "INFO"))
        self.log_dir = cfg.get("log_dir", "logs")
        self.max_file_size_mb = int(cfg.get("max_file_size_mb", 10))
        self.backup_count = int(cfg.get("backup_count", 5))
        self.format = cfg.get("format", "json")


class Config:
    """Singleton configuration object for the entire platform."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    def __init__(self):
        if self._loaded:
            return
        raw = _load_yaml()
        self.influxdb = InfluxDBConfig(raw.get("influxdb", {}))
        self.mqtt = MQTTConfig(raw.get("mqtt", {}))
        self.alarms = AlarmConfig(raw.get("alarms", {}))
        self.auth = AuthConfig(raw.get("auth", {}))
        self.scada = SCADAConfig(raw.get("scada", {}))
        self.simulator = SimulatorConfig(raw.get("simulator", {}))
        self.modbus = ModbusConfig(raw.get("modbus", {}))
        self.logging = LoggingConfig(raw.get("logging", {}))
        self.ai_engine = raw.get("ai_engine", {})
        self.project_root = PROJECT_ROOT
        self._loaded = True

    @classmethod
    def reload(cls):
        """Force reload configuration (useful for testing)."""
        cls._instance = None
        return cls()


# Convenience function
def get_config() -> Config:
    """Get the singleton Config instance."""
    return Config()
