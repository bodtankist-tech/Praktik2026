@echo off
cd /d "%~dp0.."
set PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
"%PY%" app.py --snapshot data\clean\armor\armor_001.jpg results\app_screen_ok.png > results\snap_log.txt 2>&1
"%PY%" app.py --snapshot data\challenge\armor\armor_008.jpg results\app_screen_error.png >> results\snap_log.txt 2>&1
"%PY%" app.py --snapshot data\clean\uav\uav_008.jpg results\app_screen_uav.png >> results\snap_log.txt 2>&1
echo DONE >> results\snap_log.txt
