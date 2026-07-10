from fastapi import APIRouter, Depends, Query

from app.repositories.gateway import get_gateway
from app.services.landsoft import current_user

router = APIRouter(tags=["reports"])


@router.get("/reports/call-ranking")
def call_ranking(
    hours: int = Query(default=24, ge=1, le=168),
    top: int = Query(default=15, ge=1, le=50),
    _user=Depends(current_user),
) -> dict:
    """Xep hang can duoc goi SDT nhieu nhat trong N gio qua (cho bao cao Telegram)."""
    return get_gateway().call_ranking(hours=hours, top=top)
