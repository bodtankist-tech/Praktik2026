/* Мережеве планування — автономний навчальний тренажер (без бібліотек і CDN). */
(() => {
  'use strict';
  const STORAGE_KEY = 'mil-network-lab-v1';
  const NAV = [
    ['overview','Маршрут навчання'], ['builder','Конструктор'], ['forward','Прямий прохід'],
    ['backward','Зворотний прохід'], ['critical','Критичний шлях'],
    ['practice','Практикум'], ['gallery','Інфографіки']
  ];
  const IMAGES = [
    ['Для чого потрібен мережевий графік','Застосування планування в роботі військового аналітика'],
    ['Ключові елементи графіка','Подія, робота, залежність, тривалість, критичний шлях'],
    ['Крок 1. Перелік робіт','Визначення конкретних робіт та їхньої тривалості'],
    ['Крок 2. Залежності','Послідовні та паралельні роботи'],
    ['Крок 3. Побудова схеми','Як перейти від таблиці до мережі'],
    ['Часові параметри','Ранні, пізні строки та резерви'],
    ['Прямий прохід','Розрахунок ранніх строків'],
    ['Зворотний прохід','Розрахунок пізніх строків'],
    ['Критичний шлях','Визначення робіт із нульовим резервом'],
    ['Способи розрахунку','Графічний, табличний, аналітичний та автоматизований']
  ];
  const STEP_DESCRIPTIONS = [
    ['Складіть перелік робіт','Записуйте окремі вимірювані роботи з короткими кодами. У таблиці нижче можна редагувати найменування та тривалість.','Робота: код + назва + тривалість'],
    ['Встановіть залежності','Для кожної роботи визначте початкову й кінцеву події. Дві роботи можуть виконуватися паралельно, якщо мають незалежні гілки.','(i → j): робота починається після події i'],
    ['Побудуйте мережу','Кожна подія — це коло, кожна робота — спрямована стрілка. У моделі не допускаються цикли; усі шляхи мають починатися й завершуватися в спільних подіях.','DAG: ациклічний орієнтований граф'],
    ['Додайте тривалості','Вкажіть тривалість у добах. За потреби змініть її — графік і всі часові параметри перерахуються автоматично.','tᵢⱼ ≥ 0 (у тренажері використовуються додатні значення)'],
    ['Виконайте два проходи','Прямий прохід обчислює найраніші строки подій, зворотний — найпізніші. Різниця дає резерви.','Eⱼ = max(Eᵢ + tᵢⱼ); Lᵢ = min(Lⱼ − tᵢⱼ)'],
    ['Підготуйте висновок','Роботи з нульовим повним резервом утворюють критичні шляхи. Використайте результати для визначення пріоритетів контролю.','Rᵢⱼ = Lⱼ − Eᵢ − tᵢⱼ']
  ];
  const PRESETS = {
    base: {title:'Базовий приклад (дві паралельні гілки)',count:6,acts:[
      ['A','Збір вихідних даних',1,2,3],['B','Уточнення відомостей',1,3,2],
      ['C','Аналітичне опрацювання',2,4,4],['D','Погодження матеріалів',3,5,3],
      ['E','Підготовка висновку',4,6,2],['F','Контроль якості',5,6,3]]},
    joined: {title:'Підготовка аналітичного рішення (дві критичні гілки)',count:6,acts:[
      ['A','Збір вихідної інформації',1,2,2],['B','Перевірка джерел',1,3,3],
      ['C','Обробка даних',2,4,3],['D','Узгодження даних',3,4,2],
      ['E','Підготовка висновку',4,5,2],['F','Доведення пропозиції',5,6,1]]},
    comms: {title:'Розгортання засобів звʼязку (навчальний приклад)',count:6,acts:[
      ['A','Інвентаризація засобів',1,2,2],['B','Проєктування схеми',1,3,3],
      ['C','Підготовка вузлів',2,4,4],['D','Погодження конфігурації',3,4,1],
      ['E','Налаштування системи',4,5,2],['F','Перевірка працездатності',5,6,2]]}
  };
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = x => Number.isInteger(x) ? String(x) : Number(x.toFixed(2)).toLocaleString('uk-UA');
  const suffix = n => ' '+(Math.abs(n)%10===1 && Math.abs(n)%100!==11 ? 'день' : (Math.abs(n)%10>=2 && Math.abs(n)%10<=4 && (Math.abs(n)%100<12||Math.abs(n)%100>14) ? 'дні' : 'днів'));
  const duration = x => fmt(x)+suffix(x);
  const copy = x => JSON.parse(JSON.stringify(x));
  const preset = code => {
    const source = PRESETS[code] || PRESETS.base;
    return {title:source.title,count:source.count,acts:source.acts.map((a,i)=>({id:'act'+i,code:a[0],name:a[1],from:a[2],to:a[3],t:a[4]}))};
  };
  let state = {section:'overview',scenario:'base',project:preset('base'),builderStep:0,forwardStep:0,backwardStep:0,showCritical:true,showTimes:true,selected:null,quiz:{},feedback:{},whatifCode:'A',whatifDelta:1,quizRevealed:false};
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(raw && raw.project && Array.isArray(raw.project.acts) && raw.project.acts.length<80){
      state={...state,...raw,project:raw.project,selected:null,quiz:{},feedback:{},quizRevealed:false};
      if(!NAV.some(([key])=>key===state.section))state.section='overview';
    }
  } catch(_) {}
  function persist(){try {localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,quiz:{},feedback:{},quizRevealed:false}));}catch(_){}}
  function solve(project) {
    const errs=[];
    const n=Number(project.count);
    if(!Number.isInteger(n)||n<2||n>14)errs.push('Кількість подій має бути від 2 до 14.');
    const acts=project.acts||[];
    if(acts.length<1||acts.length>40)errs.push('Необхідно мати від 1 до 40 робіт.');
    const seenCodes=new Set(),seenEdges=new Set(),inDeg=Array(n+1).fill(0),outDeg=Array(n+1).fill(0),incoming=Array.from({length:n+1},()=>[]),outgoing=Array.from({length:n+1},()=>[]);
    for(const a of acts){
      const code=String(a.code||'').trim();
      if(!code || seenCodes.has(code.toUpperCase()))errs.push(`Код «${code||'порожній'}» повторюється або відсутній.`);
      seenCodes.add(code.toUpperCase());
      const from=Number(a.from),to=Number(a.to),t=Number(a.t);
      if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<1||from>n||to>n||from===to){errs.push(`Робота ${code}: помилкові початкова/кінцева події.`);continue;}
      if(!Number.isFinite(t)||t<=0||t>365)errs.push(`Робота ${code}: тривалість має бути в межах (0; 365].`);
      const pair=from+'-'+to;
      if(seenEdges.has(pair))errs.push(`Зв’язок ${pair} повторюється. Для цієї навчальної AOA-моделі потрібні різні пари подій.`);
      seenEdges.add(pair);
      inDeg[to]++;outDeg[from]++;incoming[to].push(a);outgoing[from].push(a);
    }
    if(errs.length)return {valid:false,errors:[...new Set(errs)]};
    const starts=[],ends=[];
    for(let i=1;i<=n;i++){if(inDeg[i]===0)starts.push(i);if(outDeg[i]===0)ends.push(i);}
    if(starts.length!==1)errs.push('Мережа має містити рівно одну початкову подію (зараз: '+starts.length+').');
    if(ends.length!==1)errs.push('Мережа має містити рівно одну кінцеву подію (зараз: '+ends.length+').');
    const indeg=[...inDeg],queue=[];
    for(let i=1;i<=n;i++)if(indeg[i]===0)queue.push(i);
    const order=[];
    while(queue.length){queue.sort((a,b)=>a-b);const u=queue.shift();order.push(u);for(const a of outgoing[u]){const v=Number(a.to);if(--indeg[v]===0)queue.push(v);}}
    if(order.length!==n)errs.push('У графіку є цикл. Мережеве планування потребує ациклічної схеми.');
    if(errs.length)return {valid:false,errors:errs,order};
    const start=starts[0],end=ends[0],E=Array(n+1).fill(-Infinity),L=Array(n+1).fill(Infinity),layer=Array(n+1).fill(0);
    E[start]=0;
    for(const u of order){
      for(const a of outgoing[u]){
        const v=Number(a.to);
        E[v]=Math.max(E[v],E[u]+Number(a.t));layer[v]=Math.max(layer[v],layer[u]+1);
      }
    }
    if(E.some((v,i)=>i>0&&!Number.isFinite(v)))errs.push('Частина подій не досяжна від початку мережі.');
    L[end]=E[end];
    for(const u of [...order].reverse())for(const a of outgoing[u])L[u]=Math.min(L[u],L[Number(a.to)]-Number(a.t));
    if(L.some((v,i)=>i>0&&!Number.isFinite(v)))errs.push('Частина подій не веде до завершення проєкту.');
    if(errs.length)return {valid:false,errors:errs};
    const detail=acts.map(a=>{
      const u=Number(a.from),v=Number(a.to),t=Number(a.t);
      const ES=E[u],EF=ES+t,LF=L[v],LS=LF-t,float=LS-ES;
      return {...a,from:u,to:v,t,ES,EF,LS,LF,float:Math.abs(float)<1e-8?0:float,critical:Math.abs(float)<1e-8};
    });
    const byId=Object.fromEntries(detail.map(a=>[a.id,a]));
    const criticalPaths=[];
    function visit(u,chain){
      if(criticalPaths.length>=16)return;
      if(u===end){criticalPaths.push([...chain]);return;}
      for(const a of outgoing[u]){const d=byId[a.id];if(d.critical)visit(d.to,[...chain,d]);}
    }
    visit(start,[]);
    return {valid:true,errors:[],n,acts:detail,byId,start,end,order,E,L,layer,total:E[end],criticalPaths,incoming,outgoing};
  }
  function titleBar(title,text,right=''){
    return `<div class="content-heading"><div><div class="section-kicker">НАВЧАЛЬНИЙ МОДУЛЬ</div><h2>${title}</h2><p>${text}</p></div>${right}</div>`;
  }
  function showToast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove('visible'),3000);}
  function updateProject(mutator){mutator(state.project);state.quiz={};state.feedback={};state.quizRevealed=false;persist();renderApp();}
  function loadPreset(key){state.scenario=key;state.project=preset(key);state.forwardStep=0;state.backwardStep=0;state.selected=null;state.quiz={};state.feedback={};state.quizRevealed=false;state.whatifCode=state.project.acts[0].code;persist();renderApp();showToast('Завантажено приклад: '+state.project.title);}
  function renderNav(){ $('#nav').innerHTML=NAV.map(([key,label],i)=>`<button type="button" data-nav="${key}" class="${state.section===key?'active':''}" aria-current="${state.section===key?'page':'false'}"><span class="tab-number">${String(i+1).padStart(2,'0')}</span>${esc(label)}</button>`).join(''); }
  function buildPosition(model){
    const positions={};if(!model.valid)return positions;
    const groups={};for(let i=1;i<=model.n;i++){const k=model.layer[i];(groups[k]||(groups[k]=[])).push(i);}
    const maxLayer=Math.max(...Object.keys(groups).map(Number));
    for(const [k,ids] of Object.entries(groups)){
      ids.sort((a,b)=>a-b);
      for(let idx=0;idx<ids.length;idx++){
        const count=ids.length;
        const y=count===1?189:count===2?103+172*idx:60+(258*idx/(count-1));
        positions[ids[idx]]={x:96+788*(Number(k)/Math.max(1,maxLayer)),y};
      }
    }
    return positions;
  }
  function edgeGeometry(u,v){
    const dx=v.x-u.x,dy=v.y-u.y,dist=Math.hypot(dx,dy)||1,ux=dx/dist,uy=dy/dist;
    const x1=u.x+ux*29,y1=u.y+uy*29,x2=v.x-ux*36,y2=v.y-uy*36;
    const midpoint={x:(x1+x2)/2,y:(y1+y2)/2};
    return {x1,y1,x2,y2,midpoint};
  }
  function renderGraph(model) {
    const svg=$('#network');
    if(!model.valid){svg.innerHTML=`<text x="490" y="184" text-anchor="middle" fill="#ffc1c8" font-size="22" font-weight="800">Перевірте структуру мережі</text><text x="490" y="222" text-anchor="middle" fill="#a8bfd5" font-size="15">Виправте помилки в конструкторі — розрахунок відновиться автоматично.</text>`;return;}
    const pos=buildPosition(model),stage=state.section==='builder'?state.builderStep:6,highlightNode=state.section==='forward'?model.order[Math.min(state.forwardStep,model.order.length-1)]:state.section==='backward'?[...model.order].reverse()[Math.min(state.backwardStep,model.order.length-1)]:null;
    let html=`<defs><marker id="arrow-blue" markerWidth="9" markerHeight="9" refX="7.7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#5aaddc"/></marker><marker id="arrow-yellow" markerWidth="9" markerHeight="9" refX="7.7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#ffd45c"/></marker><filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    for(const a of model.acts){
      const geo=edgeGeometry(pos[a.from],pos[a.to]),critical=stage>=5&&state.showCritical&&a.critical,selected=state.selected===a.id;
      const line=`M${geo.x1.toFixed(1)},${geo.y1.toFixed(1)} L${geo.x2.toFixed(1)},${geo.y2.toFixed(1)}`;
      let offset=geo.y2===geo.y1?-18:(geo.y2>geo.y1?22:-22);
      let labelY=geo.midpoint.y+offset;
      const col=stage===0?'#486a85':critical?'#ffd45c':'#72b9e1';
      const label=stage<2?'':stage===2?a.code:`${a.code} · ${fmt(a.t)} дн.`;
      const labelSVG=label?`<text class="edge-label" x="${geo.midpoint.x.toFixed(1)}" y="${labelY.toFixed(1)}" fill="${critical?'#ffe38a':'#d2e9fb'}" text-anchor="middle">${esc(label)}</text>`:'';
      html+=`<g class="edge-group ${critical?'critical-path':''} ${selected?'select-focus':''}" data-edge="${esc(a.id)}" role="button" tabindex="0" aria-label="Робота ${esc(a.code)}, ${duration(a.t)}, резерв ${duration(a.float)}"><path class="edge-line" d="${line}" stroke="${col}" fill="none" stroke-width="${selected?5.8:stage===0?2.2:3.8}" ${stage===0?'stroke-dasharray="8 8"':''} stroke-linecap="round" marker-end="url(#arrow-${critical?'yellow':'blue'})"/><path class="edge-hit" d="${line}"/>${labelSVG}</g>`;
    }
    for(let i=1;i<=model.n;i++){
      const p=pos[i],selected=state.selected==='node'+i,focus=highlightNode===i;
      html+=`<g class="node-group ${focus||selected?'select-focus':''}" data-node="${i}" role="button" tabindex="0" aria-label="Подія ${i}: ранній строк ${fmt(model.E[i])}, пізній строк ${fmt(model.L[i])}"><circle class="event-ring" cx="${p.x}" cy="${p.y}" r="27" fill="${focus?'#4e4823':'#122e46'}" stroke="${focus?'#ffe07c':'#b1defc'}" stroke-width="3"/><text x="${p.x}" y="${p.y+7}" text-anchor="middle" fill="#f7fbff" class="node-label">${i}</text><circle class="node-hit" cx="${p.x}" cy="${p.y}" r="32"/>${stage>=4&&state.showTimes?`<rect x="${p.x-42}" y="${p.y+36}" width="84" height="29" rx="7" fill="#0a1c2d" stroke="#44647e"/><text x="${p.x}" y="${p.y+55}" text-anchor="middle" class="event-time">Р ${fmt(model.E[i])} · П ${fmt(model.L[i])}</text>`:''}</g>`;
    }
    svg.innerHTML=html;
  }
  function updateSelected(model){
    const el=$('#selection-description');if(!model.valid){el.textContent='Змініть некоректну структуру моделі.';return;}
    const a=model.byId[state.selected];
    if(a){el.textContent=`${a.code}: ${a.name} · ${duration(a.t)} · ES ${fmt(a.ES)} / EF ${fmt(a.EF)} / LS ${fmt(a.LS)} / LF ${fmt(a.LF)} · резерв ${duration(a.float)}${a.critical?' · КРИТИЧНА':''}`;return;}
    if(String(state.selected).startsWith('node')){
      const i=Number(state.selected.slice(4));el.textContent=`Подія ${i}: ранній строк = ${fmt(model.E[i])}; пізній строк = ${fmt(model.L[i])}; резерв події = ${duration(model.L[i]-model.E[i])}.`;return;
    }
    el.textContent='Клацніть на стрілку, щоб побачити параметри роботи, або на коло, щоб побачити строки події.';
  }
  function renderDashboard(model){
    $('#dashboard').classList.toggle('hidden',state.section==='gallery');
    if(state.section==='gallery')return;
    $('#graph-title').textContent=state.project.title;
    $('#graph-subtitle').textContent=state.section==='builder'?`Етап ${state.builderStep+1}/6: ${STEP_DESCRIPTIONS[state.builderStep][0]}. Схема відкривається поступово.`:'Р = ранній строк події; П = пізній строк події. Клацайте на елементи графіка.';
    $('#show-critical').checked=state.showCritical;$('#show-times').checked=state.showTimes;
    $('#model-errors').innerHTML=model.valid?'':`<div class="alerts"><b>Потрібно виправити модель:</b><ul>${model.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><button class="btn btn-mini" data-nav="builder">Перейти до конструктора</button></div>`;
    if(model.valid){
      const preview=state.section==='builder'&&state.builderStep<4;
      $('#metrics').innerHTML=[
        ['Тривалість проєкту',preview?'—':duration(model.total),preview?'Буде обчислено на кроці 5':'Мінімально можливий строк'],
        ['Критичних робіт',preview?'—':model.acts.filter(a=>a.critical).length+' / '+model.acts.length,preview?'Після розрахунку резервів':'Повний резерв = 0'],
        ['Критичних шляхів',preview?'—':model.criticalPaths.length>=16?'16+':model.criticalPaths.length,preview?'Відкриється наприкінці':'Можливі кілька однакових за довжиною'],
        ['Структура мережі',model.n+' подій',''+model.acts.length+' робіт']
      ].map(([lab,val,extra])=>`<div class="metric"><small>${lab}</small><b>${esc(val)}</b><div class="metric-sub">${esc(extra)}</div></div>`).join('');
    }else{$('#metrics').innerHTML='<div class="metric" style="grid-column:1/-1"><b>Розрахунок тимчасово зупинено</b><small>Виправте структуру та тривалості робіт.</small></div>';}
    renderGraph(model);updateSelected(model);
  }
  function overview(model){
    const go=`<button class="btn primary" data-nav="builder">Відкрити конструктор →</button>`;
    return `${titleBar('Як працювати з мережевим графіком','Послідовність від опису робіт до обґрунтованого висновку за результатами розрахунків.',go)}
    <div class="content stack">
      <div class="stage-cards">${STEP_DESCRIPTIONS.map((a,i)=>`<div class="stage-card"><div class="stage-n">${i+1}</div><h3>${esc(a[0])}</h3><p>${esc(a[1])}</p></div>`).join('')}</div>
      <div class="cols">
        <div class="panel"><div class="subheading">НАВЧАЛЬНИЙ КЕЙС</div><h3>Організація циклу аналітичної роботи</h3><p>Спочатку збирають вихідні дані та уточнюють відомості, далі дві гілки можуть працювати паралельно. Підсумкові матеріали мають бути завершені перед загальним фінішем.</p><div class="checklist"><div>01 · Вхідні дані: шість робіт A–F із тривалостями</div><div>02 · Модель: дві паралельні гілки від початку до завершення</div><div>03 · Рішення: знайти загальний строк, резерви і критичні роботи</div></div><div class="toolbar"><button class="btn" data-preset="base">Завантажити базовий приклад</button><button class="btn" data-preset="joined">Спробувати два критичні шляхи</button></div></div>
        <div class="panel blue-note"><div class="subheading">ПРАВИЛА МОДЕЛІ</div><h3>Що показують позначення</h3><ul class="details-list"><li><strong>Подія (коло)</strong> — момент завершення певного набору робіт; сама подія не має тривалості.</li><li><strong>Робота (стрілка)</strong> — дія від події i до події j, що має тривалість t.</li><li><strong>Ранній строк E</strong> — раніше якого подія не може настати.</li><li><strong>Пізній строк L</strong> — найпізніший строк події без перенесення кінцевого терміну.</li><li><strong>Критична робота</strong> — робота з нульовим повним резервом часу.</li></ul><div class="note">Для наочності використовується модель AOA: «роботи на стрілках». Усі приклади і розрахунки виконуються локально в браузері.</div></div>
      </div>
      <div class="panel"><div class="subheading">САМОПЕРЕВІРКА ПЕРЕД ПОЧАТКОМ</div><h3>Який результат має отримати аналітик?</h3><div class="cols three"><div><b>Час</b><p>Знайти мінімально можливий строк завершення всього набору взаємопов’язаних робіт.</p></div><div><b>Пріоритети</b><p>Виявити послідовність робіт, затримка яких призведе до затримки всього проєкту.</p></div><div><b>Гнучкість</b><p>Знайти часові резерви на некритичних роботах для обґрунтованого перепланування.</p></div></div></div>
    </div>`;
  }
  function builder(model){
    const step=STEP_DESCRIPTIONS[state.builderStep]||STEP_DESCRIPTIONS[0];
    const scenarioBtns=Object.entries(PRESETS).map(([key,item])=>`<button class="btn ${state.scenario===key?'primary':''}" data-preset="${key}">${esc(item.title)}</button>`).join('');
    const n=state.project.count;
    const rows=state.project.acts.map((a,i)=>`<tr><td><input class="table-input short" aria-label="Код роботи ${i+1}" data-edit="code" data-id="${esc(a.id)}" maxlength="8" value="${esc(a.code)}"></td><td><input class="table-input name" aria-label="Назва роботи ${i+1}" data-edit="name" data-id="${esc(a.id)}" maxlength="90" value="${esc(a.name)}"></td><td><select class="table-input short" aria-label="Початкова подія ${i+1}" data-edit="from" data-id="${esc(a.id)}">${Array.from({length:n},(_,j)=>`<option value="${j+1}" ${Number(a.from)===j+1?'selected':''}>${j+1}</option>`).join('')}</select></td><td><select class="table-input short" aria-label="Кінцева подія ${i+1}" data-edit="to" data-id="${esc(a.id)}">${Array.from({length:n},(_,j)=>`<option value="${j+1}" ${Number(a.to)===j+1?'selected':''}>${j+1}</option>`).join('')}</select></td><td><input class="table-input short" type="number" min="0.5" max="365" step="0.5" aria-label="Тривалість роботи ${i+1}" data-edit="t" data-id="${esc(a.id)}" value="${esc(a.t)}"></td><td><button class="btn danger btn-mini" data-delete="${esc(a.id)}" title="Видалити роботу ${esc(a.code)}">✕</button></td></tr>`).join('');
    return `${titleBar('Конструктор мережевого графіка','Редагуйте перелік робіт, напрямки стрілок та тривалість. Модель негайно перевіряється на цикли та структурні помилки.')}
    <div class="content stack">
      <div class="panel"><div class="subheading">ПОКРОКОВИЙ АЛГОРИТМ ПОБУДОВИ</div><div class="progress-steps">${STEP_DESCRIPTIONS.map((_,i)=>`<button class="${state.builderStep===i?'active':''}" data-stage="${i}">${i+1}. ${['Роботи','Залежності','Схема','Час','Розрахунок','Висновок'][i]}</button>`).join('')}</div><div class="step-focus"><h3>${state.builderStep+1}. ${esc(step[0])}</h3><p>${esc(step[1])}</p><span class="formula">${esc(step[2])}</span><div class="toolbar"><button class="btn" data-stage="${Math.max(0,state.builderStep-1)}" ${state.builderStep===0?'disabled':''}>← Назад</button><button class="btn primary" data-stage="${Math.min(5,state.builderStep+1)}" ${state.builderStep===5?'disabled':''}>Наступний крок →</button>${state.builderStep===4?'<button class="btn" data-nav="forward">Перейти до прямого проходу</button>':''}</div></div></div>
      <div class="panel"><div class="subheading">НАВЧАЛЬНІ СЦЕНАРІЇ</div><h3>Почніть із готової схеми або змініть її</h3><div class="toolbar">${scenarioBtns}</div><p class="hint">Сценарій із двома критичними гілками показує, що критичний шлях не завжди єдиний.</p></div>
      <div class="panel"><div class="subheading">ТАБЛИЦЯ РОБІТ</div><h3>Вхідні дані графіка</h3><p>«Від» і «до» — номери подій, між якими виконується робота. Після зміни поля натисніть Enter або перейдіть до іншого поля.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Код</th><th>Назва роботи</th><th>Від</th><th>До</th><th>t, днів</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="toolbar"><button class="btn" id="add-event" ${n>=14?'disabled':''}>+ Додати подію (${n})</button><button class="btn" id="remove-event" ${n<=2?'disabled':''}>− Прибрати останню подію</button><button class="btn outline" id="import-json">Імпортувати JSON</button><button class="btn outline" id="export-json">Зберегти JSON</button><button class="btn outline" id="export-svg">Експортувати SVG</button><button class="btn outline" id="export-csv">Зберегти CSV</button></div>
      <div class="divider"></div><h3>Додати роботу</h3><form class="form-grid" id="add-work-form"><label class="field">Код<input name="code" maxlength="8" placeholder="G" required value="${esc(nextCode())}"></label><label class="field">Назва<input name="name" maxlength="90" placeholder="Назва роботи" required></label><label class="field">Від<select name="from">${Array.from({length:n},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label><label class="field">До<select name="to">${Array.from({length:n},(_,i)=>`<option value="${i+1}" ${i===n-1?'selected':''}>${i+1}</option>`).join('')}</select></label><label class="field">t, днів<input name="t" type="number" min="0.5" max="365" step="0.5" value="1" required></label><button type="submit" class="btn primary">+ Додати</button></form>
      <p class="hint">Для створення нової гілки спочатку додайте подію, потім зв’яжіть її роботами. Усі події мають бути частиною єдиної ациклічної мережі.</p></div>
      <div class="cols equal"><div class="panel"><h3>Перевірка побудови</h3>${model.valid?`<div class="feedback success">Структура коректна: ${model.n} подій і ${model.acts.length} робіт. Одна початкова та одна кінцева події, циклів немає.</div>`:`<div class="feedback error">${model.errors.map(esc).join('<br>')}</div>`}<ul><li>Жодної роботи поза графіком.</li><li>Немає циклічних залежностей.</li><li>Кожна подія з'єднана з початком і завершенням.</li></ul></div><div class="panel"><h3>Далі — розрахунок</h3><p>Прямий прохід знаходить найраніші строки подій. Зворотний — найпізніші. Потім за різницею обчислюємо резерви та виділяємо критичні роботи.</p><div class="toolbar"><button class="btn primary" data-nav="forward" ${!model.valid?'disabled':''}>Розрахувати ранні строки →</button></div></div></div>
    </div>`;
  }
  function nextCode(){
    const codes=new Set(state.project.acts.map(a=>String(a.code).toUpperCase()));
    for(let i=65;i<=90;i++){let c=String.fromCharCode(i);if(!codes.has(c))return c;}
    return 'W'+(state.project.acts.length+1);
  }
  function walkFormula(model,u,direction){
    if(direction==='forward'){
      if(u===model.start)return {text:`Початкова подія ${u}`,expr:`E${u} = 0`,terms:'Відлік починаємо з нульового моменту часу.'};
      const list=model.incoming[u].map(a=>`E${a.from} + ${fmt(Number(a.t))} = ${fmt(model.E[Number(a.from)]+Number(a.t))}`);
      return {text:`Подія ${u}: обираємо максимальний із можливих строків завершення вхідних робіт`,expr:`E${u} = max(${list.map(s=>s.split(' = ')[1]).join('; ')}) = ${fmt(model.E[u])}`,terms:list.join(' · ')};
    }
    if(u===model.end)return {text:`Кінцева подія ${u}`,expr:`L${u} = T = ${fmt(model.total)}`,terms:'Фіксуємо строк завершення, знайдений прямим проходом.'};
    const list=model.outgoing[u].map(a=>`L${a.to} − ${fmt(Number(a.t))} = ${fmt(model.L[Number(a.to)]-Number(a.t))}`);
    return {text:`Подія ${u}: обираємо мінімальний із допустимих строків початку вихідних робіт`,expr:`L${u} = min(${list.map(s=>s.split(' = ')[1]).join('; ')}) = ${fmt(model.L[u])}`,terms:list.join(' · ')};
  }
  function walk(direction,model){
    const isForward=direction==='forward',name=isForward?'Прямий прохід':'Зворотний прохід';
    if(!model.valid)return `<div class="content"><div class="panel"><h3>Спочатку виправте схему</h3><button class="btn primary" data-nav="builder">Конструктор →</button></div></div>`;
    const order=isForward?model.order:[...model.order].reverse(),index=isForward?state.forwardStep:state.backwardStep;
    const idx=Math.min(index,order.length-1),u=order[idx],ex=walkFormula(model,u,direction),symbol=isForward?'E':'L',value=isForward?model.E[u]:model.L[u];
    const rows=order.map((node,i)=>{
      const line=walkFormula(model,node,direction);
      return `<div class="calc-step ${i===idx?'active':''}" data-jump="${i}" data-dir="${direction}" role="button" tabindex="0"><div><div class="main">${i+1}. ${esc(line.text)}</div><div class="secondary">${esc(line.terms)}</div></div><b>${symbol}${node} = ${fmt(isForward?model.E[node]:model.L[node])}</b></div>`;
    }).join('');
    return `${titleBar(name,isForward?'Рухайтеся зліва направо. Ранній строк кожної події — найбільша з сум раннього строку попередника та тривалості роботи.':'Рухайтеся справа наліво. Пізній строк кожної події — найменша з різниць пізнього строку наступника та тривалості роботи.')}
      <div class="content stack"><div class="cols"><div class="panel"><div class="subheading">ІНТЕРАКТИВНИЙ РОЗРАХУНОК · КРОК ${idx+1} ІЗ ${order.length}</div><h3>${esc(ex.text)}</h3><p>${esc(ex.terms)}</p><div class="formula-large">${esc(ex.expr)}</div><div class="step-controls"><button class="btn" data-walk="${direction}:prev" ${idx===0?'disabled':''}>← Попередня подія</button><span class="progress-label">${idx+1} / ${order.length}</span><button class="btn primary" data-walk="${direction}:next" ${idx===order.length-1?'disabled':''}>Наступна подія →</button></div><div class="divider"></div><h3>Спробуйте розрахувати самостійно</h3><p>Який ${isForward?'ранній':'пізній'} строк події <b>${u}</b>?</p><div class="check-work"><label class="field">Ваша відповідь (днів)<input id="walk-answer" type="number" step="0.5" placeholder="Наприклад, ${fmt(value)}"></label><button class="btn" data-check="${direction}">Перевірити</button></div><div id="walk-feedback" class="feedback" style="display:none"></div></div>
      <div class="panel"><div class="subheading">${isForward?'ФОРМУЛА ПРЯМОГО ПРОХОДУ':'ФОРМУЛА ЗВОРОТНОГО ПРОХОДУ'}</div><div class="formula-large">${isForward?'Eⱼ = max (Eᵢ + tᵢⱼ)':'Lᵢ = min (Lⱼ − tᵢⱼ)'}</div><p>${isForward?'Якщо до події входять кілька стрілок, подія можлива лише після завершення всіх вхідних робіт. Тому застосовуємо максимум.':'Якщо з події виходять кілька робіт, усі повинні встигнути до допустимих строків своїх наступників. Тому застосовуємо мінімум.'}</p><div class="note">${isForward?'У кінцевій події E дорівнює мінімально можливій тривалості всього проєкту.':'Зворотний прохід стартує з Lкінц = Eкінц. Зіставлення пізніх і ранніх строків дозволяє обчислити резерви.'}</div><div class="toolbar"><button class="btn primary" data-nav="${isForward?'backward':'critical'}">${isForward?'Перейти до зворотного проходу →':'Перейти до критичного шляху →'}</button></div></div></div>
      <div class="panel"><h3>Усі розрахункові кроки</h3><p>Натисніть на будь-який рядок, щоб показати відповідну подію на графіку.</p><div class="calc-list">${rows}</div></div>
      <div class="panel"><h3>Часові параметри подій</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Подія</th><th>Ранній строк E</th><th>Пізній строк L</th><th>Резерв L − E</th></tr></thead><tbody>${model.order.map(node=>`<tr><td><strong>${node}</strong></td><td>${fmt(model.E[node])}</td><td>${fmt(model.L[node])}</td><td class="${Math.abs(model.L[node]-model.E[node])<1e-8?'emph':''}">${fmt(model.L[node]-model.E[node])}</td></tr>`).join('')}</tbody></table></div></div>
      </div>`;
  }
  function critical(model){
    if(!model.valid)return '<div class="content panel">Для аналізу критичного шляху необхідна коректна схема.</div>';
    const selected=model.acts.find(a=>a.code===state.whatifCode)||model.acts[0];
    const altered=copy(state.project),aAlt=altered.acts.find(a=>a.id===selected.id);aAlt.t=Number(Math.max(.5,Number(aAlt.t)+Number(state.whatifDelta)).toFixed(2));
    const changed=solve(altered);
    const rows=model.acts.map(a=>`<tr class="${a.critical?'row-critical':''}"><td><span class="code-pill">${esc(a.code)}</span></td><td>${esc(a.name)}</td><td class="num">${fmt(a.t)}</td><td class="num">${fmt(a.ES)}</td><td class="num">${fmt(a.EF)}</td><td class="num">${fmt(a.LS)}</td><td class="num">${fmt(a.LF)}</td><td class="num ${a.critical?'emph':''}">${fmt(a.float)}</td><td><span class="tiny-pill ${a.critical?'':'neutral'}">${a.critical?'Критична':'Некритична'}</span></td></tr>`).join('');
    return `${titleBar('Критичний шлях, резерви та управлінські рішення','Порівняйте ранні й пізні строки робіт, знайдіть нульові резерви та змоделюйте зміну тривалості однієї роботи.')}
      <div class="content stack"><div class="cols"><div class="panel"><div class="subheading">РЕЗУЛЬТАТ CPM</div><h3>Критичні шляхи в моделі</h3><div class="summary-val">${duration(model.total)}</div><p>Тривалість проєкту за умови виконання заданих залежностей.</p><div class="checklist">${model.criticalPaths.map((p,i)=>`<div><span class="callout-label">ШЛЯХ ${i+1}</span> <strong>${esc(p.map(a=>a.code).join(' → '))}</strong> = ${duration(p.reduce((s,a)=>s+a.t,0))}</div>`).join('')}</div><div class="note" style="margin-top:15px">Критична робота має <b>повний резерв R = 0</b>. При збільшенні її тривалості без компенсації строк проєкту, як правило, зростає.</div></div>
      <div class="panel"><div class="subheading">ЕКСПЕРИМЕНТ «ЩО, ЯКЩО?»</div><h3>Змінімо тривалість однієї роботи</h3><p>Оберіть роботу і зміну її тривалості. Подивіться, як зміняться загальний строк та критичні шляхи.</p><div class="whatif-row"><label class="field">Робота<select id="whatif-code">${model.acts.map(a=>`<option value="${esc(a.code)}" ${a.id===selected.id?'selected':''}>${esc(a.code)} · ${esc(a.name)}</option>`).join('')}</select></label><label class="field">Зміна тривалості<select id="whatif-delta">${[-2,-1,.5,1,2,3].map(delta=>`<option value="${delta}" ${Number(state.whatifDelta)===delta?'selected':''}>${delta>0?'+':''}${fmt(delta)} днів</option>`).join('')}</select></label><button class="btn primary" id="apply-whatif">Застосувати</button></div>
      <div class="compare"><div><span class="caption">Зараз</span><span class="value">${duration(model.total)}</span><span class="caption">${selected.code}: ${duration(selected.t)}</span></div><div><span class="caption">Після зміни</span><span class="value">${changed.valid?duration(changed.total):'—'}</span><span class="caption">${selected.code}: ${duration(aAlt.t)}</span></div></div><div class="feedback ${changed.valid?'':'error'}">${changed.valid?`Зміна загального строку: <strong>${changed.total-model.total>0?'+':''}${fmt(changed.total-model.total)} днів</strong>. Критичні шляхи: ${changed.criticalPaths.map(p=>p.map(a=>esc(a.code)).join(' → ')).join('; ')||'не знайдено'}.`:'Модифікована модель некоректна.'}</div></div></div>
      <div class="panel"><div class="subheading">ПОВНА ТАБЛИЦЯ ЧАСОВИХ ПАРАМЕТРІВ РОБІТ</div><h3>ES, EF, LS, LF та повний резерв</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Код</th><th>Робота</th><th>t</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>R</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table></div><p class="hint">ES — ранній початок; EF — раннє завершення; LS — пізній початок; LF — пізнє завершення; R — повний резерв часу.</p></div>
      <div class="cols equal"><div class="panel"><h3>Формули</h3><div class="formula-large">EF = ES + t</div><div class="formula-large">LS = LF − t</div><div class="formula-large">R = LS − ES = LF − EF</div><p>Для роботи (i → j): ES = Eᵢ, LF = Lⱼ. Повний резерв може бути використаний без зміни кінцевого строку за незмінності інших умов проєкту.</p></div><div class="panel"><h3>Рекомендації аналітика</h3><div class="checklist"><div>Критичні роботи — під посиленим контролем виконання строків.</div><div>Некритичні роботи мають часовий резерв, який може підтримати перепланування.</div><div>Перед скороченням строку оцініть ресурси та ризики; сама зміна тривалості в моделі не гарантує практичної здійсненності.</div></div><div class="toolbar"><button class="btn primary" data-nav="practice">Перевірити знання →</button></div></div></div>
      </div>`;
  }
  function makeQuestions(model){
    const other=model.order.filter(i=>i!==model.start&&i!==model.end);
    const node=other[Math.floor(other.length/2)]||model.end;
    const lateNode=other[0]||model.start;
    const noncrit=model.acts.find(a=>!a.critical)||model.acts[0];
    return [
      {id:'q1',title:'Мінімальна тривалість проєкту',detail:'Який найраніший можливий строк завершення всіх робіт, у днях?',answer:model.total,why:`Ранній строк кінцевої події E${model.end} = ${fmt(model.total)}.`},
      {id:'q2',title:`Прямий прохід: подія ${node}`,detail:`Обчисліть ранній строк E${node}.`,answer:model.E[node],why:walkFormula(model,node,'forward').expr},
      {id:'q3',title:`Зворотний прохід: подія ${lateNode}`,detail:`Обчисліть пізній строк L${lateNode}.`,answer:model.L[lateNode],why:walkFormula(model,lateNode,'backward').expr},
      {id:'q4',title:`Повний резерв роботи ${noncrit.code}`,detail:`Який повний резерв роботи «${noncrit.name}» у днях?`,answer:noncrit.float,why:`R = LS − ES = ${fmt(noncrit.LS)} − ${fmt(noncrit.ES)} = ${fmt(noncrit.float)}.`},
      {id:'q5',title:'Кількість критичних шляхів',detail:'Скільки різних критичних шляхів має поточний мережевий графік?',answer:model.criticalPaths.length,why:`${model.criticalPaths.length} шлях(и): ${model.criticalPaths.map(p=>p.map(a=>a.code).join(' → ')).join('; ')}.`}
    ];
  }
  function practice(model){
    if(!model.valid)return '<div class="content"><div class="panel">Потрібна коректна мережева схема. <button class="btn" data-nav="builder">Конструктор</button></div></div>';
    const questions=makeQuestions(model),answers=state.quiz,feedback=state.feedback;
    const correct=questions.filter(q=>feedback[q.id]===true).length,checked=questions.filter(q=>feedback[q.id]!==undefined).length;
    return `${titleBar('Практикум: розрахуйте самі','П’ять завдань побудовані безпосередньо на поточній моделі. Можна змінити її в конструкторі та пройти перевірку знову.')}
      <div class="content stack"><div class="cols"><div class="panel"><div class="subheading">САМОСТІЙНЕ РОЗВ’ЯЗАННЯ</div><h3>Як виконувати практикум</h3><p>Спочатку знайдіть ранні строки, потім пізні. Розрахуйте повний резерв однієї роботи та визначте критичні шляхи.</p><ul><li>Використовуйте графік зверху й формули з попередніх розділів.</li><li>Для кожного завдання введіть числову відповідь.</li><li>Отримаєте миттєву перевірку та пояснення.</li></ul><div class="toolbar"><button class="btn" data-nav="forward">Підказка: прямий прохід</button><button class="btn" data-nav="backward">Підказка: зворотний прохід</button></div></div>
      <div class="score-card"><div class="subheading">ПОТОЧНИЙ РЕЗУЛЬТАТ</div><strong>${correct} / ${questions.length}</strong><p>${checked} перевірено з ${questions.length}. Успішні відповіді зараховуються за точним обчисленням із допуском 0,001.</p><div class="toolbar"><button class="btn primary" id="check-all">Перевірити всі відповіді</button><button class="btn" id="clear-quiz">Почати заново</button></div></div></div>
      <div class="quiz-grid">${questions.map((q,i)=>`<div class="quiz-question"><div class="subheading">ЗАВДАННЯ ${String(i+1).padStart(2,'0')}</div><h3>${esc(q.title)}</h3><div class="details">${esc(q.detail)}</div><div class="answer-row"><input class="input" data-answer="${q.id}" type="number" step="any" placeholder="Ваша відповідь" value="${esc(answers[q.id]??'')}" aria-label="Відповідь на завдання ${i+1}"><button class="btn btn-mini" data-quiz-check="${q.id}">Перевірити</button>${feedback[q.id]!==undefined?`<span class="answer-status ${feedback[q.id]?'correct':'wrong'}">${feedback[q.id]?'✓ Правильно':'✕ Спробуйте ще'}</span>`:''}</div>${feedback[q.id]===true||state.quizRevealed?`<div class="feedback ${feedback[q.id]===true?'success':''}">${esc(q.why)} Правильна відповідь: <b>${fmt(q.answer)}</b>.</div>`:''}</div>`).join('')}</div>
      <div class="panel"><h3>Запитання для обговорення з групою</h3><div class="checklist"><div>Що зміниться, якщо збільшити тривалість некритичної роботи на величину, меншу за її резерв?</div><div>За яких обставин у мережі виникають два або більше критичних шляхів?</div><div>Чому збільшення кількості виконавців не завжди скорочує загальний строк завершення?</div></div><div class="toolbar"><button class="btn" id="reveal-quiz">Показати розв’язання всіх завдань</button><button class="btn" data-preset="joined">Завантажити приклад із двома критичними шляхами</button></div></div></div>`;
  }
  function gallery(){
    return `${titleBar('Інфографіки до заняття','Десять окремих фотореалістичних ілюстрацій за темою. Натисніть на зображення для повноекранного перегляду.')}
      <div class="content stack"><div class="panel"><div class="note">Інфографіки є візуальним супроводом заняття. Для математично точних значень тривалості, резервів і критичних шляхів використовуйте інтерактивні розрахунки тренажера.</div></div>
      <div class="gallery">${IMAGES.map(([title,desc],i)=>`<button class="gallery-card" data-image="${i}" aria-label="Відкрити інфографіку ${i+1}: ${esc(title)}"><img src="assets/infographics/${String(i+1).padStart(2,'0')}_thumb.jpg" alt="${esc(title)}" loading="lazy"><div class="gallery-body"><div class="gallery-count">${String(i+1).padStart(2,'0')} / 10</div><strong>${esc(title)}</strong><p>${esc(desc)}</p></div></button>`).join('')}</div></div>`;
  }
  function renderApp(){
    const model=solve(state.project);
    renderNav();renderDashboard(model);
    $('#content').innerHTML=({overview:()=>overview(model),builder:()=>builder(model),forward:()=>walk('forward',model),backward:()=>walk('backward',model),critical:()=>critical(model),practice:()=>practice(model),gallery:()=>gallery()})[state.section]();
    $('#content').classList.add('rendered');
    window.networkLab = {solve,presets:PRESETS,currentModel:()=>solve(state.project)};
  }
  function changeTab(key){
    if(!NAV.some(([navKey])=>navKey===key))return;
    state.section=key;state.selected=null;persist();renderApp();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function download(name,data,mime){
    const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);
  }
  function exportJSON(){
    const pack={format:'AOA-CPM',version:1,title:state.project.title,eventCount:state.project.count,activities:state.project.acts.map(a=>({code:a.code,name:a.name,from:Number(a.from),to:Number(a.to),duration:Number(a.t)}))};
    download('merezhevyi-hrafik.json',JSON.stringify(pack,null,2),'application/json;charset=utf-8');showToast('JSON збережено.');
  }
  function exportCSV(){
    const model=solve(state.project);
    const header=['Код','Назва','Від','До','Тривалість','ES','EF','LS','LF','Резерв','Критична'];
    const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
    const rows=[header,...state.project.acts.map(a=>{
      const d=model.valid?model.byId[a.id]:null;
      return [a.code,a.name,a.from,a.to,a.t,d?.ES??'',d?.EF??'',d?.LS??'',d?.LF??'',d?.float??'',d?(d.critical?'Так':'Ні'):''];
    })];
    download('merezhevyi-hrafik.csv','\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8');showToast('CSV збережено.');
  }
  function exportSVG(){
    const model=solve(state.project);if(!model.valid){showToast('Для експорту SVG потрібна коректна модель.');return;}
    const source=$('#network').innerHTML;
    const css=`<style><![CDATA[text{font-family:Arial,sans-serif}.edge-label{font-size:15px;font-weight:bold;paint-order:stroke;stroke:#102236;stroke-width:5px;stroke-linejoin:round}.node-label{font-weight:bold;font-size:20px}.event-time{font-size:13px;fill:#e4f1ff;font-weight:bold}]]></style>`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1470" height="585" viewBox="0 0 980 390"><rect width="980" height="390" fill="#102235"/>${css}${source}</svg>`;
    download('merezhevyi-hrafik.svg',svg,'image/svg+xml;charset=utf-8');showToast('SVG схему збережено.');
  }
  function applyImport(obj){
    const count=Number(obj.eventCount??obj.count);
    const arr=obj.activities??obj.acts;
    if(!Array.isArray(arr)||arr.length>40||!Number.isInteger(count)||count<2||count>14)throw new Error('У файлі неправильна кількість подій або робіт.');
    const acts=arr.map((a,i)=>({id:'act'+i,code:String(a.code||''),name:String(a.name||''),from:Number(a.from),to:Number(a.to),t:Number(a.duration??a.t)}));
    const project={title:String(obj.title||'Імпортована мережа').slice(0,100),count,acts};
    const model=solve(project);
    if(!model.valid)throw new Error(model.errors.join(' '));
    state.project=project;state.scenario='custom';state.selected=null;state.builderStep=0;state.forwardStep=0;state.backwardStep=0;state.quiz={};state.feedback={};state.quizRevealed=false;
    state.whatifCode=project.acts[0].code;persist();renderApp();showToast('Модель імпортовано та перевірено.');
  }
  let lightboxIndex=0;
  function openLightbox(index){lightboxIndex=(index+IMAGES.length)%IMAGES.length;refreshLightbox();$('#lightbox').classList.add('open');$('#lightbox').setAttribute('aria-hidden','false');$('#lightbox-close').focus();}
  function refreshLightbox(){$('#lightbox-caption').textContent=`${lightboxIndex+1} / 10 — ${IMAGES[lightboxIndex][0]}`;$('#lightbox-image').src=`assets/infographics/${String(lightboxIndex+1).padStart(2,'0')}.jpg`;$('#lightbox-image').alt=IMAGES[lightboxIndex][0];}
  function closeLightbox(){$('#lightbox').classList.remove('open');$('#lightbox').setAttribute('aria-hidden','true');}
  function checkWalk(direction){
    const model=solve(state.project);if(!model.valid)return;
    const order=direction==='forward'?model.order:[...model.order].reverse();
    const idx=direction==='forward'?state.forwardStep:state.backwardStep;
    const event=order[Math.min(idx,order.length-1)];
    const answer=Number($('#walk-answer').value);const feedback=$('#walk-feedback');
    const value=direction==='forward'?model.E[event]:model.L[event];
    feedback.style.display='block';
    if(!$('#walk-answer').value.trim()){feedback.className='feedback error';feedback.textContent='Спочатку введіть число.';return;}
    const pass=Math.abs(answer-value)<.001;
    feedback.className='feedback '+(pass?'success':'error');feedback.textContent=pass?`Правильно! Час події ${event} = ${fmt(value)}.`:`Поки що ні. Підказка: ${walkFormula(model,event,direction).terms}. Спробуйте знову.`;
  }
  function checkQuiz(single){
    const model=solve(state.project);if(!model.valid)return;
    const questions=makeQuestions(model),ids=single?[single]:questions.map(q=>q.id);
    for(const id of ids){
      const input=$(`[data-answer="${id}"]`);if(!input)continue;
      state.quiz[id]=input.value;
      if(!input.value.trim()){state.feedback[id]=false;continue;}
      const question=questions.find(q=>q.id===id);
      state.feedback[id]=Math.abs(Number(input.value)-question.answer)<.001;
    }
    persist();renderApp();
  }
  document.addEventListener('click',e=>{
    const t=e.target;
    let button=t.closest('[data-nav]');if(button){changeTab(button.dataset.nav);return;}
    button=t.closest('[data-preset]');if(button){loadPreset(button.dataset.preset);return;}
    button=t.closest('[data-stage]');if(button){state.builderStep=Number(button.dataset.stage);persist();renderApp();return;}
    button=t.closest('[data-walk]');if(button){
      const [direction,action]=button.dataset.walk.split(':');const model=solve(state.project);
      const key=direction==='forward'?'forwardStep':'backwardStep';
      state[key]=Math.max(0,Math.min(model.order.length-1,state[key]+(action==='next'?1:-1)));
      persist();renderApp();return;
    }
    button=t.closest('[data-jump]');if(button){state[button.dataset.dir==='forward'?'forwardStep':'backwardStep']=Number(button.dataset.jump);persist();renderApp();$('#dashboard').scrollIntoView({behavior:'smooth',block:'start'});return;}
    button=t.closest('[data-check]');if(button){checkWalk(button.dataset.check);return;}
    button=t.closest('[data-quiz-check]');if(button){checkQuiz(button.dataset.quizCheck);return;}
    button=t.closest('[data-delete]');if(button){updateProject(project=>{project.acts=project.acts.filter(a=>a.id!==button.dataset.delete);state.scenario='custom';});return;}
    button=t.closest('[data-image]');if(button){openLightbox(Number(button.dataset.image));return;}
    if(t.closest('#reset-view')){loadPreset('base');return;}
    if(t.closest('#add-event')){updateProject(project=>{if(project.count<14)project.count++;state.scenario='custom';});return;}
    if(t.closest('#remove-event')){updateProject(project=>{if(project.count>2){project.acts=project.acts.filter(a=>Number(a.from)!==project.count&&Number(a.to)!==project.count);project.count--;}state.scenario='custom';});return;}
    if(t.closest('#export-json')){exportJSON();return;}
    if(t.closest('#export-csv')){exportCSV();return;}
    if(t.closest('#export-svg')){exportSVG();return;}
    if(t.closest('#import-json')){$('#file-import').click();return;}
    if(t.closest('#check-all')){checkQuiz();return;}
    if(t.closest('#clear-quiz')){state.quiz={};state.feedback={};state.quizRevealed=false;persist();renderApp();return;}
    if(t.closest('#reveal-quiz')){state.quizRevealed=true;persist();renderApp();return;}
    if(t.closest('#apply-whatif')){
      const selected=state.project.acts.find(a=>a.code===state.whatifCode);
      if(!selected)return;
      updateProject(project=>{const a=project.acts.find(a=>a.id===selected.id);a.t=Number(Math.max(.5,Number(a.t)+Number(state.whatifDelta)).toFixed(2));state.scenario='custom';});
      showToast('Нову тривалість застосовано до графіка.');return;
    }
    if(t.closest('#lightbox-close')){closeLightbox();return;}
    if(t.closest('#lightbox-prev')){lightboxIndex=(lightboxIndex+IMAGES.length-1)%IMAGES.length;refreshLightbox();return;}
    if(t.closest('#lightbox-next')){lightboxIndex=(lightboxIndex+1)%IMAGES.length;refreshLightbox();return;}
    if(t.id==='lightbox'){closeLightbox();return;}
    const edge=t.closest('[data-edge]');const node=t.closest('[data-node]');
    if(edge||node){state.selected=edge?edge.dataset.edge:'node'+node.dataset.node;renderGraph(solve(state.project));updateSelected(solve(state.project));return;}
  });
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.dataset.edit){
      const id=t.dataset.id,field=t.dataset.edit;
      updateProject(project=>{const a=project.acts.find(a=>a.id===id);if(!a)return;a[field]=['from','to','t'].includes(field)?Number(t.value):t.value.trim();state.scenario='custom';});return;
    }
    if(t.id==='show-critical'){state.showCritical=t.checked;persist();renderGraph(solve(state.project));return;}
    if(t.id==='show-times'){state.showTimes=t.checked;persist();renderGraph(solve(state.project));return;}
    if(t.id==='whatif-code'){state.whatifCode=t.value;persist();renderApp();return;}
    if(t.id==='whatif-delta'){state.whatifDelta=Number(t.value);persist();renderApp();return;}
    if(t.dataset.answer){state.quiz[t.dataset.answer]=t.value;persist();return;}
    if(t.id==='file-import'&&t.files?.[0]){
      const file=t.files[0];
      file.text().then(s=>{try{applyImport(JSON.parse(s));}catch(err){showToast('Помилка імпорту: '+err.message);}}).catch(()=>showToast('Не вдалося прочитати JSON.'));
      t.value='';
    }
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='add-work-form')return;
    e.preventDefault();const data=new FormData(e.target);
    const code=String(data.get('code')).trim(),name=String(data.get('name')).trim(),from=Number(data.get('from')),to=Number(data.get('to')),t=Number(data.get('t'));
    if(!code||!name||from===to||!(t>0)){showToast('Вкажіть різні події, назву та додатну тривалість.');return;}
    if(state.project.acts.some(a=>String(a.code).toUpperCase()===code.toUpperCase())){showToast('Код роботи вже використано.');return;}
    updateProject(project=>{project.acts.push({id:'act'+Math.random().toString(36).slice(2,10),code,name,from,to,t});state.scenario='custom';});showToast('Роботу додано до схеми.');
  });
  document.addEventListener('keydown',e=>{
    if($('#lightbox').classList.contains('open')){
      if(e.key==='Escape'){closeLightbox();e.preventDefault();}
      if(e.key==='ArrowLeft'){lightboxIndex=(lightboxIndex+9)%10;refreshLightbox();e.preventDefault();}
      if(e.key==='ArrowRight'){lightboxIndex=(lightboxIndex+1)%10;refreshLightbox();e.preventDefault();}
      return;
    }
    if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-jump],[data-edge],[data-node]')){e.preventDefault();e.target.click();}
  });
  renderApp();
})();
