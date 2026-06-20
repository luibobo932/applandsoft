# Landsoft MGL discovery

## Kết nối thật đã xác minh

- SQL Server: `45.119.84.17`
- Database: `LandSoftMGL_KingLand`
- Desktop config lưu `Conn` dạng mã hóa đối xứng
- `Conn` đã giải ra:
  - `Data Source=45.119.84.17`
  - `Initial Catalog=LandSoftMGL_KingLand`
  - `User ID=LandSoftMGL_KingLand`
- Mật khẩu user SQL đã xác minh chạy được qua `pyodbc`

## Auth path

- User table: `NhanVien`
- Login proc: `dbo.NhanVien_Login(@MaSo)`
- Proc trả:
  - `MaNV`
  - `MaSo`
  - `HoTen`
  - `MatKhau`
  - `PerID`
  - `MaPB`
  - `PerName`
- `MatKhau` lưu bằng RSA custom của Landsoft
- `CommonCls.GiaiMa` trong `LandSoft.exe` giải đúng về password plain text
- Backend đã reimplement giải mã password trong `app/core/landsoft_crypto.py`

## Read path cho kho hàng

- Bảng inventory thật: `dbo.mglbcBanChoThue`
- Lookup tables:
  - `Huyen`
  - `Xa`
  - `Street`
  - `LoaiBDS`
  - `mglbcTrangThai`
  - `mglNguon`
  - `PhapLy`
  - `PhuongHuong`
- Proc search gốc của desktop:
  - `dbo.mglbcBanChoThue_Search`
- Backend v1 hiện query trực tiếp `mglbcBanChoThue` + joins để hỗ trợ:
  - keyword
  - district
  - ward
  - status
  - price range
  - area range

## Detail path

- Detail source:
  - `dbo.mglbcBanChoThue`
  - `KhachHang`
  - `Street`
  - `Huyen`
  - `Xa`
  - `LoaiBDS`
  - `mglbcTrangThai`
  - `mglNguon`
  - `PhapLy`
  - `PhuongHuong`
- Notes source:
  - `dbo.mglbcNhatKyXuLy`

## Write path cho nhập nhà mới

### 1. Tạo chủ nhà

- Bảng: `dbo.KhachHang`
- Cách insert thực tế đang chạy được:
  - insert trực tiếp
  - lấy `MaKH` bằng `OUTPUT inserted.MaKH`
- Fields v1 dùng:
  - `HoKH`
  - `TenKH`
  - `DiDong`
  - `DiaChi`
  - `MaXa`
  - `MaHuyen`
  - `MaTinh`
  - `MaNV`
  - `IsPersonal`
  - `NgayDangKy`

### 2. Tạo căn mới

- Bảng: `dbo.mglbcBanChoThue`
- `MaBC` là identity
- Trigger sau insert:
  - `mglbcBanChoThue_ForInsert`
  - tự sinh `KyHieu` và `SoDK`
  - gọi `alAlert_Insert`
- Backend v1 insert trực tiếp và đã verify bằng transaction rollback

### 3. Fields create v1 đang map

- `MaTT`
- `MaKH`
- `MaNVKD`
- `MaNVCS`
- `MaNVKT`
- `IsBan`
- `MaLBDS`
- `DienTich`
- `DonGia`
- `ThanhTien`
- `MaLT`
- `MaDVT`
- `GiaText`
- `PhongNgu`
- `PhongTam`
- `SoTang`
- `DienGiai`
- `SoNha`
- `DiaChi`
- `DiaChiKD`
- `MaHuyen`
- `MaHuong`
- `MaPL`
- `MaLD`
- `DienTichKV`
- `NgangKV`
- `DaiKV`
- `MaCD`
- `MaNguon`
- `KichHoat`
- `MaXa`
- `StreetID`
- `TieuDe`
- `NoiDung`

## Status update path

- Update trực tiếp:
  - `dbo.mglbcBanChoThue.MaTT`
  - set thêm `NgayCN`
  - set `MaNVCS`

## Notes path

- Insert trực tiếp vào:
  - `dbo.mglbcNhatKyXuLy`
- Fields v1:
  - `NgayXL`
  - `TieuDe`
  - `NoiDung`
  - `MaNVG`
  - `MaNVN`
  - `MaBC`

## Verify đã làm

- Connect DB thật: pass
- Read row counts: pass
- Resolve auth row `SKL-473`: pass
- Decrypt mật khẩu user từ DB: pass
- Insert customer + insert property trong transaction rollback: pass
- Trigger tự sinh `SoDK/KyHieu`: pass
