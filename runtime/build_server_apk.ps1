$ErrorActionPreference = "Stop"

param(
    [Parameter(Mandatory = $true)]
    [string]$ServerApiBaseUrl
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $projectRoot "mobile"
$androidDir = Join-Path $mobileDir "android"
$envFile = Join-Path $mobileDir ".env"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"

$normalizedUrl = $ServerApiBaseUrl.Trim().TrimEnd("/")
if (-not $normalizedUrl) {
    throw "ServerApiBaseUrl khong hop le."
}

Set-Content -LiteralPath $envFile -Value "EXPO_PUBLIC_API_BASE_URL=$normalizedUrl" -Encoding UTF8

if (-not $env:JAVA_HOME) {
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
}
if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location $androidDir
.\gradlew.bat assembleRelease

Write-Host ""
Write-Host "APK server da build xong:"
Write-Host $apkPath
Write-Host "Base URL da dong vao APK:"
Write-Host $normalizedUrl
