"""Запуск дашборда «ОКО»: два окремі сервери — бекенд (FastAPI, :8020) і фронтенд (статика, :8080).

    .venv\\Scripts\\python run.py            # обидва сервери (так запускає ЗАПУСК.bat)
    .venv\\Scripts\\python run.py backend    # лише бекенд — у першому терміналі
    .venv\\Scripts\\python run.py frontend   # лише фронтенд — у другому терміналі

Бекенд  backend/   — JSON API над PostgreSQL:   http://localhost:8020/api, документація /docs
Фронтенд frontend/ — HTML/CSS/JS, звертається до API через CORS: http://localhost:8080

Коди виходу: 0 — нормальне завершення; 3 — потрібне первинне налаштування (немає backend/.env або БД недоступна).
"""
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
API_PORT = 8020
WEB_PORT = 8080
API_URL = f"http://localhost:{API_PORT}/"
WEB_URL = f"http://localhost:{WEB_PORT}/"
sys.path.insert(0, str(BACKEND))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def alive(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1) as r:
            return r.status == 200
    except OSError:
        return False


def wait_for(url: str, tries: int = 40) -> bool:
    for _ in range(tries):
        if alive(url):
            return True
        time.sleep(0.5)
    return False


def check_db() -> bool:
    """Перевіряє підключення до БД; за відсутності таблиць завантажує синтетичні дані."""
    from dotenv import load_dotenv
    load_dotenv(BACKEND / ".env")
    if not os.getenv("DATABASE_URL"):
        print("Немає backend/.env з DATABASE_URL — потрібне первинне налаштування.")
        return False

    import psycopg2
    from api.db import fetch_one
    try:
        has_tables = fetch_one("SELECT to_regclass('public.events') IS NOT NULL AS ok")["ok"]
    except psycopg2.OperationalError as exc:
        print(f"Не вдалося підключитися до PostgreSQL:\n  {str(exc).strip()}")
        print("Перевірте, що служба postgresql запущена і пароль у backend/.env правильний.")
        return False
    if not has_tables:
        print("Таблиць ще немає — завантажую схему й синтетичні дані…")
        subprocess.run([sys.executable, str(BACKEND / "db" / "seed.py")], check=True)
    return True


BACKEND_CMD = [sys.executable, "-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", str(API_PORT)]
FRONTEND_CMD = [sys.executable, "-m", "http.server", str(WEB_PORT), "--bind", "127.0.0.1"]


def run_backend() -> int:
    """Лише бекенд у поточному терміналі; журнал запитів видно в консолі."""
    if alive(API_URL + "api/health"):
        print(f"Бекенд уже працює: {API_URL}")
        return 0
    if not check_db():
        return 3
    print(f"Бекенд (API) → {API_URL}api   документація: {API_URL}docs   (зупинка: Ctrl+C)")
    try:
        return subprocess.call(BACKEND_CMD, cwd=BACKEND)
    except KeyboardInterrupt:
        return 0


def run_frontend() -> int:
    """Лише фронтенд у поточному терміналі; бекенд має бути запущений окремо."""
    if alive(WEB_URL):
        print(f"Фронтенд уже працює — відкриваю {WEB_URL}")
        webbrowser.open(WEB_URL)
        return 0
    if not alive(API_URL + "api/health"):
        print(f"Увага: бекенд ({API_URL}) не відповідає — запустіть в іншому терміналі: python run.py backend")
    print(f"Фронтенд (дашборд) → {WEB_URL}   (зупинка: Ctrl+C)")
    proc = subprocess.Popen(FRONTEND_CMD, cwd=FRONTEND)
    if wait_for(WEB_URL):
        webbrowser.open(WEB_URL)
    try:
        return proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        return 0


def main() -> int:
    mode = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    if mode == "backend":
        return run_backend()
    if mode == "frontend":
        return run_frontend()
    if mode != "all":
        print(__doc__)
        return 2

    procs = []
    if alive(API_URL + "api/health"):
        print(f"Бекенд уже працює: {API_URL}")
    else:
        if not check_db():
            return 3
        procs.append(subprocess.Popen(BACKEND_CMD + ["--log-level", "warning"], cwd=BACKEND))

    if alive(WEB_URL):
        print(f"Фронтенд уже працює: {WEB_URL}")
    else:
        procs.append(subprocess.Popen(FRONTEND_CMD, cwd=FRONTEND,
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))

    if not wait_for(API_URL + "api/health") or not wait_for(WEB_URL):
        print("Сервери не відповіли вчасно — дивіться повідомлення вище.")
        for p in procs:
            p.terminate()
        return 1

    print("=" * 64)
    print(f"  Фронтенд (дашборд)  →  {WEB_URL}")
    print(f"  Бекенд (API)        →  {API_URL}api   документація: {API_URL}docs")
    print("  Щоб зупинити: закрийте це вікно або натисніть Ctrl+C")
    print("=" * 64)
    webbrowser.open(WEB_URL)

    if not procs:
        return 0
    try:
        while all(p.poll() is None for p in procs):
            time.sleep(1)
        print("Один із серверів зупинився.")
        return 1
    except KeyboardInterrupt:
        return 0
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()


if __name__ == "__main__":
    sys.exit(main())
