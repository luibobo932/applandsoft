# Landsoft Mobile App

## Màn hình v1

- Đăng nhập
- Kho hàng
- Chi tiết căn
- Nhập nhà mới
- Lịch sử thao tác gần đây

## Chạy local

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile\mobile
Copy-Item .env.example .env
npm install
npx expo start --tunnel
```

## Build APK sau khi chốt backend cloud

```powershell
npx eas build --platform android --profile preview
```

Muốn build APK thật cần sửa `EXPO_PUBLIC_API_BASE_URL` sang domain HTTPS của backend.
