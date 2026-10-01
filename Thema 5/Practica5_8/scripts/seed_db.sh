#!/usr/bin/env bash
# Заповнює таблицю incidents синтетичними даними (500 записів).
set -euo pipefail
cd "$(dirname "$0")/.."
PY=python3; command -v python3 >/dev/null 2>&1 || PY=python
"$PY" db/seed.py "$@"
