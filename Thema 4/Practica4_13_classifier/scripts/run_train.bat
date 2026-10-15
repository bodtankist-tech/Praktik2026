@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
cd /d "%~dp0"
echo Навчання і оцінювання (кілька хвилин)...
"%PY%" train.py > train_log.txt 2>&1
"%PY%" challenge.py >> train_log.txt 2>&1
"%PY%" make_figures.py >> train_log.txt 2>&1
echo ALL_DONE >> train_log.txt
