$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $PSScriptRoot
Set-Location $BackendDir

# Chay lien tuc, mac dinh moi 5 phut quet log Landsoft mot lan.
python .\scripts\telegram_landsoft_call_report.py --watch --interval 300
