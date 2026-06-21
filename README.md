# Landsoft Mobile

App Android doc lap de xem kho nha va nhap nha truc tiep vao SQL Server Landsoft.

## Thanh phan

- `backend/`: FastAPI ket noi truc tiep SQL Server Landsoft.
- `mobile/`: React Native + Expo cho Android.
- `render.yaml`: cau hinh backend production tren Render.
- `.github/workflows/build-android-apk.yml`: build APK tren GitHub.

## Trang thai ky thuat

- Dang nhap bang user Landsoft va key giai ma password.
- Doc danh sach, chi tiet, so dien thoai va lookup tu DB that.
- Cap nhat trang thai, them ghi chu va tao nha moi qua service backend.
- APK release khong con fallback ve IP laptop.
- Backend co hai endpoint kiem tra:
  - `/health`: tien trinh API dang chay.
  - `/ready`: production hop le va SQL Server dang ket noi duoc.

## Chay backend local

```powershell
cd "D:\12. Tools\anthitphanmem\landsoft-mobile\backend"
python -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Build APK tro toi backend production

```powershell
cd "D:\12. Tools\anthitphanmem\landsoft-mobile"
powershell -NoProfile -ExecutionPolicy Bypass -File .\runtime\build_server_apk.ps1 `
  -ServerApiBaseUrl "https://backend-cua-ban/api/v1"
```

Script chi build khi `/health` va `/ready` cua backend deu thanh cong.

## Chay doc lap khong can laptop

- Windows Server: xem `WINDOWS_SERVER_24X7.md`.
- Xuat cau hinh tu laptop: `backend/scripts/export_server_bootstrap.py`.
- Cloud Render: mo Blueprint tu repo GitHub va dien cac bien SQL duoc danh dau `sync: false`.
