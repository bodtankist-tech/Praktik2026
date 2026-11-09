"""Запуск дашборда «ОКО» однією командою: перевіряє БД, запускає сервер і відкриває браузер.

    .venv\\Scripts\\python run.py

Коди виходу: 0 — нормальне завершення; 3 — потрібне первинне налаштування (немає .env або БД недоступна).
"""
import os
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8020
URL = f"http://localhost:{PORT}/"
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def server_alive() -> bool:
    try:
        with urllib.request.urlopen(URL + "api/health", timeout=1) as r:
            return r.status == 200
    except OSError:
        return False


def open_when_ready():
    for _ in range(40):
        if server_alive():
            webbrowser.open(URL)
            return
        time.sleep(0.5)


def main() -> int:
    if server_alive():
        print(f"Сервер уже працює — відкриваю {URL}")
        webbrowser.open(URL)
        return 0

    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    if not os.getenv("DATABASE_URL"):
        print("Немає .env з DATABASE_URL — потрібне первинне налаштування.")
        return 3

    import psycopg2
    from api.db import fetch_one
    try:
        has_tables = fetch_one("SELECT to_regclass('public.events') IS NOT NULL AS ok")["ok"]
    except psycopg2.OperationalError as exc:
        print(f"Не вдалося підключитися до PostgreSQL:\n  {str(exc).strip()}")
        print("Перевірте, що служба postgresql запущена і пароль у .env правильний.")
        return 3
    if not has_tables:
        print("Таблиць ще немає — завантажую схему й синтетичні дані…")
        import subprocess
        subprocess.run([sys.executable, str(ROOT / "db" / "seed.py")], check=True)

    print("=" * 60)
    print(f"  ОКО: дашборд  →  {URL}")
    print(f"  Документація API  →  {URL}docs")
    print("  Щоб зупинити: закрийте це вікно або натисніть Ctrl+C")
    print("=" * 60)
    threading.Thread(target=open_when_ready, daemon=True).start()

    import uvicorn
    uvicorn.run("api.main:app", host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    sys.exit(main())
