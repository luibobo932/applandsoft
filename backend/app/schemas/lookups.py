from pydantic import BaseModel


class LookupItem(BaseModel):
    code: str
    label: str
    parent_code: str | None = None


class LookupsResponse(BaseModel):
    districts: list[LookupItem]
    wards: list[LookupItem]
    property_types: list[LookupItem]
    directions: list[LookupItem]
    legal_statuses: list[LookupItem]
    statuses: list[LookupItem]
    sources: list[LookupItem]
    grades: list[LookupItem] = []
    road_types: list[LookupItem] = []
