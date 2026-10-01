# Заповнює таблицю incidents синтетичними даними (500 записів).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
python db\seed.py @args
