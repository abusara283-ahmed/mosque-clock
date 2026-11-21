@echo off
rem Mosque Clock - remove autostart
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0mosque-clock.ps1" -Action uninstall
if errorlevel 1 pause
