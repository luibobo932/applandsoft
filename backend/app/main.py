import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse

from app.core.config import get_settings
from app.db.sqlserver import check_sql_connection
from app.routers import activity, auth, call_logs, lookups, me, properties

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        openapi_url=f"{settings.api_prefix}/openapi.json",
        docs_url=f"{settings.api_prefix}/docs",
        redoc_url=f"{settings.api_prefix}/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["system"])
    def healthcheck() -> dict:
        return {
            "ok": True,
            "app": settings.app_name,
            "env": settings.app_env,
            "stub_gateway": settings.use_stub_gateway,
        }

    @app.get("/ready", tags=["system"])
    def readiness() -> JSONResponse:
        config_errors = settings.production_config_errors
        if config_errors:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"ok": False, "reason": "invalid_config", "errors": config_errors},
            )

        if settings.use_stub_gateway:
            return JSONResponse(content={"ok": True, "mode": "stub"})

        try:
            check_sql_connection()
        except Exception:
            logger.exception("Readiness check khong ket noi duoc SQL Server Landsoft")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"ok": False, "reason": "sql_unavailable"},
            )

        return JSONResponse(content={"ok": True, "mode": "landsoft-sql"})

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    def landing_page(request: Request) -> str:
        api_url = f"{request.base_url}api/v1".rstrip("/")
        base_url = str(request.base_url).rstrip("/")
        apk_exists = bool(settings.android_apk_download_url) or settings.android_apk_file.exists()
        apk_note = "APK Android da san sang de tai." if apk_exists else "APK chua duoc build tren may chu nay."
        apk_url = settings.android_apk_download_url or f"{base_url}/download/android"
        return f"""
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Landsoft Mobile</title>
  <style>
    body {{
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f4f7fb;
      color: #0f172a;
    }}
    main {{
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }}
    h1 {{
      font-size: 28px;
      margin-bottom: 8px;
    }}
    p {{
      line-height: 1.5;
      color: #334155;
    }}
    .panel {{
      background: #fff;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
    }}
    .cta {{
      display: inline-block;
      margin-top: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      background: #0f766e;
      color: #fff;
      text-decoration: none;
      font-weight: 700;
      font-size: 18px;
      border: 0;
      cursor: pointer;
    }}
    .cta-secondary {{
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      margin-left: 8px;
    }}
    .muted {{
      margin-top: 12px;
      font-size: 14px;
      color: #64748b;
    }}
    code {{
      display: block;
      margin-top: 8px;
      padding: 12px;
      border-radius: 8px;
      background: #e2e8f0;
      word-break: break-all;
    }}
    ol {{
      padding-left: 20px;
    }}
  </style>
</head>
<body>
  <main>
    <h1>Landsoft Mobile</h1>
    <p>Trang nay dung de cai app Android va lay dung URL backend cho dien thoai.</p>

    <section class="panel">
      <strong>Tai app Android</strong>
      <p>{apk_note}</p>
      <button class="cta" type="button" onclick="startApkDownload()">Tai APK Android</button>
      <a class="cta cta-secondary" href="{apk_url}" target="_blank" rel="noopener noreferrer" onclick="openApkInBrowser(event)">Mo file APK</a>
      <code>{apk_url}</code>
      <p class="muted">Neu bam nut khong thay tai xuong, bam "Mo file APK" de mo link tai truc tiep tren trinh duyet.</p>
    </section>

    <section class="panel">
      <strong>URL backend de dang nhap trong app</strong>
      <code>{api_url}</code>
    </section>

    <section class="panel">
      <strong>Cach dung</strong>
      <ol>
        <li>Tai va cai APK Android.</li>
        <li>Mo app Landsoft Mobile.</li>
        <li>Neu app hoi API backend, dan URL o tren.</li>
        <li>Dang nhap bang tai khoan Landsoft cua ban.</li>
      </ol>
    </section>
  </main>
  <script>
    const apkUrl = "{apk_url}";

    function startApkDownload() {{
      window.location.assign(apkUrl + "?t=" + Date.now());
    }}

    function openApkInBrowser(event) {{
      event.preventDefault();
      window.open(apkUrl + "?t=" + Date.now(), "_blank", "noopener,noreferrer");
    }}
  </script>
</body>
</html>
"""

    @app.get("/download/android", include_in_schema=False)
    def download_android_apk():
        if settings.android_apk_download_url:
            return RedirectResponse(settings.android_apk_download_url)
        apk_file = settings.android_apk_file
        if not apk_file.exists():
            return HTMLResponse("APK chua san sang tren may chu nay.", status_code=404)
        return FileResponse(
            path=apk_file,
            media_type="application/octet-stream",
            filename="landsoft-mobile.apk",
        )

    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(me.router, prefix=settings.api_prefix)
    app.include_router(lookups.router, prefix=settings.api_prefix)
    app.include_router(properties.router, prefix=settings.api_prefix)
    app.include_router(activity.router, prefix=settings.api_prefix)
    app.include_router(call_logs.router, prefix=settings.api_prefix)
    return app


app = create_app()
