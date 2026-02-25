"""
AI SCADA Platform — JWT Authentication

Provides JWT-based authentication for the SCADA Core API.
Features:
    - Token generation and validation
    - Role-based access control (OPERATOR, ENGINEER, ADMIN)
    - FastAPI dependency injection for route protection
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt

from configs.config_loader import get_config
from utils.logger import get_logger

logger = get_logger("auth")
config = get_config()
security = HTTPBearer()


# ── Models ──────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str


class UserInfo(BaseModel):
    username: str
    role: str


# ── User Store (In-Memory for now) ─────────────────────────
# In production, replace with database-backed user store
USERS = {
    config.auth.default_admin_user: {
        "password": config.auth.default_admin_password,
        "role": config.auth.default_admin_role,
    },
    "operator": {
        "password": "operator123",
        "role": "OPERATOR",
    },
    "engineer": {
        "password": "engineer123",
        "role": "ENGINEER",
    },
}


# ── Token Functions ─────────────────────────────────────────

def create_token(username: str, role: str) -> str:
    """Generate a JWT token for the authenticated user."""
    payload = {
        "sub": username,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=config.auth.token_expire_minutes),
    }
    token = jwt.encode(payload, config.auth.secret_key, algorithm=config.auth.algorithm)
    logger.info(f"Token created for user: {username} (role: {role})")
    return token


def verify_token(token: str) -> dict:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, config.auth.secret_key, algorithms=[config.auth.algorithm])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Validate username/password against user store."""
    user = USERS.get(username)
    if user and user["password"] == password:
        return {"username": username, "role": user["role"]}
    return None


# ── FastAPI Dependencies ────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserInfo:
    """FastAPI dependency that extracts and validates the current user from JWT."""
    payload = verify_token(credentials.credentials)
    return UserInfo(username=payload["sub"], role=payload["role"])


def require_role(*allowed_roles: str):
    """
    FastAPI dependency factory for role-based access control.

    Usage:
        @app.get("/admin-only", dependencies=[Depends(require_role("ADMIN"))])
    """
    async def role_checker(user: UserInfo = Depends(get_current_user)):
        if user.role not in allowed_roles:
            logger.warning(
                f"Access denied for {user.username} (role: {user.role}). "
                f"Required: {allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_roles)}",
            )
        return user
    return role_checker
