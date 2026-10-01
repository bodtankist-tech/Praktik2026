"""Генерація 500 синтетичних подій за останні 90 днів для «Рубіж-Монітор».

Усі дані умовні й створені випадково. Щоб на дашборді було що моніторити,
у вибірку навмисно додано:
  * три «сплески» — окремі доби з різким зростанням кількості подій
    в одному секторі (їх мають виявити сигнали);
  * кілька подій із нетиповою (дуже високою) інтенсивністю.

Запуск:  python db/seed.py            (випадкова вибірка)
         python db/seed.py --seed 42  (відтворювана вибірка)
Таблиця incidents перед заповненням очищується.
"""
import argparse
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

TOTAL = 500
DAYS = 90

SECTORS = ["Північ", "Схід", "Південь", "Захід", "Центр"]
DIRECTIONS = [
    "Харківський", "Куп'янський", "Лиманський",
    "Бахмутський", "Покровський", "Запорізький",
]
EVENT_TYPES = [
    "Обстріл", "Штурмова дія", "Розвідка", "Повітряна активність", "Переміщення сил",
]
SOURCES = ["Спостережний пост", "Звіт підрозділу", "ОСИНТ", "Розвідка", "Радіоперехоплення"]

# (скільки діб тому, сектор, напрямок, тип події, кількість подій)
SURGES = [
    (52, "Схід", "Бахмутський", "Обстріл", 20),
    (27, "Південь", "Запорізький", "Штурмова дія", 20),
    (4, "Схід", "Покровський", "Повітряна активність", 20),
]
OUTLIERS = 6  # кількість базових подій з нетиповою інтенсивністю

HOUR_WEIGHTS = [1, 1, 1, 1, 2, 3, 5, 6, 6, 6, 6, 5, 5, 5, 6, 6, 6, 6, 5, 4, 3, 2, 2, 1]


def make_summary(event_type: str, sector: str, direction: str, intensity: int) -> str:
    return f"{event_type}: сектор «{sector}», напрямок «{direction}», інтенсивність {intensity}."


def build_rows(now: datetime) -> list:
    rows = []

    # 1. Сплески: багато подій в одну добу в одному секторі/напрямку.
    for days_ago, sector, direction, event_type, count in SURGES:
        day = (now - timedelta(days=days_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
        for _ in range(count):
            when = day + timedelta(seconds=random.randint(0, 86399))
            intensity = random.randint(18, 35)
            rows.append((when, sector, direction, event_type, intensity,
                         random.choice(SOURCES),
                         make_summary(event_type, sector, direction, intensity)))

    # 2. Фонові події, рівномірно за 90 діб.
    base_count = TOTAL - len(rows)
    for i in range(base_count):
        day_offset = random.randint(0, DAYS - 1)
        day = (now - timedelta(days=day_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
        hour = random.choices(range(24), weights=HOUR_WEIGHTS)[0]
        when = day + timedelta(hours=hour, minutes=random.randint(0, 59), seconds=random.randint(0, 59))
        if when > now:
            when = now - timedelta(minutes=random.randint(1, 600))
        sector = random.choice(SECTORS)
        direction = random.choice(DIRECTIONS)
        event_type = random.choice(EVENT_TYPES)
        if i < OUTLIERS:  # нетипові значення
            intensity = random.randint(44, 50)
        else:
            intensity = max(1, min(50, int(random.triangular(1, 32, 10))))
        rows.append((when, sector, direction, event_type, intensity,
                     random.choice(SOURCES),
                     make_summary(event_type, sector, direction, intensity)))

    rows.sort(key=lambda r: r[0])
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Заповнення таблиці incidents синтетичними даними")
    parser.add_argument("--seed", type=int, default=None, help="зерно генератора для відтворюваності")
    args = parser.parse_args()
    if args.seed is not None:
        random.seed(args.seed)

    url = os.getenv("DATABASE_URL")
    if not url:
        print("Помилка: змінну DATABASE_URL не задано. Скопіюйте .env.example у .env і заповніть.")
        return 1

    rows = build_rows(datetime.now().replace(microsecond=0))
    with psycopg2.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE incidents RESTART IDENTITY")
            execute_values(
                cur,
                "INSERT INTO incidents (occurred_at, sector, direction, event_type, intensity, source, summary) VALUES %s",
                rows,
            )
    conn.close()
    print(f"Додано {len(rows)} записів у таблицю incidents "
          f"({rows[0][0]:%Y-%m-%d} … {rows[-1][0]:%Y-%m-%d}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
