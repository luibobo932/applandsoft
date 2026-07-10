"""
Bao cao Telegram 2 lan/ngay (8h sang & 8h toi): xep hang cac can nha duoc goi
NHIEU NHAT trong 24 gio truoc gio bao cao, kem so luot goi.

- Doc SQL Landsoft qua pymssql (Ubuntu/GitHub Actions) hoac pyodbc (Windows).
- Doc bien moi truong: SQL_SERVER, SQL_PORT, SQL_DATABASE, SQL_USERNAME, SQL_PASSWORD,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
- Gio tinh theo GETDATE() cua SQL server (gio Viet Nam) -> khong lo lech mui gio.

Chay: python telegram_call_ranking_report.py [--top 15] [--hours 24] [--dry-run]
"""
from __future__ import annotations

import argparse
import html
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

MAX_TELEGRAM_MESSAGE = 3900


def load_dotenv(path: Path) -> None:
    """Nap .env neu co (chay local); tren Actions dung bien moi truong san."""
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


# SQL: gom theo tung can (MaBC), dem so luot goi SDT (LoaiDV=1) trong N gio qua,
# xep tu nhieu den it. Gio lay theo GETDATE() cua server (gio VN).
RANKING_SQL = """
SELECT TOP ({top})
    bc.MaBC,
    COUNT(*) AS SoLuot,
    COUNT(DISTINCT x.MaNV) AS SoNV,
    MAX(x.NgayXem) AS LanCuoi,
    MAX(bc.SoNha) AS SoNha,
    MAX(s.Names) AS TenDuong,
    MAX(h.TenHuyen) AS Quan,
    MAX(CAST(COALESCE(NULLIF(bc.NgangKV, 0), NULLIF(bc.NgangXD, 0)) AS float)) AS Ngang,
    MAX(CAST(COALESCE(NULLIF(bc.DaiKV, 0), NULLIF(bc.DaiXD, 0)) AS float)) AS Dai,
    MAX(CAST(bc.ThanhTien / 1000000000.0 AS float)) AS GiaTy,
    MAX(COALESCE(
        NULLIF(LTRIM(RTRIM(bc.DienThoaiNDD)), ''),
        NULLIF(LTRIM(RTRIM(kh.DiDong)), ''),
        NULLIF(LTRIM(RTRIM(kh.DiDong2)), ''),
        NULLIF(LTRIM(RTRIM(kh.DienThoaiCT)), '')
    )) AS SDT
FROM dbo.mglNhanVienXem x
JOIN dbo.mglbcBanChoThue bc ON bc.MaBC = x.KeyID
LEFT JOIN dbo.KhachHang kh ON kh.MaKH = bc.MaKH
LEFT JOIN dbo.Street s ON s.ID = bc.StreetID
LEFT JOIN dbo.Huyen h ON h.MaHuyen = bc.MaHuyen
WHERE x.LoaiDV = 1
  AND x.NgayXem >= DATEADD(HOUR, -{hours}, GETDATE())
GROUP BY bc.MaBC
ORDER BY COUNT(*) DESC, MAX(x.NgayXem) DESC;
"""

TOTAL_SQL = """
SELECT COUNT(*) AS TongLuot, COUNT(DISTINCT x.KeyID) AS TongCan
FROM dbo.mglNhanVienXem x
WHERE x.LoaiDV = 1
  AND x.NgayXem >= DATEADD(HOUR, -{hours}, GETDATE());
"""


def _rows_from_pymssql(top: int, hours: int) -> tuple[list[dict], dict]:
    import pymssql

    conn = pymssql.connect(
        server=os.environ["SQL_SERVER"],
        port=int(os.getenv("SQL_PORT", "1433")),
        user=os.environ["SQL_USERNAME"],
        password=os.environ["SQL_PASSWORD"],
        database=os.environ["SQL_DATABASE"],
        login_timeout=20,
        timeout=30,
    )
    try:
        cur = conn.cursor(as_dict=True)
        cur.execute(RANKING_SQL.format(top=int(top), hours=int(hours)))
        rows = cur.fetchall()
        cur.execute(TOTAL_SQL.format(hours=int(hours)))
        total = cur.fetchone()
        return rows, total
    finally:
        conn.close()


def _rows_from_pyodbc(top: int, hours: int) -> tuple[list[dict], dict]:
    import pyodbc

    driver = os.getenv("SQL_DRIVER", "SQL Server")
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={os.environ['SQL_SERVER']},{os.getenv('SQL_PORT', '1433')};"
        f"DATABASE={os.environ['SQL_DATABASE']};"
        f"UID={os.environ['SQL_USERNAME']};"
        f"PWD={os.environ['SQL_PASSWORD']};"
    )
    conn = pyodbc.connect(conn_str, timeout=20)
    try:
        cur = conn.cursor()
        cur.execute(RANKING_SQL.format(top=int(top), hours=int(hours)))
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        cur.execute(TOTAL_SQL.format(hours=int(hours)))
        tcols = [c[0] for c in cur.description]
        total = dict(zip(tcols, cur.fetchone()))
        return rows, total
    finally:
        conn.close()


def fetch_ranking(top: int, hours: int) -> tuple[list[dict], dict]:
    """Uu tien pymssql (Actions), fallback pyodbc (Windows local)."""
    try:
        import pymssql  # noqa: F401

        return _rows_from_pymssql(top, hours)
    except ImportError:
        return _rows_from_pyodbc(top, hours)


def build_message(rows: list[dict], total: dict, hours: int) -> str:
    now = datetime.now()
    phien = "sáng" if now.hour < 12 else "tối"
    header = (
        f"📊 <b>BÁO CÁO CĂN ĐƯỢC GỌI NHIỀU NHẤT</b>\n"
        f"🕗 Phiên {phien} · {html.escape(now.strftime('%H:%M %d/%m/%Y'))}\n"
        f"⏱ Trong {hours} giờ qua: <b>{fmt_num(total.get('TongLuot'))}</b> lượt gọi · "
        f"<b>{fmt_num(total.get('TongCan'))}</b> căn\n"
        f"━━━━━━━━━━━━━━━"
    )
    if not rows:
        return header + "\n\nChưa có lượt gọi nào trong khoảng thời gian này."

    medals = {1: "🥇", 2: "🥈", 3: "🥉"}
    lines = [header]
    for i, r in enumerate(rows, start=1):
        rank = medals.get(i, f"<b>{i}.</b>")
        addr = " ".join(p for p in [fmt_num(r.get("SoNha")), fmt_num(r.get("TenDuong"))] if p) or "(chưa rõ địa chỉ)"
        quan = fmt_num(r.get("Quan"))
        size = ""
        ngang, dai = fmt_num(r.get("Ngang")), fmt_num(r.get("Dai"))
        if ngang and dai:
            size = f" · {ngang}x{dai}m"
        gia = fmt_num(r.get("GiaTy"))
        gia_txt = f" · {gia} tỷ" if gia else ""
        sdt = fmt_num(r.get("SDT"))
        sdt_txt = f"\n     ☎️ {html.escape(sdt)}" if sdt else ""
        so_nv = fmt_num(r.get("SoNV"))
        lines.append(
            f"\n{rank} <b>{html.escape(addr)}</b>"
            f"\n     🔥 <b>{fmt_num(r.get('SoLuot'))} lượt gọi</b> · {so_nv} NV"
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
        {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        }
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
    ap.add_argument("--top", type=int, default=15, help="So can hien trong bang xep hang.")
    ap.add_argument("--hours", type=int, default=24, help="Cua so thoi gian (gio) truoc gio bao cao.")
    ap.add_argument("--dry-run", action="store_true", help="In ra man hinh, khong gui Telegram.")
    args = ap.parse_args()

    rows, total = fetch_ranking(args.top, args.hours)
    message = build_message(rows, total, args.hours)
    if args.dry_run:
        print(message)
        return 0
    send_telegram(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
