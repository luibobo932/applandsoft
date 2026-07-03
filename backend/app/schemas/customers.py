from pydantic import BaseModel


class CustomerSummary(BaseModel):
    makh: int
    full_name: str
    phone: str | None = None
    phone2: str | None = None
    address: str | None = None
    registered_at: str | None = None
    staff_name: str | None = None
    property_count: int = 0


class CustomerNote(BaseModel):
    created_at: str | None = None
    title: str | None = None
    content: str | None = None


class CustomerProperty(BaseModel):
    landsoft_id: int
    title: str
    address: str | None = None
    district_name: str | None = None
    price: float | None = None
    area: float | None = None
    status_name: str | None = None
    created_at: str | None = None


class CustomerDetail(CustomerSummary):
    email: str | None = None
    note_text: str | None = None
    notes: list[CustomerNote] = []
    properties: list[CustomerProperty] = []


class PagedCustomersResponse(BaseModel):
    items: list[CustomerSummary]
    page: int
    page_size: int
    total: int
