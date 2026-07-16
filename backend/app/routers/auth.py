from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import get_settings
from app.core.rate_limit import SlidingWindowRateLimiter
from app.schemas.auth import CurrentUser, LoginRequest, TokenResponse
from app.services.auth import authenticate

router = APIRouter(tags=["auth"])

_settings = get_settings()
login_rate_limiter = SlidingWindowRateLimiter(
    _settings.login_rate_limit_max,
    _settings.login_rate_limit_window_seconds,
)


def _client_ip(request: Request) -> str:
    # Sau proxy (Render), IP that nam o X-Forwarded-For; request.client la IP cua proxy.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(request: Request, username: str) -> None:
    keys = [f"ip:{_client_ip(request)}", f"user:{username.strip().casefold()}"]
    for key in keys:
        retry_after = login_rate_limiter.hit(key)
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau.",
                headers={"Retry-After": str(int(retry_after) + 1)},
            )


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request) -> TokenResponse:
    _enforce_rate_limit(request, payload.username)
    token, user = authenticate(payload.username, payload.password)
    return TokenResponse(access_token=token, user=CurrentUser(**user.__dict__))
