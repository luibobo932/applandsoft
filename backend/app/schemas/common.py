from datetime import UTC, datetime

from pydantic import BaseModel, Field


class ActionResponse(BaseModel):
    success: bool = True
    landsoft_id: int | str | None = None
    message: str
    server_time: datetime = Field(default_factory=lambda: datetime.now(UTC))
