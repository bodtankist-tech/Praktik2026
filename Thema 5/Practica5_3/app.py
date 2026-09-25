"""Інтерактивний дашборд оперативного огляду обстановки (практична 5.3, варіант 7).

Запуск:
    pip install dash plotly pandas numpy
    python app.py
і відкрити http://127.0.0.1:8050 у браузері.
"""
from pathlib import Path
import pandas as pd
from dash import Dash, dcc, html, dash_table, Input, Output

import figures as F

DATA = Path(__file__).parent / "data"
events = F.clean_events(pd.read_csv(DATA / "events.csv"))
forces = pd.read_csv(DATA / "forces.csv")
dmin, dmax = events["date"].min().date(), events["date"].max().date()

CARD = {"background": F.SAND_LIGHT, "borderLeft": "4px solid #556B2F", "borderRadius": "8px", "padding": "10px 14px", "flex": "1", "minWidth": "150px"}
app = Dash(__name__, title="Оперативний огляд обстановки")
app.layout = html.Div(style={"fontFamily": "Segoe UI, Arial, sans-serif", "padding": "12px 18px", "maxWidth": "1500px",
                             "margin": "0 auto"}, children=[
    html.H2("Дашборд оперативного огляду обстановки", style={"margin": "0 0 2px 0", "color": F.OLIVE_DARK}),
    html.Div("Навчальний прототип · синтетичні дані · умовний район 60×40 км", style={"color": "#6c757d"}),
    html.Div(style={"display": "flex", "gap": "14px", "margin": "12px 0", "flexWrap": "wrap"}, children=[
        html.Div([html.Label("Напрямки"), dcc.Dropdown(F.DIRECTIONS, F.DIRECTIONS, multi=True, id="dir")],
                 style={"flex": "2", "minWidth": "260px"}),
        html.Div([html.Label("Типи подій"), dcc.Dropdown(F.EVENT_TYPES, F.EVENT_TYPES, multi=True, id="typ")],
                 style={"flex": "3", "minWidth": "300px"}),
        html.Div([html.Label("Період"), html.Br(),
                  dcc.DatePickerRange(id="dates", start_date=dmin, end_date=dmax, min_date_allowed=dmin,
                                      max_date_allowed=dmax, display_format="DD.MM.YYYY")],
                 style={"flex": "2", "minWidth": "280px"}),
    ]),
    html.Div(id="kpi", style={"display": "flex", "gap": "12px", "flexWrap": "wrap", "marginBottom": "10px"}),
    html.Div(style={"display": "grid", "gridTemplateColumns": "1.1fr 1fr", "gap": "10px"}, children=[
        dcc.Graph(id="map", style={"height": "440px"}),
        dcc.Graph(id="ts", style={"height": "440px"}),
        dcc.Graph(id="forces", style={"height": "420px"}),
        dcc.Graph(id="types", style={"height": "420px"}),
    ]),
    html.H4("Журнал подій (останні 15 за фільтром)"),
    dash_table.DataTable(id="table", page_size=15, sort_action="native",
                         style_header={"backgroundColor": F.OLIVE_DARK, "color": "white", "fontWeight": "bold"},
                         style_cell={"textAlign": "left", "padding": "4px 8px"},
                         style_data_conditional=[{"if": {"filter_query": "{Інтенсивність} >= 4"},
                                                  "backgroundColor": F.HOSTILE_TINT}]),
])


@app.callback(Output("kpi", "children"), Output("map", "figure"), Output("ts", "figure"),
              Output("forces", "figure"), Output("types", "figure"), Output("table", "data"),
              Input("dir", "value"), Input("typ", "value"), Input("dates", "start_date"), Input("dates", "end_date"))
def update(dirs, types, d0, d1):
    ev = F.filter_events(events, dirs, types, d0, d1)
    cards = [html.Div([html.Div(k, style={"fontSize": "12px", "color": "#6c757d"}),
                       html.Div(str(v), style={"fontSize": "22px", "fontWeight": "600"})], style=CARD)
             for k, v in (F.kpis(ev).items() if len(ev) else {"Подій": 0}.items())]
    return (cards, F.fig_map(ev), F.fig_timeseries(ev), F.fig_forces(forces, dirs), F.fig_types(ev),
            F.table_latest(ev).to_dict("records"))


if __name__ == "__main__":
    app.run(debug=False)
