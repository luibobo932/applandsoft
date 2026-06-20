from __future__ import annotations

import json
from datetime import UTC, datetime

from app.core.config import get_settings
from app.repositories.gateway import AuthenticatedUser


def log_action(actor: AuthenticatedUser, action: str, target_type: str, payload: dict, result: dict | None = None) -> None:
    settings = get_settings()
    entry = {
        "server_time": datetime.now(UTC).isoformat(),
        "actor_username": actor.username,
        "actor_display_name": actor.display_name,
        "landsoft_username": actor.landsoft_username,
        "landsoft_user_id": actor.landsoft_user_id,
        "action": action,
        "target_type": target_type,
        "payload": payload,
        "result": result or {},
    }
    with settings.audit_log_file.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_recent_activity(username: str, limit: int = 20) -> list[dict]:
    settings = get_settings()
    if not settings.audit_log_file.exists():
        return []
    lines = settings.audit_log_file.read_text(encoding="utf-8").splitlines()
    items = []
    for line in reversed(lines):
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if payload.get("actor_username") != username:
            continue
        items.append(
            {
                "action": payload.get("action"),
                "target_type": payload.get("target_type"),
                "target_id": (payload.get("result") or {}).get("landsoft_id"),
                "message": (payload.get("result") or {}).get("message") or payload.get("action"),
                "server_time": payload.get("server_time"),
            }
        )
        if len(items) >= limit:
            break
    return items
