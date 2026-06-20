from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class CurrentUser(BaseModel):
    username: str
    display_name: str
    auth_source: str
    landsoft_username: str | None = None
    landsoft_user_id: int | None = None
    department_id: int | None = None
    role_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: CurrentUser
