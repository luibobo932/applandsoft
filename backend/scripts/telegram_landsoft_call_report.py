from __future__ import annotations

import argparse
import html
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, time as dt_time
from pathlib import Path
from typing import Any

import pyodbc

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.core.config import get_settings  # noqa: E402


# Dung MaNV de khong bi lech dau tieng Viet hoac trung ten.
WATCHED_EMPLOYEES = {
    46: "Hồ Chí Cường",
    361: "Cao Rin",
    71: "Hồ Chí Công",
    120: "Nguyễn Hửu Lợi",
    426: "Nguyễn Viết Ca",
}

STATE_FILE = ROOT_DIR / "data" / "telegram_landsoft_call_report_state.json"
MAX_TELEGRAM_MESSAGE = 3900


@dataclass(frozen=True)
class CallEvent:
    log_id: int
    viewed_at: datetime
    staff_code: str
    staff_name: str
    house_no: str
    street: str
    district: str
    width: str
    length: str
    price_billion: str
    owner_phone: str


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def load_state() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return {"sent_ids_by_day": {}}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"sent_ids_by_day": {}}


def save_state(state: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def fmt_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return f"{value:.4f}".rstrip("0").rstrip(".")
    return str(value).strip()


def today_range(now: datetime | None = None) -> tuple[datetime, datetime, str]:
    now = now or datetime.now()
    start = datetime.combine(now.date(), dt_time.min)
    end = datetime.combine(now.date(), dt_time.max)
    day_key = now.strftime("%Y-%m-%d")
    return start, end, day_key


def fetch_today_events(sent_ids: set[int]) -> list[CallEvent]:
    settings = get_settings()
    start, end, _ = today_range()
    placeholders = ",".join("?" for _ in WATCHED_EMPLOYEES)
    params: list[Any] = [start, end, *WATCHED_EMPLOYEES.keys()]

    sql = f"""
    SELECT
        x.ID,
        x.NgayXem,
        nv.MaSo,
        nv.HoTen,
        bc.SoNha,
        s.Names AS TenDuong,
        h.TenHuyen AS Quan,
        CAST(COALESCE(NULLIF(bc.NgangKV, 0), NULLIF(bc.NgangXD, 0)) AS float) AS ChieuNgang,
        CAST(COALESCE(NULLIF(bc.DaiKV, 0), NULLIF(bc.DaiXD, 0)) AS float) AS ChieuDai,
        CAST(bc.ThanhTien / 1000000000.0 AS float) AS GiaBanTy,
        COALESCE(
            NULLIF(LTRIM(RTRIM(bc.DienThoaiNDD)), ''),
            NULLIF(LTRIM(RTRIM(kh.DiDong)), ''),
            NULLIF(LTRIM(RTRIM(kh.DiDong2)), ''),
            NULLIF(LTRIM(RTRIM(kh.DienThoaiCT)), '')
        ) AS SDTChu
    FROM dbo.mglNhanVienXem x
    JOIN dbo.NhanVien nv ON nv.MaNV = x.MaNV
    JOIN dbo.mglbcBanChoThue bc ON bc.MaBC = x.KeyID
    LEFT JOIN dbo.KhachHang kh ON kh.MaKH = bc.MaKH
    LEFT JOIN dbo.Street s ON s.ID = bc.StreetID
    LEFT JOIN dbo.Huyen h ON h.MaHuyen = bc.MaHuyen
    WHERE x.LoaiDV = 1
      AND x.NgayXem >= ?
      AND x.NgayXem <= ?
      AND x.MaNV IN ({placeholders})
    ORDER BY x.NgayXem ASC, x.ID ASC;
    """

    events: list[CallEvent] = []
    with pyodbc.connect(settings.sql_connection_string, timeout=15) as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        for row in cursor.fetchall():
            log_id = int(row.ID)
            if log_id in sent_ids:
                continue
            events.append(
                CallEvent(
                    log_id=log_id,
                    viewed_at=row.NgayXem,
                    staff_code=fmt_text(row.MaSo),
                    staff_name=fmt_text(row.HoTen),
                    house_no=fmt_text(row.SoNha),
                    street=fmt_text(row.TenDuong),
                    district=fmt_text(row.Quan),
                    width=fmt_text(row.ChieuNgang),
                    length=fmt_text(row.ChieuDai),
                    price_billion=fmt_text(row.GiaBanTy),
                    owner_phone=fmt_text(row.SDTChu),
                )
            )
    return events


def format_event(event: CallEvent) -> str:
    address = " ".join(part for part in [event.house_no, event.street] if part)
    staff = f"{event.staff_code} - {event.staff_name}".strip(" -")
    return "\n".join(
        [
            f"🕒 {html.escape(event.viewed_at.strftime('%H:%M:%S'))}",
            f"👤 {html.escape(staff)}",
            f"🏠 {html.escape(address)}",
            f"📍 {html.escape(event.district)}",
            f"📐 {html.escape(event.width)} x {html.escape(event.length)}",
            f"💰 {html.escape(event.price_billion)} tỷ",
            f"☎️ {html.escape(event.owner_phone or 'Trống')}",
        ]
    )


def build_messages(events: list[CallEvent]) -> list[str]:
    if not events:
        return []
    title = (
        "📞 <b>Landsoft: nhân viên vừa gọi/xem SĐT chủ nhà</b>\n"
        f"Ngày {html.escape(datetime.now().strftime('%d/%m/%Y'))}\n"
        f"Tổng mới: <b>{len(events)}</b> lượt"
    )
    messages: list[str] = []
    current = title
    for event in events:
        block = "\n\n" + format_event(event)
        if len(current) + len(block) > MAX_TELEGRAM_MESSAGE:
            messages.append(current)
            current = title + block
        else:
            current += block
    messages.append(current)
    return messages


def send_telegram(message: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print(message)
        print("\n[DRY RUN] Thieu TELEGRAM_BOT_TOKEN hoac TELEGRAM_CHAT_ID nen chua gui Telegram.")
        return

    data = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        }
    ).encode("utf-8")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    request = urllib.request.Request(url, data=data, method="POST")
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not payload.get("ok"):
        raise RuntimeError(f"Telegram gui that bai: {payload}")


def run_once(mark_sent: bool = True) -> int:
    _, _, day_key = today_range()
    state = load_state()
    sent_ids_by_day = state.setdefault("sent_ids_by_day", {})
    sent_ids = set(int(x) for x in sent_ids_by_day.get(day_key, []))

    events = fetch_today_events(sent_ids)
    if not events:
        print("Khong co log moi cho nhom nhan vien dang theo doi.")
        return 0

    for message in build_messages(events):
        send_telegram(message)

    if mark_sent:
        sent_ids.update(event.log_id for event in events)
        sent_ids_by_day[day_key] = sorted(sent_ids)
        # Giu state gon: chi luu 7 ngay gan nhat theo key string.
        for key in sorted(sent_ids_by_day)[:-7]:
            sent_ids_by_day.pop(key, None)
        save_state(state)
    return len(events)


def main() -> int:
    load_dotenv(ROOT_DIR / ".env")
    parser = argparse.ArgumentParser(
        description="Bao Telegram khi nhan vien duoc theo doi xem/goi SDT chu nha tren Landsoft."
    )
    parser.add_argument("--once", action="store_true", help="Chay mot lan roi thoat.")
    parser.add_argument("--watch", action="store_true", help="Chay lien tuc.")
    parser.add_argument("--interval", type=int, default=300, help="So giay giua moi lan quet khi --watch.")
    parser.add_argument("--no-mark-sent", action="store_true", help="Test khong ghi checkpoint.")
    args = parser.parse_args()

    if not args.once and not args.watch:
        args.once = True

    if args.once:
        run_once(mark_sent=not args.no_mark_sent)
        return 0

    print(f"Dang theo doi Landsoft, moi {args.interval} giay quet mot lan.")
    while True:
        try:
            run_once(mark_sent=not args.no_mark_sent)
        except Exception as exc:
            print(f"[ERROR] {exc}")
        time.sleep(max(args.interval, 30))


if __name__ == "__main__":
    raise SystemExit(main())
