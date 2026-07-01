from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query

from app.repositories.gateway import get_gateway
from app.schemas.call_logs import CallLogEmployee, PagedCallLogsResponse
from app.services.landsoft import current_user

router = APIRouter(tags=["call-logs"])


def _parse_employee_ids(value: str | None) -> list[int]:
    if not value:
        return []
    employee_ids: list[int] = []
    for raw in value.split(","):
        raw = raw.strip()
        if raw.isdigit():
            employee_ids.append(int(raw))
    return employee_ids


@router.get("/call-logs/employees", response_model=list[CallLogEmployee])
def list_call_log_employees(
    keyword: str | None = Query(default=None),
    limit: int = Query(default=300, ge=1, le=1000),
    _user=Depends(current_user),
) -> list[CallLogEmployee]:
    return get_gateway().list_call_log_employees(keyword=keyword, limit=limit)


@router.get("/call-logs", response_model=PagedCallLogsResponse)
def list_call_logs(
    employee_ids: str | None = Query(default=None, description="CSV MaNV, vd 46,71,426"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    after_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    _user=Depends(current_user),
) -> PagedCallLogsResponse:
    today = date.today()
    from_day = from_date or today
    to_day = to_date or today
    start = datetime.combine(from_day, time.min)
    end = datetime.combine(to_day, time.max)
    result = get_gateway().list_call_logs(
        employee_ids=_parse_employee_ids(employee_ids),
        start=start,
        end=end,
        after_id=after_id,
        limit=limit,
    )
    return PagedCallLogsResponse(**result)
