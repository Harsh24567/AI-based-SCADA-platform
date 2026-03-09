"""
AI SCADA Platform — PDF Shift Report Generator

Generates a professional multi-page PDF shift report using ReportLab.
Called by the AI Agent as a tool. The report is saved to disk and
served via the /api/reports/latest FastAPI endpoint.
"""

import os
import io
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

from influxdb_client import InfluxDBClient
from configs.config_loader import get_config

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.platypus.flowables import KeepTogether
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Matplotlib for embedded charts
import matplotlib
matplotlib.use("Agg")  # non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from reportlab.platypus import Image as RLImage
import tempfile

config = get_config()
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

# ── colour palette ────────────────────────────────────────────────────────────
DARK_BLUE  = colors.HexColor("#1E3A5F")
MID_BLUE   = colors.HexColor("#2F6FAD")
ACCENT     = colors.HexColor("#00C6AE")
LIGHT_GREY = colors.HexColor("#F0F4F8")
RED        = colors.HexColor("#E53E3E")


def _get_influx_client():
    return InfluxDBClient(
        url=config.influxdb.url,
        token=config.influxdb.token,
        org=config.influxdb.org,
    )


def _fetch_all_metrics(hours: int) -> list[dict]:
    """Fetch raw metric records for the past N hours."""
    client = _get_influx_client()
    query_api = client.query_api()
    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: -{hours}h)
      |> filter(fn: (r) => r["_measurement"] == "{config.scada.measurement}")
      |> sort(columns: ["_time"], desc: false)
    '''
    result = query_api.query(query)
    records = []
    for table in result:
        for rec in table.records:
            records.append({
                "machine_id": rec.values.get("machine_id", "UNKNOWN"),
                "metric": rec.get_field(),
                "value": rec.get_value(),
                "time": rec.get_time(),
            })
    client.close()
    return records


def _fetch_alarms(hours: int) -> list[dict]:
    """Fetch alarm events for the past N hours."""
    client = _get_influx_client()
    query_api = client.query_api()
    query = f'''
    from(bucket: "{config.influxdb.bucket}")
      |> range(start: -{hours}h)
      |> filter(fn: (r) => r["_measurement"] == "{config.scada.alarm_measurement}")
      |> sort(columns: ["_time"], desc: false)
    '''
    result = query_api.query(query)
    alarms = []
    for table in result:
        for rec in table.records:
            alarms.append({
                "machine_id": rec.values.get("machine_id", "UNKNOWN"),
                "severity": rec.values.get("severity", "INFO"),
                "message": rec.get_value(),
                "time": rec.get_time(),
            })
    client.close()
    return alarms


def _build_machine_summary(records: list[dict]) -> list[dict]:
    """Aggregate per-machine average/max/min for each metric."""
    from collections import defaultdict
    data = defaultdict(lambda: defaultdict(list))

    for r in records:
        if r["value"] is not None:
            data[r["machine_id"]][r["metric"]].append(float(r["value"]))

    summary = []
    for machine_id, metrics in sorted(data.items()):
        row = {"machine_id": machine_id}
        for metric, vals in metrics.items():
            row[f"{metric}_avg"] = round(sum(vals) / len(vals), 2)
            row[f"{metric}_max"] = round(max(vals), 2)
            row[f"{metric}_min"] = round(min(vals), 2)
        summary.append(row)
    return summary


def _make_trend_chart(records: list[dict], machine_id: str, metric: str) -> Optional[str]:
    """Generate a trend PNG for a given machine metric. Returns temp file path."""
    pts = [r for r in records if r["machine_id"] == machine_id and r["metric"] == metric]
    if len(pts) < 2:
        return None

    times = [p["time"] for p in pts]
    values = [p["value"] for p in pts]

    fig, ax = plt.subplots(figsize=(6, 1.8))
    ax.plot(times, values, linewidth=1.2, color="#2F6FAD")
    ax.fill_between(times, values, alpha=0.15, color="#2F6FAD")
    ax.set_title(f"{machine_id} — {metric}", fontsize=8, pad=3)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%H:%M"))
    ax.tick_params(labelsize=6)
    ax.grid(True, linestyle="--", alpha=0.4)
    fig.tight_layout(pad=0.5)

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    fig.savefig(tmp.name, dpi=120)
    plt.close(fig)
    return tmp.name


def _severity_color(severity: str) -> colors.Color:
    mapping = {
        "CRITICAL": colors.HexColor("#E53E3E"),
        "HIGH":     colors.HexColor("#DD6B20"),
        "MEDIUM":   colors.HexColor("#D69E2E"),
        "LOW":      colors.HexColor("#38A169"),
        "INFO":     colors.HexColor("#3182CE"),
    }
    return mapping.get(severity.upper(), colors.black)


def generate_shift_report(shift_hours: int = 8) -> Dict:
    """
    Generates a professional PDF shift report for the last N hours.

    Args:
        shift_hours: Number of hours to cover in the report (default: 8 for one shift).

    Returns:
        A dict with the report file path and a summary message.
    """
    now_utc = datetime.now(timezone.utc)
    shift_start = now_utc - timedelta(hours=shift_hours)

    records = _fetch_all_metrics(shift_hours)
    alarms  = _fetch_alarms(shift_hours)
    machine_summary = _build_machine_summary(records)

    # ── output file ──────────────────────────────────────────────────────────
    filename = f"shift_report_{now_utc.strftime('%Y%m%d_%H%M')}.pdf"
    filepath = os.path.join(REPORTS_DIR, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=18*mm, leftMargin=18*mm,
        topMargin=18*mm,   bottomMargin=18*mm,
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"],
                         fontSize=18, textColor=DARK_BLUE, spaceAfter=4)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"],
                         fontSize=12, textColor=MID_BLUE, spaceBefore=8, spaceAfter=4)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9, spaceAfter=2)
    caption = ParagraphStyle("Caption", parent=styles["Normal"],
                              fontSize=7, textColor=colors.grey, alignment=TA_CENTER)

    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20*mm))
    story.append(Paragraph("ELECSOL SCADA", h1))
    story.append(Paragraph("Shift Performance Report", ParagraphStyle(
        "Sub", parent=styles["Normal"], fontSize=14, textColor=MID_BLUE, spaceAfter=6)))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceAfter=8))
    story.append(Paragraph(f"Shift Start:  {shift_start.strftime('%d %b %Y  %H:%M UTC')}", body))
    story.append(Paragraph(f"Shift End:    {now_utc.strftime('%d %b %Y  %H:%M UTC')}", body))
    story.append(Paragraph(f"Duration:     {shift_hours} hours", body))
    story.append(Paragraph(f"Generated:    {now_utc.strftime('%d %b %Y  %H:%M UTC')}", body))
    story.append(Paragraph(f"Systems:      {len(machine_summary)} machine(s) monitored", body))
    story.append(Paragraph(f"Alarm Events: {len(alarms)} event(s)", body))
    story.append(PageBreak())

    # ── Machine Summary Table ─────────────────────────────────────────────────
    story.append(Paragraph("Machine Performance Summary", h2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GREY, spaceAfter=6))

    if machine_summary:
        table_data = [["Machine", "Temp Avg", "Temp Max", "Press Avg", "Press Max", "Vib Avg", "Vib Max"]]
        for row in machine_summary:
            table_data.append([
                row["machine_id"],
                f"{row.get('temperature_avg', '—')}",
                f"{row.get('temperature_max', '—')}",
                f"{row.get('pressure_avg', '—')}",
                f"{row.get('pressure_max', '—')}",
                f"{row.get('vibration_avg', '—')}",
                f"{row.get('vibration_max', '—')}",
            ])

        tbl = Table(table_data, colWidths=[40*mm, 22*mm, 22*mm, 22*mm, 22*mm, 22*mm, 22*mm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0), DARK_BLUE),
            ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
            ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",    (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
            ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E0")),
            ("ALIGN",       (1, 0), (-1, -1), "CENTER"),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",  (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(tbl)
    else:
        story.append(Paragraph("No machine data available for this shift.", body))

    story.append(Spacer(1, 8*mm))

    # ── Trend Charts ─────────────────────────────────────────────────────────
    story.append(Paragraph("Sensor Trend Charts", h2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GREY, spaceAfter=6))

    tracked_metrics = ["temperature", "pressure", "vibration"]
    chart_files = []

    for summ in machine_summary:
        mid = summ["machine_id"]
        for metric in tracked_metrics:
            chart_path = _make_trend_chart(records, mid, metric)
            if chart_path:
                chart_files.append(chart_path)
                img = RLImage(chart_path, width=155*mm, height=42*mm)
                story.append(KeepTogether([
                    img,
                    Paragraph(f"{mid} — {metric.capitalize()} trend over {shift_hours}h", caption),
                    Spacer(1, 4*mm),
                ]))

    if not chart_files:
        story.append(Paragraph("No trend data available.", body))

    story.append(PageBreak())

    # ── Alarm Log ────────────────────────────────────────────────────────────
    story.append(Paragraph("Alarm Event Log", h2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GREY, spaceAfter=6))

    if alarms:
        alarm_data = [["Time (UTC)", "Machine", "Severity", "Message"]]
        for a in alarms[-50:]:  # cap at 50 most recent
            alarm_data.append([
                a["time"].strftime("%H:%M:%S") if a["time"] else "—",
                a["machine_id"],
                a["severity"],
                a["message"][:60] if a["message"] else "—",
            ])

        sev_styles = []
        for i, a in enumerate(alarms[-50:], start=1):
            c = _severity_color(a["severity"])
            sev_styles.extend([
                ("TEXTCOLOR", (2, i), (2, i), c),
                ("FONTNAME",  (2, i), (2, i), "Helvetica-Bold"),
            ])

        alarm_tbl = Table(alarm_data, colWidths=[28*mm, 35*mm, 25*mm, 87*mm])
        alarm_tbl.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, 0), DARK_BLUE),
            ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
            ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",    (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GREY]),
            ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E0")),
            ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",  (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            *sev_styles,
        ]))
        story.append(alarm_tbl)
    else:
        story.append(Paragraph("✓ No alarms were triggered during this shift.", body))

    # ── Footer note ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GREY))
    story.append(Paragraph(
        f"Report generated automatically by ELECSOL SCADA AI Co-Pilot · {now_utc.strftime('%d %b %Y %H:%M')} UTC",
        caption,
    ))

    doc.build(story)

    # Cleanup temp chart files
    for f in chart_files:
        try:
            os.unlink(f)
        except Exception:
            pass

    return {
        "status": "SUCCESS",
        "filename": filename,
        "filepath": filepath,
        "download_url": f"/api/reports/download/{filename}",
        "shift_hours": shift_hours,
        "machines_included": len(machine_summary),
        "alarms_included": len(alarms),
        "message": f"Shift report generated successfully. Covers the last {shift_hours} hours. Use the download link to get your PDF.",
    }
