from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as element_tree
from pathlib import Path


def parse_args() -> argparse.Namespace:
    script_path = Path(__file__).resolve()
    backend_root = script_path.parents[1]
    project_root = backend_root.parent
    workspace_root = project_root.parent
    default_landsoft_config = workspace_root / "_analysis" / "landsoft_king_land" / "LandSoft - King Land" / "LandSoft.exe.config"
    default_output_dir = backend_root / "data" / "server_bootstrap"
    default_backend_env = backend_root / ".env"

    parser = argparse.ArgumentParser(
        description="Xuat bundle cau hinh rieng tu laptop nay de deploy backend Landsoft Mobile len server 24/7."
    )
    parser.add_argument("--landsoft-config", default=str(default_landsoft_config))
    parser.add_argument("--backend-env", default=str(default_backend_env))
    parser.add_argument("--output-dir", default=str(default_output_dir))
    parser.add_argument("--server-api-base-url", default="")
    return parser.parse_args()


def parse_landsoft_settings(config_path: Path) -> dict[str, str]:
    if not config_path.exists():
        raise FileNotFoundError(f"Khong tim thay Landsoft config: {config_path}")

    tree = element_tree.parse(config_path)
    settings: dict[str, str] = {}

    for setting in tree.findall(".//LandSoft.Properties.Settings/setting"):
        name = setting.attrib.get("name", "").strip()
        value = (setting.findtext("value") or "").strip()
        if name:
            settings[name] = value

    return settings


def parse_dotenv(env_path: Path) -> dict[str, str]:
    if not env_path.exists():
        return {}

    data: dict[str, str] = {}
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:3]}***{value[-3:]}"


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def build_backend_env(landsoft: dict[str, str], backend_env: dict[str, str]) -> str:
    sql_driver = backend_env.get("SQL_DRIVER", "SQL Server")
    sql_server = backend_env.get("SQL_SERVER") or landsoft.get("ServerName", "")
    sql_port = backend_env.get("SQL_PORT", "1433")
    sql_database = backend_env.get("SQL_DATABASE") or landsoft.get("DatabaseName", "")
    sql_username = backend_env.get("SQL_USERNAME") or landsoft.get("UserNamesSQL", "")
    sql_password = backend_env.get("SQL_PASSWORD", "<dien-sql-password-o-day>")
    jwt_secret = backend_env.get("JWT_SECRET", "<doi-secret-rieng-o-server>")
    use_stub_gateway = backend_env.get("USE_STUB_GATEWAY", "false")
    sql_encrypt = backend_env.get("SQL_ENCRYPT", "no")
    sql_trust_server_cert = backend_env.get("SQL_TRUST_SERVER_CERT", "yes")

    lines = [
        "APP_ENV=production",
        "APP_NAME=Landsoft Mobile API",
        "API_PREFIX=/api/v1",
        f"USE_STUB_GATEWAY={use_stub_gateway}",
        f"JWT_SECRET={jwt_secret}",
        "JWT_ALGORITHM=HS256",
        "JWT_EXPIRE_MINUTES=720",
        f"SQL_DRIVER={sql_driver}",
        f"SQL_SERVER={sql_server}",
        f"SQL_PORT={sql_port}",
        f"SQL_DATABASE={sql_database}",
        f"SQL_USERNAME={sql_username}",
        f"SQL_PASSWORD={sql_password}",
        f"SQL_ENCRYPT={sql_encrypt}",
        f"SQL_TRUST_SERVER_CERT={sql_trust_server_cert}",
    ]
    return "\n".join(lines) + "\n"


def build_context_payload(
    landsoft: dict[str, str], backend_env: dict[str, str], landsoft_config_path: Path, backend_env_path: Path
) -> dict[str, object]:
    return {
        "landsoft_config_path": str(landsoft_config_path),
        "backend_env_path": str(backend_env_path),
        "desktop_user": {
            "username": landsoft.get("UserName", ""),
            "staff_id": landsoft.get("StaffID", ""),
            "staff_name": landsoft.get("StaffName", ""),
            "permission_id": landsoft.get("PerID", ""),
            "permission_name": landsoft.get("PerName", ""),
        },
        "landsoft_server": {
            "server_name": landsoft.get("ServerName", ""),
            "database_name": landsoft.get("DatabaseName", ""),
            "sql_username": landsoft.get("UserNamesSQL", ""),
            "version": landsoft.get("Version", ""),
            "conn_cipher_present": bool(landsoft.get("Conn")),
        },
        "backend_env_detected": {
            "use_stub_gateway": backend_env.get("USE_STUB_GATEWAY", ""),
            "sql_driver": backend_env.get("SQL_DRIVER", ""),
            "sql_server": backend_env.get("SQL_SERVER", ""),
            "sql_database": backend_env.get("SQL_DATABASE", ""),
            "sql_username": backend_env.get("SQL_USERNAME", ""),
            "sql_password_masked": mask_secret(backend_env.get("SQL_PASSWORD", "")),
            "jwt_secret_masked": mask_secret(backend_env.get("JWT_SECRET", "")),
        },
        "notes": [
            "Backend da co san RSA private key trong app/core/landsoft_crypto.py de giai ma MatKhau cua user Landsoft.",
            "Khong can copy them key giai ma password tu laptop sang server.",
            "Can copy file backend.env.private trong bundle nay len server va doi lai JWT_SECRET neu can.",
        ],
    }


def build_readme(landsoft: dict[str, str], backend_env: dict[str, str], server_api_base_url: str) -> str:
    detected_sql_password = "co" if backend_env.get("SQL_PASSWORD") else "khong"
    detected_jwt = "co" if backend_env.get("JWT_SECRET") else "khong"
    api_line = server_api_base_url.strip() or "<dien-url-backend-server-o-day>"

    return f"""# Server bootstrap tu laptop nay

Bundle nay duoc tao de dua Landsoft Mobile len server 24/7 ma khong con phu thuoc laptop.

## Da lay duoc tren may nay

- User Landsoft desktop: {landsoft.get("UserName", "-")} / {landsoft.get("StaffName", "-")}
- SQL Server Landsoft: {landsoft.get("ServerName", "-")}
- Database: {landsoft.get("DatabaseName", "-")}
- SQL username: {landsoft.get("UserNamesSQL", "-")}
- SQL password trong backend/.env: {detected_sql_password}
- JWT secret trong backend/.env: {detected_jwt}

## Diem quan trong

- RSA key de giai ma password user Landsoft da nam san trong backend:
  - `backend/app/core/landsoft_crypto.py`
- Nghia la server KHONG can quay lai laptop de lay key dang nhap Landsoft.
- Thu can mang sang server la cau hinh backend va SQL credentials.

## File trong bundle

- `backend.env.private`: copy thanh `backend\\.env` tren server
- `landsoft_context.json`: thong tin mapping va xac nhan key/cau hinh da doc tu laptop

## Cach dung nhanh tren server

1. Copy thu muc project len server
2. Copy file `backend.env.private` thanh `backend/.env`
3. Chay:

```powershell
cd D:\\duong-dan\\toi\\landsoft-mobile\\backend
python -m venv .venv
.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\register_windows_startup_task.ps1
```

4. Build APK tro thang toi server:

```powershell
cd D:\\12. Tools\\anthitphanmem\\landsoft-mobile
powershell -NoProfile -ExecutionPolicy Bypass -File .\\runtime\\build_server_apk.ps1 -ServerApiBaseUrl "{api_line}"
```

APK release se nam o:

```text
mobile\\android\\app\\build\\outputs\\apk\\release\\app-release.apk
```
"""


def main() -> None:
    args = parse_args()
    landsoft_config_path = Path(args.landsoft_config).resolve()
    backend_env_path = Path(args.backend_env).resolve()
    output_dir = Path(args.output_dir).resolve()

    landsoft = parse_landsoft_settings(landsoft_config_path)
    backend_env = parse_dotenv(backend_env_path)

    context_payload = build_context_payload(landsoft, backend_env, landsoft_config_path, backend_env_path)
    backend_env_private = build_backend_env(landsoft, backend_env)
    readme = build_readme(landsoft, backend_env, args.server_api_base_url)

    write_text(output_dir / "README.txt", readme)
    write_text(output_dir / "backend.env.private", backend_env_private)
    write_text(output_dir / "landsoft_context.json", json.dumps(context_payload, ensure_ascii=False, indent=2))

    print(f"Da xuat bundle server bootstrap: {output_dir}")
    print(f"- README: {output_dir / 'README.txt'}")
    print(f"- Backend env: {output_dir / 'backend.env.private'}")
    print(f"- Context: {output_dir / 'landsoft_context.json'}")


if __name__ == "__main__":
    main()
