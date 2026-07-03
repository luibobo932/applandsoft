$ErrorActionPreference = "Stop"

$TaskName = "Landsoft Telegram Call Report Bot"
$BackendDir = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $PSScriptRoot "run_telegram_landsoft_call_report.ps1"

if (-not (Test-Path -LiteralPath $Runner)) {
    throw "Khong tim thay runner: $Runner"
}

$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Runner`"" `
    -WorkingDirectory $BackendDir

$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Bao Telegram khi nhan vien duoc theo doi xem/goi SDT chu nha tren Landsoft." `
    -Force | Out-Null

Write-Host "Da dang ky task: $TaskName"
Write-Host "Co the chay ngay bang lenh:"
Write-Host "Start-ScheduledTask -TaskName `"$TaskName`""
