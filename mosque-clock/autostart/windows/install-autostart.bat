@echo off
rem Mosque Clock - install autostart (kiosk on every boot)
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0mosque-clock.ps1" -Action install
if errorlevel 1 pause
