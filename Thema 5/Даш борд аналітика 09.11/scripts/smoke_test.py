"""Перевірка працездатності бекенду (API): виводить OK, якщо відповіді мають очікувані ключі."""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.getenv("API_BASE_URL", "http://localhost:8020").rstrip("/")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=10) as resp:
        return json.load(resp)


CHECKS = [
    ("/api/health", lambda d: d.get("status") == "ok"),
    ("/api/filters", lambda d: d["regions"] and d["event_types"] and d["max_date"]),
    ("/api/kpi", lambda d: all(k in d for k in ("total_events", "high_intensity", "friend_units", "hostile_units"))),
    ("/api/trend?group=week", lambda d: isinstance(d, list) and d and {"t", "value"} <= d[0].keys()),
    ("/api/distribution/types", lambda d: d and {"label", "value"} <= d[0].keys()),
    ("/api/units", lambda d: d and len(d[0]["sidc"]) == 20),
    ("/api/units/summary", lambda d: d["types"] and len(d["friend"]) == len(d["types"])),
    ("/api/events/geo?limit=5", lambda d: len(d) == 5 and "lat" in d[0]),
    ("/api/events?page_size=5", lambda d: d["total"] > 0 and len(d["items"]) == 5),
    ("/api/frontline", lambda d: len(d) >= 2),
]

ok = True
for path, check in CHECKS:
    try:
        passed = bool(check(get(path)))
    except (urllib.error.URLError, ValueError, KeyError, TypeError, IndexError) as exc:
        passed = False
        print(f"FAIL  {path}: {exc}")
        ok = False
        continue
    ok &= passed
    print(("OK    " if passed else "FAIL  ") + path)

print("OK: усі перевірки пройдено" if ok else "FAIL: перевірте, що сервер запущено і БД заповнена")
sys.exit(0 if ok else 1)
