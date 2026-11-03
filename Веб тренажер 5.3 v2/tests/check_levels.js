// Перевірка рівнів: node tests/check_levels.js
// Для кожного рівня: еталонний запит розбирається, дає непорожню вибірку,
// не відбирає всі записи, а кожен типовий хибний запит (traps) дає ІНШИЙ результат.
var path = require('path');
var Q = require(path.join(__dirname, '..', 'js', 'query.js'));
var D = require(path.join(__dirname, '..', 'js', 'levels.js'));

var byId = function (id) { return D.RECORDS[id - 1]; };
var failed = 0;

D.LEVELS.forEach(function (L, i) {
  var rows = L.rows.map(byId);
  if (rows.some(function (r) { return !r; })) { console.log('✗ рівень ' + (i + 1) + ': неіснуючий номер запису'); failed++; return; }
  var pick = function (q) { var f = Q.parse(q); return rows.filter(f).map(function (r) { return r.id; }).join(','); };
  var target = pick(L.sol);
  var n = target ? target.split(',').length : 0;
  var problems = [];
  if (!n) problems.push('еталон нічого не відбирає');
  if (n === rows.length) problems.push('еталон відбирає всі записи');
  (L.traps || []).forEach(function (t) { if (pick(t) === target) problems.push('пастка «' + t + '» дає правильний результат'); });
  if (problems.length) { failed++; console.log('✗ рівень ' + (i + 1) + ': ' + problems.join('; ')); }
  else console.log('✓ рівень ' + (i + 1) + ' «' + L.title + '»: ' + n + ' з ' + rows.length + ' записів, пасток: ' + (L.traps || []).length);
});

process.exit(failed ? 1 : 0);
