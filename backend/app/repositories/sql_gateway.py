from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.core.landsoft_crypto import decrypt_landsoft_password
from app.db.sqlserver import open_sql_connection
from app.repositories.gateway import AuthenticatedUser


class SqlLandsoftGateway:
    LIST_BASE_SQL = """
        FROM dbo.mglbcBanChoThue bc
        LEFT JOIN dbo.Huyen h ON h.MaHuyen = bc.MaHuyen
        LEFT JOIN dbo.Xa x ON x.MaXa = bc.MaXa
        LEFT JOIN dbo.Street s ON s.ID = bc.StreetID
        LEFT JOIN dbo.LoaiBDS lbds ON lbds.MaLBDS = bc.MaLBDS
        LEFT JOIN dbo.mglbcTrangThai tt ON tt.MaTT = bc.MaTT
        LEFT JOIN dbo.KhachHang kh ON kh.MaKH = bc.MaKH
        WHERE 1 = 1
    """

    LIST_SELECT_SQL = """
        SELECT
            bc.MaBC AS landsoft_id,
            COALESCE(NULLIF(bc.SoDK, N''), NULLIF(bc.KyHieu, N''), CAST(bc.MaBC AS nvarchar(20))) AS code,
            COALESCE(
                NULLIF(bc.TieuDe, N''),
                NULLIF(LTRIM(RTRIM(COALESCE(lbds.TenLBDS, N'') + N' ' + COALESCE(s.Names, N''))), N''),
                N'Căn ' + CAST(bc.MaBC AS nvarchar(20))
            ) AS title,
            CAST(bc.MaHuyen AS nvarchar(20)) AS district_code,
            h.TenHuyen AS district_name,
            CAST(bc.MaXa AS nvarchar(20)) AS ward_code,
            x.TenXa AS ward_name,
            LTRIM(RTRIM(
                COALESCE(bc.SoNha, N'')
                + CASE WHEN ISNULL(bc.SoNha, N'') <> N'' AND ISNULL(s.Names, N'') <> N'' THEN N' ' ELSE N'' END
                + COALESCE(s.Names, N'')
            )) AS address,
            CAST(bc.ThanhTien AS float) AS price,
            CAST(COALESCE(NULLIF(bc.DienTich, 0), NULLIF(bc.DienTichKV, 0), NULLIF(bc.DienTichXD, 0)) AS float) AS area,
            CAST(bc.MaTT AS nvarchar(20)) AS status_code,
            tt.TenTT AS status_name,
            COALESCE(NULLIF(CAST(bc.NoiDung AS nvarchar(max)), N''), NULLIF(bc.DienGiai, N''), NULLIF(bc.TieuDe, N''), N'') AS description,
            LTRIM(RTRIM(COALESCE(kh.HoKH, N'') + CASE WHEN ISNULL(kh.HoKH, N'') <> N'' AND ISNULL(kh.TenKH, N'') <> N'' THEN N' ' ELSE N'' END + COALESCE(kh.TenKH, N''))) AS owner_name,
            COALESCE(NULLIF(kh.DiDong, N''), NULLIF(bc.DienThoaiNDD, N''), N'') AS contact_phone,
            CAST(COALESCE(NULLIF(bc.NgangKV, 0), 0) AS float) AS width,
            CAST(COALESCE(NULLIF(bc.DaiKV, 0), 0) AS float) AS length
    """

    DETAIL_SQL = """
        SELECT
            bc.MaBC AS landsoft_id,
            COALESCE(NULLIF(bc.SoDK, N''), NULLIF(bc.KyHieu, N''), CAST(bc.MaBC AS nvarchar(20))) AS code,
            COALESCE(
                NULLIF(bc.TieuDe, N''),
                NULLIF(LTRIM(RTRIM(COALESCE(lbds.TenLBDS, N'') + N' ' + COALESCE(s.Names, N''))), N''),
                N'Căn ' + CAST(bc.MaBC AS nvarchar(20))
            ) AS title,
            CAST(bc.MaHuyen AS nvarchar(20)) AS district_code,
            h.TenHuyen AS district_name,
            CAST(bc.MaXa AS nvarchar(20)) AS ward_code,
            x.TenXa AS ward_name,
            LTRIM(RTRIM(
                COALESCE(bc.SoNha, N'')
                + CASE WHEN ISNULL(bc.SoNha, N'') <> N'' AND ISNULL(s.Names, N'') <> N'' THEN N' ' ELSE N'' END
                + COALESCE(s.Names, N'')
            )) AS address,
            CAST(bc.ThanhTien AS float) AS price,
            CAST(COALESCE(NULLIF(bc.DienTich, 0), NULLIF(bc.DienTichKV, 0), NULLIF(bc.DienTichXD, 0)) AS float) AS area,
            CAST(bc.MaTT AS nvarchar(20)) AS status_code,
            tt.TenTT AS status_name,
            COALESCE(NULLIF(CAST(bc.NoiDung AS nvarchar(max)), N''), NULLIF(bc.DienGiai, N''), NULLIF(bc.TieuDe, N''), N'') AS description,
            LTRIM(RTRIM(COALESCE(kh.HoKH, N'') + CASE WHEN ISNULL(kh.HoKH, N'') <> N'' AND ISNULL(kh.TenKH, N'') <> N'' THEN N' ' ELSE N'' END + COALESCE(kh.TenKH, N''))) AS owner_name,
            COALESCE(NULLIF(kh.DiDong, N''), NULLIF(bc.DienThoaiNDD, N''), N'') AS contact_phone,
            CAST(bc.MaPL AS nvarchar(20)) AS legal_status_code,
            pl.TenPL AS legal_status_name,
            CAST(COALESCE(NULLIF(bc.MaHuong, 0), 0) AS nvarchar(20)) AS direction_code,
            ph.TenPhuongHuong AS direction_name,
            CAST(bc.MaLBDS AS nvarchar(20)) AS property_type_code,
            lbds.TenLBDS AS property_type_name,
            CAST(bc.MaNguon AS nvarchar(20)) AS source_code,
            nguon.TenNguon AS source_name
        FROM dbo.mglbcBanChoThue bc
        LEFT JOIN dbo.Huyen h ON h.MaHuyen = bc.MaHuyen
        LEFT JOIN dbo.Xa x ON x.MaXa = bc.MaXa
        LEFT JOIN dbo.Street s ON s.ID = bc.StreetID
        LEFT JOIN dbo.LoaiBDS lbds ON lbds.MaLBDS = bc.MaLBDS
        LEFT JOIN dbo.mglbcTrangThai tt ON tt.MaTT = bc.MaTT
        LEFT JOIN dbo.KhachHang kh ON kh.MaKH = bc.MaKH
        LEFT JOIN dbo.PhapLy pl ON pl.MaPL = bc.MaPL
        LEFT JOIN dbo.PhuongHuong ph ON ph.MaPhuongHuong = bc.MaHuong
        LEFT JOIN dbo.mglNguon nguon ON nguon.MaNguon = bc.MaNguon
        WHERE bc.MaBC = ?
    """

    NOTES_SQL = """
        SELECT
            nx.ID AS note_id,
            nx.NgayXL AS created_at,
            COALESCE(NULLIF(nv.MaSo, N''), NULLIF(nv.HoTen, N''), N'Landsoft') AS created_by,
            LTRIM(RTRIM(
                COALESCE(NULLIF(nx.TieuDe, N''), N'')
                + CASE WHEN ISNULL(nx.TieuDe, N'') <> N'' AND ISNULL(nx.NoiDung, N'') <> N'' THEN N': ' ELSE N'' END
                + COALESCE(NULLIF(nx.NoiDung, N''), NULLIF(nx.KetQua, N''), N'')
            )) AS content
        FROM dbo.mglbcNhatKyXuLy nx
        LEFT JOIN dbo.NhanVien nv ON nv.MaNV = COALESCE(nx.MaNVG, nx.MaNVN)
        WHERE nx.MaBC = ?
        ORDER BY nx.ID DESC
    """

    def _row_to_dict(self, cursor, row) -> dict[str, Any]:
        columns = [col[0] for col in cursor.description]
        return {columns[index]: row[index] for index in range(len(columns))}

    def _fetch_all_dicts(self, cursor) -> list[dict[str, Any]]:
        if not cursor.description:
            return []
        columns = [col[0] for col in cursor.description]
        return [{columns[index]: row[index] for index in range(len(columns))} for row in cursor.fetchall()]

    def _build_where_clause(self, filters: dict) -> tuple[str, list[Any]]:
        clauses: list[str] = []
        params: list[Any] = []

        keyword = (filters.get("keyword") or "").strip()
        if keyword:
            like = f"%{keyword}%"
            clauses.append(
                """
                AND (
                    bc.SoDK LIKE ? OR bc.KyHieu LIKE ? OR bc.TieuDe LIKE ? OR
                    CAST(bc.NoiDung AS nvarchar(max)) LIKE ? OR bc.DienGiai LIKE ? OR
                    bc.SoNha LIKE ? OR s.Names LIKE ? OR
                    (COALESCE(kh.HoKH, N'') + N' ' + COALESCE(kh.TenKH, N'')) LIKE ? OR
                    kh.DiDong LIKE ?
                )
                """
            )
            params.extend([like] * 9)

        district = (filters.get("district") or "").strip()
        if district:
            clauses.append("AND bc.MaHuyen = ?")
            params.append(int(district))

        ward = (filters.get("ward") or "").strip()
        if ward:
            clauses.append("AND bc.MaXa = ?")
            params.append(int(ward))

        status = (filters.get("status") or "").strip()
        if status:
            clauses.append("AND bc.MaTT = ?")
            params.append(int(status))

        if filters.get("price_min") is not None:
            clauses.append("AND bc.ThanhTien >= ?")
            params.append(float(filters["price_min"]) * 1_000_000_000)

        if filters.get("price_max") is not None:
            clauses.append("AND bc.ThanhTien <= ?")
            params.append(float(filters["price_max"]) * 1_000_000_000)

        if filters.get("area_min") is not None:
            clauses.append("AND COALESCE(NULLIF(bc.DienTich, 0), NULLIF(bc.DienTichKV, 0), NULLIF(bc.DienTichXD, 0)) >= ?")
            params.append(float(filters["area_min"]))

        if filters.get("area_max") is not None:
            clauses.append("AND COALESCE(NULLIF(bc.DienTich, 0), NULLIF(bc.DienTichKV, 0), NULLIF(bc.DienTichXD, 0)) <= ?")
            params.append(float(filters["area_max"]))

        return "\n".join(clauses), params

    def _fetch_first_result(self, cursor):
        while True:
            if cursor.description is not None:
                return cursor.fetchone()
            if not cursor.nextset():
                return None

    @staticmethod
    def _split_owner_name(full_name: str | None) -> tuple[str, str]:
        cleaned = (full_name or "").strip()
        if not cleaned:
            return "", ""
        parts = [part for part in cleaned.split() if part]
        if len(parts) == 1:
            return "", parts[0]
        return " ".join(parts[:-1]), parts[-1]

    @staticmethod
    def _extract_house_number(address: str, street_name: str | None) -> str:
        cleaned_address = address.strip()
        cleaned_street = (street_name or "").strip()
        if not cleaned_address or not cleaned_street:
            return cleaned_address

        if cleaned_address.casefold().endswith(cleaned_street.casefold()):
            house_number = cleaned_address[: len(cleaned_address) - len(cleaned_street)].rstrip(" ,-/")
            if house_number:
                return house_number
        return cleaned_address

    @staticmethod
    def _price_to_vnd(price_in_billion: float) -> float:
        return round(price_in_billion * 1_000_000_000, 4)

    @staticmethod
    def _format_price_text(price_in_billion: float) -> str:
        total_million = int(round(price_in_billion * 1000))
        billions = total_million // 1000
        millions = total_million % 1000
        if billions > 0 and millions > 0:
            return f"{billions} tỷ {millions} triệu"
        if billions > 0:
            return f"{billions} tỷ"
        return f"{millions} triệu"

    def _resolve_ward(self, ward_code: str, district_code: str) -> dict[str, Any]:
        with open_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT TOP 1 MaXa, TenXa, MaHuyen
                FROM dbo.Xa
                WHERE MaXa = ? AND MaHuyen = ?
                """,
                int(ward_code),
                int(district_code),
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError("Phường hoặc quận không hợp lệ trong Landsoft.")
            return self._row_to_dict(cursor, row)

    def _resolve_street_id(self, district_code: str, street_name: str | None) -> int | None:
        street_name = (street_name or "").strip()
        if not street_name:
            return None
        with open_sql_connection() as conn:
            cursor = conn.cursor()
            like = f"%{street_name}%"
            cursor.execute(
                """
                SELECT TOP 1 ID
                FROM dbo.Street
                WHERE DistrictID = ? AND (Names = ? OR Names LIKE ?)
                ORDER BY CASE WHEN Names = ? THEN 0 ELSE 1 END, LEN(Names), Names
                """,
                int(district_code),
                street_name,
                like,
                street_name,
            )
            row = cursor.fetchone()
            return int(row[0]) if row else None

    def authenticate_landsoft_user(self, username: str, password: str) -> AuthenticatedUser | None:
        with open_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("EXEC dbo.NhanVien_Login @MaSo=?", username)
            row = cursor.fetchone()
            if not row:
                return None
            record = self._row_to_dict(cursor, row)

        stored_password = record.get("MatKhau") or ""
        if decrypt_landsoft_password(stored_password) != password:
            return None

        return AuthenticatedUser(
            username=record["MaSo"],
            display_name=(record.get("HoTen") or record["MaSo"]).strip(),
            auth_source="landsoft-db",
            landsoft_username=record["MaSo"],
            landsoft_user_id=int(record["MaNV"]),
            department_id=record.get("MaPB"),
            role_name=record.get("PerName"),
        )

    def get_lookups(self) -> dict:
        with open_sql_connection() as conn:
            cursor = conn.cursor()

            queries = {
                "districts": """
                    SELECT code, label
                    FROM (
                        SELECT DISTINCT
                            CAST(h.MaHuyen AS nvarchar(20)) AS code,
                            h.TenHuyen AS label
                        FROM dbo.mglbcBanChoThue bc
                        INNER JOIN dbo.Huyen h ON h.MaHuyen = bc.MaHuyen
                        WHERE bc.MaHuyen IS NOT NULL
                          AND h.TenHuyen IS NOT NULL
                          AND LTRIM(RTRIM(h.TenHuyen)) <> N''
                    ) AS q
                    ORDER BY q.label
                """,
                "wards": """
                    SELECT code, label, parent_code
                    FROM (
                        SELECT DISTINCT
                            CAST(x.MaXa AS nvarchar(20)) AS code,
                            x.TenXa AS label,
                            CAST(x.MaHuyen AS nvarchar(20)) AS parent_code
                        FROM dbo.mglbcBanChoThue bc
                        INNER JOIN dbo.Xa x ON x.MaXa = bc.MaXa
                        WHERE bc.MaXa IS NOT NULL
                          AND x.TenXa IS NOT NULL
                          AND LTRIM(RTRIM(x.TenXa)) <> N''
                    ) AS q
                    ORDER BY q.parent_code, q.label
                """,
                "property_types": "SELECT CAST(MaLBDS AS nvarchar(20)) AS code, TenLBDS AS label FROM dbo.LoaiBDS ORDER BY STT, MaLBDS",
                "directions": "SELECT CAST(MaPhuongHuong AS nvarchar(20)) AS code, TenPhuongHuong AS label FROM dbo.PhuongHuong ORDER BY MaPhuongHuong",
                "legal_statuses": "SELECT CAST(MaPL AS nvarchar(20)) AS code, TenPL AS label FROM dbo.PhapLy ORDER BY MaPL",
                "statuses": "SELECT CAST(MaTT AS nvarchar(20)) AS code, TenTT AS label FROM dbo.mglbcTrangThai ORDER BY STT",
                "sources": "SELECT CAST(MaNguon AS nvarchar(20)) AS code, TenNguon AS label FROM dbo.mglNguon ORDER BY MaNguon",
            }

            payload: dict[str, list[dict[str, Any]]] = {}
            for key, sql in queries.items():
                cursor.execute(sql)
                payload[key] = self._fetch_all_dicts(cursor)
            return payload

    def list_properties(self, filters: dict) -> tuple[list[dict], int]:
        page = max(int(filters.get("page", 1)), 1)
        page_size = max(min(int(filters.get("page_size", 20)), 100), 1)
        offset = (page - 1) * page_size
        extra_where, where_params = self._build_where_clause(filters)

        with open_sql_connection() as conn:
            cursor = conn.cursor()
            count_sql = f"SELECT COUNT(*) {self.LIST_BASE_SQL} {extra_where}"
            cursor.execute(count_sql, where_params)
            total = int(cursor.fetchone()[0])

            list_sql = (
                f"{self.LIST_SELECT_SQL} {self.LIST_BASE_SQL} {extra_where} "
                "ORDER BY bc.NgayCN DESC, bc.MaBC DESC "
                "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
            )
            cursor.execute(list_sql, [*where_params, offset, page_size])
            items = self._fetch_all_dicts(cursor)
            return items, total

    def get_property(self, landsoft_id: int) -> dict | None:
        with open_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(self.DETAIL_SQL, landsoft_id)
            row = cursor.fetchone()
            if not row:
                return None
            result = self._row_to_dict(cursor, row)

            cursor.execute(self.NOTES_SQL, landsoft_id)
            result["notes"] = self._fetch_all_dicts(cursor)
            return result

    def update_property_status(self, landsoft_id: int, status_code: str, actor: AuthenticatedUser) -> dict:
        with open_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE dbo.mglbcBanChoThue
                SET MaTT = ?, NgayCN = GETDATE(), MaNVCS = ?
                WHERE MaBC = ?
                """,
                int(status_code),
                actor.landsoft_user_id,
                landsoft_id,
            )
            if cursor.rowcount == 0:
                raise ValueError("Không tìm thấy căn để cập nhật trạng thái.")
            conn.commit()
            return {"landsoft_id": landsoft_id, "message": "Đã cập nhật trạng thái vào Landsoft"}

    def add_property_note(self, landsoft_id: int, content: str, actor: AuthenticatedUser) -> dict:
        with open_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO dbo.mglbcNhatKyXuLy (NgayXL, TieuDe, NoiDung, KetQua, MaNVG, MaNVN, MaPT, MaBC)
                VALUES (GETDATE(), N'Ghi chú mobile', ?, NULL, ?, ?, NULL, ?)
                """,
                content,
                actor.landsoft_user_id,
                actor.landsoft_user_id,
                landsoft_id,
            )
            conn.commit()
            return {"landsoft_id": landsoft_id, "message": "Đã thêm ghi chú vào Landsoft"}

    def create_property(self, payload: dict, actor: AuthenticatedUser) -> dict:
        if not actor.landsoft_user_id:
            raise ValueError("User hiện tại chưa map với nhân viên Landsoft.")

        ward = self._resolve_ward(payload["ward_code"], payload["district_code"])
        street_id = self._resolve_street_id(payload["district_code"], payload.get("street_name"))
        total_price = self._price_to_vnd(float(payload["price"]))
        area = float(payload["area"])
        don_gia = round(total_price / area, 4) if area > 0 else 0
        owner_first_name, owner_last_name = self._split_owner_name(payload.get("owner_name"))
        is_sale = 0 if payload.get("listing_type") == "thue" else 1
        address_text = payload["address"].strip()
        house_number = self._extract_house_number(address_text, payload.get("street_name"))
        description = (payload.get("description") or "").strip()
        note = (payload.get("note") or "").strip()

        with open_sql_connection() as conn:
            conn.autocommit = False
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                    DECLARE @t TABLE (MaKH int);
                    INSERT INTO dbo.KhachHang (
                        HoKH, TenKH, DiDong, Email, DiaChi, MaXa, MaHuyen, MaTinh, MaNV, IsPersonal, NgayDangKy
                    )
                    OUTPUT inserted.MaKH INTO @t(MaKH)
                    VALUES (?, ?, ?, N'', ?, ?, ?, 1, ?, 1, GETDATE());
                    SELECT TOP 1 MaKH FROM @t;
                    """,
                    owner_first_name,
                    owner_last_name,
                    payload.get("contact_phone") or "",
                    address_text,
                    int(payload["ward_code"]),
                    int(payload["district_code"]),
                    actor.landsoft_user_id,
                )
                customer_row = self._fetch_first_result(cursor)
                if not customer_row:
                    raise RuntimeError("Không tạo được khách hàng chủ nhà trong Landsoft.")
                customer_id = int(customer_row[0])

                cursor.execute(
                    """
                    DECLARE @t TABLE (MaBC int);
                    INSERT INTO dbo.mglbcBanChoThue (
                        NgayDK, ThoiHan, MaTT, MaKH, MaNVKD, MaNVCS, TyLeHH, MaNVKT, IsBan,
                        KyHieu, MaLBDS, MaDA, DienTich, DonGia, ThanhTien, GiaGoc, MaLT, MaDVT,
                        GiaText, DuongRong, PhongKhach, PhongNgu, PhongTam, SoTang, DienGiai,
                        ChiaSe, SoNha, DiaChi, DiaChiKD, MaHuyen, TyLeMG, PhiMG, MaHuong, MaPL,
                        MaLD, DienTichKV, NgangKV, DaiKV, SauKV, DienTichXD, NgangXD, DaiXD, SauXD,
                        NoiBat, NgayCN, MaCD, MaNguon, ThuongLuong, ChinhChu, KichHoat, NgayKH,
                        HoTenNDD, DienThoaiNDD, HoTenNTG, MaKG, StreetID, MaXa, LinkSource, TieuDe,
                        NoiDung, MaNVQL, Huong, TangHam, TangLung, SanThuong, ShowWeb, LoaiPMG,
                        SoHongID, NoteDoiGia, NoteDaBan
                    )
                    OUTPUT inserted.MaBC INTO @t(MaBC)
                    VALUES (
                        GETDATE(), 0, ?, ?, ?, ?, 0, ?, ?,
                        N'', ?, NULL, ?, ?, ?, 0, 1, 1,
                        ?, 0, 0, ?, ?, ?, ?,
                        0, ?, ?, ?, ?, 0, 0, ?, ?,
                        ?, ?, ?, ?, 0, 0, 0, 0, 0,
                        NULL, GETDATE(), 2, ?, 0, 0, 1, GETDATE(),
                        N'', ?, NULL, NULL, ?, ?, ?, ?,
                        ?, NULL, N'', 0, 0, 0, NULL, N'%',
                        NULL, NULL, NULL
                    );
                    SELECT TOP 1 MaBC FROM @t;
                    """,
                    int(payload["status_code"]),
                    customer_id,
                    actor.landsoft_user_id,
                    actor.landsoft_user_id,
                    actor.landsoft_user_id,
                    is_sale,
                    int(payload["property_type_code"]),
                    area,
                    don_gia,
                    total_price,
                    self._format_price_text(float(payload["price"])),
                    int(payload.get("bedrooms") or 0),
                    int(payload.get("bathrooms") or 0),
                    int(payload.get("floors") or 0),
                    description,
                    house_number,
                    address_text,
                    address_text,
                    int(payload["district_code"]),
                    int(payload.get("direction_code") or 0),
                    int(payload.get("legal_status_code") or 1),
                    3,
                    area,
                    float(payload.get("width") or 0),
                    float(payload.get("length") or 0),
                    int(payload["source_code"]),
                    payload.get("contact_phone") or "",
                    street_id,
                    int(payload["ward_code"]),
                    "mobile-app",
                    payload["title"].strip(),
                    description,
                )
                property_row = self._fetch_first_result(cursor)
                if not property_row:
                    raise RuntimeError("Không tạo được căn mới trong Landsoft.")
                landsoft_id = int(property_row[0])

                if note:
                    cursor.execute(
                        """
                        INSERT INTO dbo.mglbcNhatKyXuLy (NgayXL, TieuDe, NoiDung, KetQua, MaNVG, MaNVN, MaPT, MaBC)
                        VALUES (GETDATE(), N'Ghi chú mobile', ?, NULL, ?, ?, NULL, ?)
                        """,
                        note,
                        actor.landsoft_user_id,
                        actor.landsoft_user_id,
                        landsoft_id,
                    )

                conn.commit()
                return {"landsoft_id": landsoft_id, "message": "Đã tạo nhà mới vào Landsoft"}
            except Exception:
                conn.rollback()
                raise
