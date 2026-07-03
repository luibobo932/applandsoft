from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.repositories.gateway import get_gateway
from app.schemas.customers import CustomerDetail, PagedCustomersResponse
from app.services.landsoft import current_user

router = APIRouter(tags=["customers"])


@router.get("/customers", response_model=PagedCustomersResponse)
def list_customers(
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=200),
    _user=Depends(current_user),
) -> PagedCustomersResponse:
    items, total = get_gateway().list_customers(keyword, page, page_size)
    return PagedCustomersResponse(items=items, page=page, page_size=page_size, total=total)


@router.get("/customers/{makh}", response_model=CustomerDetail)
def get_customer(makh: int, _user=Depends(current_user)) -> CustomerDetail:
    detail = get_gateway().get_customer(makh)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khách hàng.")
    return CustomerDetail(**detail)
