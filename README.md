# Landsoft Mobile

App Android doc lap de xem kho nha va nhap nha truc tiep vao SQL Server Landsoft.

## Thanh phan

- `backend/`: FastAPI ket noi truc tiep SQL Server Landsoft.
- `mobile/`: React Native + Expo cho Android.
- `render.yaml`: cau hinh backend production tren Render.
- `.github/workflows/build-android-apk.yml`: build APK tren GitHub.
- `.github/workflows/mobile-ci.yml`: kiem tra TypeScript + test moi lan push vao `mobile/`.

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

## Phien ban APK

Menu 3 gach trong app hien "Phien ban <versionName> (build <versionCode>)" doc thang tu
goi APK da cai, de biet may nhan vien dang chay ban nao.

- Build tren GitHub Actions: workflow tu dat `versionName = 1.1.<so lan chay>` va
  `versionCode = 100 + <so lan chay>`, nen ban sau luon lon hon ban truoc.
- Build tay tren may (mac dinh `1.0.0` / `versionCode 1`) — muon dat so rieng:

```bash
cd mobile/android
./gradlew assembleRelease -PappVersionCode=140 -PappVersionName=1.1.40
```

## Ky APK bang keystore rieng

Mac dinh ban release van duoc ky bang `debug.keystore` cua Android (dung duoc, nhung
ai cung co the ky de len). Muon dung chu ky rieng:

1. Tao keystore MOT LAN va cat ky (mat file nay = khong cap nhat duoc app da cai nua,
   nguoi dung phai go ra cai lai):

```bash
keytool -genkeypair -v -keystore landsoft-release.jks -alias landsoft \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. Build tay: truyen 4 gia tri (file `.jks` da bi `.gitignore` chan, khong lo commit nham):

```bash
cd mobile/android
./gradlew assembleRelease \
  -PLANDSOFT_STORE_FILE=/duong/dan/landsoft-release.jks \
  -PLANDSOFT_STORE_PASSWORD=... -PLANDSOFT_KEY_ALIAS=landsoft -PLANDSOFT_KEY_PASSWORD=...
```

3. Build tren GitHub: vao Settings > Secrets and variables > Actions, them
   `ANDROID_KEYSTORE_BASE64` (ket qua `base64 -w0 landsoft-release.jks`),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   Chua them thi workflow van build binh thuong bang debug keystore.

Secret `QUICK_ACCOUNTS` (JSON danh sach tai khoan mo san) la tuy chon: khong dat thi
APK do Actions build se hoi dang nhap 1 lan.

## Kiem tra app truoc khi build

```bash
cd mobile
npm run typecheck
npm test
```

## Chay doc lap khong can laptop

- Windows Server: xem `WINDOWS_SERVER_24X7.md`.
- Xuat cau hinh tu laptop: `backend/scripts/export_server_bootstrap.py`.
- Cloud Render: mo Blueprint tu repo GitHub va dien cac bien SQL duoc danh dau `sync: false`.
