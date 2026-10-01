# Застосовує db\schema.sql до бази з DATABASE_URL (.env у корені проєкту).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
. "$PSScriptRoot\_env.ps1"
if (-not $env:DATABASE_URL) { throw "Змінну DATABASE_URL не задано (скопіюйте .env.example у .env)" }
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db\schema.sql
if ($LASTEXITCODE -ne 0) { throw "psql завершився з помилкою" }
Write-Host "Схему застосовано."
