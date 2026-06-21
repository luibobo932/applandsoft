# Landsoft Mobile App

## Man hinh v1

- Dang nhap
- Kho hang
- Chi tiet can
- Nhap nha moi
- Lich su thao tac gan day

## Chay local

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile\mobile
Copy-Item .env.example .env
npm install
npx expo start --tunnel
```

## Build APK tro thang toi backend server

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile
powershell -NoProfile -ExecutionPolicy Bypass -File .\runtime\build_server_apk.ps1 -ServerApiBaseUrl "https://backend-cua-ban/api/v1"
```

Script nay dong thang `EXPO_PUBLIC_API_BASE_URL` vao APK release. Khong nen de fallback tro ve IP laptop.
