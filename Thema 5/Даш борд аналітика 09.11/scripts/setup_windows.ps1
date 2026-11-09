# ОКО: одноразове налаштування й запуск на Windows (після встановлення PostgreSQL).
#
# Запуск із кореня проєкту (папка «Даш борд аналітика 09.11»):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1
#
# Що робить: знаходить psql, створює backend\.env (пароль вводиться приховано), створює БД oko_dashboard,
# створює .venv і встановлює залежності, завантажує схему й синтетичні дані (db\seed.py),
# запускає бекенд (API, порт 8020) і фронтенд (порт 8080) та відкриває дашборд (run.py).
# Повторний запуск безпечний: наявні .env і база не перезаписуються; дані перезавантажуються лише з ключем -Reseed.
param([switch]$Reseed)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath (Join-Path $PSScriptRoot "..")
$root = (Get-Location).Path
$dbName = "oko_dashboard"

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

# 1. psql ---------------------------------------------------------------------------------------
Step "Пошук psql"
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    $found = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
        ForEach-Object { Join-Path $_.FullName "bin\psql.exe" } |
        Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $found) { throw "psql не знайдено. Встановіть PostgreSQL (з Command Line Tools) і запустіть скрипт ще раз." }
    $env:Path = (Split-Path $found) + ";" + $env:Path
}
psql --version

# 2. .env ---------------------------------------------------------------------------------------
$envPath = "backend\.env"
Step "Підключення до БД (backend\.env)"
if ((Test-Path $envPath) -and (Select-String -Path $envPath -Pattern '^\s*DATABASE_URL=\S+' -Quiet)) {
    Write-Host "backend\.env уже існує, залишаю без змін."
} else {
    $user = Read-Host "Користувач PostgreSQL [postgres]"
    if (-not $user) { $user = "postgres" }
    $secure = Read-Host "Пароль користувача $user (вводиться приховано)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    "DATABASE_URL=postgresql://${user}:$([Uri]::EscapeDataString($plain))@localhost:5432/$dbName" |
        Set-Content -Path $envPath -Encoding ascii
    Write-Host "backend\.env створено (файл у .gitignore)."
}
. "$PSScriptRoot\_env.ps1"
if (-not ($env:DATABASE_URL -match '^postgresql://(?<u>[^:]+):(?<p>[^@]*)@(?<h>[^:/]+):(?<port>\d+)/(?<d>.+)$')) {
    throw "Не вдалося розібрати DATABASE_URL у backend\.env (очікується postgresql://USER:PASSWORD@localhost:5432/$dbName)"
}
$env:PGPASSWORD = [Uri]::UnescapeDataString($Matches.p)
$pg = @("-h", $Matches.h, "-p", $Matches.port, "-U", $Matches.u)
$target = $Matches.d

# 3. База даних ---------------------------------------------------------------------------------
Step "База $target"
$exists = psql @pg -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$target'"
if ($LASTEXITCODE -ne 0) { throw "Не вдалося підключитися до PostgreSQL: перевірте пароль у backend\.env і чи запущена служба postgresql." }
$isNew = ($exists | Out-String).Trim() -ne "1"
if ($isNew) {
    psql @pg -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $target ENCODING 'UTF8' TEMPLATE template0"
    if ($LASTEXITCODE -ne 0) { throw "Не вдалося створити базу $target" }
} else { Write-Host "База вже існує." }

# 4. Python-середовище ---------------------------------------------------------------------------
Step "Віртуальне середовище та залежності"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python не знайдено (потрібен 3.10+)." }
if (-not (Test-Path ".venv")) { python -m venv .venv }
$py = Join-Path $root ".venv\Scripts\python.exe"
& $py -m pip install -q -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Не вдалося встановити залежності" }

# 5. Схема й дані -------------------------------------------------------------------------------
Step "Схема та синтетичні дані"
$hasData = $false
if (-not $isNew) {
    $n = (psql $env:DATABASE_URL -tAc "SELECT to_regclass('public.events') IS NOT NULL" | Out-String).Trim()
    $hasData = $n -eq "t"
}
if ($Reseed -or -not $hasData) {
    & $py backend\db\seed.py
    if ($LASTEXITCODE -ne 0) { throw "Не вдалося завантажити дані" }
} else {
    Write-Host "Таблиці вже є, пропускаю. Перезавантажити дані: .\scripts\setup_windows.ps1 -Reseed"
}

# 6. Запуск -------------------------------------------------------------------------------------
Step "Запуск бекенду (8020) і фронтенду (8080)"
Write-Host "Налаштування завершено. Надалі достатньо подвійного кліку по ЗАПУСК.bat" -ForegroundColor Green
& $py run.py   # запускає обидва сервери в цьому вікні й відкриває браузер
