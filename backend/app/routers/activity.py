from fastapi import APIRouter, Depends, Query

from app.schemas.properties import ActivityItem
from app.services.audit import read_recent_activity
from app.services.landsoft import current_user

router = APIRouter(tags=["activity"])


@router.get("/activity/recent", response_model=list[ActivityItem])
def recent_activity(limit: int = Query(default=20, ge=1, le=100), user=Depends(current_user)) -> list[ActivityItem]:
    items = read_recent_activity(user.username, limit=limit)
    return [ActivityItem(**item) for item in items]
