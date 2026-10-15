@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0.."
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" -m jupyter nbconvert --to notebook --execute --inplace 4.13_vehicle_classifier.ipynb > scripts\nb_log.txt 2>&1
echo DONE >> scripts\nb_log.txt
