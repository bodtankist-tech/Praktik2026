@echo off
rem Запуск «Розпізнавача техніки» без консольного вікна
cd /d "%~dp0"
set "PYW=%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe"
if exist "%PYW%" (
  start "" "%PYW%" app.py
) else (
  start "" pyw -3.12 app.py
)
