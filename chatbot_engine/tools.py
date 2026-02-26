"""
AI SCADA Platform — Chatbot Tools

Functions that the AI Agent can call to interact with the SCADA system.
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from influxdb_client import InfluxDBClient
from configs.config_loader import get_config

config = get_config()

TAG_MACHINE_ID = "machine_id"   # The InfluxDB tag key for machine identifier

def get_influx_client():
    return InfluxDBClient(
        url=config.influxdb.url,
        token=config.influxdb.token,
        org=config.influxdb.org
    )

def query_latest_metrics(machine_id: Optional[str] = None) -> List[Dict]:
    """
    Fetches the most recent metrics for a specific machine or all machines.
    """
    client = get_influx_client()
    query_api = client.query_api()
    
    filter_expr = f'|> filter(fn: (r) => r["machine_id"] == "{machine_id}")' if machine_id else ""
    
    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => r["_measurement"] == "{config.scada.measurement}")
      {filter_expr}
      |> last()
    '''
    
    result = query_api.query(query)
    output = []
    
    for table in result:
        for record in table.records:
            output.append({
                "machine_id": record["machine_id"],
                "metric": record["_field"],
                "value": record.get_value(),
                "time": record.get_time().isoformat()
            })
            
    client.close()
    return output

def query_historical_stats(machine_id: str, metric: str, minutes: int = 30) -> Dict:
    """
    Calculates statistics (mean, max, min) for a metric over a time range.
    """
    client = get_influx_client()
    query_api = client.query_api()
    
    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: -{minutes}m)
      |> filter(fn: (r) => r["_measurement"] == "{config.scada.measurement}")
      |> filter(fn: (r) => r["machine_id"] == "{machine_id}")
      |> filter(fn: (r) => r["_field"] == "{metric}")
      |> yield(name: "raw")
    '''
    
    result = query_api.query(query)
    values = []
    for table in result:
        for record in table.records:
            values.append(record.get_value())
            
    client.close()
    
    if not values:
        return {"error": f"No data found for {machine_id} {metric} in the last {minutes} minutes"}
        
    return {
        "machine_id": machine_id,
        "metric": metric,
        "count": len(values),
        "avg": sum(values) / len(values),
        "max": max(values),
        "min": min(values),
        "range_minutes": minutes
    }

def get_active_alarms() -> List[Dict]:
    """
    Retrieves currently active alarms from the database.
    """
    client = get_influx_client()
    query_api = client.query_api()
    
    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r["_measurement"] == "{config.scada.alarm_measurement}")
      |> last()
    '''
    
    result = query_api.query(query)
    alarms = []
    
    for table in result:
        for record in table.records:
            alarms.append({
                "machine_id": record[TAG_MACHINE_ID],
                "severity": record["severity"],
                "message": record.get_value(),
                "time": record.get_time().isoformat()
            })
            
    client.close()
    return alarms


def query_time_series(machine_id: str, metric: str, minutes: int = 30) -> Dict:
    """
    Returns time-series data points for a specific metric on a machine,
    suitable for plotting charts. Returns a list of {time, value} dicts.
    Args:
        machine_id: The machine identifier (e.g. MOTOR_1)
        metric: The field name to chart (e.g. temperature, current)
        minutes: How many minutes of history to retrieve (default 30)
    """
    client = get_influx_client()
    query_api = client.query_api()

    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: -{minutes}m)
      |> filter(fn: (r) => r["_measurement"] == "{config.scada.measurement}")
      |> filter(fn: (r) => r["{TAG_MACHINE_ID}"] == "{machine_id}")
      |> filter(fn: (r) => r["_field"] == "{metric}")
      |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
    '''

    result = query_api.query(query)
    series = []
    for table in result:
        for record in table.records:
            series.append({
                "time": record.get_time().strftime("%H:%M"),
                "value": round(record.get_value(), 3) if record.get_value() is not None else None
            })

    client.close()

    if not series:
        return {"error": f"No time-series data for {machine_id}/{metric} in last {minutes} min"}

    values = [p["value"] for p in series if p["value"] is not None]
    return {
        "machine_id": machine_id,
        "metric": metric,
        "minutes": minutes,
        "series": series,
        "summary": {
            "avg": round(sum(values) / len(values), 3),
            "max": round(max(values), 3),
            "min": round(min(values), 3),
            "count": len(values)
        }
    }
