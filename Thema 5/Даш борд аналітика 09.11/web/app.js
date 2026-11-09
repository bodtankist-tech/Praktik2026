"use strict";
/* ОКО: дашборд аналітика. Дані надходять з FastAPI (той самий сервер, префікс /api). */

const API = location.protocol === "file:" ? "http://localhost:8020/api" : "/api";

// Відкрито подвійним кліком (file://)? Якщо сервер працює — переходимо на нього, інакше покаже банер з підказкою.
if (location.protocol === "file:") {
  fetch(API + "/health").then((r) => { if (r.ok) location.replace("http://localhost:8020/"); }).catch(() => {});
}

/* ================= кольори (див. styles.css) ================= */
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const C = {
  brand: css("--brand"), friend: css("--friend"), hostile: css("--hostile"),
  fire: css("--cat-fire"), ground: css("--cat-ground"), intel: css("--cat-intel"),
  good: css("--good"), warn: css("--warn"), crit: css("--crit"),
  text2: css("--text-2"), grid: "#e6e9e7",
};
// Категорія події з БД → група на карті (3 кольори: більше на карті не розрізнити надійно)
const GROUP = {
  "вогневе ураження": { label: "Вогневе ураження", color: C.fire },
  "наземні дії": { label: "Наземні дії", color: C.ground },
  "розвідка": { label: "Розвідка та РЕБ", color: C.intel },
  "РЕБ": { label: "Розвідка та РЕБ", color: C.intel },
  "інше": { label: "Інше", color: "#8a918c" },
};
const groupOf = (cat) => GROUP[cat] || GROUP["інше"];
const TYPE_CATEGORY = {
  "Артилерійський обстріл": "вогневе ураження", "Удар ударного БпЛА": "вогневе ураження",
  "Ракетний удар": "вогневе ураження", "Ураження цілі": "вогневе ураження",
  "Штурмові дії": "наземні дії", "Активність ДРГ": "наземні дії",
  "Переміщення техніки": "розвідка", "Робота засобів РЕБ": "РЕБ",
};

/* ================= стан ================= */
const state = {
  filters: { from: "", to: "", direction: "", region: "", event_type: "", min_intensity: "" },
  group: "day",
  page: 1, pageSize: 15, sort: "occurred_at", order: "desc",
};
let bounds = { min: "", max: "" };
let seq = 0;
const charts = {};

/* ================= утиліти ================= */
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString("uk-UA");
const fmtDate = (iso) => iso.slice(0, 10).split("-").reverse().join(".");
const fmtShort = (iso) => iso.slice(5, 10).split("-").reverse().join(".");
const fmtDT = (iso) => `${fmtDate(iso)} ${iso.slice(11, 16)}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const AFF = { friend: "Свої", hostile: "Противник", neutral: "Нейтральні", unknown: "Невідомі" };

function qs(extra = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...state.filters, ...extra })) if (v !== "" && v != null) p.set(k, v);
  const s = p.toString();
  return s ? "?" + s : "";
}

async function api(path) {
  const res = await fetch(API + path);
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).detail || msg; } catch (_) { /* ignore */ }
    throw new Error(`${res.status}: ${msg}`);
  }
  return res.json();
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ================= Chart.js: загальні налаштування ================= */
Chart.defaults.font.family = '"Segoe UI", Roboto, Arial, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = C.text2;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(20,30,25,.92)";
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation.duration = 300;

function upsertChart(id, config) {
  if (charts[id]) {
    charts[id].data = config.data;
    if (config.options) charts[id].options = config.options;
    charts[id].update();
  } else {
    charts[id] = new Chart($(id), config);
  }
  return charts[id];
}

const axisX = { grid: { display: false }, border: { color: C.grid } };
const axisY = { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { precision: 0 } };

function hBar(id, rows, color, onPick) {
  upsertChart(id, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.label),
      datasets: [{ label: "Подій", data: rows.map((r) => r.value), backgroundColor: color, borderRadius: 4, barPercentage: 0.75, maxBarThickness: 22 }],
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { afterLabel: (ctx) => rows[ctx.dataIndex]?.avg_intensity != null ? `Сер. інтенсивність: ${rows[ctx.dataIndex].avg_intensity}` : "" } },
      },
      scales: { x: { ...axisY }, y: { ...axisX } },
      onClick: onPick ? (_e, els) => { if (els.length) onPick(rows[els[0].index].label); } : undefined,
      onHover: onPick ? (e, els) => { e.native.target.style.cursor = els.length ? "pointer" : "default"; } : undefined,
    },
  });
}

/* ================= карта ================= */
const START_BOUNDS = [[46.0, 31.0], [51.4, 39.0]]; // район умовної лінії; тил видно при віддаленні
const map = L.map("map", { zoomControl: true, preferCanvas: true, minZoom: 5 }).fitBounds(START_BOUNDS);
map.on("zoomend", () => { if (lastUnits.length) drawUnits(); });
// Тайли OpenStreetMap віддаються лише сторінкам, відкритим через http:// (OSM вимагає заголовок Referer;
// у file:// його немає, і замість карти буде «Access blocked»). Тому сторінку відкривати з сервера: http://localhost:8020
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 14, attribution: "© OpenStreetMap contributors",
}).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const layers = {
  friend: L.layerGroup().addTo(map),
  hostile: L.layerGroup().addTo(map),
  events: L.layerGroup().addTo(map),
  line: L.layerGroup().addTo(map),
};
const eventMarkers = new Map();

// Розмір позначки залежить від масштабу, щоб на всю Україну знаки не злипалися
const symbolSize = (z) => (z <= 6 ? 13 : z === 7 ? 17 : z === 8 ? 22 : 26);

function symbolIcon(unit, zoom) {
  const designation = unit.name.match(/«([^»]+)»|П-\d+/);
  const sym = new ms.Symbol(unit.sidc, {
    size: symbolSize(zoom),
    // умовне найменування (поле T) показуємо лише на великому масштабі
    uniqueDesignation: zoom >= 8 && designation ? (designation[1] || designation[0]) : "",
    standard: "APP6",
  });
  const anchor = sym.getAnchor();
  const sz = sym.getSize();
  const label = `<span class="lbl">${esc(unit.unit_type)}</span>`;
  return L.divIcon({
    className: "mil-icon",
    html: `<div style="position:relative">${sym.asSVG()}${label}</div>`,
    iconSize: [sz.width, sz.height],
    iconAnchor: [anchor.x, anchor.y],
  });
}

function unitDetails(u) {
  const sym = new ms.Symbol(u.sidc, { size: 30, standard: "APP6" }).asSVG();
  const color = u.strength_pct >= 70 ? C.good : u.strength_pct >= 45 ? C.warn : C.crit;
  $("details").classList.remove("muted");
  $("details").innerHTML = `
    <div class="title">${sym}<span>${esc(u.name)}</span></div>
    <dl>
      <dt>Сторона</dt><dd>${AFF[u.affiliation]}</dd>
      <dt>Тип</dt><dd>${esc(u.unit_type)}, ${esc(u.echelon)}</dd>
      <dt>Район</dt><dd>${esc(u.region)} обл.${u.direction ? ", " + esc(u.direction) : ""}</dd>
      <dt>Стан</dt><dd>${esc(u.status)}</dd>
      <dt>Укомпл.</dt><dd>${u.strength_pct}%<div class="bar"><span style="width:${u.strength_pct}%;background:${color}"></span></div></dd>
      <dt>Подій</dt><dd>${u.events_count}</dd>
      <dt>SIDC</dt><dd><code>${esc(u.sidc)}</code></dd>
      <dt>Оновлено</dt><dd>${fmtDT(u.updated_at)}</dd>
    </dl>`;
}

function eventDetails(e) {
  const g = groupOf(e.category);
  $("details").classList.remove("muted");
  $("details").innerHTML = `
    <div class="title"><span class="chip" style="--c:${g.color}"></span>${esc(e.event_type)}</div>
    <dl>
      <dt>Час</dt><dd>${fmtDT(e.occurred_at)}</dd>
      <dt>Район</dt><dd>${esc(e.region)} обл.${e.direction ? ", " + esc(e.direction) : " (тил)"}</dd>
      <dt>Інтенсивн.</dt><dd>${e.intensity}/10</dd>
      ${e.reliability ? `<dt>Оцінка</dt><dd>${esc(e.reliability)} · ${esc(e.source)}</dd>` : ""}
      ${e.unit_name ? `<dt>Підрозділ</dt><dd>${esc(e.unit_name)}</dd>` : ""}
      <dt>Коорд.</dt><dd>${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}</dd>
    </dl>
    ${e.summary ? `<p class="muted" style="margin-top:6px">${esc(e.summary)}</p>` : ""}`;
}

async function showEvent(id, fly = false) {
  const e = await api(`/events/${id}`);
  eventDetails(e);
  if (fly) map.flyTo([e.lat, e.lon], Math.max(map.getZoom(), 9), { duration: 0.8 });
  const m = eventMarkers.get(id);
  if (m) m.openPopup();
}

// Підрозділи — це «знімок» без часу, тому до них застосовуються лише область і напрямок
function unitQuery() {
  const p = new URLSearchParams();
  if (state.filters.region) p.set("region", state.filters.region);
  if (state.filters.direction) p.set("direction", state.filters.direction);
  const s = p.toString();
  return s ? "?" + s : "";
}

let lastUnits = [];

async function loadUnits() {
  lastUnits = await api(`/units${unitQuery()}`);
  drawUnits();
}

function drawUnits() {
  const units = lastUnits;
  const zoom = map.getZoom();
  layers.friend.clearLayers();
  layers.hostile.clearLayers();
  let nf = 0, nh = 0;
  for (const u of units) {
    const layer = u.affiliation === "friend" ? layers.friend : layers.hostile;
    u.affiliation === "friend" ? nf++ : nh++;
    L.marker([u.lat, u.lon], { icon: symbolIcon(u, zoom), title: u.name, zIndexOffset: u.affiliation === "friend" ? 200 : 100 })
      .on("click", () => unitDetails(u))
      .bindTooltip(`<b>${esc(u.name)}</b><br>${esc(u.status)}, ${u.strength_pct}%`, { direction: "top", offset: [0, -8] })
      .addTo(layer);
  }
  $("n-friend").textContent = nf;
  $("n-hostile").textContent = nh;
}

async function loadEventsLayer(mySeq) {
  const pts = await api(`/events/geo${qs()}`);
  if (mySeq !== seq) return;
  layers.events.clearLayers();
  eventMarkers.clear();
  for (const p of pts) {
    const g = groupOf(p.category);
    const m = L.circleMarker([p.lat, p.lon], {
      radius: 3 + p.intensity * 0.7, color: "#fff", weight: 1.5,
      fillColor: g.color, fillOpacity: 0.8,
    })
      .bindPopup(`<b>${esc(p.event_type)}</b><br>${fmtDT(p.occurred_at)}<br>${esc(p.region)} обл. · інтенсивність ${p.intensity}/10`)
      .on("click", () => showEvent(p.id));
    m.addTo(layers.events);
    eventMarkers.set(p.id, m);
  }
  $("n-events").textContent = fmt(pts.length);
}

async function loadFrontline() {
  const pts = await api("/frontline");
  L.polyline(pts, { color: C.crit, weight: 3, dashArray: "8 6", opacity: 0.85 })
    .bindTooltip("Умовна лінія зіткнення (синтетична, навчальна)", { sticky: true })
    .addTo(layers.line);
}

document.querySelectorAll("[data-layer]").forEach((cb) =>
  cb.addEventListener("change", () => {
    const layer = layers[cb.dataset.layer];
    cb.checked ? layer.addTo(map) : map.removeLayer(layer);
  })
);
$("labels-toggle").addEventListener("change", (e) => $("map").classList.toggle("show-labels", e.target.checked));

// Зразки позначок у легенді
$("leg-friend").innerHTML = new ms.Symbol("10031000161211020000", { size: 16 }).asSVG();
$("leg-hostile").innerHTML = new ms.Symbol("10061000161211020000", { size: 16 }).asSVG();

/* ================= KPI ================= */
function renderKpi(k) {
  const delta = k.delta_pct == null ? "немає бази для порівняння"
    : `<span class="${k.delta_pct > 0 ? "up" : "down"}">${k.delta_pct > 0 ? "▲" : "▼"} ${Math.abs(k.delta_pct)}%</span> до попер. періоду`;
  const cards = [
    { label: "Подій за період", value: fmt(k.total_events), sub: delta, alert: k.delta_pct > 25 },
    { label: "Висока інтенсивність (≥ 8)", value: fmt(k.high_intensity), sub: k.total_events ? `${Math.round(k.high_intensity / k.total_events * 100)}% від усіх` : "" },
    { label: "Ракетні удари по тилу", value: fmt(k.deep_strikes), sub: "за обраний період" },
    { label: "Середня інтенсивність", value: k.avg_intensity.toLocaleString("uk-UA"), sub: "шкала 1–10" },
    { label: "Найактивніший напрямок", value: k.top_direction || "—", small: true, sub: "за кількістю подій" },
    { label: "Підрозділи: свої / противник", value: `${k.friend_units} / ${k.hostile_units}`, sub: k.friend_strength != null ? `укомплектованість своїх ${k.friend_strength}%` : "" },
  ];
  $("kpis").innerHTML = cards.map((c) => `
    <div class="kpi${c.alert ? " alert" : ""}">
      <div class="label">${c.label}</div>
      <div class="value${c.small ? " small" : ""}">${esc(c.value)}</div>
      <div class="sub">${c.sub}</div>
    </div>`).join("");
}

/* ================= графіки ================= */
function renderTrend(rows) {
  const labels = rows.map((r) => r.t);
  const values = rows.map((r) => r.value);
  // ковзне середнє за 7 точок (лише для добового кроку)
  const ma = state.group === "day" ? values.map((_, i) => {
    if (i < 6) return null;
    const w = values.slice(i - 6, i + 1);
    return Math.round(w.reduce((a, b) => a + b, 0) / 7 * 10) / 10;
  }) : null;
  const datasets = [{
    label: state.group === "day" ? "Подій за добу" : "Подій за тиждень",
    data: values, borderColor: C.brand, backgroundColor: "rgba(0,90,52,.10)",
    borderWidth: 2, fill: true, tension: 0.25, pointRadius: 0, pointHoverRadius: 5,
  }];
  if (ma) datasets.push({ label: "Ковзне середнє (7 діб)", data: ma, borderColor: "#d99a00", borderWidth: 2, borderDash: [5, 4], pointRadius: 0, fill: false, tension: 0.3 });
  upsertChart("ch-trend", {
    type: "line",
    data: { labels, datasets },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: !!ma, position: "top", align: "end" },
        tooltip: { callbacks: { title: (items) => (state.group === "week" ? "Тиждень з " : "") + fmtDate(items[0].label) } },
      },
      scales: {
        x: { ...axisX, ticks: { callback: function (v) { return fmtShort(this.getLabelForValue(v)); }, maxTicksLimit: 12, maxRotation: 0 } },
        y: { ...axisY },
      },
    },
  });
}

function renderTypes(rows) {
  hBar("ch-types", rows, rows.map((r) => groupOf(TYPE_CATEGORY[r.label]).color), (label) => setFilter("event_type", label));
}

function renderHourly(rows) {
  upsertChart("ch-hourly", {
    type: "bar",
    data: { labels: rows.map((r) => String(r.hour).padStart(2, "0")), datasets: [{ label: "Подій", data: rows.map((r) => r.value), backgroundColor: C.brand, borderRadius: 3, barPercentage: 0.85 }] },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `${i[0].label}:00–${i[0].label}:59` } } },
      scales: { x: { ...axisX, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }, y: { ...axisY } },
    },
  });
}

function renderForces(s) {
  upsertChart("ch-forces", {
    type: "bar",
    data: {
      labels: s.types,
      datasets: [
        { label: "Свої", data: s.friend, backgroundColor: C.friend, borderRadius: 3, maxBarThickness: 12 },
        { label: "Противник", data: s.hostile, backgroundColor: C.hostile, borderRadius: 3, maxBarThickness: 12 },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { position: "top", align: "end" },
        tooltip: { callbacks: { afterLabel: (ctx) => { const v = s[(ctx.datasetIndex ? "hostile" : "friend") + "_strength"][ctx.dataIndex]; return v != null ? `Сер. укомплектованість: ${v}%` : ""; } } },
      },
      scales: { x: { ...axisY }, y: { ...axisX } },
    },
  });
}

function renderStatus(s) {
  const statuses = [["боєздатний", C.good], ["обмежено боєздатний", C.warn], ["небоєздатний", C.crit]];
  const affs = ["friend", "hostile"];
  const n = (aff, st) => (s.status.find((r) => r.affiliation === aff && r.status === st) || { n: 0 }).n;
  const totals = affs.map((a) => statuses.reduce((sum, [st]) => sum + n(a, st), 0));
  upsertChart("ch-status", {
    type: "bar",
    data: {
      labels: affs.map((a) => AFF[a]),
      datasets: statuses.map(([st, color]) => ({
        label: st, backgroundColor: color, borderColor: "#fff", borderWidth: { right: 2 }, borderSkipped: false,
        data: affs.map((a, i) => totals[i] ? Math.round(n(a, st) / totals[i] * 1000) / 10 : 0),
        counts: affs.map((a) => n(a, st)),
        maxBarThickness: 34,
      })),
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.dataset.counts[ctx.dataIndex]} (${ctx.raw}%)` } },
      },
      scales: { x: { ...axisY, stacked: true, max: 100, ticks: { callback: (v) => v + "%" } }, y: { ...axisX, stacked: true } },
    },
  });
}

/* ================= таблиця ================= */
async function loadTable() {
  const mySeq = seq;
  const d = await api(`/events${qs({ page: state.page, page_size: state.pageSize, sort: state.sort, order: state.order })}`);
  if (mySeq !== seq) return;
  const tbody = document.querySelector("#events-table tbody");
  tbody.innerHTML = d.items.length ? d.items.map((e) => {
    const g = groupOf(TYPE_CATEGORY[e.event_type]);
    return `<tr data-id="${e.id}">
      <td>${fmtDT(e.occurred_at)}</td>
      <td><span class="chip" style="--c:${g.color}"></span>${esc(e.event_type)}</td>
      <td>${esc(e.direction || "тил")}</td>
      <td>${esc(e.region)}</td>
      <td class="num"><span class="pill${e.intensity >= 8 ? " hi" : ""}">${e.intensity}</span></td>
      <td>${esc(e.reliability)}</td>
      <td>${esc(e.source)}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="7" class="muted">Немає подій за обраними фільтрами</td></tr>`;
  const pages = Math.max(1, Math.ceil(d.total / d.page_size));
  $("pg-info").textContent = `сторінка ${d.page} з ${pages}`;
  $("table-info").textContent = `${fmt(d.total)} записів`;
  $("pg-prev").disabled = d.page <= 1;
  $("pg-next").disabled = d.page >= pages;
  document.querySelectorAll("#events-table th[data-sort]").forEach((th) => {
    th.classList.toggle("asc", th.dataset.sort === state.sort && state.order === "asc");
    th.classList.toggle("desc", th.dataset.sort === state.sort && state.order === "desc");
  });
}

document.querySelector("#events-table tbody").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  document.querySelectorAll("#events-table tr.sel").forEach((r) => r.classList.remove("sel"));
  tr.classList.add("sel");
  showEvent(Number(tr.dataset.id), true);
  $("map").scrollIntoView({ behavior: "smooth", block: "center" });
});
document.querySelectorAll("#events-table th[data-sort]").forEach((th) =>
  th.addEventListener("click", () => {
    if (state.sort === th.dataset.sort) state.order = state.order === "asc" ? "desc" : "asc";
    else { state.sort = th.dataset.sort; state.order = th.dataset.sort === "occurred_at" || th.dataset.sort === "intensity" ? "desc" : "asc"; }
    state.page = 1;
    loadTable().catch(showError);
  })
);
$("pg-prev").addEventListener("click", () => { state.page--; loadTable().catch(showError); });
$("pg-next").addEventListener("click", () => { state.page++; loadTable().catch(showError); });

/* ================= фільтри ================= */
function fillSelect(id, values) {
  const sel = $(id);
  for (const v of values) sel.add(new Option(v, v));
}

function readForm() {
  state.filters = {
    from: $("f-from").value, to: $("f-to").value,
    direction: $("f-direction").value, region: $("f-region").value,
    event_type: $("f-type").value, min_intensity: $("f-intensity").value,
  };
}

function writeForm() {
  const f = state.filters;
  $("f-from").value = f.from; $("f-to").value = f.to;
  $("f-direction").value = f.direction; $("f-region").value = f.region;
  $("f-type").value = f.event_type; $("f-intensity").value = f.min_intensity;
  const span = f.from && f.to ? (Date.parse(f.to) - Date.parse(f.from)) / 864e5 + 1 : null;
  document.querySelectorAll(".quick button").forEach((b) => {
    const d = Number(b.dataset.days);
    b.classList.toggle("on", f.to === bounds.max && (d === 0 ? f.from === bounds.min : span === d));
  });
}

function setFilter(key, value) {
  state.filters[key] = state.filters[key] === value ? "" : value; // повторний клік знімає фільтр
  writeForm();
  refresh();
}

$("filters").addEventListener("submit", (e) => { e.preventDefault(); readForm(); writeForm(); refresh(); });
$("f-reset").addEventListener("click", () => {
  state.filters = { from: bounds.min, to: bounds.max, direction: "", region: "", event_type: "", min_intensity: "" };
  writeForm(); refresh();
});
document.querySelectorAll(".quick button").forEach((b) =>
  b.addEventListener("click", () => {
    const d = Number(b.dataset.days);
    state.filters.to = bounds.max;
    state.filters.from = d === 0 ? bounds.min : addDays(bounds.max, -(d - 1));
    writeForm(); refresh();
  })
);
document.querySelectorAll(".seg button").forEach((b) =>
  b.addEventListener("click", () => {
    state.group = b.dataset.group;
    document.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("on", x === b));
    api(`/trend${qs({ group: state.group })}`).then(renderTrend).catch(showError);
  })
);

/* ================= оновлення ================= */
function showError(err) {
  console.error(err);
  $("api-status").className = "dot err";
  let box = document.querySelector(".error-banner");
  if (!box) {
    box = document.createElement("div");
    box.className = "error-banner";
    document.querySelector("main").prepend(box);
  }
  box.textContent = `Помилка звернення до API: ${err.message}. ` + (location.protocol === "file:"
    ? "Сторінку відкрито як файл. Запустіть scripts\\setup_windows.ps1 і відкрийте http://localhost:8020"
    : "Перевірте, що сервер запущено (див. README).");
}

async function refresh() {
  const mySeq = ++seq;
  state.page = 1;
  try {
    const [k, trend, types, dirs, regions, hourly, summary] = await Promise.all([
      api(`/kpi${qs()}`), api(`/trend${qs({ group: state.group })}`),
      api(`/distribution/types${qs()}`), api(`/distribution/directions${qs()}`),
      api(`/distribution/regions${qs()}`), api(`/hourly${qs()}`),
      api(`/units/summary${unitQuery()}`),
    ]);
    if (mySeq !== seq) return;
    document.querySelector(".error-banner")?.remove();
    $("api-status").className = "dot ok";
    renderKpi(k);
    renderTrend(trend);
    renderTypes(types);
    hBar("ch-directions", dirs, C.brand, (label) => setFilter("direction", label === "Тил (поза напрямками)" ? "" : label));
    hBar("ch-regions", regions, "#4f7f63");
    renderHourly(hourly);
    renderForces(summary);
    renderStatus(summary);
    await Promise.all([loadEventsLayer(mySeq), loadUnits(), loadTable()]);
  } catch (err) {
    showError(err);
  }
}

async function init() {
  try {
    const f = await api("/filters");
    bounds = { min: f.min_date, max: f.max_date };
    fillSelect("f-direction", f.directions);
    fillSelect("f-region", f.regions);
    fillSelect("f-type", f.event_types);
    for (const id of ["f-from", "f-to"]) { $(id).min = f.min_date; $(id).max = f.max_date; }
    $("data-range").textContent = `Дані: ${fmtDate(f.min_date)} – ${fmtDate(f.max_date)}`;
    // за замовчуванням — останні 30 діб
    state.filters.to = f.max_date;
    state.filters.from = addDays(f.max_date, -29);
    writeForm();
    await loadFrontline();
    await refresh();
  } catch (err) {
    showError(err);
  }
}

init();
