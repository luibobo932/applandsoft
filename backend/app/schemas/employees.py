from pydantic import BaseModel


class EmployeeSummary(BaseModel):
    manv: int
    code: str | None = None
    full_name: str
    phone: str | None = None
    email: str | None = None
    department: str | None = None
    role_name: str | None = None
    locked: bool = False


class PagedEmployeesResponse(BaseModel):
    items: list[EmployeeSummary]
    page: int
    page_size: int
    total: int


class PropertyHistoryItem(BaseModel):
    history_id: int
    created_at: str | None = None
    content: str | None = None
    status_name: str | None = None
    staff_name: str | None = None
