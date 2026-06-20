from fastapi import APIRouter, Depends

from app.repositories.gateway import get_gateway
from app.schemas.lookups import LookupsResponse
from app.services.landsoft import current_user

router = APIRouter(tags=["lookups"])


@router.get("/lookups", response_model=LookupsResponse)
def get_lookups(_user=Depends(current_user)) -> LookupsResponse:
    payload = get_gateway().get_lookups()
    return LookupsResponse(**payload)
