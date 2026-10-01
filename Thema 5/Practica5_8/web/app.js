"use strict";

// Адреса API (за вимогами завдання зафіксована в коді).
const API_BASE_URL = "http://localhost:8010";

/* ============ Режим аудиторії (?view=executive|analyst|demo) ============ */
const VIEWS = ["executive", "analyst", "demo"];
let view = new URLSearchParams(location.search).get("view");
if (!VIEWS.includes(view)) view = "analyst";
document.body.dataset.view = view;
document.querySelectorAll("[data-view-link]").forEach((a) =>
  a.classList.toggle("active", a.dataset.viewLink === view)
);

// У яких режимах який блок показується (синхронно з CSS-класами в index.html).
const VISIBLE = {
  insight: ["executive"],
  dist: ["analyst", "demo"],
  signals: ["analyst", "demo"],
  heatmap: ["analyst", "demo"],
  table: ["analyst"],
};
const shows = (block) => VISIBLE[block].includes(view);

/* ============ Стан ============ */
const state = {
  filters: { from: "", to: "", sector: "", direction: "", event_type: "", min_intensity: "" },
  group: "day",
  page: 1,
  pageSize: 20,
  sort: "occurred_at",
  order: "desc",
};
let bounds = { min: "", max: "" };
let refreshSeq = 0; // номер оновлення: застарілі відповіді ігноруються
let tableSeq = 0;
const charts = {};

const NAVY = "#1f3a5f";
const OLIVE = "#55633a";
const ALERT = "#b3261e";

/* ============ Допоміжні функції ============ */
const $ = (id) => document.getElementById(id);

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

const fmtNum = (n) => Number(n).toLocaleString("uk-UA");
const fmtDate = (iso) => iso.slice(0, 10).split("-").reverse().join(".");
const fmtShort = (iso) => iso.slice(0, 10).split("-").reverse().slice(0, 2).join(".");
const fmtDateTime = (iso) => `${fmtDate(iso)} ${iso.slice(11, 16)}`;

function plural(n, forms) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return forms[1];
  return forms[2];
}

function setBanner(text) {
  const banner = $("banner");
  banner.hidden = !text;
  banner.textContent = text || "";
}

async function api(path, extra = {}, useFilters = true) {
  const p = new URLSearchParams();
  if (useFilters) {
    for (const [k, v] of Object.entries(state.filters)) {
      if (v !== "" && v != null) p.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const qs = p.toString();
  const res = await fetch(API_BASE_URL + path + (qs ? "?" + qs : ""));
  if (!res.ok) {
    let msg = `Помилка ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
    } catch (_) { /* ігноруємо */ }
    throw new Error(msg);
  }
  return res.json();
}

function drawChart(key, canvasId, config) {
  if (charts[key]) charts[key].destroy();
  charts[key] = new Chart($(canvasId), config);
}

/* ============ Фільтри ============ */
function fillSelect(select, values) {
  const keep = select.value;
  select.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());
  values.forEach((v) => {
    const opt = el("option", v);
    opt.value = v;
    select.appendChild(opt);
  });
  select.value = values.includes(keep) ? keep : "";
}

async function loadFilters() {
  const f = await api("/filters", {}, false);
  fillSelect($("f-sector"), f.sectors);
  fillSelect($("f-direction"), f.directions);
  fillSelect($("f-type"), f.event_types);
  bounds = { min: f.min_date, max: f.max_date };
  $("f-from").min = $("f-to").min = bounds.min;
  $("f-from").max = $("f-to").max = bounds.max;
}

function resetInputs() {
  $("f-from").value = bounds.min;
  $("f-to").value = bounds.max;
  $("f-sector").value = "";
  $("f-direction").value = "";
  $("f-type").value = "";
  $("f-min").value = "";
}

function readFilters() {
  const from = $("f-from").value;
  const to = $("f-to").value;
  const min = $("f-min").value.trim();
  if (from && to && from > to) {
    setBanner("Дата «Від» не може бути пізнішою за «До».");
    return false;
  }
  if (min !== "" && !(Number(min) >= 1 && Number(min) <= 50)) {
    setBanner("Мінімальна інтенсивність має бути від 1 до 50.");
    return false;
  }
  state.filters = {
    from,
    to,
    sector: $("f-sector").value,
    direction: $("f-direction").value,
    event_type: $("f-type").value,
    min_intensity: min,
  };
  return true;
}

/* ============ Відображення блоків ============ */
function renderKpi(kpi) {
  $("kpi-total").textContent = fmtNum(kpi.total_incidents);
  $("kpi-sum").textContent = fmtNum(kpi.total_intensity);
  $("kpi-avg").textContent = kpi.total_incidents ? kpi.avg_intensity.toFixed(1) : "–";
  $("kpi-top").textContent = kpi.top_direction || "–";
}

function renderTrend(points, spikes) {
  const spikeDays = new Set(state.group === "day" ? spikes.map((s) => s.date) : []);
  drawChart("trend", "chart-trend", {
    type: "line",
    data: {
      labels: points.map((p) => (state.group === "week" ? "Тиж. " : "") + fmtShort(p.t)),
      datasets: [{
        label: "Подій",
        data: points.map((p) => p.value),
        borderColor: NAVY,
        backgroundColor: "rgba(31,58,95,.12)",
        fill: true,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: points.map((p) => (spikeDays.has(p.t) ? 6 : 2)),
        pointBackgroundColor: points.map((p) => (spikeDays.has(p.t) ? ALERT : NAVY)),
      }],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => fmtDate(points[items[0].dataIndex].t),
            afterBody: (items) =>
              spikeDays.has(points[items[0].dataIndex].t) ? ["⚠ сигнал: стрибок"] : [],
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Кількість подій" } },
        x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } },
      },
    },
  });
}

function renderDistribution(key, canvasId, data, color) {
  drawChart(key, canvasId, {
    type: "bar",
    data: {
      labels: data.map((d) => d.label),
      datasets: [{ label: "Подій", data: data.map((d) => d.value), backgroundColor: color }],
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderSignals(sig) {
  const spikesUl = $("signals-spikes");
  spikesUl.replaceChildren();
  if (!sig.spikes.length) {
    spikesUl.appendChild(el("li", "Різких стрибків у вибраному періоді не виявлено.", "empty"));
  }
  sig.spikes.forEach((s) => {
    const li = el("li");
    li.appendChild(el("span", fmtDate(s.date), "when"));
    li.appendChild(el("span", `×${s.ratio}`, "badge"));
    li.appendChild(el("br"));
    const intensity = s.avg_intensity != null ? `, середня інтенсивність ${s.avg_intensity}` : "";
    li.appendChild(document.createTextNode(
      `${s.value} ${plural(s.value, ["подія", "події", "подій"])} при звичайному рівні ≈ ${s.baseline}${intensity}`
    ));
    spikesUl.appendChild(li);
  });

  const outUl = $("signals-outliers");
  outUl.replaceChildren();
  const out = sig.outliers;
  $("outlier-threshold").textContent = out.threshold != null ? `(поріг: інтенсивність > ${out.threshold})` : "";
  if (!out.items.length) {
    outUl.appendChild(el("li", "Нетипових значень не виявлено.", "empty"));
  }
  out.items.forEach((o) => {
    const li = el("li");
    li.appendChild(el("span", fmtDateTime(o.occurred_at), "when"));
    li.appendChild(el("span", `${o.intensity}`, "badge"));
    li.appendChild(el("br"));
    li.appendChild(document.createTextNode(`${o.sector} · ${o.direction} · ${o.event_type}`));
    outUl.appendChild(li);
  });
  if (out.total > out.items.length) {
    outUl.appendChild(el("li", `…і ще ${out.total - out.items.length} (показано найбільші ${out.items.length})`, "empty"));
  }

  const r = sig.rules;
  $("signals-rules").textContent =
    `Стрибок: доба, у яку щонайменше ${r.spike_min_events} подій і значення перевищує середнє за попередні ` +
    `${r.baseline_days} діб більш ніж на ${r.spike_z} σ. Нетипова інтенсивність: вище Q3 + ${r.outlier_iqr_k}·IQR.`;
}

function renderHeatmap(data) {
  const table = $("heatmap");
  table.replaceChildren();
  if (!data.rows.length) {
    table.appendChild(el("caption", "Немає даних за вибраними фільтрами."));
    return;
  }
  const max = Math.max(1, ...data.rows.flatMap((r) => r.values));
  const head = el("tr");
  head.appendChild(el("th", "Сектор"));
  data.columns.forEach((c) => {
    const th = el("th", fmtShort(c));
    th.title = `Тиждень з ${fmtDate(c)}`;
    head.appendChild(th);
  });
  const thead = el("thead");
  thead.appendChild(head);
  table.appendChild(thead);

  const tbody = el("tbody");
  data.rows.forEach((row) => {
    const tr = el("tr");
    tr.appendChild(el("td", row.sector));
    row.values.forEach((v, i) => {
      const td = el("td", v === 0 ? "" : String(v), "cell");
      const alpha = v === 0 ? 0 : 0.12 + 0.78 * (v / max);
      td.style.backgroundColor = v === 0 ? "#f4f5f2" : `rgba(31,58,95,${alpha.toFixed(2)})`;
      td.style.color = alpha > 0.55 ? "#fff" : "#1f2a22";
      td.title = `${row.sector}, тиждень з ${fmtDate(data.columns[i])}: ${v}`;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

function renderIncidents(data) {
  const tbody = document.querySelector("#incidents-table tbody");
  tbody.replaceChildren();
  data.items.forEach((item) => {
    const tr = el("tr");
    tr.appendChild(el("td", fmtDateTime(item.occurred_at)));
    tr.appendChild(el("td", item.sector));
    tr.appendChild(el("td", item.direction));
    tr.appendChild(el("td", item.event_type));
    tr.appendChild(el("td", String(item.intensity), "num"));
    tr.appendChild(el("td", item.source || "–", "source-field"));
    const actions = el("td");
    const btn = el("button", "Details", "link-btn");
    btn.type = "button";
    btn.addEventListener("click", () => openDetails(item.id));
    actions.appendChild(btn);
    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
  if (!data.items.length) {
    const tr = el("tr");
    const td = el("td", "Немає подій за вибраними фільтрами.");
    td.colSpan = 7;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  $("incidents-count").textContent = `Знайдено: ${fmtNum(data.total)}`;
  $("pg-info").textContent = `Сторінка ${data.page} з ${pages}`;
  $("pg-prev").disabled = data.page <= 1;
  $("pg-next").disabled = data.page >= pages;

  document.querySelectorAll("#incidents-table th[data-sort]").forEach((th) => {
    const active = th.dataset.sort === state.sort;
    th.classList.toggle("sorted", active);
    th.classList.toggle("desc", active && state.order === "desc");
  });
}

function buildInsight(kpi, dayTrend, sig) {
  if (!kpi.total_incidents) return "За вибраними фільтрами подій немає.";
  const parts = [];
  const range = dayTrend.length
    ? `${fmtDate(dayTrend[0].t)} – ${fmtDate(dayTrend[dayTrend.length - 1].t)}`
    : "вибраний період";
  parts.push(
    `За період ${range} зафіксовано ${fmtNum(kpi.total_incidents)} ${plural(kpi.total_incidents, ["подію", "події", "подій"])}, ` +
    `середня інтенсивність ${kpi.avg_intensity.toFixed(1)}.`
  );

  if (dayTrend.length >= 14) {
    const sum = (arr) => arr.reduce((a, p) => a + p.value, 0);
    const last7 = sum(dayTrend.slice(-7));
    const prev7 = sum(dayTrend.slice(-14, -7));
    if (prev7 > 0) {
      const change = Math.round(((last7 - prev7) / prev7) * 100);
      const word = change > 0 ? "зростання" : change < 0 ? "спад" : "без змін";
      parts.push(`Останні 7 діб: ${last7} ${plural(last7, ["подія", "події", "подій"])}, ${word}${change ? ` на ${Math.abs(change)}%` : ""} відносно попередніх 7 діб.`);
    }
  }
  if (kpi.top_direction) parts.push(`Найбільше подій на напрямку «${kpi.top_direction}».`);

  if (sig.spikes.length) {
    const strongest = sig.spikes.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    parts.push(
      `Виявлено ${sig.spikes.length} ${plural(sig.spikes.length, ["сигнал стрибка", "сигнали стрибка", "сигналів стрибка"])}; ` +
      `найсильніший ${fmtDate(strongest.date)}: ${strongest.value} ${plural(strongest.value, ["подія", "події", "подій"])} (×${strongest.ratio} від звичайного рівня).`
    );
    const lastDay = dayTrend.length ? new Date(dayTrend[dayTrend.length - 1].t) : null;
    const recent = sig.spikes.filter((s) => lastDay && (lastDay - new Date(s.date)) / 864e5 < 7);
    if (recent.length) parts.push(`Увага: стрибок у межах останніх 7 діб (${recent.map((s) => fmtDate(s.date)).join(", ")}).`);
  } else {
    parts.push("Різких стрибків не виявлено.");
  }
  if (sig.outliers.total) {
    parts.push(`Подій з нетиповою інтенсивністю: ${sig.outliers.total}.`);
  }
  return parts.join(" ");
}

/* ============ Завантаження даних ============ */
function incidentsParams() {
  return { page: state.page, page_size: state.pageSize, sort: state.sort, order: state.order };
}

function showError(e) {
  if (e instanceof TypeError) {
    setBanner(`API недоступне (${API_BASE_URL}). Запустіть: uvicorn api.main:app --reload`);
  } else {
    setBanner(e.message);
  }
}

async function refreshAll() {
  const seq = ++refreshSeq;
  setBanner("");
  try {
    const kpiP = api("/kpi");
    const trendP = api("/trend", { group: state.group });
    const dayP = view === "executive" && state.group !== "day" ? api("/trend", { group: "day" }) : trendP;
    const sigP = api("/signals");
    const distP = shows("dist") ? Promise.all([api("/distribution/directions"), api("/distribution/types")]) : null;
    const heatP = shows("heatmap") ? api("/heatmap") : null;
    const tableP = shows("table") ? api("/incidents", incidentsParams()) : null;

    const [kpi, trend, dayTrend, sig, dist, heat, inc] =
      await Promise.all([kpiP, trendP, dayP, sigP, distP, heatP, tableP]);
    if (seq !== refreshSeq) return; // уже запущено новіше оновлення

    renderKpi(kpi);
    renderTrend(trend, sig.spikes);
    if (shows("insight")) $("insight-text").textContent = buildInsight(kpi, dayTrend, sig);
    if (dist) {
      renderDistribution("dirs", "chart-directions", dist[0], OLIVE);
      renderDistribution("types", "chart-types", dist[1], NAVY);
    }
    if (shows("signals")) renderSignals(sig);
    if (heat) renderHeatmap(heat);
    if (inc) renderIncidents(inc);
  } catch (e) {
    if (seq === refreshSeq) showError(e);
  }
}

async function refreshTable() {
  const seq = ++tableSeq;
  try {
    const inc = await api("/incidents", incidentsParams());
    if (seq === tableSeq) renderIncidents(inc);
  } catch (e) {
    showError(e);
  }
}

/* ============ Деталі події (модальне вікно) ============ */
async function openDetails(id) {
  try {
    const item = await api(`/incidents/${id}`, {}, false);
    $("m-id").textContent = `№${item.id}`;
    const dl = $("m-body");
    dl.replaceChildren();
    const fields = [
      ["Час", fmtDateTime(item.occurred_at)],
      ["Сектор", item.sector],
      ["Напрямок", item.direction],
      ["Тип події", item.event_type],
      ["Інтенсивність", String(item.intensity)],
      ["Джерело", item.source || "–", true],
      ["Опис", item.summary || "–"],
    ];
    fields.forEach(([label, value, isSource]) => {
      if (isSource && view === "demo") return; // у demo поле source не показуємо
      const cls = isSource ? "source-field" : null;
      dl.appendChild(el("dt", label, cls));
      dl.appendChild(el("dd", value, cls));
    });
    $("modal").showModal();
  } catch (e) {
    showError(e);
  }
}

/* ============ Події інтерфейсу ============ */
$("filters").addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (!readFilters()) return;
  state.page = 1;
  refreshAll();
});

$("f-reset").addEventListener("click", () => {
  resetInputs();
  readFilters();
  state.page = 1;
  refreshAll();
});

$("trend-group").addEventListener("change", (ev) => {
  state.group = ev.target.value;
  refreshAll();
});

$("pg-prev").addEventListener("click", () => { state.page -= 1; refreshTable(); });
$("pg-next").addEventListener("click", () => { state.page += 1; refreshTable(); });

document.querySelectorAll("#incidents-table th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    if (state.sort === th.dataset.sort) {
      state.order = state.order === "desc" ? "asc" : "desc";
    } else {
      state.sort = th.dataset.sort;
      state.order = "desc";
    }
    state.page = 1;
    refreshTable();
  });
});

/* ============ Запуск ============ */
(async function init() {
  if (typeof Chart === "undefined") {
    setBanner("Не вдалося завантажити Chart.js з CDN. Перевірте підключення до інтернету.");
    return;
  }
  try {
    await loadFilters();
    resetInputs();
    readFilters();
    await refreshAll();
  } catch (e) {
    showError(e);
  }
})();
