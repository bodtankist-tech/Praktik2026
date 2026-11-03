/* ================== СТАН ================== */
const STORE='kartoteka-progress-v3'; // v3: 32 рівні, залік, таблиця групи, мова інтерфейсу
const DEFAULT_STATE={level:0,extra:false,done:{},score:{},badges:{},streak:0,cmd:'ua',ui:'ua',sound:true,exams:[],group:[]};
let state={...DEFAULT_STATE};
try{const s=JSON.parse(localStorage.getItem(STORE)); if(s&&typeof s.level==='number') state=Object.assign(state,s);}catch(e){}
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state))}catch(e){}};
const cmd=()=>state.cmd==='en'?'en':'ua';
const ui=()=>state.ui==='en'?'en':'ua';
const loc=(o,k)=>ui()==='en'&&o[k+'En']!=null?o[k+'En']:o[k];

let cards=[], target=new Set(), busy=false, hintN=0, wrongN=0, usedAnswer=false, t0=Date.now();
let exam=null; // {name, group, list, i, start, results[]}
const EXAM_TASKS=10, EXAM_LIMIT=15*60;

const ICONS={
 'фото':'<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
 'відео':'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
 'звіт':'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
 'допис':'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
 'аудіо':'<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
 'карта':'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'
};
const SRC_COL={A:'#2f7a4a',B:'#4d8a3a',C:'#8a7a2a',D:'#a8642a',E:'#a8422a',F:'#6b6b6b'};
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const num=id=>'№'+String(id).padStart(2,'0');

/* ================== ЗВУК (синтез, без файлів) ================== */
const SND=(()=>{
  let ctx;
  const ac=()=>ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)());
  const safe=fn=>(...a)=>{ if(state.sound===false) return; try{fn(...a)}catch(e){} };
  function tone(f,at,dur,type,gain){
    const c=ac(), o=c.createOscillator(), g=c.createGain(), tt=c.currentTime+at;
    o.type=type; o.frequency.value=f;
    g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(gain,tt+.01); g.gain.exponentialRampToValueAtTime(.0001,tt+dur);
    o.connect(g).connect(c.destination); o.start(tt); o.stop(tt+dur+.05);
  }
  function noise(dur,gain,f0,f1){
    const c=ac(), b=c.createBuffer(1,Math.ceil(c.sampleRate*dur),c.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const s=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain(), tt=c.currentTime;
    s.buffer=b; fl.type='bandpass'; fl.Q.value=1.2;
    fl.frequency.setValueAtTime(f0,tt); fl.frequency.exponentialRampToValueAtTime(f1,tt+dur);
    g.gain.setValueAtTime(gain,tt); g.gain.exponentialRampToValueAtTime(.0001,tt+dur);
    s.connect(fl).connect(g).connect(c.destination); s.start();
  }
  let lastKey=0;
  return {
    key:safe(()=>{const n=Date.now(); if(n-lastKey<35) return; lastKey=n; noise(.03,.05,2600,1800);}),
    click:safe(()=>tone(880,0,.06,'square',.025)),
    ok:safe(()=>[523,659,784,1047].forEach((f,i)=>tone(f,i*.08,.4,'triangle',.07))),
    err:safe(()=>{tone(150,0,.16,'square',.04); tone(110,.1,.22,'square',.04);}),
    whoosh:safe(()=>noise(.55,.12,350,3200)),
    medal:safe(()=>[880,1318,1760].forEach((f,i)=>tone(f,i*.11,.7,'sine',.06)))
  };
})();
const ICON_SND_ON='<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>';
const ICON_SND_OFF='<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';

/* ================== «ЖИВІ ШПАЛЕРИ» ДОШКИ: ЦИФРОВИЙ ДОЩ ================== */
const RAIN=(()=>{
  const cv=$('rain'), desk=$('desk');
  if(!cv||!cv.getContext) return {on:false,start(){},stop(){},flash(){}}; // немає полотна — без дощу, решта працює
  const ctx=cv.getContext('2d');
  const CH='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ЖЗИЛФЦЧШЮЯ';
  const FS=16, BG='3,9,13';
  let drops=[], w=0, h=0, raf=0, last=0, goldUntil=0, on=false;
  const rnd=()=>CH[Math.random()*CH.length|0];
  function resize(){
    const r=desk.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
    w=r.width; h=r.height; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
    drops=Array.from({length:Math.ceil(w/FS)},(_,i)=>drops[i]??-Math.random()*h/FS);
    ctx.fillStyle=`rgb(${BG})`; ctx.fillRect(0,0,w,h);
  }
  function frame(ts){
    raf=requestAnimationFrame(frame);
    if(ts-last<50) return; // близько 20 кадрів на секунду
    last=ts;
    const gold=Date.now()<goldUntil;
    ctx.fillStyle=`rgba(${BG},.11)`; ctx.fillRect(0,0,w,h); // затухання дає «хвіст»
    ctx.font=`${FS}px "JetBrains Mono", monospace`; ctx.textBaseline='top';
    for(let i=0;i<drops.length;i++){
      const x=i*FS, y=drops[i]*FS;
      ctx.fillStyle=gold?'#e8b934':'rgba(0,229,255,.75)'; ctx.fillText(rnd(),x,y-FS); // хвіст
      ctx.fillStyle=gold?'#ffd75e':'#e2fdff'; ctx.fillText(rnd(),x,y);              // яскрава «голова»
      if(y>h&&Math.random()>.97) drops[i]=-Math.random()*8;
      drops[i]+=gold?1.7:1;
    }
  }
  const run=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(frame); };
  new ResizeObserver(()=>{ if(on) resize(); }).observe(desk);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) cancelAnimationFrame(raf); else if(on) run(); });
  return {
    get on(){ return on; },
    start(){ if(on) return; on=true; desk.classList.add('rain'); resize(); run(); },
    stop(){ on=false; cancelAnimationFrame(raf); desk.classList.remove('rain'); ctx.clearRect(0,0,w,h); },
    flash(){ goldUntil=Date.now()+1300; } // золотий дощ після правильної відповіді
  };
})();
const rainWanted=()=>state.rain===true; // ефекти за замовчуванням вимкнені: вони відволікають від завдання
const ICON_RAIN_ON='<svg viewBox="0 0 24 24"><path d="M6 3v6M6 13v2M12 6v8M12 18v2M18 3v4M18 11v6"/></svg>';
const ICON_RAIN_OFF='<svg viewBox="0 0 24 24"><path d="M6 3v6M6 13v2M12 6v8M12 18v2M18 3v4M18 11v6" opacity=".4"/><path d="M4 4l16 16"/></svg>';

/* ================== 3D: НАХИЛ ДОШКИ Й КАРТОК ЗА КУРСОРОМ ================== */
// Стилі — у css/style.css (body.d3). Тут лише кути: --dx/--dy для дошки, --rx/--ry для картки під курсором.
const d3Wanted=()=>state.d3===true;
{
  const desk=$('desk'); let raf=0, ev=null, lastCard=null;
  const reset=c=>{ if(c){ c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } };
  desk.addEventListener('mousemove',e=>{ ev=e; if(raf) return; raf=requestAnimationFrame(()=>{
    raf=0;
    if(!document.body.classList.contains('d3')) return;
    const r=desk.getBoundingClientRect();
    desk.style.setProperty('--dx',((ev.clientX-r.left)/r.width-.5).toFixed(3));
    desk.style.setProperty('--dy',((ev.clientY-r.top)/r.height-.5).toFixed(3));
    const c=ev.target.closest&&ev.target.closest('.card');
    if(c!==lastCard){ reset(lastCard); lastCard=c; }
    if(c){ const b=c.getBoundingClientRect(), x=(ev.clientX-b.left)/b.width-.5, y=(ev.clientY-b.top)/b.height-.5;
      c.style.setProperty('--rx',(-y*16).toFixed(1)+'deg'); c.style.setProperty('--ry',(x*18).toFixed(1)+'deg'); }
  }); });
  desk.addEventListener('mouseleave',()=>{ desk.style.setProperty('--dx',0); desk.style.setProperty('--dy',0); reset(lastCard); lastCard=null; });
}

/* ================== БАЛИ, ЗВАННЯ, НАГОРОДИ ================== */
// За рівень: 100 − 15 за підказку − 10 за хибну спробу (не менше 20), +20 до 30 с, +10 до 60 с; з готовою відповіддю 10.
const RANKS=[[0,'rank.0'],[400,'rank.1'],[1200,'rank.2'],[2200,'rank.3'],[3100,'rank.4']];
const BADGES=[
  {id:'first',icon:'1'},{id:'clean',icon:'✓'},{id:'fast',icon:'20'},{id:'streak',icon:'×5'},{id:'eng',icon:'EN'},
  {id:'adm',icon:'A1'},{id:'eye',icon:'◎'},{id:'osint',icon:'#'},{id:'map',icon:'⌖'},{id:'final',icon:'★'}
];
const ENG_RE=/(^|[\s(!-])(type|region|source|info|rating|date|lang|language|priority|equip|equipment|image|shot|meta|square|similar):|(^|\s)(OR|AND|NOT)(\s|$)/i;
const total=()=>Object.values(state.score).reduce((a,b)=>a+b,0);
const rankOf=p=>t(RANKS.filter(r=>p>=r[0]).pop()[1]);
// Основні рівні (навичка: писати пошукові запити) ідуть першими, додаткові — після них.
const CORE=[0,2,3,5,7,8,12,13];
const ORDER=[...CORE,...LEVELS.map((L,i)=>i).filter(i=>!CORE.includes(i))]; // спершу основні, потім додаткові
const vis=()=>ORDER;
const visPos=n=>Math.max(0,vis().indexOf(n));
const visDone=()=>vis().filter(i=>state.done[i]).length;
const fxSync=()=>document.body.classList.toggle('fx',RAIN.on||document.body.classList.contains('d3'));
const blockDone=key=>LEVELS.every((L,i)=>L.block!==key||state.done[i]===true);

function renderStats(pop){
  $('score').textContent=total(); $('rank').textContent=rankOf(total());
  if(pop){const c=$('scoreChip'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');}
  $('soundBtn').innerHTML=state.sound===false?ICON_SND_OFF:ICON_SND_ON;
  $('soundBtn').title=t(state.sound===false?'sound.on':'sound.off');
  $('rainBtn').innerHTML=RAIN.on?ICON_RAIN_ON:ICON_RAIN_OFF;
  $('rainBtn').title=t(RAIN.on?'rain.off':'rain.on');
  const d3=document.body.classList.contains('d3');
  $('d3Btn').classList.toggle('off',!d3); $('d3Btn').title=t(d3?'d3.off':'d3.on');
}
function toast(title,sub,icon){
  const el=document.createElement('div'); el.className='toast';
  el.innerHTML=`<span class="medal">${esc(icon)}</span><div><b>${esc(title)}</b><small>${esc(sub)}</small></div>`;
  $('toasts').appendChild(el); SND.medal();
  setTimeout(()=>{el.classList.add('out'); setTimeout(()=>el.remove(),350);},4000);
}
function award(id){
  if(state.badges[id]) return;
  state.badges[id]=true; const b=BADGES.find(x=>x.id===id);
  toast(t('badge.got',{name:t('badge.'+id)}),t('badge.'+id+'.d'),b.icon);
}

const fmt=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
function tick(){
  $('clock').textContent=new Date().toLocaleTimeString('uk-UA',{hour12:false});
  if(exam){
    const left=Math.max(0,EXAM_LIMIT-Math.floor((Date.now()-exam.start)/1000));
    $('examTime').textContent=fmt(left);
    $('examTime').classList.toggle('low',left<=60);
    if(left===0&&!busy){ finishExam(true); return; }
  }
  if(!busy) $('timer').textContent=fmt(Math.floor((Date.now()-t0)/1000));
}

/* ================== МОВА ІНТЕРФЕЙСУ ================== */
function applyStatic(){
  document.documentElement.lang=ui()==='en'?'en':'uk';
  document.title=t('doc.title');
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-html]').forEach(el=>el.innerHTML=t(el.dataset.i18nHtml));
  document.querySelectorAll('[data-i18n-title]').forEach(el=>el.title=t(el.dataset.i18nTitle));
  document.querySelectorAll('#uiSeg button').forEach(b=>b.classList.toggle('on',b.dataset.ui===ui()));
}
// Обидва перемикачі УКР / ENG (угорі й у полі запиту) змінюють мову повністю: інтерфейс і команди.
// Поле запиту й так приймає команди обома мовами.
function setUi(lang){
  if(ui()===lang&&cmd()===lang){ $('q').focus(); return; }
  state.ui=lang; save(); applyStatic(); renderDict(); renderStats();
  if(cmd()!==lang) setCmd(lang); else { renderText(); renderCards(true); preview(); }
}
function setCmd(lang){
  if(cmd()===lang){ $('q').focus(); return; }
  state.cmd=lang; save();
  $('q').value=toLang($('q').value,lang);
  renderText(); renderCards(true); preview();
  $('q').focus();
}

/* ================== РІВЕНЬ ================== */
function loadLevel(n){
  n=Math.max(0,Math.min(LEVELS.length-1,n));
  if(!exam){ state.level=n; save(); }
  busy=false; hintN=0; wrongN=0; usedAnswer=false; t0=Date.now(); tick();
  curLevel=n;
  const L=LEVELS[n];
  cards=L.cards.map(byId);
  const sol=parse(L.sol); target=new Set(cards.filter(c=>run(sol,c)).map(c=>c.id));

  renderText(); renderCards();
  $('q').value=''; setFb('',''); $('why').innerHTML=''; preview();
  $('q').focus({preventScroll:true});
}
let curLevel=0;

const admTable=tbl=>`<table>${Object.entries(tbl[ui()]).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
const guideHtml=list=>`<div class="guide">${list.map(e=>{const I=EQ_INFO[e];
  return `<figure data-eq="${e}"><img src="media/img/${I.ref}.jpg" alt="${esc(loc(I,'name'))}" loading="lazy"><figcaption><b>${esc(loc(I,'name'))} · <code>техніка:${e}</code></b>${esc(loc(I,'f'))}</figcaption></figure>`;}).join('')}</div>`;

function renderText(){
  const n=curLevel, L=LEVELS[n], en=cmd()==='en';
  $('menuBtn').textContent=t('nav.level',{n:visPos(n)+1,total:vis().length});
  $('task').textContent=loc(L,'task');
  $('lnum').textContent=t('nav.levelShort',{n:visPos(n)+1})+(!exam&&state.done[n]?' · '+t('lvl.done'):'')+(!exam&&state.score[n]?` · ★ ${state.score[n]}`:'');
  $('ltitle').textContent=loc(L,'title');
  $('lpart').textContent=loc(L.blockPart,'part');
  $('lsyntax').innerHTML=highlight(en&&L.syntaxEn?L.syntaxEn:ui()==='en'&&L.syntaxEn?L.syntaxEn:T(L.syntax));
  let body=loc(L,'body').replace('{ADM_SRC}',admTable(SRC_TXT)).replace('{ADM_INFO}',admTable(INFO_TXT))
    .replace('{SIM}',SIM_MIN.toFixed(2)).replace('{GUIDE}',L.guide?guideHtml(L.guide):'');
  if(exam) body=L.guide?guideHtml(L.guide):''; // на заліку без пояснень, лише довідник
  $('lbody').innerHTML=body;
  // команди в тексті уроку показуємо обраною мовою, якщо цей варіант ще не згадано в тексті
  $('lbody').querySelectorAll('code').forEach(el=>{const x=el.textContent,v=codeLang(x); if(v!==x&&!body.includes(`<code>${esc(v)}</code>`)) el.textContent=v;});
  $('lbody').querySelectorAll('figure[data-eq]').forEach(f=>f.onclick=()=>openRef(f.dataset.eq));
  $('lex').innerHTML=L.ex.map(([c,d,dEn])=>`<div><code>${highlight(T(c))}</code> — ${esc(ui()==='en'?dEn:d)}</div>`).join('');
  $('prog').style.width=(visDone()/vis().length*100)+'%';
  document.querySelectorAll('#cmdSeg button').forEach(b=>b.classList.toggle('on',b.dataset.cmd===cmd()));
  $('promptLbl').textContent=t('editor.prompt');
  $('q').placeholder=t('editor.ph',{ex:T('тип:фото')});
  renderHints(); renderCheat();
  if(exam) renderExamBar();
}

function renderHints(){
  const H=LEVELS[curLevel].hints;
  $('hints').innerHTML=exam?'':H.slice(0,hintN).map((h,i)=>`<div class="hint"><b>${i+1}/${H.length}</b>${
    (ui()==='en'?h[1]:h[0]).split(/\{\{(.*?)\}\}/).map((s,j)=>j%2?`<code>${highlight(T(s))}</code>`:esc(s)).join('')}</div>`).join('');
  const b=$('tip');
  b.disabled=hintN>=H.length;
  b.textContent=hintN>=H.length?t('hint.none'):hintN?t('hint.more',{i:hintN+1,n:H.length}):t('hint.first',{n:H.length});
}

function renderCheat(){
  const en=cmd()==='en', o=OPS[cmd()];
  const rows=[
    [ui()==='en'?'word':'слово',t('cheat.word')],
    [ui()==='en'?'"phrase"':'"фраза"',t('cheat.phrase')],
    [`A B, A ${o.and} B`,t('cheat.and')],
    [`A ${o.or} B`,t('cheat.or')],
    [`-A, ${o.not} A`,t('cheat.not')],
    ['( … )',t('cheat.group')],
    [en?'field:value':'поле:знач',fieldList()],
    ['< <= > >= ..',t('cheat.cmp')],
    [T('квадрат:4410..4612'),t('cheat.sq')],
    [T('схоже:"…"'),t('cheat.sim')]];
  // «поле:знач» у шпаргалці — шаблон запису, а не помилка, тож без червоного підкреслення
  $('cheatTbl').innerHTML=rows.map(([a,b])=>`<tr><td>${highlight(a).replace(/h-bad/g,'h-field')}</td><td>${esc(b)}</td></tr>`).join('');
}

function renderDict(){
  const rows=[['АБО','OR'],['І, ТА','AND'],['НЕ','NOT']];
  FIELD_ORDER.forEach(f=>{
    rows.push([FIELD_UA[f]+':',EN_FIELD[f]+':']);
    if(EN_VAL[f]) rows.push(['  '+Object.keys(EN_VAL[f]).join(', '),'  '+Object.values(EN_VAL[f]).join(', ')]);
  });
  $('dictTbl').innerHTML=`<tr><th>УКР</th><th>ENG</th></tr>`+rows.map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
}

/* ================== КАРТКИ ================== */
const ZOOM_SVG='<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/></svg>';
const equipShown=c=>c.equip?(!exam&&state.done[curLevel]?valName('equip',c.equip):'?'):'—';
function renderCards(noDeal){
  const desk=$('desk');
  desk.querySelectorAll('.card').forEach(e=>e.remove());
  cards.forEach((c,i)=>{
    const m=c.media&&MED[c.media], vid=c.type==='відео';
    const el=document.createElement('div');
    el.className='card'+(target.has(c.id)?' target':'')+(m?' has-ph':'')+(noDeal?' dealt':'');
    el.dataset.id=c.id;
    el.style.setProperty('--rot',(((c.id*37+i*11)%7)-3)*0.6+'deg');
    el.style.setProperty('--d',(i*0.07)+'s');
    el.style.setProperty('--bd',(i*0.13)+'s');
    const ph=m?`<div class="ph${vid&&!m.video?' kb':''}"><img src="media/img/${c.media}.jpg" alt="" loading="lazy">${
      vid?`<span class="live"><i></i>${t(m.video?'card.video':'card.still')}</span>`:''}<span class="zoom">${ZOOM_SVG}</span></div>`:'';
    el.innerHTML=`<div class="row"><span class="ico"><svg viewBox="0 0 24 24">${ICONS[c.type]}</svg></span><span class="type">${valName('type',c.type)}</span><span class="simscore"></span><span class="num">${num(c.id)}</span></div>
      ${ph}<div class="row"><span class="badge" style="background:${SRC_COL[c.src]}" title="${esc(t('card.badge',{s:SRC_TXT[ui()][c.src],i:INFO_TXT[ui()][c.info]}))}">${c.src}${c.info}</span>${c.pri==='високий'?`<span class="pri-h">● ${t('card.urgent')}</span>`:''}</div>
      ${ui()==='en'&&c.titleEn?`<div class="ttl">${esc(c.titleEn)}</div><div class="gloss orig" title="${esc(t('card.orig'))}">UA: ${esc(c.title)}</div>`:`<div class="ttl">${esc(c.title)}</div>`}
      <div class="meta"><span>${valName('reg',c.reg)}</span><span>${c.date}</span><span>${valName('lang',c.lang)}</span>${c.sq?`<span>⌖${c.sq}</span>`:''}</div>`;
    el.addEventListener('animationend',e=>{ if(e.animationName==='deal'||e.animationName==='deal3') el.classList.add('dealt'); });
    el.addEventListener('mouseenter',()=>{
      link(c.id,true);
      // «живе» відео: на картці грає без звуку, поки наведено курсор
      if(m&&m.video&&!el.querySelector('video')){
        const v=document.createElement('video'); Object.assign(v,{src:`media/video/${c.media}.webm`,muted:true,loop:true,autoplay:true,playsInline:true});
        el.querySelector('.ph').insertBefore(v,el.querySelector('.ph .live'));
      }
    });
    el.addEventListener('mouseleave',()=>{ link(c.id,false); const v=el.querySelector('.ph video'); if(v) v.remove(); });
    if(m) el.addEventListener('click',()=>openCard(c));
    desk.appendChild(el);
  });

  const L=LEVELS[curLevel];
  const kv=(f,v)=>`<span class="rk">${fieldName(f)}:</span><span class="rv">${v===''?'—':valName(f,v)}</span>`;
  const extra=c=>{ const x=[];
    if(c.media) x.push(`<span class="rk">${fieldName('equip')}:</span><span class="rv">${equipShown(c)}</span>`, kv('img',c.img));
    if(c.shot||c.meta) x.push(kv('shot',c.shot),kv('meta',c.meta));
    if(c.sq) x.push(kv('sq',c.sq));
    return x.length?' '+x.join(' '):''; };
  $('recList').innerHTML=cards.map(c=>`<div class="rec" data-id="${c.id}"><span class="rid">${num(c.id)}</span><span>${
    [kv('type',c.type),kv('src',c.src),kv('info',c.info),kv('reg',c.reg),kv('date',c.date),kv('lang',c.lang),kv('pri',c.pri)].join(' ')+extra(c)
  }</span><span class="rt">${ui()==='en'&&c.titleEn?`${esc(c.titleEn)} <i>UA: «${esc(c.title)}»</i>`:`«${esc(c.title)}»`}</span></div>`).join('');
  $('recList').querySelectorAll('.rec').forEach(r=>{
    r.addEventListener('mouseenter',()=>link(+r.dataset.id,true));
    r.addEventListener('mouseleave',()=>link(+r.dataset.id,false));
  });
  renderMap(L);
}

function link(id,on){
  document.querySelectorAll(`[data-id="${id}"]`).forEach(e=>e.classList.toggle('hover-link',on));
}
function setFb(x,cls){const f=$('fb'); f.textContent=x; f.className='feedback '+cls;}

/* ================== КАРТА ================== */
const CELL=64, PAD=28;
const mx=e=>PAD+(e-MAP.e0)*CELL, my=n=>PAD+(MAP.n1+1-n)*CELL;
function renderMap(L){
  const wrap=$('mapwrap');
  if(!L.map){ wrap.hidden=true; return; }
  wrap.hidden=false;
  const W=PAD*2+(MAP.e1-MAP.e0+1)*CELL, H=PAD*2+(MAP.n1-MAP.n0+1)*CELL;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('map.aria'))}">`;
  s+=`<rect x="${PAD}" y="${PAD}" width="${W-2*PAD}" height="${H-2*PAD}" class="m-land"/>`;
  // ліси, річка, дорога (умовні)
  s+=[[42.1,12.2,1.3,.9],[43.2,9.1,1.6,1.1],[46.2,12.1,1.2,.8],[44.1,10.2,.9,.7]].map(([e,n,w,h])=>`<ellipse class="m-forest" cx="${mx(e+w/2)}" cy="${my(n+h/2)}" rx="${w*CELL/2}" ry="${h*CELL/2}"/>`).join('');
  s+=`<path class="m-river" d="M${mx(44.6)} ${my(14)} C ${mx(44.2)} ${my(12.6)}, ${mx(45.6)} ${my(11.6)}, ${mx(45.4)} ${my(10.5)} S ${mx(44.7)} ${my(8.6)}, ${mx(45.2)} ${my(8)}"/>`;
  s+=`<path class="m-road" d="M${mx(41)} ${my(10.8)} L ${mx(43.5)} ${my(10.6)} L ${mx(45.4)} ${my(10.5)} L ${mx(47)} ${my(11)} L ${mx(49)} ${my(11.6)}"/>`;
  s+=`<path class="m-road m-road2" d="M${mx(42.3)} ${my(14)} L ${mx(42.5)} ${my(12.6)} L ${mx(43.5)} ${my(10.6)} M ${mx(47)} ${my(11)} L ${mx(47.3)} ${my(9.4)} L ${mx(47.6)} ${my(8)}"/>`;
  s+=`<rect class="m-bridge" x="${mx(45.25)}" y="${my(10.62)}" width="${CELL*.3}" height="${CELL*.24}" rx="2"/>`;
  s+=`<rect id="mapRange" class="m-range" x="0" y="0" width="0" height="0"/>`;
  for(let e=MAP.e0;e<=MAP.e1+1;e++) s+=`<line class="m-grid" x1="${mx(e)}" y1="${PAD}" x2="${mx(e)}" y2="${H-PAD}"/><text class="m-lbl" x="${mx(e)}" y="${H-PAD+16}" text-anchor="middle">${e}</text>`;
  for(let n=MAP.n0;n<=MAP.n1+1;n++) s+=`<line class="m-grid" x1="${PAD}" y1="${my(n)}" x2="${W-PAD}" y2="${my(n)}"/><text class="m-lbl" x="${PAD-6}" y="${my(n)+4}" text-anchor="end">${String(n).padStart(2,'0')}</text>`;
  s+=MAP.places.map(p=>`<text class="m-place" x="${mx(p.e)}" y="${my(p.n)}">${esc(ui()==='en'?p.en:p.ua)}</text>`).join('');
  const bySq={};
  cards.filter(c=>c.sq).forEach(c=>{ (bySq[c.sq]=bySq[c.sq]||[]).push(c); });
  for(const sq in bySq){ const e=+sq.slice(0,2), n=+sq.slice(2), list=bySq[sq];
    list.forEach((c,i)=>{ const k=list.length, ang=k>1?(i/k)*Math.PI*2-Math.PI/2:0, r=k>1?17:0;
      const x=mx(e)+CELL/2+Math.cos(ang)*r, y=my(n+1)+CELL/2+Math.sin(ang)*r;
      s+=`<g class="m-mark${target.has(c.id)?' target':''}" data-id="${c.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11"/><text y="4" text-anchor="middle">${c.id}</text></g>`; }); }
  s+='</svg>';
  $('map').innerHTML=s;
  $('map').querySelectorAll('.m-mark').forEach(g=>{
    const id=+g.dataset.id;
    g.addEventListener('mouseenter',()=>link(id,true)); g.addEventListener('mouseleave',()=>link(id,false));
    g.addEventListener('click',()=>{ const c=byId(id); if(c.media) openCard(c); });
  });
}
function mapRange(q){
  const r=$('mapRange'); if(!r) return;
  const m=q.match(/(?:квадрат|square|sq|grid):(\d{4})(?:\.\.(\d{4}))?/i);
  if(!m){ r.setAttribute('width',0); return; }
  const a=m[1], b=m[2]||m[1];
  const e1=Math.min(+a.slice(0,2),+b.slice(0,2)), e2=Math.max(+a.slice(0,2),+b.slice(0,2));
  const n1=Math.min(+a.slice(2),+b.slice(2)), n2=Math.max(+a.slice(2),+b.slice(2));
  r.setAttribute('x',mx(e1)); r.setAttribute('y',my(n2+1)); r.setAttribute('width',(e2-e1+1)*CELL); r.setAttribute('height',(n2-n1+1)*CELL);
}

/* ================== ПЕРЕГЛЯД ЗНІМКА ================== */
const mediaHtml=(k,video)=>video
  ?`<video src="media/video/${k}.webm" poster="media/img/${k}.jpg" controls autoplay muted loop playsinline></video>`
  :`<img src="media/img/${k}.jpg" alt="">`;
const credit=k=>{const m=MED[k]; return m?`<div class="vcredit">${t('view.source')}: <a href="${esc(m.page)}" target="_blank" rel="noopener">${esc(m.author==='автор не вказаний'?t('view.noauthor'):m.author)}</a>, ${esc(m.license)}, Wikimedia Commons.</div>`:'';};
function openViewer(html){ $('vbox').innerHTML=html; $('viewer').classList.add('open'); SND.click(); }
function closeViewer(){ $('viewer').classList.remove('open'); $('vbox').innerHTML=''; }
function openCard(c){
  if(busy||!c.media) return;
  const m=MED[c.media];
  const eq=c.equip?(!exam&&state.done[curLevel]?t('view.eq',{v:valName('equip',c.equip)}):t('view.eq?')):'';
  openViewer(`<div class="vmedia">${mediaHtml(c.media,m.video)}</div>
    <div class="vinfo"><h3>${ui()==='en'&&c.titleEn?`${esc(c.titleEn)} <small>UA: «${esc(c.title)}»</small>`:`«${esc(c.title)}»`}</h3><div class="m">${num(c.id)} · ${valName('type',c.type)} · ${t('view.grade')} ${c.src}${c.info}: ${SRC_TXT[ui()][c.src]}, ${INFO_TXT[ui()][c.info]} · ${valName('reg',c.reg)} · ${c.date}${c.sq?' · ⌖'+c.sq:''}</div>${eq?`<div class="eq">${eq}</div>`:''}</div>
    ${credit(c.media)}<div class="vcredit">${t('view.note')}</div>`);
}
function openRef(e){
  const I=EQ_INFO[e];
  openViewer(`<div class="vmedia">${mediaHtml(I.ref,false)}</div><div class="vinfo"><h3>${esc(loc(I,'name'))} · <code>${esc(T('техніка:'+e))}</code></h3><div class="eq">${esc(loc(I,'f'))}</div></div>${credit(I.ref)}`);
}
function openCredits(){
  const rows=Object.entries(MED).map(([k,m])=>`<div><img src="media/img/${k}.jpg" alt="" loading="lazy"><span><b>${k.startsWith('ref-')?t('cred.ref'):t('cred.card',{n:k.slice(1)})}${m.video?' ('+t('cred.video')+')':''}</b> — <a href="${esc(m.page)}" target="_blank" rel="noopener">${esc(m.title)}</a><br>${esc(m.author==='автор не вказаний'?t('view.noauthor'):m.author)} · ${m.licenseUrl?`<a href="${esc(m.licenseUrl)}" target="_blank" rel="noopener">${esc(m.license)}</a>`:esc(m.license)}</span></div>`).join('');
  openPanel(`<h2>${t('cred.title')}</h2><p>${t('cred.text')}</p><div class="cred-list">${rows}</div><p class="small">${t('cred.fonts')}</p><div class="row"><button class="btn" data-close>${t('btn.close')}</button></div>`);
}

/* ================== ПЕРЕВІРКА ================== */
function evaluate(){
  const ast=parse($('q').value);
  if(!ast) return null;
  return {ast,set:new Set(cards.filter(c=>run(ast,c)).map(c=>c.id))};
}

// Кольоровий шар під полем запиту: той самий текст, розфарбований як код.
function syncHL(){ $('qhl').innerHTML=highlight($('q').value)+' '; $('qhl').scrollLeft=$('q').scrollLeft; }

function preview(){
  syncHL();
  const els=[...document.querySelectorAll('.desk .card, #map .m-mark')];
  els.forEach(e=>{e.classList.remove('hit','wrong','missed'); e.removeAttribute('data-why');});
  let r;
  try{r=evaluate();}catch(e){ if(e instanceof QErr){$('count').textContent=t('count.err'); setFb(e.message,'err'); showSim(); return;} throw e;}
  showSim(); mapRange($('q').value);
  if(!r){$('count').textContent=t('count.none',{n:target.size}); setFb('',''); return;}
  if($('fb').classList.contains('err')) setFb('','');
  els.forEach(e=>{ if(r.set.has(+e.dataset.id)) e.classList.add('hit'); });
  $('count').textContent=t('count',{f:r.set.size,n:target.size});
}
function showSim(){
  document.querySelectorAll('.desk .card').forEach(e=>{
    const s=e.querySelector('.simscore'), v=LAST_SIM&&LAST_SIM.get(+e.dataset.id);
    s.textContent=LAST_SIM?(v||0).toFixed(2):''; s.classList.toggle('on',!!LAST_SIM); s.classList.toggle('ok',!!LAST_SIM&&(v||0)>=SIM_MIN);
  });
}

function submit(){
  if(busy) return;
  let r;
  try{r=evaluate();}catch(e){ if(e instanceof QErr){setFb(e.message,'err'); shakeEditor(); SND.err(); return;} throw e;}
  if(!r){setFb(t('fb.empty'),'err'); shakeEditor(); SND.err(); return;}
  const extra=[...r.set].filter(id=>!target.has(id));
  const miss=[...target].filter(id=>!r.set.has(id));
  if(!extra.length && !miss.length){ success(); return; }
  wrongN++;
  const parts=[];
  if(extra.length) parts.push(t('fb.extra',{n:extra.length}));
  if(miss.length) parts.push(t('fb.miss',{n:miss.length}));
  setFb(t('fb.wrong',{parts:parts.join(', ')}),'err');
  shakeEditor(); SND.err();
  // пояснення по кожній картці: чому зайва (за еталоном) і чому пропущена (за вашим запитом)
  const sol=parse(LEVELS[curLevel].sol); const user=parse($('q').value);
  const items=[
    ...extra.map(id=>{const c=byId(id); return {id,kind:'extra',why:exam?[]:whyNot(sol,c)};}),
    ...miss.map(id=>{const c=byId(id); return {id,kind:'miss',why:whyNot(user,c)};})];
  $('why').innerHTML=items.slice(0,8).map(x=>`<li class="${x.kind}" data-id="${x.id}"><b>${num(x.id)}</b> ${t(x.kind==='extra'?'why.extra':'why.miss')}${x.why.length?': '+esc(x.why.join('; ')):''}</li>`).join('')
    +(items.length>8?`<li>${t('why.more',{n:items.length-8})}</li>`:'');
  $('why').querySelectorAll('li[data-id]').forEach(li=>{
    li.addEventListener('mouseenter',()=>link(+li.dataset.id,true)); li.addEventListener('mouseleave',()=>link(+li.dataset.id,false)); });
  document.querySelectorAll('.desk .card, #map .m-mark').forEach(e=>{
    const id=+e.dataset.id; e.classList.remove('hit');
    if(extra.includes(id)) e.classList.add('wrong');
    if(miss.includes(id)) e.classList.add('missed');
  });
}

function levelPoints(secs){
  if(usedAnswer) return {pts:10,why:[t('pts.answer')]};
  const why=[]; let pts=Math.max(20,100-15*hintN-10*wrongN);
  if(!hintN&&!wrongN) why.push(t('pts.clean'));
  if(hintN) why.push(t('pts.hints',{n:hintN}));
  if(wrongN) why.push(t('pts.wrong',{n:wrongN}));
  if(secs<=30){pts+=20; why.push(t('pts.fast'));} else if(secs<=60) pts+=10;
  return {pts,why};
}

function success(){
  busy=true;
  const n=curLevel, secs=Math.round((Date.now()-t0)/1000), clean=!usedAnswer&&!hintN&&!wrongN;
  const {pts,why}=levelPoints(secs);
  SND.ok(); RAIN.flash();
  if(exam){
    // для оцінки рахуємо бали без бонусу за швидкість: максимум 100 за завдання
    exam.results.push({lv:n,ok:true,wrong:wrongN,secs,pts,base:Math.max(20,100-10*wrongN)});
    setFb(t('fb.ok',{pts})+(why.length?` (${why.join(', ')})`:'')+'.','ok');
  } else {
    const before=total(), prev=state.score[n]||0;
    state.score[n]=Math.max(prev,pts);
    if(!usedAnswer) state.done[n]=true; else if(!state.done[n]) state.done[n]='hint';
    state.streak=clean?state.streak+1:0;
    setFb(t('fb.ok',{pts})+(why.length?` (${why.join(', ')})`:'')+(prev>pts?'. '+t('fb.record',{p:prev}):'.'),'ok');
    renderStats(true);
    if(rankOf(total())!==rankOf(before)) toast(t('rank.new'),rankOf(total()),'★');
    award('first');
    if(clean) award('clean');
    if(!usedAnswer&&secs<20) award('fast');
    if(state.streak>=5) award('streak');
    if(!usedAnswer&&ENG_RE.test($('q').value)) award('eng');
    if(blockDone('adm')) award('adm');
    if(blockDone('eye')) award('eye');
    if(blockDone('osint')) award('osint');
    if(blockDone('map')) award('map');
    if(n===vis()[vis().length-1]) award('final');
    save();
  }
  const hits=[...document.querySelectorAll('.desk .card')].filter(e=>target.has(+e.dataset.id));
  hits.forEach((e,i)=>setTimeout(()=>{e.classList.remove('target'); e.insertAdjacentHTML('beforeend',`<span class="stamp">${t('stamp')}</span>`);},i*70));
  setTimeout(()=>{ SND.whoosh(); hits.forEach(e=>e.classList.add('fly')); },450+hits.length*70);
  $('prog').style.width=(visDone()/vis().length*100)+'%';
  setTimeout(()=>{ if(exam) examNext(); else visPos(n)+1<vis().length ? loadLevel(vis()[visPos(n)+1]) : finale(); },1300+hits.length*70);
}
function shakeEditor(){const ed=$('editor'); ed.classList.remove('shake'); void ed.offsetWidth; ed.classList.add('shake');}

/* ================== ПАНЕЛІ: МЕНЮ, ФІНАЛ ================== */
function openPanel(html){ $('panel').innerHTML=html; $('overlay').classList.add('open');
  $('panel').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeMenu); }
function closeMenu(){$('overlay').classList.remove('open');}
const badgeGrid=()=>`<div class="badges">${BADGES.map(b=>{const on=state.badges[b.id];
  return `<div class="badge-item${on?'':' off'}"><span class="medal${on?'':' off'}">${esc(b.icon)}</span><div>${t('badge.'+b.id)}<small>${t('badge.'+b.id+'.d')}</small></div></div>`;}).join('')}</div>`;

function openMenu(){
  if(exam) return;
  let html=`<h2>${t('menu.levels')}</h2><p>${t('menu.sum',{d:visDone(),n:vis().length,s:total(),r:rankOf(total())})}</p><div class="lv-grid">`;
  let lastBlock=null;
  vis().forEach((i,pos)=>{ const L=LEVELS[i];
    if(pos===0) html+=`<div class="part">${t('menu.core')}</div>`;
    if(pos===CORE.length){ html+=`<div class="part">${t('menu.extra')}</div>`; lastBlock=null; }
    if(pos>=CORE.length&&L.block!==lastBlock){ lastBlock=L.block; html+=`<div class="part sub">${esc(loc(L.blockPart,'part'))}</div>`; }
    const d=state.done[i];
    html+=`<button class="lv-item${i===state.level?' cur':''}" data-l="${i}"><b>${pos+1}</b>${esc(loc(L,'title'))}${state.score[i]?`<span class="pts">${state.score[i]}</span>`:''}${d?`<span class="ck${d==='hint'?' hint':''}">✓</span>`:''}</button>`;
  });
  html+=`</div><h2 class="mt">${t('menu.badges')}</h2>${badgeGrid()}
    <div class="row wrap"><button class="btn ghost" id="reset">${t('menu.reset')}</button><span class="spacer"></span>
    <button class="btn ghost" id="mGroup">${t('group.title')}</button><button class="btn ghost" id="mExams">${t('exam.mine')}</button><button class="btn ghost" id="mExam">${t('exam.start')}</button><button class="btn" data-close>${t('btn.close')}</button></div>`;
  openPanel(html);
  $('panel').querySelectorAll('.lv-item').forEach(b=>b.onclick=()=>{closeMenu(); loadLevel(+b.dataset.l);});
  $('reset').onclick=()=>{ if(confirm(t('menu.resetq'))) resetProgress(); };
  $('mExam').onclick=examDialog; $('mGroup').onclick=openGroup; $('mExams').onclick=openMyExams;
}
const resetProgress=()=>{state={...DEFAULT_STATE,cmd:state.cmd,ui:state.ui,extra:state.extra,sound:state.sound,rain:state.rain,d3:state.d3,exams:state.exams,group:state.group}; save(); closeMenu(); renderStats(); loadLevel(0);};

function finale(){
  const hints=Object.values(state.done).filter(v=>v==='hint').length;
  openPanel(`<div class="finale"><div class="lesson-n">${t('fin.kicker')}</div><div class="big">${t('fin.title')}</div><div class="score">${t('fin.score',{s:total(),r:rankOf(total())})}</div><p>${t('fin.done',{d:visDone(),n:vis().length})}${hints?t('fin.hints',{h:hints}):t('fin.nohints')}</p><p>${t('fin.text')}</p></div>${badgeGrid()}<div class="row wrap"><button class="btn ghost" id="again">${t('fin.again')}</button><span class="spacer"></span><button class="btn ghost" id="fExam">${t('exam.start')}</button><button class="btn" id="toMenu">${t('fin.menu')}</button></div>`);
  $('again').onclick=resetProgress; $('toMenu').onclick=openMenu; $('fExam').onclick=examDialog;
}

/* ================== ЗАЛІК ================== */
function examDialog(){
  openPanel(`<h2>${t('exam.title')}</h2><p>${t('exam.rules',{n:Math.min(EXAM_TASKS,vis().length),m:EXAM_LIMIT/60})}</p>
    <label class="fld">${t('exam.name')}<input id="exName" maxlength="60" autocomplete="name"></label>
    <label class="fld">${t('exam.group')}<input id="exGroup" maxlength="30"></label>
    <div class="row"><button class="btn ghost" data-close>${t('btn.cancel')}</button><button class="btn" id="exGo">${t('exam.go')}</button></div>`);
  $('exName').value=state.lastName||''; $('exGroup').value=state.lastGroup||'';
  $('exName').focus();
  $('exGo').onclick=()=>{
    const name=$('exName').value.trim(), group=$('exGroup').value.trim();
    if(!name){ $('exName').focus(); $('exName').classList.add('bad'); return; }
    state.lastName=name; state.lastGroup=group; save();
    startExam(name,group);
  };
}
function pickExamLevels(){
  // по одному випадковому рівню з кожного блоку, решту добираємо випадково
  const V=vis(), blocks=[...new Set(V.map(i=>LEVELS[i].block))];
  const rnd=a=>a[Math.floor(Math.random()*a.length)];
  const pick=blocks.map(b=>rnd(V.filter(i=>LEVELS[i].block===b)));
  const rest=V.filter(i=>!pick.includes(i));
  while(pick.length<EXAM_TASKS&&rest.length) pick.push(rest.splice(Math.floor(Math.random()*rest.length),1)[0]);
  return pick.slice(0,EXAM_TASKS).sort((a,b)=>a-b);
}
function startExam(name,group){
  closeMenu();
  exam={name,group,list:pickExamLevels(),i:0,start:Date.now(),results:[]};
  document.body.classList.add('exam');
  loadLevel(exam.list[0]);
}
function renderExamBar(){
  $('examTitle').textContent=t('exam.bar',{name:exam.name,i:exam.i+1,n:exam.list.length});
}
function examNext(){
  exam.i++;
  if(exam.i>=exam.list.length) return finishExam(false);
  loadLevel(exam.list[exam.i]);
}
function examSkip(){
  if(busy) return;
  exam.results.push({lv:curLevel,ok:false,skipped:true,wrong:wrongN,secs:Math.round((Date.now()-t0)/1000),pts:0});
  examNext();
}
const gradeOf=pct=>pct>=90?5:pct>=75?4:pct>=60?3:2;
function finishExam(timeout){
  if(!exam) return;
  // невиконані завдання зараховуються як пропущені
  for(let k=exam.results.length;k<exam.list.length;k++) exam.results.push({lv:exam.list[k],ok:false,skipped:true,wrong:k===exam.i?wrongN:0,secs:0,pts:0});
  const secs=Math.round((Date.now()-exam.start)/1000), score=exam.results.reduce((a,r)=>a+r.pts,0);
  const pct=Math.round(exam.results.reduce((a,r)=>a+(r.base||0),0)/exam.list.length);
  const rep={name:exam.name,group:exam.group,date:new Date().toISOString(),secs,score,max:exam.list.length*120,pct,grade:gradeOf(pct),
    passed:exam.results.filter(r=>r.ok).length,n:exam.list.length,timeout:!!timeout,results:exam.results};
  rep.code=encodeResult(rep);
  state.exams=[rep,...(state.exams||[])].slice(0,20); save();
  exam=null; document.body.classList.remove('exam');
  loadLevel(vis().includes(state.level)?state.level:vis()[0]);
  showReport(rep);
}
function showReport(rep){
  const d=new Date(rep.date), L=i=>LEVELS[i];
  const rows=rep.results.map((r,k)=>`<tr><td>${k+1}</td><td>${esc(loc(L(r.lv),'title'))}<small>${t('rep.lvl',{n:r.lv+1})}</small></td><td class="${r.ok?'ok':'no'}">${t(r.ok?'rep.ok':'rep.skip')}</td><td>${r.wrong}</td><td>${r.secs?fmt(r.secs):'—'}</td><td>${r.pts}</td></tr>`).join('');
  openPanel(`<div class="report" id="report">
    <div class="rep-head"><div><div class="lesson-n">${t('rep.kicker')}</div><h2>${t('rep.title')}</h2></div><div class="rep-grade"><b>${rep.grade}</b><small>${t('grade.'+rep.grade)}</small></div></div>
    <table class="rep-meta"><tr><td>${t('rep.name')}</td><td><b>${esc(rep.name)}</b></td></tr><tr><td>${t('rep.group')}</td><td>${esc(rep.group||'—')}</td></tr>
      <tr><td>${t('rep.date')}</td><td>${d.toLocaleString(ui()==='en'?'en-GB':'uk-UA')}</td></tr><tr><td>${t('rep.time')}</td><td>${fmt(rep.secs)}${rep.timeout?' · '+t('rep.timeout'):''}</td></tr>
      <tr><td>${t('rep.result')}</td><td>${t('rep.sum',{p:rep.passed,n:rep.n,s:rep.score,pct:rep.pct})}</td></tr></table>
    <table class="rep-tbl"><tr><th>#</th><th>${t('rep.task')}</th><th>${t('rep.status')}</th><th>${t('rep.wrong')}</th><th>${t('rep.secs')}</th><th>${t('rep.pts')}</th></tr>${rows}</table>
    <p class="small">${t('rep.scale')}</p>
    <div class="rep-code"><span>${t('rep.code')}</span><code id="repCode">${rep.code}</code></div>
    <p class="small">${t('rep.codehelp')}</p>
  </div>
  <div class="row wrap noprint"><button class="btn ghost" id="repCopy">${t('rep.copy')}</button><button class="btn ghost" id="repPrint">${t('rep.print')}</button><span class="spacer"></span><button class="btn" data-close>${t('btn.close')}</button></div>`);
  $('repPrint').onclick=()=>window.print();
  $('repCopy').onclick=()=>{ navigator.clipboard&&navigator.clipboard.writeText(rep.code).then(()=>{$('repCopy').textContent=t('rep.copied');},()=>{}); };
}
function openMyExams(){
  const list=state.exams||[];
  openPanel(`<h2>${t('exam.mine')}</h2>${list.length?`<table class="rep-tbl"><tr><th>${t('rep.date')}</th><th>${t('rep.name')}</th><th>${t('rep.pts')}</th><th>${t('rep.grade')}</th><th></th></tr>${
    list.map((r,i)=>`<tr><td>${new Date(r.date).toLocaleString(ui()==='en'?'en-GB':'uk-UA')}</td><td>${esc(r.name)}</td><td>${r.score}</td><td>${r.grade}</td><td><button class="linkbtn" data-rep="${i}">${t('exam.open')}</button></td></tr>`).join('')}</table>`:`<p>${t('exam.none')}</p>`}
    <div class="row"><button class="btn ghost" id="exNew">${t('exam.start')}</button><button class="btn" data-close>${t('btn.close')}</button></div>`);
  $('panel').querySelectorAll('[data-rep]').forEach(b=>b.onclick=()=>showReport(list[+b.dataset.rep]));
  $('exNew').onclick=examDialog;
}

/* ---------- код результату: KRT-<base64>-<контрольна сума> ---------- */
const fnv=s=>{let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0;} return h.toString(36);};
const b64e=s=>btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64d=s=>decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));
function encodeResult(r){
  const j=JSON.stringify({v:1,n:r.name,g:r.group,s:r.score,m:r.max,p:r.pct,gr:r.grade,ok:r.passed,k:r.n,t:r.secs,d:r.date});
  return `KRT-${b64e(j)}-${fnv('kartoteka'+j)}`;
}
function decodeResult(code){
  const m=code.trim().match(/^KRT-([A-Za-z0-9_-]+)-([0-9a-z]+)$/); if(!m) return null;
  try{ const j=b64d(m[1]); if(fnv('kartoteka'+j)!==m[2]) return null; const o=JSON.parse(j); return o.v===1?o:null; }catch(e){ return null; }
}

/* ================== ТАБЛИЦЯ ГРУПИ ================== */
function openGroup(){
  const g=[...(state.group||[])].sort((a,b)=>b.s-a.s||a.t-b.t);
  openPanel(`<h2>${t('group.title')}</h2><p>${t('group.text')}</p>
    <textarea id="grIn" rows="3" placeholder="KRT-…"></textarea>
    <div class="row wrap"><span id="grMsg" class="small"></span><span class="spacer"></span><button class="btn" id="grAdd">${t('group.add')}</button></div>
    ${g.length?`<table class="rep-tbl"><tr><th>#</th><th>${t('rep.name')}</th><th>${t('rep.group')}</th><th>${t('rep.pts')}</th><th>%</th><th>${t('rep.grade')}</th><th>${t('rep.time')}</th><th>${t('rep.date')}</th><th></th></tr>${
      g.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.n)}</td><td>${esc(r.g||'—')}</td><td>${r.s}</td><td>${r.p}</td><td>${r.gr}</td><td>${fmt(r.t)}</td><td>${new Date(r.d).toLocaleDateString(ui()==='en'?'en-GB':'uk-UA')}</td><td><button class="linkbtn" data-del="${esc(r.code)}" title="${t('group.del')}">✕</button></td></tr>`).join('')}</table>`:`<p class="small">${t('group.empty')}</p>`}
    <p class="small">${t('group.note')}</p>
    <div class="row wrap"><button class="btn ghost" id="grCsv" ${g.length?'':'disabled'}>${t('group.csv')}</button><button class="btn ghost" id="grClear" ${g.length?'':'disabled'}>${t('group.clear')}</button><span class="spacer"></span><button class="btn" data-close>${t('btn.close')}</button></div>`);
  $('grAdd').onclick=()=>{
    let ok=0,bad=0,dup=0;
    $('grIn').value.split(/\s+/).filter(Boolean).forEach(code=>{
      const o=decodeResult(code); if(!o){bad++; return;}
      if((state.group||[]).some(x=>x.code===code)){dup++; return;}
      state.group=[...(state.group||[]),{...o,code}]; ok++;
    });
    save(); openGroup(); $('grMsg').textContent=t('group.added',{ok,bad,dup});
  };
  $('panel').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ state.group=state.group.filter(x=>x.code!==b.dataset.del); save(); openGroup(); });
  $('grClear').onclick=()=>{ if(confirm(t('group.clearq'))){ state.group=[]; save(); openGroup(); } };
  $('grCsv').onclick=()=>{
    const head=[t('rep.name'),t('rep.group'),t('rep.pts'),'%',t('rep.grade'),t('rep.time'),t('rep.date')];
    const lines=[head,...g.map(r=>[r.n,r.g||'',r.s,r.p,r.gr,fmt(r.t),r.d.slice(0,10)])].map(a=>a.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';'));
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv'}));
    a.download='kartoteka-group.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
}

/* ================== ПОДІЇ ================== */
$('q').addEventListener('input',preview);
['scroll','keyup','keydown','select','click','focus'].forEach(ev=>$('q').addEventListener(ev,()=>requestAnimationFrame(()=>{$('qhl').scrollLeft=$('q').scrollLeft;})));
$('q').addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();submit();} else if(e.key.length===1) SND.key(); });
$('run').onclick=submit;
$('clear').onclick=()=>{$('q').value=''; preview(); $('q').focus();};
$('tip').onclick=()=>{ if(exam) return; hintN=Math.min(hintN+1,LEVELS[curLevel].hints.length); renderHints(); SND.click(); $('q').focus(); };
document.querySelectorAll('#cmdSeg button').forEach(b=>b.onclick=()=>setUi(b.dataset.cmd));
document.querySelectorAll('#uiSeg button').forEach(b=>b.onclick=()=>setUi(b.dataset.ui));
$('hint').onclick=()=>{ if(exam) return; $('q').value=T(LEVELS[curLevel].sol); usedAnswer=true; preview(); setFb(t('fb.answer'),''); $('q').focus(); };
$('prev').onclick=()=>loadLevel(vis()[Math.max(0,visPos(state.level)-1)]);
$('next').onclick=()=>loadLevel(vis()[Math.min(vis().length-1,visPos(state.level)+1)]);
$('menuBtn').onclick=openMenu;
$('examBtn').onclick=examDialog;
$('credBtn').onclick=openCredits;
$('examSkip').onclick=examSkip;
$('examEnd').onclick=()=>{ if(confirm(t('exam.endq'))) finishExam(false); };
$('soundBtn').onclick=()=>{ state.sound=state.sound===false; save(); renderStats(); SND.click(); };
$('d3Btn').onclick=()=>{ state.d3=!document.body.classList.contains('d3'); save(); document.body.classList.toggle('d3',state.d3); fxSync(); renderStats(); SND.click(); };
$('rainBtn').onclick=()=>{ state.rain=!RAIN.on; save(); state.rain?RAIN.start():RAIN.stop(); fxSync(); renderStats(); SND.click(); };
$('overlay').addEventListener('click',e=>{if(e.target.id==='overlay') closeMenu();});
$('viewer').addEventListener('click',e=>{if(e.target.id==='viewer') closeViewer();});
$('vclose').onclick=closeViewer;
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if($('viewer').classList.contains('open')) closeViewer(); else closeMenu(); } });

applyStatic();
renderDict();
if(rainWanted()) RAIN.start();
document.body.classList.toggle('d3',d3Wanted());
fxSync();
renderStats();
setInterval(tick,1000);
loadLevel(vis().includes(state.level)?state.level:vis()[0]);
