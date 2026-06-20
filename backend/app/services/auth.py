from __future__ import annotations

import json
from pathlib import Path

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.repositories.gateway import AuthenticatedUser, get_gateway


def authenticate(username: str, password: str) -> tuple[str, AuthenticatedUser]:
    gateway = get_gateway()
    user = gateway.authenticate_landsoft_user(username, password)
    if user:
        token = create_access_token(
            subject=user.username,
            extra={
                "display_name": user.display_name,
                "auth_source": user.auth_source,
                "landsoft_username": user.landsoft_username,
                "landsoft_user_id": user.landsoft_user_id,
                "department_id": user.department_id,
                "role_name": user.role_name,
            },
        )
        return token, user

    local_user = authenticate_local_user(username, password)
    if local_user:
        token = create_access_token(
            subject=local_user.username,
            extra={
                "display_name": local_user.display_name,
                "auth_source": local_user.auth_source,
                "landsoft_username": local_user.landsoft_username,
                "landsoft_user_id": local_user.landsoft_user_id,
                "department_id": local_user.department_id,
                "role_name": local_user.role_name,
            },
        )
        return token, local_user

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sai tên đăng nhập hoặc mật khẩu")


def authenticate_local_user(username: str, password: str) -> AuthenticatedUser | None:
    settings = get_settings()
    path: Path = settings.local_users_path
    if not path.exists():
        return None
    users = json.loads(path.read_text(encoding="utf-8"))
    for item in users:
        if item.get("username") != username:
            continue
        if not verify_password(password, item.get("password_hash", "")):
            return None
        return AuthenticatedUser(
            username=item["username"],
            display_name=item.get("display_name", item["username"]),
            auth_source="local-app-user",
            landsoft_username=item.get("landsoft_username"),
            landsoft_user_id=item.get("landsoft_user_id"),
            department_id=item.get("department_id"),
            role_name=item.get("role_name"),
        )
    return None


def user_from_claims(claims: dict) -> AuthenticatedUser:
    return AuthenticatedUser(
        username=claims["sub"],
        display_name=claims.get("display_name", claims["sub"]),
        auth_source=claims.get("auth_source", "token"),
        landsoft_username=claims.get("landsoft_username"),
        landsoft_user_id=claims.get("landsoft_user_id"),
        department_id=claims.get("department_id"),
        role_name=claims.get("role_name"),
    )
