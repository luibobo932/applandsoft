# Landsoft Mobile

App Android độc lập cho Landsoft theo mô hình:

- `backend/`: FastAPI trung gian kết nối SQL Server Landsoft
- `mobile/`: Expo React Native cho Android

## Trạng thái hiện tại

- Backend contract v1 đã dựng xong và có test stub
- Mobile v1 đã có 5 màn hình:
  - Đăng nhập
  - Kho hàng
  - Chi tiết căn
  - Nhập nhà mới
  - Lịch sử thao tác gần đây
- Discovery SQL đã có script nhưng chưa chạy với SQL credentials thật

## Chạy backend local

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile\backend
python -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Chạy mobile local

```powershell
cd D:\12. Tools\anthitphanmem\landsoft-mobile\mobile
Copy-Item .env.example .env
npm install
npx expo start --tunnel
```

## Các file cần chốt trước khi nối DB Landsoft thật

- `backend/.env`
- `backend/config/landsoft_mapping.local.yaml`
- `backend/data/discovery/*.json`
- `backend/docs/DISCOVERY_STATUS.md`
