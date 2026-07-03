from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings


@dataclass
class AuthenticatedUser:
    username: str
    display_name: str
    auth_source: str
    landsoft_username: str | None = None
    landsoft_user_id: int | None = None
    department_id: int | None = None
    role_name: str | None = None


class LandsoftGateway(Protocol):
    def authenticate_landsoft_user(self, username: str, password: str) -> AuthenticatedUser | None: ...

    def get_lookups(self) -> dict: ...

    def list_properties(self, filters: dict) -> tuple[list[dict], int]: ...

    def get_property(self, landsoft_id: int) -> dict | None: ...

    def update_property_status(self, landsoft_id: int, status_code: str, actor: AuthenticatedUser) -> dict: ...

    def add_property_note(self, landsoft_id: int, content: str, actor: AuthenticatedUser) -> dict: ...

    def create_property(self, payload: dict, actor: AuthenticatedUser) -> dict: ...

    def find_owner_by_phone(self, phone: str) -> dict: ...

    def list_customers(self, keyword: str | None, page: int, page_size: int) -> tuple[list[dict], int]: ...

    def get_customer(self, makh: int) -> dict | None: ...

    def list_employees(self, keyword: str | None, page: int, page_size: int) -> tuple[list[dict], int]: ...

    def list_property_history(self, landsoft_id: int) -> list[dict]: ...

    def get_next_property_code(self) -> int: ...

    def list_streets(self, district_code: str, keyword: str | None = None) -> list[dict]: ...

    def list_call_log_employees(self, keyword: str | None = None, limit: int = 300) -> list[dict]: ...

    def list_call_logs(
        self,
        employee_ids: list[int],
        start,
        end,
        after_id: int | None = None,
        limit: int = 100,
    ) -> dict: ...


@lru_cache
def get_gateway() -> LandsoftGateway:
    settings = get_settings()
    if settings.use_stub_gateway:
        from app.repositories.stub_gateway import StubLandsoftGateway

        return StubLandsoftGateway()
    from app.repositories.sql_gateway import SqlLandsoftGateway

    return SqlLandsoftGateway()
