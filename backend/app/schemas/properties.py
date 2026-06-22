from datetime import datetime

from pydantic import BaseModel, Field


class PropertySummary(BaseModel):
    landsoft_id: int
    code: str
    title: str
    district_code: str | None = None
    district_name: str | None = None
    ward_code: str | None = None
    ward_name: str | None = None
    address: str | None = None
    price: float | None = None
    area: float | None = None
    status_code: str | None = None
    status_name: str | None = None
    description: str | None = None
    owner_name: str | None = None
    contact_phone: str | None = None
    width: float | None = None
    length: float | None = None


class PropertyNote(BaseModel):
    note_id: int | None = None
    created_at: datetime | None = None
    created_by: str | None = None
    content: str


class PropertyDetail(PropertySummary):
    owner_name: str | None = None
    contact_phone: str | None = None
    legal_status_code: str | None = None
    legal_status_name: str | None = None
    direction_code: str | None = None
    direction_name: str | None = None
    property_type_code: str | None = None
    property_type_name: str | None = None
    source_code: str | None = None
    source_name: str | None = None
    created_at: datetime | None = None
    created_by: str | None = None
    notes: list[PropertyNote] = Field(default_factory=list)


class PropertyFilters(BaseModel):
    keyword: str | None = None
    district: str | None = None
    districts: str | None = None
    ward: str | None = None
    street: str | None = None
    status: str | None = None
    property_type: str | None = None
    property_types: str | None = None
    price_min: float | None = None
    price_max: float | None = None
    area_min: float | None = None
    area_max: float | None = None
    width_min: float | None = None
    sort: str | None = None
    page: int = 1
    page_size: int = 20


class PagedPropertiesResponse(BaseModel):
    items: list[PropertySummary]
    page: int
    page_size: int
    total: int


class PropertyStatusPatch(BaseModel):
    status_code: str


class PropertyNoteCreate(BaseModel):
    content: str


class PropertyCreateRequest(BaseModel):
    title: str
    address: str
    district_code: str
    ward_code: str
    property_type_code: str
    status_code: str
    source_code: str
    street_name: str | None = None
    owner_name: str | None = None
    contact_phone: str | None = None
    price: float
    area: float
    width: float | None = None
    length: float | None = None
    road_width: float | None = None
    floors: int | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    living_rooms: int | None = None
    legal_status_code: str | None = None
    direction_code: str | None = None
    grade_code: str | None = None
    negotiable: bool = False
    direct_owner: bool = False
    description: str | None = None
    note: str | None = None
    listing_type: str = "ban"


class ActivityItem(BaseModel):
    action: str
    target_type: str
    target_id: int | str | None = None
    message: str
    server_time: datetime
