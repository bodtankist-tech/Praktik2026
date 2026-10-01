# Рубіж-Монітор: одноразове налаштування й запуск на Windows (після встановлення PostgreSQL).
#
# Запуск із кореня проєкту (папка Practica5_8):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1
#
# Що робить: знаходить psql, створює .env (пароль вводиться приховано), створює БД rubizh_monitor,
# застосовує схему, заповнює даними (якщо порожньо), створює .venv, встановлює залежності,
# запускає API (порт 8010) і веб (порт 5500) у окремих вікнах та відкриває дашборд.
# Повторний запуск безпечний: наявні .env, база й дані не перезаписуються.

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath (Join-Path $PSScriptRoot "..")
$root = (Get-Location).Path
$dbName = "rubizh_monitor"

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

function Start-Window($command) {
    # Запуск у новому вікні PowerShell; EncodedCommand захищає від проблем зі шляхами з пробілами та кирилицею
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    Start-Process powershell -ArgumentList "-NoExit", "-EncodedCommand", $encoded
}

# 1. psql ---------------------------------------------------------------------------------------
Step "Пошук psql"
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    $found = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
    if (-not $found) {
        throw "psql не знайдено. Встановіть PostgreSQL (postgresql.org/download/windows, разом із Command Line Tools) і запустіть скрипт ще раз."
    }
    $env:Path = (Split-Path $found) + ";" + $env:Path
}
psql --version

# 2. Python -------------------------------------------------------------------------------------
Step "Перевірка Python"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python не знайдено. Встановіть Python 3.10+ (python.org) з галочкою «Add python.exe to PATH»."
}
python --version

# 3. .env ---------------------------------------------------------------------------------------
Step "Підключення до БД (.env)"
if (Test-Path ".env") {
    Write-Host ".env уже існує, залишаю без змін."
} else {
    $user = Read-Host "Користувач PostgreSQL [postgres]"
    if (-not $user) { $user = "postgres" }
    $secure = Read-Host "Пароль користувача $user (вводиться приховано)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $encoded = [Uri]::EscapeDataString($plain)
    "DATABASE_URL=postgresql://${user}:${encoded}@localhost:5432/$dbName" |
        Set-Content -Path ".env" -Encoding ascii
    Write-Host ".env створено (файл у .gitignore, на GitHub не потрапить)."
}
. "$PSScriptRoot\_env.ps1"
if (-not ($env:DATABASE_URL -match '^postgresql://(?<u>[^:]+):(?<p>[^@]*)@(?<h>[^:/]+):(?<port>\d+)/(?<d>.+)$')) {
    throw "Не вдалося розібрати DATABASE_URL у .env. Очікується формат postgresql://USER:PASSWORD@localhost:5432/$dbName"
}
$dbUser = $Matches.u
$dbPass = [Uri]::UnescapeDataString($Matches.p)
$dbHost = $Matches.h
$dbPort = $Matches.port
$dbTarget = $Matches.d

# 4. База даних ---------------------------------------------------------------------------------
Step "Створення бази $dbTarget (якщо її ще немає)"
$env:PGPASSWORD = $dbPass
$exists = psql -h $dbHost -p $dbPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbTarget'"
if ($LASTEXITCODE -ne 0) { throw "Не вдалося підключитися до PostgreSQL. Перевірте користувача й пароль (файл .env) та чи запущена служба postgresql." }
if (($exists | Out-String).Trim() -ne "1") {
    psql -h $dbHost -p $dbPort -U $dbUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbTarget"
    if ($LASTEXITCODE -ne 0) { throw "Не вдалося створити базу $dbTarget" }
} else {
    Write-Host "База $dbTarget вже існує."
}

Step "Схема БД"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -q -f db\schema.sql
if ($LASTEXITCODE -ne 0) { throw "Не вдалося застосувати db\schema.sql" }

# 5. Python-середовище ---------------------------------------------------------------------------
Step "Віртуальне середовище та залежності"
if (-not (Test-Path ".venv")) { python -m venv .venv }
$py = Join-Path $root ".venv\Scripts\python.exe"
& $py -m pip install -q -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Не вдалося встановити залежності з requirements.txt" }

# 6. Дані ---------------------------------------------------------------------------------------
Step "Тестові дані"
$count = (psql $env:DATABASE_URL -tAc "SELECT COUNT(*) FROM incidents" | Out-String).Trim()
if ($count -eq "0") {
    & $py db\seed.py
    if ($LASTEXITCODE -ne 0) { throw "Не вдалося заповнити таблицю incidents" }
} else {
    Write-Host "У таблиці вже $count записів, пропускаю. Щоб згенерувати заново: .venv\Scripts\python db\seed.py"
}

# 7. Запуск -------------------------------------------------------------------------------------
Step "Запуск API (порт 8010) і веб (порт 5500)"
Start-Window "Set-Location -LiteralPath '$root'; & '$py' -m uvicorn api.main:app --port 8010"
Start-Window "Set-Location -LiteralPath '$root\web'; & '$py' -m http.server 5500"
Start-Sleep -Seconds 4

Step "Перевірка працездатності"
& $py scripts\smoke_test.py

Start-Process "http://localhost:5500/?view=analyst"
Write-Host "`nГотово. Дашборд: http://localhost:5500/?view=analyst  (режими: executive, analyst, demo)" -ForegroundColor Green
Write-Host "Щоб зупинити, закрийте два нові вікна PowerShell (API та веб)."
