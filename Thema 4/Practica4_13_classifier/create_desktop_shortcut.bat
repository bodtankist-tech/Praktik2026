@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make_shortcut.ps1" > "%~dp0shortcut_log.txt" 2>&1
