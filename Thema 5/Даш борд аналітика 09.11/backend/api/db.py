"""Мінімальний доступ до PostgreSQL: без пулів, без async, без ORM."""
import os
from contextlib import contextmanager
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@contextmanager
def get_conn():
    """Відкриває з'єднання з БД (autocommit) і гарантовано закриває його."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL не задано (див. .env.example)")
    conn = psycopg2.connect(url)
    conn.autocommit = True
    try:
        yield conn
    finally:
        conn.close()


def fetch_all(sql: str, params=()):
    """Виконує SELECT і повертає список словників."""
    with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def fetch_one(sql: str, params=()):
    """Виконує SELECT і повертає один рядок (словник) або None."""
    with get_conn() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchone()
