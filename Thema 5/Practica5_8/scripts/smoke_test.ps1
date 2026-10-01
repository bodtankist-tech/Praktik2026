# Перевіряє /health, /filters, /kpi, /trend. Адресу API можна змінити: $env:API_BASE_URL
Set-Location (Join-Path $PSScriptRoot "..")
python scripts\smoke_test.py @args
exit $LASTEXITCODE
