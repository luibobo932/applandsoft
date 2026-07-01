import json
import threading
from pathlib import Path
from typing import Any

_STATE_FILE = Path(__file__).resolve().parents[3] / "data" / "push_subscriptions.json"
_lock = threading.Lock()


def _load() -> dict[str, Any]:
    if not _STATE_FILE.exists():
        return {}
    try:
        return json.loads(_STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _save(data: dict[str, Any]) -> None:
    _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def upsert_subscription(expo_push_token: str, employee_ids: list[int]) -> None:
    with _lock:
        data = _load()
        existing = data.get(expo_push_token, {})
        data[expo_push_token] = {
            "employee_ids": employee_ids,
            # Giu lai last_notified_id cu de khong bao spam lai log da gui truoc do.
            "last_notified_id": existing.get("last_notified_id"),
        }
        _save(data)


def list_subscriptions() -> dict[str, Any]:
    with _lock:
        return _load()


def update_last_notified_id(expo_push_token: str, last_notified_id: int) -> None:
    with _lock:
        data = _load()
        if expo_push_token in data:
            data[expo_push_token]["last_notified_id"] = last_notified_id
            _save(data)


def remove_subscription(expo_push_token: str) -> None:
    with _lock:
        data = _load()
        if data.pop(expo_push_token, None) is not None:
            _save(data)
