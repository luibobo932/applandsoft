import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings


bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str, salt: str | None = None, iterations: int = 120_000) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    encoded = base64.b64encode(digest).decode("utf-8")
    return f"pbkdf2_sha256${iterations}${salt}${encoded}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, encoded = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        candidate = hash_password(password, salt=salt, iterations=int(iterations))
        return hmac.compare_digest(candidate, stored)
    except Exception:
        return False


def create_access_token(subject: str, extra: dict | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def require_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        return decode_token(credentials.credentials)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
