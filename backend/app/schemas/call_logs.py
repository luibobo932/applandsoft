from datetime import datetime

from pydantic import BaseModel


class CallLogEmployee(BaseModel):
    employee_id: int
    employee_code: str
    employee_name: str
    today_call_count: int = 0
    latest_call_at: datetime | None = None


class CallLogItem(BaseModel):
    log_id: int
    called_at: datetime
    employee_id: int
    employee_code: str
    employee_name: str
    landsoft_id: int
    house_number: str | None = None
    street_name: str | None = None
    district_name: str | None = None
    address: str | None = None
    width: float | None = None
    length: float | None = None
    area: float | None = None
    price: float | None = None
    owner_phone: str | None = None
    created_at: datetime | None = None


class PagedCallLogsResponse(BaseModel):
    items: list[CallLogItem]
    total: int
    limit: int
    after_id: int | None = None
    latest_id: int | None = None
