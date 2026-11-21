@echo off
rem Mosque Clock - stop now (starts again on next boot)
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0mosque-clock.ps1" -Action stop
