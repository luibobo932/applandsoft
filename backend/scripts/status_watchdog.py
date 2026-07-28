"""
Giam sat thay doi TRANG THAI nha trong Landsoft (Cho duyet / Mo ban / Ngung ban / ...).

KHONG DUNG CHAM LANDSOFT GOC:
  - Chi chay lenh SELECT tren cac bang Landsoft (doc thuan tuy).
  - KHONG tao bang moi, KHONG them trigger, KHONG sua du lieu goc.
  - Toan bo nhat ky luu rieng trong file SQLite ben ngoai: backend/data/status_watch.db

Cach hoat dong: cu N giay chup 1 "anh" trang thai toan kho (MaBC -> MaTT), so voi
anh truoc do. Can nao doi trang thai -> ghi nhat ky + bao Telegram, kem danh sach
nhan vien co truy cap can do gan thoi diem doi (chi la THAM KHAO, khong phai bang chung).

Luu y ve gioi han: Landsoft khong luu nguoi doi trang thai, nen cong cu nay xac dinh
duoc "doi luc nao" (trong khoang giua 2 lan quet) chu khong chac chan "ai doi".

Chay:
  python status_watchdog.py --once            # quet 1 lan
  python status_watchdog.py --watch           # chay lien tuc (mac dinh 300s)
  python status_watchdog.py --once --dry-run  # in ra man hinh, khong gui Telegram
"""
from __future__ import annotations

import argparse
import html
import json
import os
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

import pyodbc

ROOT_DIR = Path(__file__).resolve().parents[1]
STATE_DB = ROOT_DIR / "data" / "status_watch.db"
LOG_FILE = ROOT_DIR / "data" / "status_watch.log"
MAX_ALERT_ITEMS = 12

STATUS_NAMES = {
    0: "Ngừng bán",
    1: "Mở bán",
    2: "Đang giao dịch",
    3: "Đã giao dịch",
    4: "Chờ duyệt",
}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def log(msg: str) -> None:
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    print(line, flush=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def status_name(code) -> str:
    if code is None:
        return "(trống)"
    return STATUS_NAMES.get(int(code), f"Mã {code}")


# ---------------------------------------------------------------- Landsoft (CHI DOC)
def sql_connect() -> pyodbc.Connection:
    return pyodbc.connect(
        f"DRIVER={{{os.getenv('SQL_DRIVER', 'SQL Server')}}};"
        f"SERVER={os.environ['SQL_SERVER']},{os.getenv('SQL_PORT', '1433')};"
        f"DATABASE={os.environ['SQL_DATABASE']};"
        f"UID={os.environ['SQL_USERNAME']};PWD={os.environ['SQL_PASSWORD']};",
        timeout=20,
    )


def fetch_snapshot(conn: pyodbc.Connection) -> dict[int, int]:
    """Chup trang thai toan kho. Chi SELECT."""
    cur = conn.cursor()
    cur.execute("SELECT MaBC, MaTT FROM dbo.mglbcBanChoThue")
    return {int(r[0]): (int(r[1]) if r[1] is not None else -1) for r in cur.fetchall()}


def fetch_details(conn: pyodbc.Connection, ids: list[int]) -> dict[int, dict]:
    """Thong tin can + nhan vien truy cap gan day (chi SELECT)."""
    if not ids:
        return {}
    placeholders = ",".join("?" for _ in ids)
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT bc.MaBC, bc.SoDK, bc.SoNha, s.Names AS duong, h.TenHuyen AS quan,
               kh.TenKH, nv.MaSo AS nv_ma, nv.HoTen AS nv_ten,
               CAST(bc.ThanhTien / 1000000000.0 AS float) AS gia_ty
        FROM dbo.mglbcBanChoThue bc
        LEFT JOIN dbo.Street s ON s.ID = bc.StreetID
        LEFT JOIN dbo.Huyen h ON h.MaHuyen = bc.MaHuyen
        LEFT JOIN dbo.KhachHang kh ON kh.MaKH = bc.MaKH
        LEFT JOIN dbo.NhanVien nv ON nv.MaNV = bc.MaNVKD
        WHERE bc.MaBC IN ({placeholders})
        """,
        ids,
    )
    cols = [c[0] for c in cur.description]
    out = {int(r[0]): dict(zip(cols, r)) for r in cur.fetchall()}

    # Nhan vien co truy cap can trong 24h qua — CHI THAM KHAO
    cur.execute(
        f"""
        SELECT x.KeyID, nv.MaSo, nv.HoTen, x.NgayXem
        FROM dbo.mglNhanVienXem x
        LEFT JOIN dbo.NhanVien nv ON nv.MaNV = x.MaNV
        WHERE x.KeyID IN ({placeholders})
          AND x.NgayXem >= DATEADD(hour, -24, GETDATE())
        ORDER BY x.NgayXem DESC
        """,
        ids,
    )
    for r in cur.fetchall():
        item = out.get(int(r[0]))
        if item is not None:
            item.setdefault("truy_cap", []).append(
                {"ma": (r[1] or "").strip(), "ten": (r[2] or "").strip(), "luc": r[3]}
            )
    return out


# ---------------------------------------------------------------- State rieng (SQLite)
def open_state() -> sqlite3.Connection:
    STATE_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(STATE_DB)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS snapshot (mabc INTEGER PRIMARY KEY, matt INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phat_hien_luc TEXT NOT NULL,
            quet_truoc_luc TEXT,
            mabc INTEGER NOT NULL,
            so_dk TEXT, dia_chi TEXT, quan TEXT,
            tu_trang_thai INTEGER, sang_trang_thai INTEGER,
            nv_nhap TEXT, truy_cap_gan_day TEXT
        );
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
        """
    )
    return conn


def get_meta(state: sqlite3.Connection, key: str) -> str | None:
    row = state.execute("SELECT v FROM meta WHERE k = ?", (key,)).fetchone()
    return row[0] if row else None


def set_meta(state: sqlite3.Connection, key: str, value: str) -> None:
    state.execute("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)", (key, value))


def save_snapshot(state: sqlite3.Connection, snap: dict[int, int]) -> None:
    state.execute("DELETE FROM snapshot")
    state.executemany("INSERT INTO snapshot (mabc, matt) VALUES (?, ?)", snap.items())
    set_meta(state, "last_scan", datetime.now().isoformat(timespec="seconds"))
    state.commit()


def load_snapshot(state: sqlite3.Connection) -> dict[int, int]:
    return {int(r[0]): int(r[1]) for r in state.execute("SELECT mabc, matt FROM snapshot")}


# ---------------------------------------------------------------- Telegram
def send_telegram(message: str, dry_run: bool = False) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if dry_run or not token or not chat_id:
        print(message)
        if not dry_run:
            log("[canh bao] Thieu TELEGRAM_BOT_TOKEN/CHAT_ID -> chua gui duoc.")
        return
    data = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": message, "parse_mode": "HTML", "disable_web_page_preview": "true"}
    ).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage", data=data, method="POST"
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if not payload.get("ok"):
        raise RuntimeError(f"Telegram loi: {payload}")


def build_message(changes: list[dict], truoc: str | None) -> str:
    head = (
        f"🔄 <b>THAY ĐỔI TRẠNG THÁI NHÀ</b>\n"
        f"Phát hiện {len(changes)} căn lúc {datetime.now():%H:%M %d/%m/%Y}"
    )
    if truoc:
        try:
            t = datetime.fromisoformat(truoc)
            head += f"\n<i>Đổi trong khoảng {t:%H:%M} → {datetime.now():%H:%M}</i>"
        except ValueError:
            pass
    head += "\n━━━━━━━━━━━━━━━"

    blocks = []
    for c in changes[:MAX_ALERT_ITEMS]:
        addr = c["dia_chi"] or f"Căn {c['mabc']}"
        b = (
            f"\n\n📍 <b>{html.escape(addr)}</b>"
            f"{' · ' + html.escape(c['quan']) if c['quan'] else ''}"
            f"\n     <b>{html.escape(status_name(c['tu']))}</b> ➜ "
            f"<b>{html.escape(status_name(c['sang']))}</b>"
            f"\n     🔢 Số ĐK {html.escape(str(c['so_dk'] or c['mabc']))}"
        )
        if c.get("nv_nhap"):
            b += f"\n     👤 NV nhập: {html.escape(c['nv_nhap'])}"
        if c.get("truy_cap"):
            names = ", ".join(c["truy_cap"][:4])
            b += f"\n     👀 Có mở căn này 24h qua: {html.escape(names)}"
        blocks.append(b)

    tail = ""
    if len(changes) > MAX_ALERT_ITEMS:
        tail = f"\n\n… và {len(changes) - MAX_ALERT_ITEMS} căn khác (xem nhật ký)."
    tail += "\n\n<i>Landsoft không lưu người đổi trạng thái — danh sách 👀 chỉ để tham khảo, không phải bằng chứng.</i>"
    return head + "".join(blocks) + tail


# ---------------------------------------------------------------- Vong quet
def run_once(dry_run: bool = False) -> int:
    state = open_state()
    truoc = get_meta(state, "last_scan")
    cu = load_snapshot(state)

    with sql_connect() as conn:
        moi = fetch_snapshot(conn)

        if not cu:
            save_snapshot(state, moi)
            log(f"Lần đầu chạy: đã ghi nền {len(moi):,} căn, chưa báo gì.")
            state.close()
            return 0

        doi = [(mabc, cu[mabc], matt) for mabc, matt in moi.items() if mabc in cu and cu[mabc] != matt]
        them_moi = len(set(moi) - set(cu))
        bi_xoa = len(set(cu) - set(moi))

        if not doi:
            save_snapshot(state, moi)
            log(f"Quét {len(moi):,} căn — không có thay đổi trạng thái."
                + (f" (+{them_moi} căn mới)" if them_moi else "")
                + (f" (-{bi_xoa} căn bị xóa)" if bi_xoa else ""))
            state.close()
            return 0

        chi_tiet = fetch_details(conn, [d[0] for d in doi])

    changes = []
    for mabc, tu, sang in doi:
        d = chi_tiet.get(mabc, {})
        addr = " ".join(p for p in [(d.get("SoNha") or "").strip(), (d.get("duong") or "").strip()] if p)
        nv = " ".join(p for p in [(d.get("nv_ma") or "").strip(), (d.get("nv_ten") or "").strip()] if p)
        tc = [f"{t['ma']} {t['ten']} ({t['luc']:%H:%M %d/%m})" for t in d.get("truy_cap", [])]
        changes.append(
            {
                "mabc": mabc, "tu": tu, "sang": sang,
                "so_dk": d.get("SoDK"), "dia_chi": addr,
                "quan": (d.get("quan") or "").strip(),
                "nv_nhap": nv, "truy_cap": tc,
            }
        )

    now_iso = datetime.now().isoformat(timespec="seconds")
    state.executemany(
        """INSERT INTO changes (phat_hien_luc, quet_truoc_luc, mabc, so_dk, dia_chi, quan,
                                tu_trang_thai, sang_trang_thai, nv_nhap, truy_cap_gan_day)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        [
            (now_iso, truoc, c["mabc"], c["so_dk"], c["dia_chi"], c["quan"],
             c["tu"], c["sang"], c["nv_nhap"], " | ".join(c["truy_cap"]))
            for c in changes
        ],
    )
    save_snapshot(state, moi)
    state.close()

    for c in changes:
        log(f"ĐỔI: MaBC={c['mabc']} {c['dia_chi']} | {status_name(c['tu'])} -> {status_name(c['sang'])}")

    send_telegram(build_message(changes, truoc), dry_run=dry_run)
    return len(changes)


def main() -> int:
    load_dotenv(ROOT_DIR / ".env")
    ap = argparse.ArgumentParser(description="Giam sat doi trang thai nha Landsoft (chi doc).")
    ap.add_argument("--once", action="store_true", help="Quet 1 lan roi thoat.")
    ap.add_argument("--watch", action="store_true", help="Chay lien tuc.")
    ap.add_argument("--interval", type=int, default=300, help="So giay giua 2 lan quet (mac dinh 300).")
    ap.add_argument("--dry-run", action="store_true", help="In ra man hinh, khong gui Telegram.")
    args = ap.parse_args()

    if not args.once and not args.watch:
        args.once = True

    if args.once:
        run_once(dry_run=args.dry_run)
        return 0

    log(f"Bắt đầu giám sát, mỗi {args.interval} giây quét một lần.")
    while True:
        try:
            run_once(dry_run=args.dry_run)
        except Exception as exc:
            log(f"[LỖI] {exc}")
        time.sleep(max(args.interval, 30))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    raise SystemExit(main())
