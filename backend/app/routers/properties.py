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
from app.services.audit import log_action
from app.services.landsoft import current_user, property_or_404

router = APIRouter(tags=["properties"])


@router.get("/properties", response_model=PagedPropertiesResponse)
def list_properties(
    keyword: str | None = None,
    district: str | None = None,
    ward: str | None = None,
    status: str | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
    area_min: float | None = None,
    area_max: float | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _user=Depends(current_user),
) -> PagedPropertiesResponse:
    filters = PropertyFilters(
        keyword=keyword,
        district=district,
        ward=ward,
        status=status,
        price_min=price_min,
        price_max=price_max,
        area_min=area_min,
        area_max=area_max,
        page=page,
        page_size=page_size,
    )
    items, total = get_gateway().list_properties(filters.model_dump())
    return PagedPropertiesResponse(items=items, page=page, page_size=page_size, total=total)


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
