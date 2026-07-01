from pydantic import BaseModel


class PushRegisterRequest(BaseModel):
    expo_push_token: str
    employee_ids: list[int] = []


class PushRegisterResponse(BaseModel):
    ok: bool = True
