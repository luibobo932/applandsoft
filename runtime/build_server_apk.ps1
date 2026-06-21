param(
    [Parameter(Mandatory = $true)]
    [string]$ServerApiBaseUrl,
    [switch]$SkipBackendCheck
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $projectRoot "mobile"
$androidDir = Join-Path $mobileDir "android"
$envFile = Join-Path $mobileDir ".env"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"

$normalizedUrl = $ServerApiBaseUrl.Trim().TrimEnd("/")
if (-not $normalizedUrl) {
    throw "ServerApiBaseUrl khong hop le."
}
if ($normalizedUrl -notmatch "^https?://.+/api/v1$") {
    throw "ServerApiBaseUrl phai co dang https://ten-may-chu/api/v1."
}

if (-not $SkipBackendCheck) {
    $serverRoot = $normalizedUrl -replace "/api/v1$", ""
    try {
        $health = Invoke-RestMethod -Uri "$serverRoot/health" -TimeoutSec 20
        $ready = Invoke-RestMethod -Uri "$serverRoot/ready" -TimeoutSec 20
        if (-not $health.ok -or -not $ready.ok) {
            throw "Backend chua san sang."
        }
    } catch {
        throw "Khong build APK vi backend production chua san sang: $($_.Exception.Message)"
    }
}

Set-Content -LiteralPath $envFile -Value "EXPO_PUBLIC_API_BASE_URL=$normalizedUrl" -Encoding UTF8

if (-not $env:JAVA_HOME) {
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
}
if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NODE_ENV = "production"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location $androidDir
.\gradlew.bat generateCodegenArtifactsFromSchema assembleRelease --no-daemon

Write-Host ""
Write-Host "APK server da build xong:"
Write-Host $apkPath
Write-Host "Base URL da dong vao APK:"
Write-Host $normalizedUrl
