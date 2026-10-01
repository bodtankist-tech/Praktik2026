"""Рубіж-Монітор: API (FastAPI, синхронний, сирий SQL через psycopg2).

Усі аналітичні ендпоїнти приймають однакові необов'язкові фільтри:
from, to (YYYY-MM-DD), sector, direction, event_type, min_intensity.
"""
from datetime import date, datetime, timedelta
from math import sqrt
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .db import fetch_all, fetch_one

app = FastAPI(title="Рубіж-Монітор API", version="1.0")

# Найпростіша CORS-настройка «дозволити всім», щоб web міг викликати API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SORT_COLUMNS = {"id", "occurred_at", "sector", "direction", "event_type", "intensity"}

# Параметри виявлення «сигналів» (навчальна модель).
BASELINE_DAYS = 14      # вікно для розрахунку звичайного рівня
MIN_BASELINE_DAYS = 7   # мінімум діб історії для оцінки
SPIKE_Z = 2.5           # у скільки «сигм» добове значення має перевищити норму
SPIKE_MIN_EVENTS = 5    # мінімальна кількість подій за добу для сигналу
OUTLIER_IQR_K = 1.5     # множник міжквартильного розмаху для нетипових значень


def parse_date(value: Optional[str], name: str) -> Optional[date]:
    if value is None or value == "":
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Невірна дата в параметрі '{name}': очікується YYYY-MM-DD")


class Filters:
    """Спільні фільтри для всіх аналітичних ендпоїнтів."""

    def __init__(
        self,
        date_from: Optional[str] = Query(None, alias="from", description="Початок періоду, YYYY-MM-DD"),
        to: Optional[str] = Query(None, description="Кінець періоду (включно), YYYY-MM-DD"),
        sector: Optional[str] = None,
        direction: Optional[str] = None,
        event_type: Optional[str] = None,
        min_intensity: Optional[int] = Query(None, ge=1, le=50),
    ):
        self.date_from = parse_date(date_from, "from")
        self.date_to = parse_date(to, "to")
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise HTTPException(status_code=400, detail="Параметр 'from' не може бути пізнішим за 'to'")
        self.sector = sector or None
        self.direction = direction or None
        self.event_type = event_type or None
        self.min_intensity = min_intensity

    def where(self, extra: Optional[str] = None):
        """Повертає (рядок WHERE, список параметрів). Значення йдуть лише через параметри."""
        conds, params = [], []
        if self.date_from:
            conds.append("occurred_at >= %s")
            params.append(self.date_from)
        if self.date_to:
            conds.append("occurred_at < %s")
            params.append(self.date_to + timedelta(days=1))
        if self.sector:
            conds.append("sector = %s")
            params.append(self.sector)
        if self.direction:
            conds.append("direction = %s")
            params.append(self.direction)
        if self.event_type:
            conds.append("event_type = %s")
            params.append(self.event_type)
        if self.min_intensity is not None:
            conds.append("intensity >= %s")
            params.append(self.min_intensity)
        if extra:
            conds.append(extra)
        return ("WHERE " + " AND ".join(conds)) if conds else "", params


def fill_series(rows, step_days: int):
    """Доповнює часовий ряд нульовими значеннями для пропущених діб/тижнів."""
    if not rows:
        return []
    by_date = {r["t"]: r["value"] for r in rows}
    current, last = rows[0]["t"], rows[-1]["t"]
    result = []
    while current <= last:
        result.append({"t": current.isoformat(), "value": by_date.get(current, 0)})
        current += timedelta(days=step_days)
    return result


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/filters")
def get_filters():
    sectors = fetch_all("SELECT DISTINCT sector AS v FROM incidents ORDER BY 1")
    directions = fetch_all("SELECT DISTINCT direction AS v FROM incidents ORDER BY 1")
    types = fetch_all("SELECT DISTINCT event_type AS v FROM incidents ORDER BY 1")
    bounds = fetch_one("SELECT MIN(occurred_at)::date AS d1, MAX(occurred_at)::date AS d2 FROM incidents")
    return {
        "sectors": [r["v"] for r in sectors],
        "directions": [r["v"] for r in directions],
        "event_types": [r["v"] for r in types],
        "min_date": bounds["d1"].isoformat() if bounds and bounds["d1"] else "",
        "max_date": bounds["d2"].isoformat() if bounds and bounds["d2"] else "",
    }


@app.get("/kpi")
def kpi(f: Filters = Depends()):
    where, params = f.where()
    row = fetch_one(
        f"""SELECT COUNT(*) AS total_incidents,
                   COALESCE(SUM(intensity), 0) AS total_intensity,
                   COALESCE(ROUND(AVG(intensity)::numeric, 2), 0) AS avg_intensity
            FROM incidents {where}""",
        params,
    )
    top = fetch_one(
        f"SELECT direction FROM incidents {where} GROUP BY direction ORDER BY COUNT(*) DESC, direction LIMIT 1",
        params,
    )
    return {
        "total_incidents": int(row["total_incidents"]),
        "total_intensity": int(row["total_intensity"]),
        "avg_intensity": float(row["avg_intensity"]),
        "top_direction": top["direction"] if top else None,
    }


@app.get("/trend")
def trend(group: str = Query("day", pattern="^(day|week)$"), f: Filters = Depends()):
    where, params = f.where()
    # group перевірено регулярним виразом, тому підстановка в SQL безпечна
    rows = fetch_all(
        f"""SELECT date_trunc('{group}', occurred_at)::date AS t, COUNT(*) AS value
            FROM incidents {where} GROUP BY 1 ORDER BY 1""",
        params,
    )
    return fill_series(rows, 1 if group == "day" else 7)


def distribution(column: str, f: Filters):
    where, params = f.where()
    rows = fetch_all(
        f"SELECT {column} AS label, COUNT(*) AS value FROM incidents {where} GROUP BY 1 ORDER BY 2 DESC, 1",
        params,
    )
    return [{"label": r["label"], "value": r["value"]} for r in rows]


@app.get("/distribution/directions")
def distribution_directions(f: Filters = Depends()):
    return distribution("direction", f)


@app.get("/distribution/types")
def distribution_types(f: Filters = Depends()):
    return distribution("event_type", f)


@app.get("/heatmap")
def heatmap(f: Filters = Depends()):
    """Сектор × тиждень: кількість подій."""
    where, params = f.where()
    rows = fetch_all(
        f"""SELECT sector, date_trunc('week', occurred_at)::date AS week, COUNT(*) AS value
            FROM incidents {where} GROUP BY 1, 2 ORDER BY 2, 1""",
        params,
    )
    weeks = sorted({r["week"] for r in rows})
    sectors = sorted({r["sector"] for r in rows})
    cell = {(r["sector"], r["week"]): r["value"] for r in rows}
    return {
        "columns": [w.isoformat() for w in weeks],
        "rows": [{"sector": s, "values": [cell.get((s, w), 0) for w in weeks]} for s in sectors],
    }


@app.get("/incidents")
def incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=5, le=100),
    sort: str = "occurred_at",
    order: str = Query("desc", pattern="^(asc|desc)$"),
    f: Filters = Depends(),
):
    if sort not in SORT_COLUMNS:
        raise HTTPException(status_code=400, detail=f"Сортування можливе за: {', '.join(sorted(SORT_COLUMNS))}")
    where, params = f.where()
    total = fetch_one(f"SELECT COUNT(*) AS n FROM incidents {where}", params)["n"]
    items = fetch_all(
        f"""SELECT id, occurred_at, sector, direction, event_type, intensity, source, summary
            FROM incidents {where}
            ORDER BY {sort} {order}, id DESC
            LIMIT %s OFFSET %s""",
        params + [page_size, (page - 1) * page_size],
    )
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@app.get("/incidents/{incident_id}")
def incident(incident_id: int):
    row = fetch_one(
        """SELECT id, occurred_at, sector, direction, event_type, intensity, source, summary
           FROM incidents WHERE id = %s""",
        (incident_id,),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Запис не знайдено")
    return row


@app.get("/signals")
def signals(f: Filters = Depends()):
    """Сигнали для моніторингу змін (специфіка варіанту «Рубіж-Монітор»).

    1) spikes — доби, коли кількість подій різко перевищила звичайний рівень
       (середнє за попередні BASELINE_DAYS діб + SPIKE_Z стандартних відхилень);
    2) outliers — події з нетиповою інтенсивністю (вище Q3 + 1.5·IQR).
    """
    where, params = f.where()

    daily = fetch_all(
        f"""SELECT occurred_at::date AS t, COUNT(*) AS value,
                   ROUND(AVG(intensity)::numeric, 1) AS avg_intensity
            FROM incidents {where} GROUP BY 1 ORDER BY 1""",
        params,
    )
    series = fill_series([{"t": r["t"], "value": r["value"]} for r in daily], 1)
    avg_i = {r["t"].isoformat(): float(r["avg_intensity"]) for r in daily}

    spikes = []
    for i, point in enumerate(series):
        history = [p["value"] for p in series[max(0, i - BASELINE_DAYS):i]]
        if len(history) < MIN_BASELINE_DAYS:
            continue
        mean = sum(history) / len(history)
        std = sqrt(sum((v - mean) ** 2 for v in history) / len(history))
        z = (point["value"] - mean) / max(std, 1.0)
        if point["value"] >= SPIKE_MIN_EVENTS and z >= SPIKE_Z:
            spikes.append({
                "date": point["t"],
                "value": point["value"],
                "baseline": round(mean, 1),
                "ratio": round(point["value"] / max(mean, 0.5), 1),
                "z": round(z, 1),
                "avg_intensity": avg_i.get(point["t"]),
            })

    stats = fetch_one(
        f"""SELECT COUNT(*) AS n,
                   percentile_cont(0.25) WITHIN GROUP (ORDER BY intensity) AS q1,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY intensity) AS q3
            FROM incidents {where}""",
        params,
    )
    outliers = {"threshold": None, "total": 0, "items": []}
    if stats["n"] >= 8:
        threshold = float(stats["q3"]) + OUTLIER_IQR_K * (float(stats["q3"]) - float(stats["q1"]))
        where_out, params_out = f.where("intensity > %s")
        params_out = params_out + [threshold]
        total = fetch_one(f"SELECT COUNT(*) AS n FROM incidents {where_out}", params_out)["n"]
        items = fetch_all(
            f"""SELECT id, occurred_at, sector, direction, event_type, intensity
                FROM incidents {where_out}
                ORDER BY intensity DESC, occurred_at DESC LIMIT 10""",
            params_out,
        )
        outliers = {"threshold": round(threshold, 1), "total": total, "items": items}

    return {
        "spikes": spikes,
        "outliers": outliers,
        "rules": {
            "baseline_days": BASELINE_DAYS,
            "spike_z": SPIKE_Z,
            "spike_min_events": SPIKE_MIN_EVENTS,
            "outlier_iqr_k": OUTLIER_IQR_K,
        },
    }
