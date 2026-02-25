"""
AI SCADA Platform — Chatbot Tools

Functions that the AI Agent can call to interact with the SCADA system.
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from influxdb_client import InfluxDBClient
from configs.config_loader import get_config

config = get_config()

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
                "machine_id": record["machine_id"],
                "severity": record["severity"],
                "message": record.get_value(),
                "time": record.get_time().isoformat()
            })
            
    client.close()
    return alarms
