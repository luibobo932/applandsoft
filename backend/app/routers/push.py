from fastapi import APIRouter, Depends

from app.repositories.push_store import remove_subscription, upsert_subscription
from app.schemas.push import PushRegisterRequest, PushRegisterResponse
from app.services.landsoft import current_user

router = APIRouter(tags=["push"])


@router.post("/push/register", response_model=PushRegisterResponse)
def register_push_token(payload: PushRegisterRequest, _user=Depends(current_user)) -> PushRegisterResponse:
    if payload.employee_ids:
        upsert_subscription(payload.expo_push_token, payload.employee_ids)
    else:
        remove_subscription(payload.expo_push_token)
    return PushRegisterResponse()
