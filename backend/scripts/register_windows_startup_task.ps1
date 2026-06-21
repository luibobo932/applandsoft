$ErrorActionPreference = "Stop"

param(
    [string]$TaskName = "LandsoftMobileBackend",
    [string]$WorkingRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)

$backendDir = Join-Path $WorkingRoot "backend"
$runnerPath = Join-Path $backendDir "scripts\run_backend_server.ps1"

if (-not (Test-Path -LiteralPath $runnerPath)) {
    throw "Khong tim thay file runner: $runnerPath"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""

$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Write-Host "Da dang ky task startup: $TaskName"
Write-Host "Neu server reboot, backend se tu chay lai."
