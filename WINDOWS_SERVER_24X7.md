# Landsoft Mobile 24/7 Tren Windows Server

Muc tieu: app dien thoai chay doc lap, khong can laptop mo.

## Kien truc dung

Android app -> Backend FastAPI tren Windows Server -> SQL Server Landsoft

Khuyen nghi:
- Cai Tailscale tren Windows Server
- Cai Tailscale tren dien thoai
- App tro toi IP Tailscale cua server

Loi ich:
- Khong can laptop mo
- Khong phai cung WiFi
- Khong mo cong SQL Server ra internet cong khai

## 0. Xuat bundle cau hinh tu laptop hien tai

Tren laptop dang chay Landsoft, xuat bundle rieng de mang len server:

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile\backend
python .\scripts\export_server_bootstrap.py --server-api-base-url "http://100.x.x.x:8000/api/v1"
```

Bundle se nam o:

```text
backend\data\server_bootstrap\
```

Trong do:

- `backend.env.private`: doi ten thanh `backend\.env` tren server
- `landsoft_context.json`: xac nhan config/server/user da doc tu laptop
- `README.txt`: huong dan thao tac nhanh

Luu y:

- RSA key de giai ma password user Landsoft da nam san trong `backend/app/core/landsoft_crypto.py`
- Nghia la khong can copy them "key dang nhap Landsoft" tu laptop sang server
- Thu can chuyen sang server la cau hinh backend va SQL credentials

## 1. Chuan bi tren server

Copy thu muc project len server, it nhat can:

- `backend/`
- `runtime/`

Neu build APK ngay tren may local thi server khong can `mobile/`.

## 2. Cai Tailscale tren server

1. Dang nhap RDP vao server
2. Cai Tailscale
3. Dang nhap cung tai khoan Tailscale voi dien thoai
4. Ghi lai IP Tailscale cua server, vi du:

```text
100.x.x.x
```

## 3. Cau hinh backend tren server

Trong `backend/.env`, dat cac bien toi thieu:

```text
APP_ENV=production
USE_STUB_GATEWAY=false
JWT_SECRET=<doi-secret-rieng>
SQL_DRIVER=SQL Server
SQL_SERVER=127.0.0.1
SQL_PORT=1433
SQL_DATABASE=LandSoftMGL_KingLand
SQL_USERNAME=<sql-user>
SQL_PASSWORD=<sql-password>
SQL_ENCRYPT=no
SQL_TRUST_SERVER_CERT=yes
```

Neu SQL Server khong nam cung may, doi `SQL_SERVER` thanh IP/host that.

## 4. Cai backend chay 24/7

Mo PowerShell tren server:

```powershell
cd D:\duong-dan\toi\landsoft-mobile\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Test backend:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Test health:

```text
http://127.0.0.1:8000/health
```

Neu OK, dang ky startup task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\register_windows_startup_task.ps1
```

Task nay se tu chay backend sau moi lan server reboot.

## 5. Build APK tro toi server

Tren may dev:

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile
powershell -NoProfile -ExecutionPolicy Bypass -File .\runtime\build_server_apk.ps1 -ServerApiBaseUrl "http://100.x.x.x:8000/api/v1"
```

Trong do `100.x.x.x` la IP Tailscale cua server.

APK output:

```text
mobile\android\app\build\outputs\apk\release\app-release.apk
```

## 6. Cach dung sau khi xong

1. Server luon mo 24/7
2. Dien thoai bat Tailscale
3. Cai APK moi
4. Mo app va dang nhap

Luc nay app khong con phu thuoc vao laptop nua.

## 7. Neu muon bo ca Tailscale

Co the dat them:
- Cloudflare Tunnel hoac reverse proxy HTTPS
- Domain rieng cho backend

Khi do app tro toi URL HTTPS cong khai cua server.

Day la buoc sau. Ban dau nen chot Tailscale truoc vi nhanh va an toan hon.
