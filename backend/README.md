# Landsoft Mobile Backend

Backend FastAPI cho app Android Landsoft doc lap.

## Trang thai hien tai

- Da noi DB Landsoft that.
- Da xac thuc user Landsoft that qua `dbo.NhanVien_Login`.
- Da doc kho hang that tu `dbo.mglbcBanChoThue`.
- Da verify write path that:
  - cap nhat trang thai
  - them ghi chu
  - tao nha moi
- Contract test stub: `6 passed`

## Chay local

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Mac dinh repo co the chay bang `stub gateway`, nhung file `.env` hien tai da duoc cau hinh de noi DB Landsoft that.

## Bien moi truong chinh

```text
USE_STUB_GATEWAY=false
SQL_DRIVER=SQL Server                # local Windows hien tai
SQL_SERVER=<server>
SQL_PORT=1433
SQL_DATABASE=<database>
SQL_USERNAME=<username>
SQL_PASSWORD=<password>
SQL_ENCRYPT=no
SQL_TRUST_SERVER_CERT=yes
```

Neu deploy len Linux/container, dung:

```text
SQL_DRIVER=ODBC Driver 18 for SQL Server
```

## Deploy cloud

Repo da co san:

- `Dockerfile`: image Python + ODBC Driver 18
- `.dockerignore`
- `..\render.yaml`: mau deploy len Render

Health check:

```text
GET /health
```

## Discovery note

Tai lieu mapping noi bo:

- `docs/LANDSOFT_MGL_DISCOVERY.md`
