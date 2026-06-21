$ErrorActionPreference = "Stop"

$backendDir = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$pythonExe = if (Test-Path -LiteralPath $venvPython) { $venvPython } else { "python" }
$logDir = Join-Path $backendDir "data"
$logFile = Join-Path $logDir "backend-server.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $backendDir

# Chay backend that tren server, log vao file de de debug sau khi reboot.
& $pythonExe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 *>> $logFile
