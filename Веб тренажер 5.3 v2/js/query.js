/*
 * Мова запитів до бази повідомлень.
 *   слово        — частина слова в заголовку
 *   "фраза"      — точний фрагмент заголовка
 *   A B / A І B  — обидві умови
 *   A АБО B      — будь-яка з умов
 *   -A / НЕ A    — виключення
 *   ( ... )      — групування
 *   поле:знач    — тип, район, мова, пріоритет, джерело, інфо, дата
 *   < <= > >= від..до — для джерело, інфо, дата
 */
var Query = (function () {
  function QErr(msg) { this.message = msg; }

  var norm = function (s) { return s.toLowerCase().replace(/[’ʼ`]/g, "'"); };
  // Літери оцінки, які можна набрати кирилицею
  var LAT = { 'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Д': 'D', 'Ф': 'F', 'Б': 'B' };
  var normLetter = function (s) { return s.toUpperCase().split('').map(function (c) { return LAT[c] || c; }).join(''); };

  var FIELDS = { 'тип': 'type', 'район': 'reg', 'мова': 'lang', 'пріоритет': 'pri', 'джерело': 'src', 'інфо': 'info', 'дата': 'date' };
  var CATS = {
    type: ['фото', 'відео', 'звіт', 'допис', 'аудіо', 'карта'],
    reg: ['Північ', 'Південь', 'Схід', 'Захід'],
    lang: ['укр', 'англ', 'інша'],
    pri: ['високий', 'середній', 'низький']
  };
  var FIELD_LIST = 'тип, район, джерело, інфо, дата, мова, пріоритет';

  function tokenize(q) {
    var t = [], i = 0;
    while (i < q.length) {
      var c = q[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(' || c === ')') { t.push({ k: c }); i++; continue; }
      if (c === '"' || c === '«' || c === '“') {
        var close = c === '«' ? '»' : (c === '“' ? '”' : '"');
        var j = q.indexOf(close, i + 1);
        if (j < 0) throw new QErr('Не закрито лапки.');
        t.push({ k: 'phrase', v: q.slice(i + 1, j) }); i = j + 1; continue;
      }
      var e = i; while (e < q.length && !/[\s()"«“]/.test(q[e])) e++;
      var w = q.slice(i, e); i = e;
      if (w === '-') { t.push({ k: 'not' }); continue; }
      if (w.length > 1 && w[0] === '-') { t.push({ k: 'not' }); w = w.slice(1); }
      var up = w.toUpperCase();
      if (up === 'АБО' || up === 'OR') t.push({ k: 'or' });
      else if (up === 'І' || up === 'ТА' || up === 'AND') t.push({ k: 'and' });
      else if (up === 'НЕ' || up === 'NOT') t.push({ k: 'not' });
      else t.push({ k: 'word', v: w });
    }
    return t;
  }

  function cmp(op, a, b) {
    if (op === '<') return a < b; if (op === '<=') return a <= b;
    if (op === '>') return a > b; if (op === '>=') return a >= b;
    return a === b;
  }

  function fieldTerm(name, val) {
    var f = FIELDS[norm(name)];
    if (!f) throw new QErr('Невідоме поле «' + name + '». Доступні поля: ' + FIELD_LIST + '.');
    if (!val) throw new QErr('Після «' + name + ':» вкажіть значення.');
    var m = val.match(/^(<=|>=|<|>|=)?(.*)$/), op = m[1] || '=', v = m[2];
    if (!v) throw new QErr('Після «' + name + ':' + op + '» вкажіть значення.');
    var range = v.indexOf('..') >= 0 ? v.split('..') : null;
    if (range && (op !== '=' || range.length !== 2 || !range[0] || !range[1])) throw new QErr('Діапазон записується як «від..до», наприклад інфо:2..3.');

    if (CATS[f]) {
      if (op !== '=' || range) throw new QErr('Для поля «' + name + '» порівняння не застосовуються, вкажіть одне значення.');
      var hit = CATS[f].filter(function (x) { return norm(x) === norm(v); })[0];
      if (!hit) throw new QErr('Невідоме значення «' + v + '» для поля «' + name + '». Можливі: ' + CATS[f].join(', ') + '.');
      return function (r) { return r[f] === hit; };
    }
    if (f === 'src') {
      var L = function (x) { var y = normLetter(x); if (!/^[A-F]$/.test(y)) throw new QErr('Оцінка джерела позначається однією літерою від A до F.'); return y; };
      if (range) { var a = L(range[0]), b = L(range[1]); return function (r) { return r.src >= a && r.src <= b; }; }
      var s = L(v); return function (r) { return cmp(op, r.src, s); };
    }
    if (f === 'info') {
      var N = function (x) { if (!/^[1-6]$/.test(x)) throw new QErr('Оцінка інформації позначається цифрою від 1 до 6.'); return +x; };
      if (range) { var a2 = N(range[0]), b2 = N(range[1]); return function (r) { return r.info >= a2 && r.info <= b2; }; }
      var n = N(v); return function (r) { return cmp(op, r.info, n); };
    }
    if (f === 'date') {
      var D = function (x) { if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) throw new QErr('Дата записується у форматі РРРР-ММ-ДД, наприклад 2026-10-20.'); return x; };
      if (range) { var a3 = D(range[0]), b3 = D(range[1]); return function (r) { return r.date >= a3 && r.date <= b3; }; }
      var d = D(v); return function (r) { return cmp(op, r.date, d); };
    }
  }

  function term(w) {
    var k = w.indexOf(':');
    if (k > 0) return fieldTerm(w.slice(0, k), w.slice(k + 1));
    if (k === 0) throw new QErr('Перед двокрапкою має стояти назва поля.');
    var v = norm(w); return function (r) { return norm(r.title).indexOf(v) >= 0; };
  }

  function both(a, b) { return function (x) { return a(x) && b(x); }; }
  function either(a, b) { return function (x) { return a(x) || b(x); }; }

  function parse(q) {
    var toks = tokenize(q), p = 0;
    if (!toks.length) return null;
    function peek() { return toks[p]; }
    function startsTerm(t) { return t && (t.k === 'and' || t.k === 'not' || t.k === 'word' || t.k === 'phrase' || t.k === '('); }
    function orExpr() {
      var l = andExpr();
      while (peek() && peek().k === 'or') { p++; l = either(l, andExpr()); }
      return l;
    }
    function andExpr() {
      var l = unary();
      while (startsTerm(peek())) { if (peek().k === 'and') p++; l = both(l, unary()); }
      return l;
    }
    function unary() {
      var t = peek();
      if (!t) throw new QErr('Запит обривається: після оператора бракує умови.');
      if (t.k === 'not') { p++; var f = unary(); return function (x) { return !f(x); }; }
      if (t.k === '(') {
        p++; var g = orExpr();
        if (!peek() || peek().k !== ')') throw new QErr('Не закрито дужку «(».');
        p++; return g;
      }
      if (t.k === ')') throw new QErr('Зайва дужка «)».');
      if (t.k === 'or') throw new QErr('АБО має стояти між двома умовами.');
      if (t.k === 'and') throw new QErr('І має стояти між двома умовами.');
      p++;
      if (t.k === 'phrase') { var v = norm(t.v); if (!v.trim()) throw new QErr('Порожні лапки.'); return function (x) { return norm(x.title).indexOf(v) >= 0; }; }
      return term(t.v);
    }
    var res = orExpr();
    if (p < toks.length) throw new QErr(toks[p].k === ')' ? 'Зайва дужка «)».' : 'Не вдалося розібрати запит.');
    return res;
  }

  return { parse: parse, QErr: QErr };
})();

if (typeof module !== 'undefined') module.exports = Query;
