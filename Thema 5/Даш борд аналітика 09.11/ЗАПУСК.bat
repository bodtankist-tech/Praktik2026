@echo off
chcp 65001 >nul
title OKO - dashboard
cd /d "%~dp0"

rem Перший запуск (немає .venv або backend\.env): повне налаштування із запитом пароля PostgreSQL
if not exist ".venv\Scripts\python.exe" goto setup
findstr /b /c:"DATABASE_URL=" backend\.env >nul 2>&1 || goto setup

rem Звичайний запуск: бекенд і фронтенд у цьому вікні, браузер відкриється сам
".venv\Scripts\python.exe" run.py
if errorlevel 3 goto setup
rem пауза лише при помилці, щоб було видно її текст
if errorlevel 1 pause
exit /b

:setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup_windows.ps1"
pause
