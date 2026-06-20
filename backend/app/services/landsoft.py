from fastapi import Depends, HTTPException, status

from app.core.security import require_token
from app.repositories.gateway import AuthenticatedUser, get_gateway
from app.services.auth import user_from_claims


def current_user(claims: dict = Depends(require_token)) -> AuthenticatedUser:
    return user_from_claims(claims)


def property_or_404(landsoft_id: int) -> dict:
    gateway = get_gateway()
    prop = gateway.get_property(landsoft_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy căn")
    return prop
