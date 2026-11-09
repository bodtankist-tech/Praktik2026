"""ОКО: API дашборда аналітика (FastAPI, синхронний, сирий SQL через psycopg2).

Аналітичні ендпоїнти подій приймають однакові необов'язкові фільтри:
from, to (YYYY-MM-DD), region, direction, event_type, min_intensity.
Це лише бекенд (JSON API). Веб-інтерфейс — окремий фронтенд у папці frontend/ (свій сервер, порт 8080),
він звертається сюди через CORS.
"""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .db import fetch_all, fetch_one

app = FastAPI(title="ОКО: API дашборда аналітика", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

SORT_COLUMNS = {"id", "occurred_at", "event_type", "region", "direction", "intensity", "reliability"}
DIMENSIONS = {"types": "event_type", "regions": "region", "directions": "direction", "categories": "category"}
HIGH_INTENSITY = 8  # поріг «високої інтенсивності» для KPI


def parse_date(value: Optional[str], name: str) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"Невірна дата в параметрі '{name}': очікується YYYY-MM-DD")


class Filters:
    """Спільні фільтри подій. Значення потрапляють у SQL лише як параметри."""

    def __init__(
        self,
        date_from: Optional[str] = Query(None, alias="from", description="Початок періоду, YYYY-MM-DD"),
        to: Optional[str] = Query(None, description="Кінець періоду (включно), YYYY-MM-DD"),
        region: Optional[str] = None,
        direction: Optional[str] = None,
        event_type: Optional[str] = None,
        min_intensity: Optional[int] = Query(None, ge=1, le=10),
    ):
        self.date_from = parse_date(date_from, "from")
        self.date_to = parse_date(to, "to")
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise HTTPException(400, "Параметр 'from' не може бути пізнішим за 'to'")
        self.region = region or None
        self.direction = direction or None
        self.event_type = event_type or None
        self.min_intensity = min_intensity

    def where(self, date_from=None, date_to=None, extra=None):
        d1 = date_from if date_from is not None else self.date_from
        d2 = date_to if date_to is not None else self.date_to
        conds, params = [], []
        for cond, value in (
            ("occurred_at >= %s", d1),
            ("occurred_at < %s", d2 + timedelta(days=1) if d2 else None),
            ("region = %s", self.region),
            ("direction = %s", self.direction),
            ("event_type = %s", self.event_type),
            ("intensity >= %s", self.min_intensity),
        ):
            if value is not None:
                conds.append(cond)
                params.append(value)
        if extra:
            conds.append(extra)
        return ("WHERE " + " AND ".join(conds)) if conds else "", params


def data_bounds():
    row = fetch_one("SELECT MIN(occurred_at)::date AS d1, MAX(occurred_at)::date AS d2 FROM events")
    return row["d1"], row["d2"]


def fill_series(rows, step_days: int):
    """Доповнює часовий ряд нулями для пропущених діб/тижнів."""
    if not rows:
        return []
    by_date = {r["t"]: r["value"] for r in rows}
    current, last = rows[0]["t"], rows[-1]["t"]
    result = []
    while current <= last:
        result.append({"t": current.isoformat(), "value": by_date.get(current, 0)})
        current += timedelta(days=step_days)
    return result


# ------------------------------------------------------------------ довідкові
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/filters")
def get_filters():
    d1, d2 = data_bounds()
    return {
        "regions": [r["name"] for r in fetch_all("SELECT name FROM regions ORDER BY name")],
        "directions": [r["name"] for r in fetch_all("SELECT name FROM directions ORDER BY id")],
        "event_types": [r["name"] for r in fetch_all("SELECT name FROM event_types ORDER BY id")],
        "unit_types": [r["v"] for r in fetch_all("SELECT DISTINCT unit_type AS v FROM units ORDER BY 1")],
        "min_date": d1.isoformat() if d1 else "",
        "max_date": d2.isoformat() if d2 else "",
    }


@app.get("/api/frontline")
def frontline():
    return [[r["lat"], r["lon"]] for r in fetch_all("SELECT lat, lon FROM frontline_points ORDER BY seq")]


# ------------------------------------------------------------------ аналітика подій
@app.get("/api/kpi")
def kpi(f: Filters = Depends()):
    where, params = f.where()
    row = fetch_one(
        f"""SELECT COUNT(*) AS total,
                   COALESCE(ROUND(AVG(intensity)::numeric, 1), 0) AS avg_intensity,
                   COUNT(*) FILTER (WHERE intensity >= {HIGH_INTENSITY}) AS high,
                   COUNT(*) FILTER (WHERE event_type = 'Ракетний удар') AS deep_strikes
            FROM v_events {where}""",
        params,
    )
    top_where, top_params = f.where(extra="direction IS NOT NULL")
    top = fetch_one(
        f"SELECT direction FROM v_events {top_where} GROUP BY direction ORDER BY COUNT(*) DESC LIMIT 1",
        top_params,
    )

    # Порівняння з попереднім періодом такої ж тривалості
    d_min, d_max = data_bounds()
    d1, d2 = f.date_from or d_min, f.date_to or d_max
    delta_pct = None
    if d1 and d2:
        span = (d2 - d1).days + 1
        prev_where, prev_params = f.where(d1 - timedelta(days=span), d1 - timedelta(days=1))
        prev = fetch_one(f"SELECT COUNT(*) AS n FROM v_events {prev_where}", prev_params)["n"]
        if prev:
            delta_pct = round((row["total"] - prev) / prev * 100, 1)

    unit_where, unit_params = unit_filter(region=f.region, direction=f.direction)
    units = fetch_one(
        f"""SELECT COUNT(*) FILTER (WHERE affiliation = 'friend')  AS friend,
                   COUNT(*) FILTER (WHERE affiliation = 'hostile') AS hostile,
                   ROUND(AVG(strength_pct) FILTER (WHERE affiliation = 'friend')) AS friend_strength
            FROM units u {unit_where}""",
        unit_params,
    )
    return {
        "total_events": row["total"],
        "avg_intensity": float(row["avg_intensity"]),
        "high_intensity": row["high"],
        "deep_strikes": row["deep_strikes"],
        "delta_pct": delta_pct,
        "top_direction": top["direction"] if top else None,
        "friend_units": units["friend"],
        "hostile_units": units["hostile"],
        "friend_strength": int(units["friend_strength"]) if units["friend_strength"] is not None else None,
    }


@app.get("/api/trend")
def trend(group: str = Query("day", pattern="^(day|week)$"), f: Filters = Depends()):
    where, params = f.where()
    rows = fetch_all(  # group перевірено регулярним виразом
        f"SELECT date_trunc('{group}', occurred_at)::date AS t, COUNT(*) AS value FROM v_events {where} GROUP BY 1 ORDER BY 1",
        params,
    )
    return fill_series(rows, 1 if group == "day" else 7)


@app.get("/api/distribution/{dimension}")
def distribution(dimension: str, f: Filters = Depends()):
    column = DIMENSIONS.get(dimension)
    if column is None:
        raise HTTPException(404, f"Доступні розрізи: {', '.join(DIMENSIONS)}")
    where, params = f.where()
    rows = fetch_all(
        f"""SELECT COALESCE({column}, 'Тил (поза напрямками)') AS label, COUNT(*) AS value,
                   ROUND(AVG(intensity)::numeric, 1) AS avg_intensity
            FROM v_events {where} GROUP BY 1 ORDER BY 2 DESC, 1""",
        params,
    )
    return [{"label": r["label"], "value": r["value"], "avg_intensity": float(r["avg_intensity"])} for r in rows]


@app.get("/api/hourly")
def hourly(f: Filters = Depends()):
    """Розподіл подій за годиною доби (0–23)."""
    where, params = f.where()
    rows = fetch_all(f"SELECT EXTRACT(HOUR FROM occurred_at)::int AS h, COUNT(*) AS n FROM v_events {where} GROUP BY 1", params)
    counts = {r["h"]: r["n"] for r in rows}
    return [{"hour": h, "value": counts.get(h, 0)} for h in range(24)]


@app.get("/api/events/geo")
def events_geo(f: Filters = Depends(), limit: int = Query(3000, ge=1, le=10000)):
    """Точки подій для карти (найновіші, не більше limit)."""
    where, params = f.where()
    return fetch_all(
        f"""SELECT id, lat, lon, event_type, category, intensity, occurred_at, region
            FROM v_events {where} ORDER BY occurred_at DESC LIMIT %s""",
        params + [limit],
    )


@app.get("/api/events")
def events(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=5, le=100),
    sort: str = "occurred_at",
    order: str = Query("desc", pattern="^(asc|desc)$"),
    f: Filters = Depends(),
):
    if sort not in SORT_COLUMNS:
        raise HTTPException(400, f"Сортування можливе за: {', '.join(sorted(SORT_COLUMNS))}")
    where, params = f.where()
    total = fetch_one(f"SELECT COUNT(*) AS n FROM v_events {where}", params)["n"]
    items = fetch_all(
        f"""SELECT id, occurred_at, event_type, region, direction, intensity, reliability, source, lat, lon
            FROM v_events {where} ORDER BY {sort} {order} NULLS LAST, id DESC LIMIT %s OFFSET %s""",
        params + [page_size, (page - 1) * page_size],
    )
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@app.get("/api/events/{event_id}")
def event(event_id: int):
    row = fetch_one("SELECT * FROM v_events WHERE id = %s", (event_id,))
    if row is None:
        raise HTTPException(404, "Подію не знайдено")
    return row


# ------------------------------------------------------------------ підрозділи
def unit_filter(affiliation=None, region=None, direction=None, unit_type=None):
    conds, params = [], []
    for cond, value in (
        ("u.affiliation = %s", affiliation),
        ("u.region_id = (SELECT id FROM regions WHERE name = %s)", region),
        ("u.direction_id = (SELECT id FROM directions WHERE name = %s)", direction),
        ("u.unit_type = %s", unit_type),
    ):
        if value:
            conds.append(cond)
            params.append(value)
    return ("WHERE " + " AND ".join(conds)) if conds else "", params


@app.get("/api/units")
def units(
    affiliation: Optional[str] = Query(None, pattern="^(friend|hostile|neutral|unknown)$"),
    region: Optional[str] = None,
    direction: Optional[str] = None,
    unit_type: Optional[str] = None,
):
    where, params = unit_filter(affiliation, region, direction, unit_type)
    return fetch_all(
        f"""SELECT u.id, u.name, u.affiliation, u.unit_type, u.echelon, u.sidc, u.lat, u.lon,
                   u.strength_pct, u.status, u.updated_at, r.name AS region, d.name AS direction,
                   (SELECT COUNT(*) FROM events e WHERE e.unit_id = u.id) AS events_count
            FROM units u JOIN regions r ON r.id = u.region_id LEFT JOIN directions d ON d.id = u.direction_id
            {where} ORDER BY u.affiliation, u.unit_type, u.name""",
        params,
    )


@app.get("/api/units/summary")
def units_summary(region: Optional[str] = None, direction: Optional[str] = None):
    """Кількість підрозділів за типом і належністю + середня укомплектованість."""
    where, params = unit_filter(region=region, direction=direction)
    rows = fetch_all(
        f"""SELECT unit_type, affiliation, COUNT(*) AS n, ROUND(AVG(strength_pct)) AS strength
            FROM units u {where} GROUP BY 1, 2 ORDER BY 1""",
        params,
    )
    types = sorted({r["unit_type"] for r in rows})
    cell = {(r["unit_type"], r["affiliation"]): r for r in rows}
    out = {"types": types}
    for aff in ("friend", "hostile"):
        out[aff] = [cell[(t, aff)]["n"] if (t, aff) in cell else 0 for t in types]
        out[aff + "_strength"] = [int(cell[(t, aff)]["strength"]) if (t, aff) in cell else None for t in types]
    status = fetch_all(
        f"SELECT affiliation, status, COUNT(*) AS n FROM units u {where} GROUP BY 1, 2", params
    )
    out["status"] = [{"affiliation": r["affiliation"], "status": r["status"], "n": r["n"]} for r in status]
    return out

