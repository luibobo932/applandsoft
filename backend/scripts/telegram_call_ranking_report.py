"""
Bao cao Telegram 2 lan/ngay (8h sang & 8h toi): xep hang cac can nha duoc goi
NHIEU NHAT trong 24 gio truoc gio bao cao, kem so luot goi.

Lay du lieu qua API backend (Render da duoc phep truy cap SQL Landsoft) -> chay
duoc tu bat ky dau (GitHub Actions, laptop) ma khong can driver SQL / mo firewall.

Uu tien endpoint /reports/call-ranking (gom nhom san o SQL). Neu backend chua co
endpoint do (chua deploy), tu dong quay ve /call-logs roi gom nhom tai cho.

QUAN TRONG ve mui gio: API tra `called_at` theo gio Viet Nam (gio SQL server),
trong khi GitHub Actions chay theo UTC -> luon quy doi sang gio VN truoc khi so.

Bien moi truong:
  API_BASE_URL, REPORT_LOGIN_USER, REPORT_LOGIN_PASSWORD,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

Chay: python telegram_call_ranking_report.py [--top 15] [--hours 24] [--dry-run]
"""
from __future__ import annotations

import argparse
import html
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DEFAULT_API_BASE = "https://landsoft-mobile-api.onrender.com/api/v1"
MAX_TELEGRAM_MESSAGE = 3900
VN_TZ = timezone(timedelta(hours=7))
CALL_LOGS_MAX_LIMIT = 500


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def now_vn() -> datetime:
    """Gio Viet Nam dang naive, de so truc tiep voi called_at tu API."""
    return datetime.now(timezone.utc).astimezone(VN_TZ).replace(tzinfo=None)


def fmt_num(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return f"{value:.2f}".rstrip("0").rstrip(".")
    return str(value).strip()


def api_base() -> str:
    return (os.getenv("API_BASE_URL") or DEFAULT_API_BASE).rstrip("/")


def _request_json(url: str, headers: dict | None = None, body: dict | None = None, timeout: int = 90) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    if data:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def login() -> str:
    user = os.getenv("REPORT_LOGIN_USER", "SKL-473")
    password = os.getenv("REPORT_LOGIN_PASSWORD", "1")
    # Render free co the "ngu" -> timeout dai de danh thuc dich vu.
    res = _request_json(f"{api_base()}/auth/login", body={"username": user, "password": password}, timeout=120)
    return res["access_token"]


def _aggregate_from_call_logs(token: str, top: int, hours: int) -> dict:
    """Fallback: lay log tho roi gom nhom theo can tai cho."""
    end_vn = now_vn()
    start_vn = end_vn - timedelta(hours=hours)
    q = urllib.parse.urlencode(
        {
            "from_date": start_vn.date().isoformat(),
            "to_date": end_vn.date().isoformat(),
            "limit": CALL_LOGS_MAX_LIMIT,
        }
    )
    raw = _request_json(f"{api_base()}/call-logs?{q}", {"Authorization": f"Bearer {token}"})
    items = raw.get("items", [])
    if raw.get("total", 0) > CALL_LOGS_MAX_LIMIT:
        # API tra ve log MOI NHAT truoc, nen 500 ban ghi dau van phu het cua so gio yeu cau.
        print(f"[canh bao] Khoang ngay co {raw['total']} log, chi lay {CALL_LOGS_MAX_LIMIT} log moi nhat.")

    groups: dict[Any, dict] = {}
    staff: dict[Any, set] = defaultdict(set)
    for it in items:
        called_at = datetime.fromisoformat(str(it["called_at"]))
        if called_at < start_vn:  # loc chinh xac dung cua so N gio
            continue
        key = it.get("landsoft_id")
        g = groups.get(key)
        if g is None:
            g = {
                "landsoft_id": key,
                "call_count": 0,
                "last_call_at": called_at,
                "house_number": it.get("house_number"),
                "street_name": it.get("street_name"),
                "district_name": it.get("district_name"),
                "width": it.get("width"),
                "length": it.get("length"),
                "price": it.get("price"),
                "owner_phone": it.get("owner_phone"),
            }
            groups[key] = g
        g["call_count"] += 1
        g["last_call_at"] = max(g["last_call_at"], called_at)
        staff[key].add(it.get("employee_id"))

    for key, g in groups.items():
        g["staff_count"] = len(staff[key])
    ranked = sorted(groups.values(), key=lambda g: (-g["call_count"], -g["last_call_at"].timestamp()))
    total_calls = sum(g["call_count"] for g in groups.values())
    return {
        "items": ranked[:top],
        "total_calls": total_calls,
        "total_houses": len(groups),
        "hours": hours,
    }


def fetch_ranking(top: int, hours: int) -> dict:
    token = login()
    q = urllib.parse.urlencode({"hours": hours, "top": top})
    try:
        return _request_json(f"{api_base()}/reports/call-ranking?{q}", {"Authorization": f"Bearer {token}"})
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
        print("[info] Backend chua co /reports/call-ranking -> gom nhom tu /call-logs.")
        return _aggregate_from_call_logs(token, top, hours)


def build_message(data: dict, hours: int) -> str:
    now = now_vn()
    phien = "sáng" if now.hour < 12 else "tối"
    rows = data.get("items", [])
    header = (
        f"📊 <b>BÁO CÁO CĂN ĐƯỢC GỌI NHIỀU NHẤT</b>\n"
        f"🕗 Phiên {phien} · {html.escape(now.strftime('%H:%M %d/%m/%Y'))}\n"
        f"⏱ Trong {hours} giờ qua: <b>{fmt_num(data.get('total_calls'))}</b> lượt gọi · "
        f"<b>{fmt_num(data.get('total_houses'))}</b> căn\n"
        f"━━━━━━━━━━━━━━━"
    )
    if not rows:
        return header + "\n\nChưa có lượt gọi nào trong khoảng thời gian này."

    medals = {1: "🥇", 2: "🥈", 3: "🥉"}
    lines = [header]
    for i, r in enumerate(rows, start=1):
        rank = medals.get(i, f"<b>{i}.</b>")
        addr = " ".join(p for p in [fmt_num(r.get("house_number")), fmt_num(r.get("street_name"))] if p) or "(chưa rõ địa chỉ)"
        quan = fmt_num(r.get("district_name"))
        ngang, dai = fmt_num(r.get("width")), fmt_num(r.get("length"))
        size = f" · {ngang}x{dai}m" if ngang and dai else ""
        gia = fmt_num(r.get("price"))
        gia_txt = f" · {gia} tỷ" if gia else ""
        sdt = fmt_num(r.get("owner_phone"))
        sdt_txt = f"\n     ☎️ {html.escape(sdt)}" if sdt else ""
        lines.append(
            f"\n{rank} <b>{html.escape(addr)}</b>"
            f"\n     🔥 <b>{fmt_num(r.get('call_count'))} lượt gọi</b> · {fmt_num(r.get('staff_count'))} NV"
            f" · {html.escape(quan)}{size}{gia_txt}{sdt_txt}"
        )
    msg = "".join(lines)
    if len(msg) > MAX_TELEGRAM_MESSAGE:
        msg = msg[:MAX_TELEGRAM_MESSAGE] + "\n…"
    return msg


def send_telegram(message: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print(message)
        print("\n[DRY RUN] Thieu TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID -> chua gui.")
        return
    data = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": message, "parse_mode": "HTML", "disable_web_page_preview": "true"}
    ).encode("utf-8")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    req = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if not payload.get("ok"):
        raise RuntimeError(f"Telegram gui that bai: {payload}")
    print("Da gui Telegram OK.")


def main() -> int:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    ap = argparse.ArgumentParser(description="Bao cao Telegram top can duoc goi nhieu nhat 24h.")
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--hours", type=int, default=24)
    ap.add_argument("--dry-run", action="store_true", help="In ra man hinh, khong gui Telegram.")
    args = ap.parse_args()

    data = fetch_ranking(args.top, args.hours)
    message = build_message(data, args.hours)
    if args.dry_run:
        print(message)
        return 0
    send_telegram(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
