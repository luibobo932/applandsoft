import asyncio
import logging
from datetime import date, datetime, time

import httpx

from app.repositories.gateway import get_gateway
from app.repositories.push_store import list_subscriptions, update_last_notified_id

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
POLL_INTERVAL_SECONDS = 25


def _summarize(item: dict) -> str:
    address = " ".join(part for part in [item.get("house_number"), item.get("street_name")] if part).strip()
    district = item.get("district_name") or ""
    address_part = ", ".join(part for part in [address, district] if part)
    name = item.get("employee_name") or ""
    return f"{name} vừa gọi {address_part or 'một căn'}".strip()


async def _check_subscription(client: httpx.AsyncClient, token: str, sub: dict) -> None:
    employee_ids = sub.get("employee_ids") or []
    if not employee_ids:
        return
    today = date.today()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)
    after_id = sub.get("last_notified_id")

    try:
        result = await asyncio.to_thread(
            get_gateway().list_call_logs,
            employee_ids,
            start,
            end,
            after_id,
            50,
        )
    except Exception:
        logger.exception("Khong the truy van call logs cho push token %s", token[:16])
        return

    items = result.get("items") or []
    if not items:
        return

    latest_id = result.get("latest_id") or max(item["log_id"] for item in items)
    newest = items[0]
    title = "Có nhân viên vừa gọi SĐT" if len(items) == 1 else f"{len(items)} lượt gọi SĐT mới"
    body = _summarize(newest)

    message = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "priority": "high",
        "channelId": "call-logs",
        "data": {"type": "call_logs", "latest_id": latest_id},
    }
    try:
        response = await client.post(EXPO_PUSH_URL, json=[message], timeout=15)
        response.raise_for_status()
        payload = response.json()
        ticket = (payload.get("data") or [{}])[0]
        if ticket.get("status") == "error" and ticket.get("details", {}).get("error") == "DeviceNotRegistered":
            from app.repositories.push_store import remove_subscription

            remove_subscription(token)
            return
    except Exception:
        logger.exception("Gui push that bai cho token %s", token[:16])
        return

    update_last_notified_id(token, latest_id)


async def poll_and_notify_once() -> None:
    subscriptions = list_subscriptions()
    if not subscriptions:
        return
    async with httpx.AsyncClient() as client:
        await asyncio.gather(
            *(_check_subscription(client, token, sub) for token, sub in subscriptions.items())
        )


async def run_push_notifier_loop() -> None:
    while True:
        try:
            await poll_and_notify_once()
        except Exception:
            logger.exception("Loi vong lap push notifier")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
