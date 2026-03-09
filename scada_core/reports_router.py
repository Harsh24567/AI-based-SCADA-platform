"""
AI SCADA Platform — Reports API Router

Serves generated PDF shift reports for download.
"""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "reports")


@router.get("/download/{filename}")
async def download_report(filename: str):
    """Serve a generated PDF report as a file download."""
    # Sanitize filename to prevent path traversal
    safe_name = os.path.basename(filename)
    if not safe_name.endswith(".pdf") or ".." in safe_name:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    filepath = os.path.join(REPORTS_DIR, safe_name)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"Report '{safe_name}' not found.")

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get("/list")
async def list_reports():
    """List all available generated reports."""
    if not os.path.exists(REPORTS_DIR):
        return {"reports": []}

    files = sorted(
        [f for f in os.listdir(REPORTS_DIR) if f.endswith(".pdf")],
        reverse=True,
    )
    return {
        "reports": [
            {"filename": f, "download_url": f"/api/reports/download/{f}"}
            for f in files
        ]
    }
