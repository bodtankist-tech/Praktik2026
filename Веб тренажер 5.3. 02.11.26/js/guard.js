/* Видима панель помилок: якщо щось зламалося (наприклад, браузер узяв старі файли з кешу),
   користувач бачить причину й підказку, а не «нічого не працює». */
(function(){
  function show(msg){
    var b=document.getElementById('jsErr');
    if(!b){ b=document.createElement('div'); b.id='jsErr';
      b.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:99;background:#2a0710;border:1px solid #ff3b5c;color:#ffd6dd;font:13px/1.45 monospace;padding:10px 14px;white-space:pre-wrap';
      (document.body||document.documentElement).appendChild(b); }
    b.textContent='⚠ Помилка / Error: '+msg+'\nОновіть сторінку з очищенням кешу: Ctrl+F5 (Mac: Cmd+Shift+R). / Hard-refresh the page.';
  }
  // помилки в коді
  window.addEventListener('error',function(e){
    if(e.target&&e.target!==window) return;
    show((e.message||'')+(e.filename?' ('+e.filename.split('/').pop()+':'+e.lineno+')':''));
  });
  // файл скрипту чи стилів не завантажився
  window.addEventListener('error',function(e){
    var t=e.target, u=t&&(t.src||t.href);
    if(t&&t!==window&&u&&/\.(js|css)(\?|$)/.test(u)) show('не завантажився файл / file failed to load: '+decodeURI(u).split('/').slice(-2).join('/'));
  },true);
})();
