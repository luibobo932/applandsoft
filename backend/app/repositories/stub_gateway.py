from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime

from app.repositories.gateway import AuthenticatedUser


class StubLandsoftGateway:
    def __init__(self) -> None:
        self.lookups = {
            "districts": [
                {"code": "q1", "label": "Quận 1"},
                {"code": "q3", "label": "Quận 3"},
                {"code": "pn", "label": "Phú Nhuận"},
            ],
            "wards": [
                {"code": "bnghe", "label": "Bến Nghé", "parent_code": "q1"},
                {"code": "dakao", "label": "Đa Kao", "parent_code": "q1"},
                {"code": "w7q3", "label": "Phường 7", "parent_code": "q3"},
                {"code": "w4pn", "label": "Phường 4", "parent_code": "pn"},
            ],
            "property_types": [
                {"code": "nha_pho", "label": "Nhà phố"},
                {"code": "villa", "label": "Villa"},
            ],
            "directions": [
                {"code": "dong", "label": "Đông"},
                {"code": "tay", "label": "Tây"},
                {"code": "nam", "label": "Nam"},
                {"code": "bac", "label": "Bắc"},
            ],
            "legal_statuses": [
                {"code": "so_hong", "label": "Sổ hồng"},
                {"code": "gp_xd", "label": "Giấy phép xây dựng"},
            ],
            "statuses": [
                {"code": "dang_ban", "label": "Đang bán"},
                {"code": "da_coc", "label": "Đã cọc"},
                {"code": "tam_an", "label": "Tạm ẩn"},
            ],
            "sources": [
                {"code": "owner_call", "label": "Chủ gọi"},
                {"code": "zalo", "label": "Zalo"},
                {"code": "moi_gioi", "label": "Môi giới"},
            ],
        }
        self.properties = [
            {
                "landsoft_id": 1001,
                "code": "KL-Q1-1001",
                "title": "Nhà phố 4 tầng Nguyễn Bỉnh Khiêm",
                "district_code": "q1",
                "district_name": "Quận 1",
                "ward_code": "dakao",
                "ward_name": "Đa Kao",
                "address": "Nguyễn Bỉnh Khiêm, Đa Kao, Quận 1",
                "price": 18.5,
                "area": 72,
                "status_code": "dang_ban",
                "status_name": "Đang bán",
                "description": "Hẻm xe hơi, sẵn HĐT 40tr/tháng.",
                "owner_name": "Chị Mai",
                "contact_phone": "0909000001",
                "legal_status_code": "so_hong",
                "legal_status_name": "Sổ hồng",
                "direction_code": "dong",
                "direction_name": "Đông",
                "property_type_code": "nha_pho",
                "property_type_name": "Nhà phố",
                "source_code": "owner_call",
                "source_name": "Chủ gọi",
                "notes": [
                    {
                        "note_id": 1,
                        "created_at": datetime.now(UTC),
                        "created_by": "system",
                        "content": "Tin mẫu cho mobile app.",
                    }
                ],
            },
            {
                "landsoft_id": 1002,
                "code": "KL-PN-1002",
                "title": "Nhà phố Phan Xích Long",
                "district_code": "pn",
                "district_name": "Phú Nhuận",
                "ward_code": "w4pn",
                "ward_name": "Phường 4",
                "address": "Phan Xích Long, Phường 4, Phú Nhuận",
                "price": 24.9,
                "area": 98,
                "status_code": "da_coc",
                "status_name": "Đã cọc",
                "description": "Mặt tiền kinh doanh, ngang 5m.",
                "owner_name": "Anh Hùng",
                "contact_phone": "0909000002",
                "legal_status_code": "gp_xd",
                "legal_status_name": "Giấy phép xây dựng",
                "direction_code": "tay",
                "direction_name": "Tây",
                "property_type_code": "nha_pho",
                "property_type_name": "Nhà phố",
                "source_code": "zalo",
                "source_name": "Zalo",
                "notes": [],
            },
        ]
        self.next_property_id = 1003
        self.next_note_id = 2

    def authenticate_landsoft_user(self, username: str, password: str) -> AuthenticatedUser | None:
        if username == "SKL-473" and password == "123456":
            return AuthenticatedUser(
                username=username,
                display_name="Trần Đăng Duy",
                auth_source="stub-landsoft",
                landsoft_username=username,
                landsoft_user_id=490,
                department_id=6,
                role_name="Chuyên Viên Kinh Doanh",
            )
        return None

    def get_lookups(self) -> dict:
        return deepcopy(self.lookups)

    def list_properties(self, filters: dict) -> tuple[list[dict], int]:
        items = deepcopy(self.properties)
        keyword = (filters.get("keyword") or "").strip().lower()
        district = filters.get("district")
        ward = filters.get("ward")
        status = filters.get("status")
        price_min = filters.get("price_min")
        price_max = filters.get("price_max")
        area_min = filters.get("area_min")
        area_max = filters.get("area_max")

        def matches(item: dict) -> bool:
            haystack = " ".join(
                [
                    item.get("code", ""),
                    item.get("title", ""),
                    item.get("address", ""),
                    item.get("description", ""),
                ]
            ).lower()
            if keyword and keyword not in haystack:
                return False
            if district and item.get("district_code") != district:
                return False
            if ward and item.get("ward_code") != ward:
                return False
            if status and item.get("status_code") != status:
                return False
            if price_min is not None and (item.get("price") or 0) < price_min:
                return False
            if price_max is not None and (item.get("price") or 0) > price_max:
                return False
            if area_min is not None and (item.get("area") or 0) < area_min:
                return False
            if area_max is not None and (item.get("area") or 0) > area_max:
                return False
            return True

        filtered = [item for item in items if matches(item)]
        total = len(filtered)
        page = max(int(filters.get("page", 1)), 1)
        page_size = max(int(filters.get("page_size", 20)), 1)
        start = (page - 1) * page_size
        end = start + page_size
        return filtered[start:end], total

    def get_property(self, landsoft_id: int) -> dict | None:
        for item in self.properties:
            if item["landsoft_id"] == landsoft_id:
                return deepcopy(item)
        return None

    def update_property_status(self, landsoft_id: int, status_code: str, actor: AuthenticatedUser) -> dict:
        label = next((item["label"] for item in self.lookups["statuses"] if item["code"] == status_code), status_code)
        for item in self.properties:
            if item["landsoft_id"] == landsoft_id:
                item["status_code"] = status_code
                item["status_name"] = label
                return {"landsoft_id": landsoft_id, "message": f"Đã cập nhật trạng thái thành {label}"}
        raise KeyError(f"Property {landsoft_id} not found")

    def add_property_note(self, landsoft_id: int, content: str, actor: AuthenticatedUser) -> dict:
        for item in self.properties:
            if item["landsoft_id"] == landsoft_id:
                note = {
                    "note_id": self.next_note_id,
                    "created_at": datetime.now(UTC),
                    "created_by": actor.display_name,
                    "content": content,
                }
                self.next_note_id += 1
                item.setdefault("notes", []).append(note)
                return {"landsoft_id": landsoft_id, "message": "Đã thêm ghi chú", "note_id": note["note_id"]}
        raise KeyError(f"Property {landsoft_id} not found")

    def find_owner_by_phone(self, phone: str) -> dict:
        digits = "".join(ch for ch in (phone or "") if ch.isdigit())
        if len(digits) < 9:
            return {"count": 0, "owner_name": None}
        def norm(value) -> str:
            return "".join(ch for ch in str(value or "") if ch.isdigit())
        matches = [item for item in self.properties if norm(item.get("contact_phone")) == digits]
        name = next((m.get("owner_name") for m in matches if m.get("owner_name")), None)
        return {"count": len(matches), "owner_name": name}

    def list_streets(self, district_code: str, keyword: str | None = None) -> list[dict]:
        return []

    def list_customers(self, keyword: str | None, page: int, page_size: int) -> tuple[list[dict], int]:
        customers = [
            {
                "makh": 1001,
                "full_name": "Chị Liên",
                "phone": "0911380022",
                "address": "172 Nguyễn Trãi",
                "registered_at": "2026-06-01 09:00:00",
                "staff_name": "Duy skl",
                "property_count": 2,
            },
            {
                "makh": 1002,
                "full_name": "Anh Tùng",
                "phone": "0903123456",
                "address": "88 Trần Hưng Đạo",
                "registered_at": "2026-06-15 14:30:00",
                "staff_name": "Duy skl",
                "property_count": 1,
            },
        ]
        needle = (keyword or "").strip().casefold()
        if needle:
            customers = [
                item for item in customers
                if needle in item["full_name"].casefold() or needle in (item.get("phone") or "")
            ]
        return customers, len(customers)

    def get_customer(self, makh: int) -> dict | None:
        items, _ = self.list_customers(None, 1, 50)
        found = next((item for item in items if item["makh"] == makh), None)
        if not found:
            return None
        return {
            **found,
            "email": None,
            "note_text": None,
            "notes": [],
            "properties": [
                {
                    "landsoft_id": 501,
                    "title": "Nhà mẫu stub",
                    "address": "172 Nguyễn Trãi",
                    "district_name": "Q.5",
                    "price": 5_200_000_000.0,
                    "area": 52.0,
                    "status_name": "Chờ duyệt",
                    "created_at": "2026-06-20 10:00:00",
                },
            ],
        }

    def list_employees(self, keyword: str | None, page: int, page_size: int) -> tuple[list[dict], int]:
        employees = [
            {"manv": 2, "code": "SKL-001", "full_name": "Duy skl", "phone": "0900000001", "email": None, "department": "Kinh doanh", "role_name": "Chuyên viên", "locked": False},
            {"manv": 130, "code": "SKL-130", "full_name": "Danh Văn Dương", "phone": "0900000002", "email": None, "department": "Kinh doanh", "role_name": "Chuyên viên", "locked": False},
        ]
        needle = (keyword or "").strip().casefold()
        if needle:
            employees = [e for e in employees if needle in e["full_name"].casefold() or needle in (e["code"] or "").casefold()]
        return employees, len(employees)

    def check_house_number(self, house_number: str, district_code: str | None = None) -> dict:
        return {"count": 0, "sample": None}

    def get_next_property_code(self) -> int:
        return self.next_property_id

    def list_property_history(self, landsoft_id: int) -> list[dict]:
        return [
            {"history_id": 1, "created_at": "2026-07-01 09:00:00", "content": "Thêm sản phẩm", "status_name": "Chờ duyệt", "staff_name": "Duy skl"},
        ]

    def list_call_log_employees(self, keyword: str | None = None, limit: int = 300) -> list[dict]:
        employees = [
            {"employee_id": 46, "employee_code": "SKL-038", "employee_name": "Hồ Chí Cường", "today_call_count": 2, "latest_call_at": datetime.now(UTC)},
            {"employee_id": 71, "employee_code": "SKL-063", "employee_name": "Hồ Chí Công", "today_call_count": 1, "latest_call_at": datetime.now(UTC)},
            {"employee_id": 120, "employee_code": "SKL-109", "employee_name": "Nguyễn Hửu Lợi", "today_call_count": 0, "latest_call_at": None},
            {"employee_id": 426, "employee_code": "SKL-409", "employee_name": "Nguyễn Viết Ca", "today_call_count": 3, "latest_call_at": datetime.now(UTC)},
        ]
        needle = (keyword or "").strip().casefold()
        if needle:
            employees = [
                item for item in employees
                if needle in item["employee_code"].casefold() or needle in item["employee_name"].casefold()
            ]
        return employees[:limit]

    def list_call_logs(
        self,
        employee_ids: list[int],
        start,
        end,
        after_id: int | None = None,
        limit: int = 100,
    ) -> dict:
        logs = [
            {
                "log_id": 101,
                "called_at": datetime.now(UTC),
                "employee_id": 426,
                "employee_code": "SKL-409",
                "employee_name": "Nguyễn Viết Ca",
                "landsoft_id": 1001,
                "house_number": "61.",
                "street_name": "Đường 100 Bình Thới",
                "district_name": "Q.11",
                "address": "61. Đường 100 Bình Thới",
                "width": 4,
                "length": 16,
                "area": 64,
                "price": 14.8,
                "owner_phone": "0906862996",
                "created_at": datetime.now(UTC),
            },
            {
                "log_id": 100,
                "called_at": datetime.now(UTC),
                "employee_id": 46,
                "employee_code": "SKL-038",
                "employee_name": "Hồ Chí Cường",
                "landsoft_id": 1002,
                "house_number": "CC5",
                "street_name": "Trường Sơn",
                "district_name": "Q.10",
                "address": "CC5 Trường Sơn",
                "width": 4,
                "length": 28,
                "area": 112,
                "price": 30,
                "owner_phone": "0903388883",
                "created_at": datetime.now(UTC),
            },
        ]
        if employee_ids:
            logs = [item for item in logs if int(item["employee_id"]) in employee_ids]
        if after_id is not None:
            logs = [item for item in logs if int(item["log_id"]) > after_id]
        return {
            "items": logs[:limit],
            "total": len(logs),
            "limit": limit,
            "after_id": after_id,
            "latest_id": max((int(item["log_id"]) for item in logs), default=after_id),
        }

    def create_property(self, payload: dict, actor: AuthenticatedUser) -> dict:
        district_name = next((item["label"] for item in self.lookups["districts"] if item["code"] == payload["district_code"]), payload["district_code"])
        ward_name = next((item["label"] for item in self.lookups["wards"] if item["code"] == payload["ward_code"]), payload["ward_code"])
        status_name = next((item["label"] for item in self.lookups["statuses"] if item["code"] == payload["status_code"]), payload["status_code"])
        prop_type_name = next((item["label"] for item in self.lookups["property_types"] if item["code"] == payload["property_type_code"]), payload["property_type_code"])
        source_name = next((item["label"] for item in self.lookups["sources"] if item["code"] == payload["source_code"]), payload["source_code"])
        legal_name = next((item["label"] for item in self.lookups["legal_statuses"] if item["code"] == payload.get("legal_status_code")), payload.get("legal_status_code"))
        direction_name = next((item["label"] for item in self.lookups["directions"] if item["code"] == payload.get("direction_code")), payload.get("direction_code"))

        new_id = self.next_property_id
        self.next_property_id += 1
        item = {
            "landsoft_id": new_id,
            "code": f"KL-{district_name[:2].upper()}-{new_id}",
            "title": payload["title"],
            "district_code": payload["district_code"],
            "district_name": district_name,
            "ward_code": payload["ward_code"],
            "ward_name": ward_name,
            "address": payload["address"],
            "price": payload["price"],
            "area": payload["area"],
            "status_code": payload["status_code"],
            "status_name": status_name,
            "description": payload.get("description"),
            "owner_name": payload.get("owner_name"),
            "contact_phone": payload.get("contact_phone"),
            "legal_status_code": payload.get("legal_status_code"),
            "legal_status_name": legal_name,
            "direction_code": payload.get("direction_code"),
            "direction_name": direction_name,
            "property_type_code": payload["property_type_code"],
            "property_type_name": prop_type_name,
            "source_code": payload["source_code"],
            "source_name": source_name,
            "notes": [],
        }
        if payload.get("note"):
            item["notes"].append(
                {
                    "note_id": self.next_note_id,
                        "created_at": datetime.now(UTC),
                    "created_by": actor.display_name,
                    "content": payload["note"],
                }
            )
            self.next_note_id += 1
        self.properties.insert(0, item)
        return {"landsoft_id": new_id, "message": "Đã tạo nhà mới trong stub gateway"}
