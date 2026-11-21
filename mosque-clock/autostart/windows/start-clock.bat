@echo off
rem Mosque Clock - start now in kiosk mode
if exist "%LOCALAPPDATA%\MosqueClock\run-hidden.vbs" (
  start "" wscript.exe "%LOCALAPPDATA%\MosqueClock\run-hidden.vbs"
) else (
  start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0mosque-clock.ps1" -Action run
)
