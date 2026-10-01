"""Мінімальна перевірка працездатності API: виводить OK, якщо відповіді мають очікувані ключі."""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.getenv("API_BASE_URL", "http://localhost:8010").rstrip("/")


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=10) as resp:
        return json.load(resp)


def check(name, path, validator):
    try:
        data = get(path)
        ok = validator(data)
    except (urllib.error.URLError, ValueError, KeyError, TypeError) as exc:
        print(f"FAIL  {name}: {exc}")
        return False
    print(("OK    " if ok else "FAIL  ") + name)
    return ok


checks = [
    ("/health", "/health", lambda d: d.get("status") == "ok"),
    ("/filters", "/filters",
     lambda d: all(k in d for k in ("sectors", "directions", "event_types", "min_date", "max_date"))),
    ("/kpi", "/kpi",
     lambda d: all(k in d for k in ("total_incidents", "total_intensity", "avg_intensity", "top_direction"))),
    ("/trend", "/trend",
     lambda d: isinstance(d, list) and (not d or all(k in d[0] for k in ("t", "value")))),
]

results = [check(*c) for c in checks]
if all(results):
    print("OK: усі перевірки пройдено")
    sys.exit(0)
print("FAIL: є помилки; перевірте, що API запущено (uvicorn api.main:app --reload) і БД заповнена")
sys.exit(1)
