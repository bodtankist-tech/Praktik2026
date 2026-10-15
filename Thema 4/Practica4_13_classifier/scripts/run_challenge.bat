@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
cd /d "%~dp0"
"%PY%" fetch_images.py 10 challenge > challenge_log.txt 2>&1
echo ALL_DONE >> challenge_log.txt
