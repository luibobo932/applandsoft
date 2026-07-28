# Chay giam sat doi trang thai nha Landsoft (chi doc DB, khong dung cham du lieu goc).
# Khoa mutex: du co 2 launcher khoi dong cung luc, chi 1 ban chay.
$ErrorActionPreference = "Stop"

$script:wdMutex = New-Object System.Threading.Mutex($false, "Local\Landsoft-StatusWatchdog")
if (-not $script:wdMutex.WaitOne(0)) {
    Write-Host "Watchdog dang chay san, bo qua lan mo moi."
    exit 0
}

$backendDir = Split-Path $PSScriptRoot -Parent
Set-Location $backendDir

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { throw "Khong tim thay python trong PATH." }

& $python -X utf8 "scripts\status_watchdog.py" --watch --interval 300
