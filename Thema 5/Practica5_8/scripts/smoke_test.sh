#!/usr/bin/env bash
# Перевіряє /health, /filters, /kpi, /trend. Адресу API можна змінити: API_BASE_URL=http://host:8010
cd "$(dirname "$0")/.."
PY=python3; command -v python3 >/dev/null 2>&1 || PY=python
exec "$PY" scripts/smoke_test.py "$@"
