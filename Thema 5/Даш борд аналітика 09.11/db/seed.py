"""Генератор синтетичних даних для дашборду «ОКО».

Створює два файли:
  db/data.sql        — лише INSERT-и (довідники, підрозділи, події, умовна лінія);
  db/oko_dashboard.sql — повний скрипт для здачі: schema.sql + data.sql (можна виконати одним psql -f).
І, якщо не вказано --no-load, одразу завантажує повний скрипт у БД з DATABASE_URL (.env).

Усі назви підрозділів, координати й події вигадані. Лінія зіткнення умовна й наближена.

    python db/seed.py                 # згенерувати й завантажити
    python db/seed.py --no-load       # лише згенерувати .sql
    python db/seed.py --seed 7 --days 90 --end 2026-11-08
"""
import argparse
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------- довідники
REGIONS = {
    "Київська": (50.45, 30.52), "Львівська": (49.84, 24.03), "Одеська": (46.48, 30.72),
    "Сумська": (50.91, 34.80), "Харківська": (49.99, 36.23), "Донецька": (48.50, 37.60),
    "Луганська": (48.90, 38.80), "Дніпропетровська": (48.46, 35.04), "Запорізька": (47.84, 35.14),
    "Херсонська": (46.64, 32.61), "Миколаївська": (46.97, 31.99), "Чернігівська": (51.49, 31.29),
    "Полтавська": (49.59, 34.55),
}
DIRECTIONS = ["Північний", "Північно-Східний", "Східний", "Південно-Східний", "Південний"]

# Типи подій: назва, категорія, частка, звідки (front_own — своя сторона біля лінії,
# line — на лінії, enemy — бік противника, deep — тилові міста), інтенсивність (мін, макс)
EVENT_TYPES = [
    ("Артилерійський обстріл", "вогневе ураження", 0.30, "front_own", (2, 8)),
    ("Удар ударного БпЛА",     "вогневе ураження", 0.22, "front_own", (1, 6)),
    ("Штурмові дії",           "наземні дії",      0.14, "line",      (4, 10)),
    ("Активність ДРГ",         "наземні дії",      0.06, "front_own", (2, 6)),
    ("Переміщення техніки",    "розвідка",         0.12, "enemy",     (1, 7)),
    ("Робота засобів РЕБ",     "РЕБ",              0.08, "enemy",     (1, 5)),
    ("Ракетний удар",          "вогневе ураження", 0.03, "deep",      (5, 10)),
    ("Ураження цілі",          "вогневе ураження", 0.05, "enemy",     (3, 9)),
]

DEEP_TARGETS = [  # (місто-орієнтир, область) — для ракетних ударів
    ((50.45, 30.52), "Київська"), ((49.99, 36.23), "Харківська"), ((48.46, 35.04), "Дніпропетровська"),
    ((46.48, 30.72), "Одеська"), ((47.84, 35.14), "Запорізька"), ((49.84, 24.03), "Львівська"),
    ((47.91, 33.39), "Дніпропетровська"), ((50.91, 34.80), "Сумська"), ((46.97, 31.99), "Миколаївська"),
    ((49.59, 34.55), "Полтавська"), ((51.49, 31.29), "Чернігівська"),
]

# Умовна (синтетична) лінія з півночі на південь: (lat, lon, область, напрямок).
FRONT = [
    (51.20, 34.30, "Сумська", "Північний"),
    (50.80, 35.45, "Сумська", "Північний"),
    (50.35, 36.40, "Харківська", "Північний"),
    (50.25, 36.95, "Харківська", "Північно-Східний"),
    (49.85, 37.70, "Харківська", "Північно-Східний"),
    (49.30, 37.95, "Харківська", "Північно-Східний"),
    (48.98, 38.05, "Донецька", "Східний"),
    (48.60, 38.00, "Донецька", "Східний"),
    (48.40, 37.75, "Донецька", "Східний"),
    (48.25, 37.25, "Донецька", "Східний"),
    (47.85, 37.10, "Донецька", "Південно-Східний"),
    (47.70, 36.60, "Запорізька", "Південно-Східний"),
    (47.60, 36.10, "Запорізька", "Південно-Східний"),
    (47.50, 35.60, "Запорізька", "Південний"),
    (47.42, 35.20, "Запорізька", "Південний"),
    (47.10, 34.40, "Херсонська", "Південний"),
    (46.75, 33.37, "Херсонська", "Південний"),
    (46.60, 32.60, "Херсонська", "Південний"),
    (46.48, 31.95, "Миколаївська", "Південний"),
]

# Типи підрозділів: назва, код сутності APP-6D (набір 10 «Land unit»), допустимі ешелони
UNIT_TYPES = {
    "Механізовані":   ("121102", ["16", "18"]),
    "Танкові":        ("120500", ["16"]),
    "Розвідувальні":  ("121300", ["15", "16"]),
    "Артилерія":      ("130300", ["16"]),
    "Мінометні":      ("130800", ["15"]),
    "ППО":            ("130100", ["16"]),
    "БпЛА":           ("121900", ["15", "16"]),
    "Інженерні":      ("140700", ["15", "16"]),
    "Управління":     ("110000", ["18"]),
    "Забезпечення":   ("163400", ["16"]),
    "Медичні":        ("161300", ["15"]),
}
ECHELON_NAMES = {"15": "рота", "16": "батальйон", "17": "полк", "18": "бригада"}
AFFILIATION_CODE = {"friend": "3", "hostile": "6"}  # стандартна ідентичність APP-6D

SOURCES = ["Донесення підрозділу", "Аеророзвідка (БпЛА)", "Радіоелектронна розвідка",
           "Спостережний пост", "OSINT", "Взаємодіючий підрозділ"]
RELIABILITY = ["A1", "A2", "B1", "B2", "B3", "C2", "C3", "C4", "D3", "F6"]
RELIABILITY_W = [3, 6, 10, 18, 12, 14, 10, 5, 3, 2]


def sidc(affiliation: str, entity: str, echelon: str, hq: bool = False) -> str:
    """APP-6D SIDC: версія 10, контекст 0 (реальність), ідентичність, набір 10, статус 0,
    HQ/TF (2 = штаб), ешелон, сутність, модифікатори 00 00."""
    return f"10{0}{AFFILIATION_CODE[affiliation]}10{0}{2 if hq else 0}{echelon}{entity}0000"


# ---------------------------------------------------------------- геометрія
def front_point(rng, side_km: float):
    """Випадкова точка біля умовної лінії. side_km > 0 — своя сторона (захід/північ), < 0 — противника."""
    i = rng.randrange(len(FRONT) - 1)
    a, b = FRONT[i], FRONT[i + 1]
    t = rng.random()
    lat = a[0] + (b[0] - a[0]) * t
    lon = a[1] + (b[1] - a[1]) * t
    coslat = math.cos(math.radians(lat))
    dx, dy = (b[1] - a[1]) * coslat, b[0] - a[0]
    norm = math.hypot(dx, dy) or 1.0
    px, py = dy / norm, -dx / norm  # перпендикуляр у бік «своєї» сторони
    deg = side_km / 111.0
    lat += py * deg
    lon += px * deg / coslat
    anchor = a if t < 0.5 else b
    return round(lat, 5), round(lon, 5), anchor[2], anchor[3], i


# ---------------------------------------------------------------- SQL-хелпери
def q(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, datetime):
        return "'" + value.strftime("%Y-%m-%d %H:%M:%S") + "'"
    return "'" + str(value).replace("'", "''") + "'"


def insert(table: str, cols, rows) -> str:
    out = [f"INSERT INTO {table} ({', '.join(cols)}) VALUES"]
    out.append(",\n".join("  (" + ", ".join(q(v) for v in r) + ")" for r in rows) + ";")
    return "\n".join(out)


# ---------------------------------------------------------------- генерація
def build(seed: int, days: int, end: date) -> str:
    rng = random.Random(seed)
    region_id = {name: i + 1 for i, name in enumerate(REGIONS)}
    direction_id = {name: i + 1 for i, name in enumerate(DIRECTIONS)}
    type_id = {t[0]: i + 1 for i, t in enumerate(EVENT_TYPES)}
    end_dt = datetime(end.year, end.month, end.day, 23, 59)
    start_dt = end_dt - timedelta(days=days) + timedelta(minutes=1)

    parts = ["-- Синтетичні дані (seed=%d, %d діб до %s). Згенеровано db/seed.py." % (seed, days, end),
             "BEGIN;"]
    parts.append(insert("regions", ["name", "center_lat", "center_lon"],
                        [(n, la, lo) for n, (la, lo) in REGIONS.items()]))
    parts.append(insert("directions", ["name"], [(d,) for d in DIRECTIONS]))
    parts.append(insert("event_types", ["name", "category"], [(t[0], t[1]) for t in EVENT_TYPES]))
    parts.append(insert("frontline_points", ["seq", "lat", "lon"],
                        [(i + 1, p[0], p[1]) for i, p in enumerate(FRONT)]))

    # --- підрозділи
    units = []
    counters = {}

    def add_unit(aff, utype, lat, lon, region, direction, hq=False):
        entity, echelons = UNIT_TYPES[utype]
        ech = rng.choice(echelons)
        counters[aff] = counters.get(aff, 0) + 1
        n = counters[aff]
        ech_name = ECHELON_NAMES[ech].capitalize()
        if aff == "friend":
            name = f"{ech_name} «Сокіл-{n:02d}» · {utype} (умовн.)"
        else:
            name = f"{ech_name} П-{100 + n} · {utype} (противник, умовн.)"
        strength = max(15, min(100, int(rng.gauss(78 if aff == "friend" else 64, 14))))
        status = "боєздатний" if strength >= 70 else "обмежено боєздатний" if strength >= 45 else "небоєздатний"
        updated = end_dt - timedelta(hours=rng.randint(1, 96))
        units.append((name, aff, utype, ECHELON_NAMES[ech], sidc(aff, entity, ech, hq),
                      region_id[region], direction_id.get(direction), lat, lon, strength, status, updated))

    front_mix = ["Механізовані"] * 5 + ["Танкові", "Розвідувальні", "Артилерія", "Артилерія",
                                         "Мінометні", "БпЛА", "БпЛА", "Інженерні"]
    for aff, sign in (("friend", 1), ("hostile", -1)):
        count = 46 if aff == "friend" else 38
        for _ in range(count):
            utype = rng.choice(front_mix)
            depth = {"Механізовані": (2, 10), "Танкові": (6, 18), "Розвідувальні": (1, 6),
                     "Мінометні": (3, 8), "БпЛА": (5, 15)}.get(utype, (8, 25))
            lat, lon, reg, dirn, _ = front_point(rng, sign * rng.uniform(*depth))
            add_unit(aff, utype, lat, lon, reg, dirn)
        # штаби та тил
        for _ in range(5):
            lat, lon, reg, dirn, _ = front_point(rng, sign * rng.uniform(30, 55))
            add_unit(aff, "Управління", lat, lon, reg, dirn, hq=True)
        for utype in ("Забезпечення", "Забезпечення", "Медичні", "ППО"):
            lat, lon, reg, dirn, _ = front_point(rng, sign * rng.uniform(25, 60))
            add_unit(aff, utype, lat, lon, reg, dirn)
    # ППО прикриття тилових міст (лише свої)
    for (lat, lon), reg in DEEP_TARGETS[:7]:
        add_unit("friend", "ППО", round(lat + rng.uniform(-0.12, 0.12), 5),
                 round(lon + rng.uniform(-0.18, 0.18), 5), reg, None)

    parts.append(insert("units", ["name", "affiliation", "unit_type", "echelon", "sidc", "region_id",
                                  "direction_id", "lat", "lon", "strength_pct", "status", "updated_at"], units))

    friend_ids = [i + 1 for i, u in enumerate(units) if u[1] == "friend" and u[2] != "ППО"]
    hostile_ids = [i + 1 for i, u in enumerate(units) if u[1] == "hostile"]

    # --- події: базовий рівень + тижневий ритм + ескалація на одному напрямку
    events = []
    weights = [t[2] for t in EVENT_TYPES]
    escalation_day = days - 18  # «сигнал» для аналітика: різке зростання на Східному напрямку
    for d in range(days):
        day = start_dt.date() + timedelta(days=d)
        base = 22 + 6 * math.sin(d / 7 * 2 * math.pi) + d * 0.08
        n = max(5, int(rng.gauss(base, 4)))
        surge = escalation_day <= d < escalation_day + 6
        if surge:
            n += 18
        for _ in range(n):
            etype = rng.choices(EVENT_TYPES, weights)[0]
            name, _cat, _w, where, (imin, imax) = etype
            if where == "deep":
                (clat, clon), reg = rng.choice(DEEP_TARGETS)
                lat, lon = round(clat + rng.gauss(0, 0.08), 5), round(clon + rng.gauss(0, 0.12), 5)
                dirn = None
            else:
                side = {"front_own": rng.uniform(0.5, 20), "line": rng.uniform(-2.5, 2.5),
                        "enemy": -rng.uniform(3, 35)}[where]
                lat, lon, reg, dirn, _ = front_point(rng, side)
                if surge and rng.random() < 0.6:  # концентрація на Східному напрямку
                    while dirn != "Східний":
                        lat, lon, reg, dirn, _ = front_point(rng, side)
            when = datetime(day.year, day.month, day.day) + timedelta(minutes=rng.randint(0, 1439))
            intensity = rng.randint(imin, imax)
            if surge and dirn == "Східний":
                intensity = min(10, intensity + rng.randint(1, 3))
            unit = None
            if where in ("front_own", "line") and rng.random() < 0.7:
                unit = rng.choice(friend_ids)
            elif where == "enemy" and rng.random() < 0.5:
                unit = rng.choice(hostile_ids)
            rel = rng.choices(RELIABILITY, RELIABILITY_W)[0]
            src = rng.choice(SOURCES)
            summary = f"{name}, {reg} обл.; інтенсивність {intensity}/10; джерело: {src} ({rel}). Синтетичний запис."
            events.append((when, type_id[name], region_id[reg], direction_id.get(dirn),
                           lat, lon, intensity, unit, src, rel, summary))
    events.sort(key=lambda e: e[0])
    parts.append(insert("events", ["occurred_at", "event_type_id", "region_id", "direction_id", "lat", "lon",
                                   "intensity", "unit_id", "source", "reliability", "summary"], events))
    parts.append("COMMIT;")
    print(f"Згенеровано: {len(units)} підрозділів, {len(events)} подій, {len(FRONT)} точок умовної лінії.")
    return "\n\n".join(parts) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--days", type=int, default=60)
    ap.add_argument("--end", type=lambda s: datetime.strptime(s, "%Y-%m-%d").date(), default=date(2026, 11, 8),
                    help="остання доба даних, YYYY-MM-DD")
    ap.add_argument("--no-load", action="store_true", help="лише записати .sql, без завантаження в БД")
    args = ap.parse_args()
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # кирилиця в консолі Windows

    data_sql = build(args.seed, args.days, args.end)
    schema_sql = (DB_DIR / "schema.sql").read_text(encoding="utf-8")
    full_sql = ("-- ОКО: дашборд аналітика. Повний скрипт БД (схема + синтетичні дані).\n"
                "-- Виконання: psql -d oko_dashboard -f db/oko_dashboard.sql\n"
                "SET client_encoding = 'UTF8';\n\n" + schema_sql + "\n" + data_sql)
    (DB_DIR / "data.sql").write_text(data_sql, encoding="utf-8")
    (DB_DIR / "oko_dashboard.sql").write_text(full_sql, encoding="utf-8")
    print("Записано db/data.sql і db/oko_dashboard.sql")

    if args.no_load:
        return
    import sys
    sys.path.insert(0, str(DB_DIR.parent))
    from api.db import get_conn
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(schema_sql)
        cur.execute(data_sql)
    print("Дані завантажено в БД.")


if __name__ == "__main__":
    main()
