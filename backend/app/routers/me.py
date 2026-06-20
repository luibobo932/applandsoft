from fastapi import APIRouter, Depends

from app.schemas.auth import CurrentUser
from app.services.landsoft import current_user

router = APIRouter(tags=["me"])


@router.get("/me", response_model=CurrentUser)
def me(user=Depends(current_user)) -> CurrentUser:
    return CurrentUser(**user.__dict__)
