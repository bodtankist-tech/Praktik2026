/* Логіка інтерфейсу: екрани, перевірка запиту, прогрес */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var byId = function (id) { return RECORDS[id - 1]; };

  /* ---------- прогрес (лише в цьому браузері) ---------- */
  var KEY = 'trenazher-analityka-v2';
  var state = { level: 0, done: {} };          // done[i] = 'ok' | 'hint'
  try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.done) state = s; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var rows = [], target = new Set(), hintStep = 0, solved = false;

  /* ---------- екрани ---------- */
  function show(id) {
    ['screen-start', 'screen-level', 'screen-finish'].forEach(function (s) { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
    renderSteps(id === 'screen-level' ? state.level : -1);
  }

  function renderSteps(cur) {
    $('steps').innerHTML = LEVELS.map(function (L, i) {
      var cls = 'step' + (i === cur ? ' cur' : '') + (state.done[i] === 'ok' ? ' done' : state.done[i] === 'hint' ? ' hint' : '');
      var mark = state.done[i] === 'ok' ? ' — виконано' : state.done[i] === 'hint' ? ' — з підказкою' : '';
      return '<button class="' + cls + '" data-l="' + i + '" title="' + esc(L.title + mark) + '">' + (i + 1) + '</button>';
    }).join('');
    Array.prototype.forEach.call($('steps').querySelectorAll('.step'), function (b) {
      b.onclick = function () { openLevel(+b.dataset.l); };
    });
  }

  /* ---------- рівень ---------- */
  function admTable() {
    var h = '<table class="adm"><tr><th></th><th>джерело</th><th></th><th>інформація</th></tr>';
    'ABCDEF'.split('').forEach(function (l, i) {
      h += '<tr><td class="k">' + l + '</td><td>' + SRC_TXT[l] + '</td><td class="k">' + (i + 1) + '</td><td>' + INFO_TXT[i + 1] + '</td></tr>';
    });
    return h + '</table>';
  }

  function openLevel(n) {
    n = Math.max(0, Math.min(LEVELS.length - 1, n));
    state.level = n; save();
    var L = LEVELS[n];
    rows = L.rows.map(byId);
    target = new Set(rows.filter(Query.parse(L.sol)).map(function (r) { return r.id; }));
    hintStep = 0; solved = false;

    $('lvlNum').textContent = 'Рівень ' + (n + 1) + ' з ' + LEVELS.length;
    $('task').textContent = L.task;
    $('lvlTitle').textContent = L.title;
    $('theory').innerHTML = L.theory;
    $('admTable').innerHTML = L.table ? admTable() : '';
    $('exQ').textContent = L.example[0];
    $('exD').textContent = L.example[1];
    $('hintBtn').textContent = 'Підказка';
    $('hintBtn').hidden = false;
    $('hintText').hidden = true;
    $('result').hidden = true;
    $('q').value = '';

    $('db').tBodies[0].innerHTML = rows.map(function (r) {
      return '<tr data-id="' + r.id + '"><td class="num">' + r.id + '</td><td>' + r.type + '</td>' +
        '<td class="c" title="' + SRC_TXT[r.src] + '">' + r.src + '</td>' +
        '<td class="c" title="' + INFO_TXT[r.info] + '">' + r.info + '</td>' +
        '<td>' + r.reg + '</td><td class="c">' + r.date + '</td><td>' + esc(r.title) + '<span class="mark"></span></td></tr>';
    }).join('');

    show('screen-level');
    live();
    $('q').focus({ preventScroll: true });
  }

  function evaluate() {
    var f = Query.parse($('q').value);
    return f ? new Set(rows.filter(f).map(function (r) { return r.id; })) : null;
  }

  function eachRow(fn) {
    Array.prototype.forEach.call($('db').tBodies[0].rows, function (tr) { fn(tr, +tr.dataset.id); });
  }

  function clearMarks() {
    eachRow(function (tr) { tr.classList.remove('sel', 'extra', 'miss'); tr.querySelector('.mark').textContent = ''; });
  }

  /* Підсвічування під час набору */
  function live() {
    if (solved) return;
    clearMarks();
    $('result').hidden = true;
    var res;
    try { res = evaluate(); } catch (e) {
      if (e instanceof Query.QErr) { setStatus(e.message, true); $('counter').textContent = ''; return; }
      throw e;
    }
    setStatus(res ? '' : 'Почніть писати запит: відібрані повідомлення підсвітяться в таблиці.', false);
    if (!res) { $('counter').textContent = 'потрібно відібрати: ' + target.size; return; }
    eachRow(function (tr, id) { if (res.has(id)) tr.classList.add('sel'); });
    $('counter').textContent = 'відібрано: ' + res.size + ' · потрібно: ' + target.size;
  }

  function setStatus(t, err) { $('status').textContent = t; $('status').className = 'status' + (err ? ' err' : ''); }

  function check(ev) {
    ev.preventDefault();
    if (solved) { next(); return; }
    var res;
    try { res = evaluate(); } catch (e) { if (e instanceof Query.QErr) { setStatus(e.message, true); return; } throw e; }
    if (!res) { setStatus('Спочатку напишіть запит.', true); return; }

    var extra = [], miss = [];
    res.forEach(function (id) { if (!target.has(id)) extra.push(id); });
    target.forEach(function (id) { if (!res.has(id)) miss.push(id); });
    clearMarks();
    var box = $('result'), L = LEVELS[state.level];

    if (!extra.length && !miss.length) {
      solved = true;
      if (state.done[state.level] !== 'hint') state.done[state.level] = 'ok';
      save(); renderSteps(state.level);
      eachRow(function (tr, id) { if (target.has(id)) tr.classList.add('sel'); });
      var last = state.level === LEVELS.length - 1;
      box.className = 'result ok';
      box.innerHTML = '<b>Правильно. Вибірка відповідає вимозі.</b><p>' + esc(L.why) + '</p>' +
        '<button class="btn" type="button" id="nextBtn">' + (last ? 'До підсумку' : 'Наступний рівень') + '</button>';
      box.hidden = false;
      $('nextBtn').onclick = next;
      $('nextBtn').focus();
      return;
    }

    eachRow(function (tr, id) {
      if (extra.indexOf(id) >= 0) { tr.classList.add('extra'); tr.querySelector('.mark').textContent = 'зайве'; }
      else if (miss.indexOf(id) >= 0) { tr.classList.add('miss'); tr.querySelector('.mark').textContent = 'пропущено'; }
      else if (res.has(id)) tr.classList.add('sel');
    });
    var parts = [];
    if (extra.length) parts.push('зайві повідомлення: № ' + extra.join(', '));
    if (miss.length) parts.push('пропущені: № ' + miss.join(', '));
    box.className = 'result bad';
    box.innerHTML = '<b>Вибірка не відповідає вимозі.</b><p>' + parts.join('; ') + '.</p><p>Порівняйте ці рядки таблиці з вимогою керівника: яку умову ви не врахували?</p>';
    box.hidden = false;
  }

  function next() {
    if (state.level < LEVELS.length - 1) openLevel(state.level + 1); else finish();
  }

  function hint() {
    var L = LEVELS[state.level];
    hintStep++;
    if (hintStep === 1) {
      $('hintText').textContent = L.hint;
      $('hintBtn').textContent = 'Показати еталонний запит';
    } else {
      $('hintText').innerHTML = 'Еталонний запит: <code>' + esc(L.sol) + '</code><br>Розберіть, з яких умов він складається, і наберіть його самостійно.';
      $('hintBtn').hidden = true;
      if (state.done[state.level] !== 'ok') { state.done[state.level] = 'hint'; save(); renderSteps(state.level); }
    }
    $('hintText').hidden = false;
  }

  /* ---------- підсумок ---------- */
  function finish() {
    var ok = 0, hinted = 0;
    LEVELS.forEach(function (L, i) { if (state.done[i] === 'ok') ok++; else if (state.done[i] === 'hint') hinted++; });
    var total = LEVELS.length, rest = total - ok - hinted;
    $('finTitle').textContent = ok === total ? 'Усі завдання виконано самостійно' : 'Виконано ' + (ok + hinted) + ' з ' + total + ' завдань';
    $('finLead').textContent = 'Самостійно: ' + ok + '. З підказкою: ' + hinted + '.' + (rest ? ' Не виконано: ' + rest + '.' : '') +
      (hinted || rest ? ' Поверніться до рівнів, позначених жовтим або сірим у верхній панелі.' : '');
    $('finSkills').innerHTML = LEVELS.map(function (L, i) {
      var m = state.done[i] === 'ok' ? '' : state.done[i] === 'hint' ? ' (з підказкою)' : ' (не виконано)';
      return '<li>' + esc(L.skill) + m + '</li>';
    }).join('');
    show('screen-finish');
  }

  /* ---------- події ---------- */
  $('skillList').innerHTML = LEVELS.map(function (L) { return '<li>' + esc(L.skill) + '</li>'; }).join('');
  $('startBtn').onclick = function () { openLevel(state.level || 0); };
  $('home').onclick = function () { show('screen-start'); };
  $('againBtn').onclick = function () { state = { level: 0, done: {} }; save(); openLevel(0); };
  $('qform').addEventListener('submit', check);
  $('q').addEventListener('input', function () { solved = false; live(); });
  $('hintBtn').onclick = hint;

  show('screen-start');
})();
