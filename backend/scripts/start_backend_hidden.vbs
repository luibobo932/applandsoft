' Khoi dong backend Landsoft Mobile chay ngam (khong hien cua so terminal)
' Duoc goi tu Task Scheduler moi khi bat may.
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "D:\12. Tools\anthitphanmem\landsoft-mobile\backend"
shell.Run "cmd /c python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> ""D:\12. Tools\anthitphanmem\landsoft-mobile\backend\data\backend.log"" 2>&1", 0, False
