# Discovery status

## Đã xác minh từ môi trường hiện có

- Landsoft desktop đang dùng SQL Server trực tiếp
- Có connection settings trong:
  - `_analysis/landsoft_king_land/LandSoft - King Land/LandSoft.exe.config`
  - `_incoming/ls_zip/user.config`
- Có dấu vết server/catalog:
  - `Data Source=27.0.14.84`
  - `Initial Catalog=NewLand_db`
  - `ServerName=45.119.84.17`
  - `DatabaseName=LandSoftMGL_KingLand`
  - `UserName=SKL-473`
  - `StaffID=490`
- Credential nhạy cảm hiện đang ở dạng mã hóa cục bộ, chưa giải mã được tự động

## Còn thiếu để chốt mapping thật

1. SQL credentials chạy được
2. Chạy:

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile\backend
python scripts\discover_landsoft.py
```

3. Từ output discovery, điền chính xác:
   - auth path
   - read path cho kho hàng
   - write path cho nhập nhà mới
   - lookup tables/procs
4. Ghi lại vào:
   - `config/landsoft_mapping.local.yaml`
   - `data/discovery/landsoft-discovery-*.md`

## Quy tắc thực hiện discovery

- Chỉ dùng SQL parameterized
- Không đoán tên bảng để ghi dữ liệu
- Ưu tiên stored procedure nếu Landsoft đang dùng proc write path
- Mỗi action ghi phải test trên dữ liệu mẫu riêng
