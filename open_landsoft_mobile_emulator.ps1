$ErrorActionPreference = "Stop"

$sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$adb = Join-Path $sdkRoot "platform-tools\adb.exe"
$emulator = Join-Path $sdkRoot "emulator\emulator.exe"
$apkPath = Join-Path $PSScriptRoot "mobile\android\app\build\outputs\apk\release\app-release.apk"
$packageName = "com.anthitphanmem.landsoftmobile"
$activityName = "com.anthitphanmem.landsoftmobile.MainActivity"
$avdName = "Medium_Phone_API_36.1"
$mobileEnvPath = Join-Path $PSScriptRoot "mobile\.env"
$backendDir = Join-Path $PSScriptRoot "backend"
$backendLauncher = Join-Path $PSScriptRoot "runtime\start_backend_real.ps1"
$backendHealthUrl = "http://127.0.0.1:8000/health"

function Assert-FileExists {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label khong ton tai: $Path"
    }
}

function Get-FirstDevice {
    $output = & $adb devices
    $devices = $output | Select-String "`tdevice$" | ForEach-Object {
        ($_ -split "`t")[0].Trim()
    }
    return $devices | Select-Object -First 1
}

function Wait-ForBoot {
    param(
        [string]$DeviceId,
        [int]$TimeoutSeconds = 180
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $boot = (& $adb -s $DeviceId shell getprop sys.boot_completed 2>$null).Trim()
        if ($boot -eq "1") {
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "Emulator khong boot xong trong $TimeoutSeconds giay."
}

function Test-BackendHealthy {
    try {
        $response = Invoke-WebRequest -Uri $backendHealthUrl -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Ensure-BackendRunning {
    if (Test-BackendHealthy) {
        Write-Host "Backend Landsoft da san sang."
        return
    }

    if (-not (Test-Path -LiteralPath $backendLauncher)) {
        $script = @"
Set-Location '$backendDir'
& 'C:\Users\Duy\AppData\Local\Programs\Python\Python312\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8000
"@
        Set-Content -LiteralPath $backendLauncher -Value $script -Encoding UTF8
    }

    Write-Host "Dang khoi dong backend Landsoft that..."
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "& '$backendLauncher'" -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if (Test-BackendHealthy) {
            Write-Host "Backend Landsoft da len."
            return
        }
        Start-Sleep -Seconds 1
    }

    throw "Khong khoi dong duoc backend Landsoft."
}

Assert-FileExists -Path $adb -Label "adb"
Assert-FileExists -Path $emulator -Label "Android emulator"
Assert-FileExists -Path $apkPath -Label "APK release"

Ensure-BackendRunning

$deviceId = Get-FirstDevice
if (-not $deviceId) {
    Write-Host "Dang mo Android emulator..."
    Start-Process -FilePath $emulator -ArgumentList @("-avd", $avdName, "-netdelay", "none", "-netspeed", "full")
    Start-Sleep -Seconds 8
    & $adb wait-for-device | Out-Null
    $deviceId = Get-FirstDevice
}

if (-not $deviceId) {
    throw "Khong tim thay Android emulator."
}

Write-Host "Dang doi emulator boot xong..."
Wait-ForBoot -DeviceId $deviceId

Write-Host "Dang cai APK vao emulator..."
& $adb -s $deviceId install -r $apkPath | Out-Host

Write-Host "Dang mo Landsoft Mobile..."
& $adb -s $deviceId shell am start -n "$packageName/$activityName" | Out-Host

Write-Host ""
Write-Host "Da mo Landsoft Mobile tren emulator."
Write-Host "Neu dang test tren emulator, bam nut 'May nay' de dung:"
Write-Host "http://10.0.2.2:8000/api/v1"
if (Test-Path -LiteralPath $mobileEnvPath) {
    $apiLine = Get-Content -LiteralPath $mobileEnvPath | Where-Object { $_ -match '^EXPO_PUBLIC_API_BASE_URL=' } | Select-Object -First 1
    if ($apiLine) {
        $apiUrl = ($apiLine -split '=', 2)[1].Trim()
        if ($apiUrl) {
            Write-Host "Neu can dang nhap thu cong, dung API:"
            Write-Host $apiUrl
        }
    }
}
