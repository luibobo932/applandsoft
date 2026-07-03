from fastapi import APIRouter, Depends, Query

from app.repositories.gateway import get_gateway
from app.schemas.employees import PagedEmployeesResponse
from app.services.landsoft import current_user

router = APIRouter(tags=["employees"])


@router.get("/employees", response_model=PagedEmployeesResponse)
def list_employees(
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    _user=Depends(current_user),
) -> PagedEmployeesResponse:
    items, total = get_gateway().list_employees(keyword, page, page_size)
    return PagedEmployeesResponse(items=items, page=page, page_size=page_size, total=total)
