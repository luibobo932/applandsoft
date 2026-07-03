from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.repositories.gateway import get_gateway
from app.schemas.common import ActionResponse
from app.schemas.properties import (
    PagedPropertiesResponse,
    PropertyCreateRequest,
    PropertyDetail,
    PropertyFilters,
    PropertyNoteCreate,
    PropertyStatusPatch,
)
from app.schemas.employees import PropertyHistoryItem
from app.services.audit import log_action
from app.services.landsoft import current_user, property_or_404

router = APIRouter(tags=["properties"])


@router.get("/properties", response_model=PagedPropertiesResponse)
def list_properties(
    keyword: str | None = None,
    phone: str | None = None,
    district: str | None = None,
    districts: str | None = None,
    ward: str | None = None,
    street: str | None = None,
    status: str | None = None,
    property_type: str | None = None,
    property_types: str | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
    area_min: float | None = None,
    area_max: float | None = None,
    width_min: float | None = None,
    sort: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=5000),
    _user=Depends(current_user),
) -> PagedPropertiesResponse:
    filters = PropertyFilters(
        keyword=keyword,
        phone=phone,
        district=district,
        districts=districts,
        ward=ward,
        street=street,
        status=status,
        property_type=property_type,
        property_types=property_types,
        price_min=price_min,
        price_max=price_max,
        area_min=area_min,
        area_max=area_max,
        width_min=width_min,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    items, total = get_gateway().list_properties(filters.model_dump())
    return PagedPropertiesResponse(items=items, page=page, page_size=page_size, total=total)


@router.get("/properties/check-phone")
def check_phone(phone: str, _user=Depends(current_user)) -> dict:
    """Check SDT chu nha da ton tai trong he thong (khop chinh xac cot KhachHang.DiDong).
    Giong Landsoft 'Số di động đã có trong hệ thống'. Tra ve them ten chu nha."""
    result = get_gateway().find_owner_by_phone(phone)
    return {"exists": result["count"] > 0, "count": result["count"], "owner_name": result.get("owner_name")}


@router.get("/streets")
def list_streets(district: str, keyword: str | None = None, _user=Depends(current_user)) -> list[dict]:
    """Danh sach ten duong theo quan — cho dropdown 'Tên đường' (giong Landsoft)."""
    return get_gateway().list_streets(district, keyword)


@router.get("/properties/{landsoft_id}", response_model=PropertyDetail)
def get_property(landsoft_id: int, _user=Depends(current_user)) -> PropertyDetail:
    return PropertyDetail(**property_or_404(landsoft_id))


@router.patch("/properties/{landsoft_id}/status", response_model=ActionResponse)
def update_status(landsoft_id: int, payload: PropertyStatusPatch, user=Depends(current_user)) -> ActionResponse:
    try:
        result = get_gateway().update_property_status(landsoft_id, payload.status_code, user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    log_action(user, "update_property_status", "property", {"landsoft_id": landsoft_id, **payload.model_dump()}, result)
    return ActionResponse(message=result["message"], landsoft_id=result["landsoft_id"])


@router.post("/properties/{landsoft_id}/notes", response_model=ActionResponse)
def add_note(landsoft_id: int, payload: PropertyNoteCreate, user=Depends(current_user)) -> ActionResponse:
    try:
        result = get_gateway().add_property_note(landsoft_id, payload.content, user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    log_action(user, "add_property_note", "property", {"landsoft_id": landsoft_id, **payload.model_dump()}, result)
    return ActionResponse(message=result["message"], landsoft_id=result["landsoft_id"])


@router.post("/properties", response_model=ActionResponse)
def create_property(payload: PropertyCreateRequest, user=Depends(current_user)) -> ActionResponse:
    try:
        result = get_gateway().create_property(payload.model_dump(), user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    log_action(user, "create_property", "property", payload.model_dump(), result)
    return ActionResponse(message=result["message"], landsoft_id=result["landsoft_id"])


@router.get("/properties/{landsoft_id}/history", response_model=list[PropertyHistoryItem])
def property_history(landsoft_id: int, _user=Depends(current_user)) -> list[PropertyHistoryItem]:
    return [PropertyHistoryItem(**item) for item in get_gateway().list_property_history(landsoft_id)]


@router.get("/next-property-code")
def next_property_code(_user=Depends(current_user)) -> dict:
    return {"next_code": get_gateway().get_next_property_code()}


@router.get("/check-house")
def check_house(
    house_number: str, district: str | None = None, street: str | None = None, _user=Depends(current_user)
) -> dict:
    return get_gateway().check_house_number(house_number, district, street)
