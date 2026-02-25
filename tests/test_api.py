"""
AI SCADA Platform — API Tests

Tests for SCADA Core API endpoints including authentication,
data endpoints, alarm lifecycle, and health checks.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from scada_core.main import app


client = TestClient(app)


# ── Helper ──────────────────────────────────────────────────

def get_auth_token(username="admin", password="admin123") -> str:
    """Login and return JWT token."""
    response = client.post("/auth/login", json={
        "username": username,
        "password": password,
    })
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_header(token: str = None) -> dict:
    """Build authorization header."""
    if token is None:
        token = get_auth_token()
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════════
#  HEALTH CHECK TESTS
# ══════════════════════════════════════════════════════════

class TestHealthCheck:
    def test_health_returns_200(self):
        """Health endpoint should always be accessible (no auth)."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "services" in data
        assert "uptime_seconds" in data

    def test_health_shows_influxdb_status(self):
        """Health should report InfluxDB connection status."""
        response = client.get("/health")
        data = response.json()
        assert "influxdb" in data["services"]


# ══════════════════════════════════════════════════════════
#  AUTHENTICATION TESTS
# ══════════════════════════════════════════════════════════

class TestAuthentication:
    def test_login_success(self):
        """Valid credentials should return a JWT token."""
        response = client.post("/auth/login", json={
            "username": "admin",
            "password": "admin123",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "ADMIN"

    def test_login_failure(self):
        """Invalid credentials should return 401."""
        response = client.post("/auth/login", json={
            "username": "admin",
            "password": "wrongpassword",
        })
        assert response.status_code == 401

    def test_login_operator(self):
        """Operator login should return OPERATOR role."""
        response = client.post("/auth/login", json={
            "username": "operator",
            "password": "operator123",
        })
        assert response.status_code == 200
        assert response.json()["role"] == "OPERATOR"

    def test_protected_endpoint_without_token(self):
        """Accessing protected endpoint without token should be rejected."""
        response = client.get("/latest")
        # FastAPI's HTTPBearer returns 403 when no credentials provided
        assert response.status_code in [401, 403]

    def test_protected_endpoint_with_token(self):
        """Accessing protected endpoint with valid token should work."""
        response = client.get("/latest", headers=auth_header())
        # May return 200 or 503 depending on InfluxDB availability
        assert response.status_code in [200, 503]


# ══════════════════════════════════════════════════════════
#  ALARM ENDPOINT TESTS
# ══════════════════════════════════════════════════════════

class TestAlarms:
    def test_get_alarms(self):
        """Should return alarm list."""
        headers = auth_header()
        response = client.get("/alarms", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "active_alarms" in data
        assert "total_count" in data

    def test_get_alarm_history(self):
        """Should return alarm history."""
        headers = auth_header()
        response = client.get("/alarms/history", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "history" in data

    def test_clear_all_requires_admin(self):
        """Only ADMIN role should be able to clear all alarms."""
        # Operator should be forbidden
        op_token = get_auth_token("operator", "operator123")
        response = client.post("/alarms/clear-all", headers=auth_header(op_token))
        assert response.status_code == 403

        # Admin should succeed
        admin_token = get_auth_token("admin", "admin123")
        response = client.post("/alarms/clear-all", headers=auth_header(admin_token))
        assert response.status_code == 200


# ══════════════════════════════════════════════════════════
#  METRICS ENDPOINT TESTS
# ══════════════════════════════════════════════════════════

class TestMetrics:
    def test_metrics_returns_data(self):
        """Metrics endpoint should return system metrics."""
        headers = auth_header()
        response = client.get("/metrics", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "uptime_seconds" in data
        assert "api" in data
        assert "alarms" in data
