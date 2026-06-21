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


def test_login_fail() -> None:
    response = client.post("/api/v1/auth/login", json={"username": "SKL-473", "password": "sai"})
    assert response.status_code == 401


def test_get_lookups() -> None:
    response = client.get("/api/v1/lookups", headers=login_headers())
    assert response.status_code == 200
    assert len(response.json()["districts"]) >= 1


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
