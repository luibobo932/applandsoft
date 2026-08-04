from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "Landsoft Mobile API"
    api_prefix: str = "/api/v1"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:8081"])

    # Chong brute-force /auth/login: so lan thu toi da moi IP va moi username trong cua so thoi gian.
    login_rate_limit_max: int = 10
    login_rate_limit_window_seconds: int = 60

    use_stub_gateway: bool = True
    local_app_users_file: str = "./config/local_app_users.json"
    landsoft_mapping_file: str = "./config/landsoft_mapping.local.yaml"
    discovery_output_dir: str = "./data/discovery"
    audit_log_path: str = "./data/audit.log"
    android_apk_path: str = "../mobile/android/app/build/outputs/apk/release/app-release.apk"
    android_apk_download_url: str = (
        "https://github.com/luibobo932/applandsoft/releases/download/v1.0.0/"
        "landsoft-mobile-v1.0.0.apk"
    )

    sql_driver: str = "ODBC Driver 18 for SQL Server"
    sql_server: str = ""
    sql_port: int = 1433
    sql_database: str = ""
    sql_username: str = ""
    sql_password: str = ""
    # Ma hoa duong truyen SQL (TLS). Giu TrustServerCertificate=yes de chap nhan cert self-signed
    # cua SQL Server noi bo, nhung van ma hoa du lieu tren duong truyen.
    sql_encrypt: str = "yes"
    sql_trust_server_cert: str = "yes"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[2]

    @property
    def local_users_path(self) -> Path:
        return (self.project_root / self.local_app_users_file).resolve()

    @property
    def mapping_path(self) -> Path:
        return (self.project_root / self.landsoft_mapping_file).resolve()

    @property
    def discovery_dir(self) -> Path:
        return (self.project_root / self.discovery_output_dir).resolve()

    @property
    def audit_log_file(self) -> Path:
        return (self.project_root / self.audit_log_path).resolve()

    @property
    def android_apk_file(self) -> Path:
        return (self.project_root / self.android_apk_path).resolve()

    @property
    def has_sql_credentials(self) -> bool:
        return all(
            [
                self.sql_server.strip(),
                self.sql_database.strip(),
                self.sql_username.strip(),
                self.sql_password.strip(),
            ]
        )

    @property
    def production_config_errors(self) -> list[str]:
        errors: list[str] = []
        if self.app_env.casefold() != "production":
            return errors
        if self.use_stub_gateway:
            errors.append("USE_STUB_GATEWAY phai la false trong production.")
        if not self.has_sql_credentials:
            errors.append("Thieu SQL_SERVER, SQL_DATABASE, SQL_USERNAME hoac SQL_PASSWORD.")
        if not self.jwt_secret.strip() or self.jwt_secret == "change-me":
            errors.append("JWT_SECRET chua duoc cau hinh an toan.")
        return errors

    @property
    def sql_connection_string(self) -> str:
        return (
            f"DRIVER={{{self.sql_driver}}};"
            f"SERVER={self.sql_server},{self.sql_port};"
            f"DATABASE={self.sql_database};"
            f"UID={self.sql_username};"
            f"PWD={self.sql_password};"
            f"Encrypt={self.sql_encrypt};"
            f"TrustServerCertificate={self.sql_trust_server_cert};"
        )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.discovery_dir.mkdir(parents=True, exist_ok=True)
    settings.audit_log_file.parent.mkdir(parents=True, exist_ok=True)
    return settings
