from fastapi import APIRouter

from app.schemas.auth import CurrentUser, LoginRequest, TokenResponse
from app.services.auth import authenticate

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    token, user = authenticate(payload.username, payload.password)
    return TokenResponse(access_token=token, user=CurrentUser(**user.__dict__))
