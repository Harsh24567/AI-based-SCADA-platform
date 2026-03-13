from influxdb_client import InfluxDBClient
import os

NEW_TOKEN = "tXO3SkSduNRLWvA0gqOFbfBC67ixEfL5vBzFUdwXimvYc8i65DwP9zxlKkhV95S4n80Fq8fKyBWcL8mm1WBX9Q=="
c = InfluxDBClient(url="http://localhost:8086", token=NEW_TOKEN, org="ELECSOL")
q = c.query_api()

result = q.query(
    'from(bucket:"ELEC1") |> range(start: -5m) |> filter(fn: (r) => r["_measurement"] == "machine_metrics") |> last()'
)

rows = [r for t in result for r in t.records]
if rows:
    for r in rows:
        print(f"  {r.values.get('machine_id')}  {r.get_field()}={r.get_value()}  @ {r.get_time()}")
else:
    print("NO DATA in last 5 minutes.")

c.close()
