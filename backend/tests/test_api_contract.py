import os
from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ["USE_STUB_GATEWAY"] = "true"
from app.main import create_app
from app.core.config import get_settings
from app.repositories.gateway import get_gateway

get_settings.cache_clear()
get_gateway.cache_clear()
client = TestClient(create_app())


def login_headers() -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"username": "SKL-473", "password": "123456"})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_login_success() -> None:
    response = client.post("/api/v1/auth/login", json={"username": "SKL-473", "password": "123456"})
    assert response.status_code == 200
    assert response.json()["user"]["landsoft_user_id"] == 490


def test_health_and_readiness() -> None:
    health_response = client.get("/health")
    assert health_response.status_code == 200
    assert health_response.json()["ok"] is True

    ready_response = client.get("/ready")
    assert ready_response.status_code == 200
    assert ready_response.json() == {"ok": True, "mode": "stub"}


def test_landing_page_has_apk_download() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "landsoft-mobile-v1.0.0.apk" in response.text


def test_login_fail() -> None:
    response = client.post("/api/v1/auth/login", json={"username": "SKL-473", "password": "sai"})
    assert response.status_code == 401


def test_get_lookups() -> None:
    response = client.get("/api/v1/lookups", headers=login_headers())
    assert response.status_code == 200
    assert len(response.json()["districts"]) >= 1


def test_listing_address_lookup_uses_separate_token_and_matches_full_address(monkeypatch) -> None:
    from pydantic import SecretStr

    monkeypatch.setattr(get_settings(), "landsoft_listing_lookup_token", SecretStr("test-token"))
    matching_house = {
        "address": "123/4A Lê Thánh Tôn",
        "district_name": "Quận 1",
        "ward_name": "Bến Thành",
        "contact_phone": "0909000001",
    }
    monkeypatch.setattr(get_gateway(), "properties", [
        matching_house,
        {**matching_house, "district_name": "Quận 3", "contact_phone": "0909000002"},
        {**matching_house, "ward_name": "Bến Nghé", "contact_phone": "0909000003"},
        {**matching_house, "address": "123/4AB Lê Thánh Tôn", "contact_phone": "0909000004"},
        {**matching_house, "address": "123/4A Lê Thánh Tôn Nối Dài", "contact_phone": "0909000005"},
        {**matching_house, "house_number": "12 3/4A", "contact_phone": "0909000006"},
    ])
    path = "/api/v1/properties/listing-address-lookup"
    query = {"house_number": "123/4a", "street": "Đường Lê Thánh Tôn", "district": "Q.1", "ward": "Phường Bến Thành"}
    assert client.post(path, json=query, headers=login_headers()).status_code == 401

    headers = {"Authorization": "Bearer test-token"}
    response = client.post(path, json=query, headers=headers)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {"match_count": 1, "ambiguous": False, "owner_phones": ["0909000001"]}
    assert client.get("/api/v1/properties", headers=headers).status_code == 401

    response = client.post(path, json={**query, "ward": ""}, headers=headers)
    assert response.json() == {"match_count": 0, "ambiguous": True, "owner_phones": []}


def test_listing_address_lookup_can_use_public_ward_alias(monkeypatch) -> None:
    from datetime import datetime

    from pydantic import SecretStr

    monkeypatch.setattr(get_settings(), "landsoft_listing_lookup_token", SecretStr("test-token"))
    monkeypatch.setattr(get_gateway(), "properties", [
        {
            "address": "243/1/32 Tô Hiến Thành",
            "district_name": "Quận 10",
            "ward_name": "Phường 13",
            "contact_phone": "0909000001",
            "created_at": datetime(2026, 11, 24, 8, 0),
        },
    ])
    path = "/api/v1/properties/listing-address-lookup"
    headers = {"Authorization": "Bearer test-token"}
    address = {
        "house_number": "243/1/32", "street": "Đường Tô Hiến Thành",
        "district": "Quận 10", "ward": "Phường Hòa Hưng",
    }
    conflict = client.post(path, json=address, headers=headers).json()
    assert conflict == {"match_count": 0, "ambiguous": True, "owner_phones": []}
    match = client.post(
        path, json={**address, "ward_aliases": ["Phường 13"], "include_record_times": True}, headers=headers,
    ).json()
    assert match == {
        "match_count": 1, "ambiguous": False, "owner_phones": ["0909000001"],
        "first_registered_at": "2026-11-24T08:00:00",
    }


def test_property_flow() -> None:
    headers = login_headers()
    list_response = client.get("/api/v1/properties", headers=headers)
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert items

    landsoft_id = items[0]["landsoft_id"]
    detail_response = client.get(f"/api/v1/properties/{landsoft_id}", headers=headers)
    assert detail_response.status_code == 200

    patch_response = client.patch(
        f"/api/v1/properties/{landsoft_id}/status",
        headers=headers,
        json={"status_code": "tam_an"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["success"] is True

    note_response = client.post(
        f"/api/v1/properties/{landsoft_id}/notes",
        headers=headers,
        json={"content": "Ghi chú test"},
    )
    assert note_response.status_code == 200


def test_create_property_and_activity() -> None:
    headers = login_headers()
    create_response = client.post(
        "/api/v1/properties",
        headers=headers,
        json={
            "title": "Nhà mới mobile",
            "address": "123 Nguyễn Đình Chiểu",
            "district_code": "q1",
            "ward_code": "dakao",
            "property_type_code": "nha_pho",
            "status_code": "dang_ban",
            "source_code": "zalo",
            "owner_name": "Anh Test",
            "contact_phone": "0909000999",
            "price": 12.5,
            "area": 55,
            "description": "Tin tạo từ API test",
        },
    )
    assert create_response.status_code == 200
    assert create_response.json()["landsoft_id"] is not None

    activity_response = client.get("/api/v1/activity/recent", headers=headers)
    assert activity_response.status_code == 200
    assert len(activity_response.json()) >= 1


def test_call_logs_endpoints() -> None:
    headers = login_headers()

    employees_response = client.get("/api/v1/call-logs/employees", headers=headers)
    assert employees_response.status_code == 200
    employees = employees_response.json()
    assert any(item["employee_code"] == "SKL-409" for item in employees)

    logs_response = client.get("/api/v1/call-logs?employee_ids=426&limit=20", headers=headers)
    assert logs_response.status_code == 200
    payload = logs_response.json()
    assert payload["total"] >= 1
    assert payload["items"][0]["employee_code"] == "SKL-409"
    assert payload["items"][0]["owner_phone"]
