"""Побудова елементів дашборда оперативного огляду обстановки (варіант 7, практична 5.3).

Модуль спільний для ноутбука 5.3task.ipynb, інтерактивного застосунку app.py (Dash)
та статичного dashboard.html. Усі дані синтетичні (навчальні).
"""
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

DIRECTIONS = ["Напрямок А", "Напрямок Б", "Напрямок В", "Напрямок Г"]
EVENT_TYPES = ["Артобстріл", "Удар БпЛА", "Штурмові дії", "Дії ДРГ", "Авіаудар (КАБ)"]
UNIT_TYPES = ["Мотострілецькі", "Танкові", "Артилерійські", "Підрозділи БпЛА", "РЕБ", "Логістичні"]

# Палітра військового стилю (вимога 4.2 методики): NATO blue, олива, земляні відтінки.
# Напрямки: холодні тони (сині/оливкові/сірі); типи подій: теплі земляні тони,
# найнебезпечніші дії (штурм) виділено темно-червоним (у NATO червоний означає противника).
OLIVE_DARK, SAND_LIGHT, HOSTILE_TINT = "#3B4A2F", "#EEF0E6", "#EBCFC8"
# Сталі кольори: той самий напрямок або тип події має той самий колір на всіх графіках
DIR_COLORS = dict(zip(DIRECTIONS, ["#1F4E79", "#556B2F", "#6C8EBF", "#8C8C7A"]))
TYPE_COLORS = dict(zip(EVENT_TYPES, ["#A0522D", "#C2A36B", "#8B1A1A", "#6F4E37", "#2F2F28"]))
TEMPLATE = "plotly_white"
FONT = dict(family="Segoe UI, Arial, sans-serif", color="#2B2B24")


# ---------------------------------------------------------------- data
def generate_data(seed=7, start="2026-08-24", days=30):
    """Синтетичний журнал подій та оцінка складу сил противника в умовному районі 60×40 км."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start, periods=days, freq="D")
    # центр кожного напрямку на лінії зіткнення (умовні координати, км)
    centers = {"Напрямок А": (8, 30), "Напрямок Б": (22, 24), "Напрямок В": (38, 18), "Напрямок Г": (52, 12)}
    base_rate = {"Напрямок А": 6, "Напрямок Б": 9, "Напрямок В": 7, "Напрямок Г": 5}
    type_p = {"Напрямок А": [.40, .30, .10, .15, .05], "Напрямок Б": [.30, .25, .25, .05, .15],
              "Напрямок В": [.35, .35, .10, .10, .10], "Напрямок Г": [.45, .25, .05, .20, .05]}
    rows, eid = [], 1
    for d_i, day in enumerate(dates):
        for dname in DIRECTIONS:
            lam = base_rate[dname]
            if dname == "Напрямок Б" and d_i >= days - 8:        # наростання активності в останній тиждень
                lam *= 2.3
            if dname == "Напрямок Г" and d_i >= days - 10:       # спад активності
                lam *= 0.45
            if d_i % 7 in (5, 6):                                 # слабкий тижневий ритм
                lam *= 0.85
            for _ in range(rng.poisson(lam)):
                cx, cy = centers[dname]
                etype = rng.choice(EVENT_TYPES, p=type_p[dname])
                intensity = int(np.clip(rng.normal(3.4 if etype in ("Штурмові дії", "Авіаудар (КАБ)") else 2.4, 1), 1, 5))
                if dname == "Напрямок Б" and d_i >= days - 8:
                    intensity = min(5, intensity + 1)
                ts = day + pd.Timedelta(minutes=int(rng.integers(0, 24 * 60)))
                rows.append({"event_id": f"E{eid:05d}", "datetime": ts, "date": day.date(), "direction": dname,
                             "event_type": etype, "intensity": intensity,
                             "x_km": round(float(np.clip(cx + rng.normal(0, 3.2), 0, 60)), 2),
                             "y_km": round(float(np.clip(cy + rng.normal(0, 2.4), 0, 40)), 2)})
                eid += 1
    events = pd.DataFrame(rows).sort_values("datetime").reset_index(drop=True)
    # трохи «брудних» записів, щоб було що перевіряти під час підготовки
    dup = events.sample(3, random_state=seed)
    events = pd.concat([events, dup], ignore_index=True)
    events.loc[events.sample(4, random_state=seed + 1).index, "intensity"] = np.nan

    comp = {"Напрямок А": [14, 3, 6, 5, 2, 3], "Напрямок Б": [22, 7, 9, 8, 3, 5],
            "Напрямок В": [16, 4, 8, 7, 2, 4], "Напрямок Г": [10, 2, 5, 3, 1, 3]}
    forces = pd.DataFrame([{"direction": d, "unit_type": u, "units": n}
                           for d, vals in comp.items() for u, n in zip(UNIT_TYPES, vals)])
    return events, forces


def clean_events(events):
    ev = events.drop_duplicates(subset="event_id").copy()
    ev["datetime"] = pd.to_datetime(ev["datetime"])
    ev["date"] = ev["datetime"].dt.normalize()
    ev["intensity"] = ev.groupby("event_type")["intensity"].transform(lambda s: s.fillna(s.median())).astype(int)
    return ev.sort_values("datetime").reset_index(drop=True)


def filter_events(ev, directions=None, types=None, date_from=None, date_to=None):
    m = pd.Series(True, index=ev.index)
    if directions: m &= ev["direction"].isin(directions)
    if types: m &= ev["event_type"].isin(types)
    if date_from is not None: m &= ev["date"] >= pd.to_datetime(date_from)
    if date_to is not None: m &= ev["date"] <= pd.to_datetime(date_to)
    return ev[m]


# ---------------------------------------------------------------- KPI
def kpis(ev):
    last_day = ev["date"].max()
    last7 = ev[ev["date"] > last_day - pd.Timedelta(days=7)]
    prev7 = ev[(ev["date"] <= last_day - pd.Timedelta(days=7)) & (ev["date"] > last_day - pd.Timedelta(days=14))]
    change = (len(last7) - len(prev7)) / max(len(prev7), 1) * 100
    top_dir = last7["direction"].value_counts().idxmax() if len(last7) else "—"
    return {"Подій за період": len(ev),
            "Подій за 7 діб": len(last7),
            "Зміна до попередніх 7 діб": f"{change:+.0f} %",
            "Найактивніший напрямок (7 діб)": top_dir,
            "Середня інтенсивність": f"{ev['intensity'].mean():.1f} / 5" if len(ev) else "—"}


# ---------------------------------------------------------------- figures
def _style(fig):
    fig.update_layout(font=FONT, title_font=dict(color=OLIVE_DARK, size=16))
    return fig


def fig_map(ev):
    fig = px.scatter(ev, x="x_km", y="y_km", color="event_type", size="intensity", size_max=13,
                     color_discrete_map=TYPE_COLORS, category_orders={"event_type": EVENT_TYPES},
                     hover_data={"direction": True, "datetime": "|%d.%m %H:%M", "intensity": True,
                                 "x_km": False, "y_km": False, "event_type": False},
                     labels={"event_type": "Тип події", "x_km": "X, км", "y_km": "Y, км",
                             "direction": "Напрямок", "datetime": "Час", "intensity": "Інтенсивність"},
                     template=TEMPLATE, opacity=0.65)
    # умовна лінія зіткнення
    fig.add_trace(go.Scatter(x=[0, 8, 22, 38, 52, 60], y=[33, 30, 24, 18, 12, 10], mode="lines",
                             line=dict(color="black", dash="dash", width=1.5), name="Лінія зіткнення (умовна)"))
    for d, (x, y) in {"А": (8, 36), "Б": (22, 30), "В": (38, 24), "Г": (52, 18)}.items():
        fig.add_annotation(x=x, y=y, text=f"<b>{d}</b>", showarrow=False, font=dict(size=14, color="#333"))
    fig.update_layout(title="Карта подій (умовний район 60×40 км)", legend_title_text="",
                      xaxis=dict(range=[0, 60]), yaxis=dict(range=[0, 40], scaleanchor="x"),
                      margin=dict(l=40, r=10, t=50, b=40))
    return _style(fig)


def fig_timeseries(ev):
    daily = ev.groupby(["date", "direction"]).size().unstack(fill_value=0).reindex(columns=DIRECTIONS, fill_value=0)
    fig = go.Figure()
    for d in daily.columns:
        fig.add_trace(go.Scatter(x=daily.index, y=daily[d], mode="lines", name=d, legendgroup=d,
                                 line=dict(color=DIR_COLORS[d], width=1), opacity=0.35, showlegend=False,
                                 hovertemplate="%{x|%d.%m}: %{y} подій<extra>" + d + "</extra>"))
        fig.add_trace(go.Scatter(x=daily.index, y=daily[d].rolling(3, min_periods=1).mean(), mode="lines",
                                 name=d, legendgroup=d, line=dict(color=DIR_COLORS[d], width=3),
                                 hovertemplate="%{x|%d.%m}: %{y:.1f} (сер. 3 доби)<extra>" + d + "</extra>"))
    fig.update_layout(title="Динаміка подій за напрямками<br><sup>тонка лінія: за добу; товста: ковзне середнє за 3 доби</sup>",
                      xaxis=dict(title="", tickformat="%d.%m"), yaxis_title="Подій за добу", template=TEMPLATE, hovermode="x unified",
                      legend=dict(orientation="h", y=1.0, x=0, yanchor="bottom"), margin=dict(l=40, r=10, t=90, b=30))
    return _style(fig)


def fig_forces(forces, directions=None):
    f = forces if not directions else forces[forces["direction"].isin(directions)]
    fig = px.treemap(f, path=[px.Constant("Угруповання противника"), "direction", "unit_type"], values="units",
                     color="direction", color_discrete_map={**DIR_COLORS, "(?)": "#D9D6C7"}, template=TEMPLATE)
    fig.update_traces(texttemplate="<b>%{label}</b><br>%{value} підрозд.<br>%{percentParent:.0%}",
                      hovertemplate="%{label}: %{value} підрозділів (%{percentParent:.0%} від %{parent})<extra></extra>")
    fig.update_layout(title="Структура сил противника (кількість підрозділів рівня рота/батарея)",
                      margin=dict(l=10, r=10, t=50, b=10))
    return _style(fig)


def fig_types(ev):
    t = ev.groupby(["direction", "event_type"]).size().reset_index(name="n")
    fig = px.bar(t, y="direction", x="n", color="event_type", orientation="h", color_discrete_map=TYPE_COLORS,
                 category_orders={"direction": DIRECTIONS[::-1], "event_type": EVENT_TYPES},
                 labels={"n": "Подій", "direction": "", "event_type": "Тип події"}, template=TEMPLATE)
    fig.update_layout(title="Характер подій за напрямками", legend_title_text="", barmode="stack",
                      margin=dict(l=10, r=10, t=50, b=30))
    return _style(fig)


def table_latest(ev, n=15):
    t = ev.sort_values("datetime", ascending=False).head(n)
    return pd.DataFrame({"Час": t["datetime"].dt.strftime("%d.%m %H:%M"), "Напрямок": t["direction"],
                         "Тип події": t["event_type"], "Інтенсивність": t["intensity"],
                         "X, км": t["x_km"], "Y, км": t["y_km"]})


def fig_table(ev, n=15):
    t = table_latest(ev, n)
    fill = [[HOSTILE_TINT if v >= 4 else "white" for v in t["Інтенсивність"]]] * len(t.columns)
    fig = go.Figure(go.Table(header=dict(values=[f"<b>{c}</b>" for c in t.columns], fill_color=OLIVE_DARK,
                                         font=dict(color="white"), align="left"),
                             cells=dict(values=[t[c] for c in t.columns], fill_color=fill, align="left", height=24)))
    fig.update_layout(title=f"Останні {n} подій (виділено: інтенсивність ≥ 4)", margin=dict(l=10, r=10, t=50, b=10))
    return _style(fig)
