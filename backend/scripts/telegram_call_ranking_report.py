"""
Bao cao Telegram 2 lan/ngay (8h sang & 8h toi): xep hang cac can nha duoc goi
NHIEU NHAT trong 24 gio truoc gio bao cao, kem so luot goi.

Lay du lieu qua API backend (Render da duoc phep truy cap SQL Landsoft) — nen chay
duoc tu bat ky dau (GitHub Actions, laptop) ma khong can driver SQL hay mo firewall.

Bien moi truong:
  API_BASE_URL            (mac dinh production Render)
  REPORT_LOGIN_USER       (mac dinh SKL-473)
  REPORT_LOGIN_PASSWORD   (mac dinh 1)
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

Chay: python telegram_call_ranking_report.py [--top 15] [--hours 24] [--dry-run]
"""
from __future__ import annotations

import argparse
import html
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

DEFAULT_API_BASE = "https://landsoft-mobile-api.onrender.com/api/v1"
MAX_TELEGRAM_MESSAGE = 3900


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


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


def _post_json(url: str, body: dict, headers: dict | None = None, timeout: int = 60) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_json(url: str, headers: dict | None = None, timeout: int = 60) -> dict:
    req = urllib.request.Request(url, method="GET")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_ranking(top: int, hours: int) -> dict:
    user = os.getenv("REPORT_LOGIN_USER", "SKL-473")
    password = os.getenv("REPORT_LOGIN_PASSWORD", "1")
    # Render free co the "ngu" -> lan login dau timeout dai de danh thuc.
    login = _post_json(f"{api_base()}/auth/login", {"username": user, "password": password}, timeout=90)
    token = login["access_token"]
    q = urllib.parse.urlencode({"hours": hours, "top": top})
    return _get_json(f"{api_base()}/reports/call-ranking?{q}", {"Authorization": f"Bearer {token}"}, timeout=90)


def build_message(data: dict, hours: int) -> str:
    now = datetime.now()
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
