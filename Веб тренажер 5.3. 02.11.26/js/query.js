/* ================== МОВА ЗАПИТІВ ==================
   Токенізатор, парсер у дерево виразу, переклад команд УКР ↔ ENG,
   пояснення «чому картка не підходить» і пошук за схожістю (TF–IDF). */

class QErr extends Error{}
const E = (key,p) => new QErr(t(key,p));
const norm = s => s.toLowerCase().replace(/[’ʼ`ʹ]/g,"'").replace(/ё/g,'е');
const LAT = {'А':'A','В':'B','С':'C','Е':'E','Д':'D','Ф':'F','Б':'B'};
const normLetter = s => s.toUpperCase().split('').map(ch=>LAT[ch]||ch).join('');

const FIELDS = {
  'тип':'type','type':'type',
  'район':'reg','region':'reg','reg':'reg',
  'джерело':'src','source':'src','src':'src','надійність':'src','reliability':'src',
  'інфо':'info','info':'info','достовірність':'info','credibility':'info',
  'оцінка':'rating','rating':'rating','код':'rating','grade':'rating',
  'дата':'date','date':'date',
  'мова':'lang','lang':'lang','language':'lang',
  'пріоритет':'pri','priority':'pri',
  'техніка':'equip','equip':'equip','equipment':'equip',
  'знімок':'img','image':'img','img':'img',
  'зйомка':'shot','shot':'shot','captured':'shot',
  'метадані':'meta','meta':'meta','metadata':'meta',
  'квадрат':'sq','square':'sq','sq':'sq','grid':'sq',
  'схоже':'sim','similar':'sim','like':'sim'
};
const FIELD_UA = {type:'тип',reg:'район',src:'джерело',info:'інфо',rating:'оцінка',date:'дата',lang:'мова',pri:'пріоритет',
  equip:'техніка',img:'знімок',shot:'зйомка',meta:'метадані',sq:'квадрат',sim:'схоже'};
const EN_FIELD = {type:'type',reg:'region',src:'source',info:'info',rating:'rating',date:'date',lang:'lang',pri:'priority',
  equip:'equip',img:'image',shot:'shot',meta:'meta',sq:'square',sim:'similar'};
const FIELD_ORDER = ['type','reg','src','info','rating','date','lang','pri','equip','img','shot','meta','sq','sim'];

const CATS = {
  type:{фото:'фото',photo:'фото',відео:'відео',video:'відео',звіт:'звіт',report:'звіт',допис:'допис',post:'допис',аудіо:'аудіо',audio:'аудіо',карта:'карта',map:'карта',схема:'карта',scheme:'карта'},
  reg:{північ:'Північ',north:'Північ',південь:'Південь',south:'Південь',схід:'Схід',east:'Схід',захід:'Захід',west:'Захід'},
  lang:{укр:'укр',українська:'укр',ua:'укр',uk:'укр',ukr:'укр',ukrainian:'укр',англ:'англ',англійська:'англ',en:'англ',eng:'англ',english:'англ',інша:'інша',other:'інша'},
  pri:{високий:'високий',high:'високий',середній:'середній',medium:'середній',низький:'низький',low:'низький'},
  equip:{танк:'танк',tank:'танк',бтр:'бтр',apc:'бтр',сау:'сау',spg:'сау',рсзв:'рсзв',mlrs:'рсзв',вантажівка:'вантажівка',truck:'вантажівка',
    бпла:'бпла',uav:'бпла',дрон:'бпла',drone:'бпла',ппо:'ппо',sam:'ппо',гелікоптер:'гелікоптер',helicopter:'гелікоптер',heli:'гелікоптер',вертоліт:'гелікоптер'},
  meta:{є:'є',present:'є',intact:'є',видалено:'видалено',removed:'видалено',stripped:'видалено',змінено:'змінено',edited:'змінено',modified:'змінено'}
};
const EN_VAL = {
  type:{фото:'photo',відео:'video',звіт:'report',допис:'post',аудіо:'audio',карта:'map'},
  reg:{Північ:'North',Південь:'South',Схід:'East',Захід:'West'},
  lang:{укр:'ua',англ:'en',інша:'other'},
  pri:{високий:'high',середній:'medium',низький:'low'},
  equip:{танк:'tank',бтр:'apc',сау:'spg',рсзв:'mlrs',вантажівка:'truck',бпла:'uav',ппо:'sam',гелікоптер:'heli'},
  meta:{є:'present',видалено:'removed',змінено:'edited'}
};
const OPS = {ua:{or:'АБО',and:'І',not:'НЕ'},en:{or:'OR',and:'AND',not:'NOT'}};

const fieldName = (f,lang=cmd()) => lang==='en'?EN_FIELD[f]:FIELD_UA[f];
const valName = (f,v,lang=cmd()) => lang==='en'&&EN_VAL[f]&&EN_VAL[f][v]?EN_VAL[f][v]:v;

/* ---------- токенізатор ---------- */
const OPEN = {'"':'"','«':'»','“':'”','„':'“'};
function readPhrase(q,i){
  let j=q.indexOf(OPEN[q[i]],i+1);
  if(OPEN[q[i]]==='“' && j<0) j=q.indexOf('”',i+1);
  if(j<0) throw E('err.quote');
  return [q.slice(i+1,j), j+1];
}
function tokenize(q){
  const toks=[]; let i=0;
  while(i<q.length){
    const c=q[i];
    if(/\s/.test(c)){i++;continue}
    if(c==='('||c===')'){toks.push({k:c});i++;continue}
    if(OPEN[c]){ const [v,j]=readPhrase(q,i); toks.push({k:'phrase',v}); i=j; continue; }
    let j=i; while(j<q.length && !/[\s()"«“„]/.test(q[j])) j++;
    let w=q.slice(i,j); i=j;
    // поле зі значенням у лапках: схоже:"рух колони"
    if(w.endsWith(':') && OPEN[q[i]]){ const [v,k]=readPhrase(q,i); w+=v; i=k; toks.push({k:'word',v:w,quoted:true}); continue; }
    if(w==='-'||w==='!'){toks.push({k:'not'});continue}
    if(w.length>1 && (w[0]==='-'||w[0]==='!')){toks.push({k:'not'}); w=w.slice(1);}
    const up=w.toUpperCase();
    if(['АБО','OR','|','||'].includes(up)) toks.push({k:'or'});
    else if(['І','ТА','AND','&','&&'].includes(up)) toks.push({k:'and'});
    else if(['НЕ','NOT'].includes(up)) toks.push({k:'not'});
    else toks.push({k:'word',v:w});
  }
  return toks;
}

/* ---------- умови ---------- */
const cmp=(op,a,b)=>op==='<'?a<b:op==='<='?a<=b:op==='>'?a>b:op==='>='?a>=b:a===b;
const fieldList=()=>FIELD_ORDER.map(x=>fieldName(x)).join(', ');
const shown=(f,c)=>{ // значення поля картки для пояснень
  const v=cardVal(c,f);
  return `${fieldName(f)}: ${v===''||v==null?'—':valName(f,v)}`;
};

function fieldTerm(rawName,rawVal){
  const f=FIELDS[norm(rawName)];
  if(!f) throw E('err.field',{name:rawName,list:fieldList()});
  if(!rawVal) throw E('err.noval',{name:rawName});
  if(f==='sim') return simTerm(rawVal);
  const m=rawVal.match(/^(<=|>=|<|>|=)?(.*)$/); const op=m[1]||'='; const v=m[2];
  if(!v) throw E('err.noval',{name:rawName+':'+op});
  const range = v.includes('..') ? v.split('..') : null;
  if(range && (op!=='=' || range.length!==2 || !range[0] || !range[1])) throw E('err.range',{ex:T('інфо:2..3')});
  const R=(test)=>({test,actual:c=>shown(f,c)});

  if(CATS[f]){
    if(op!=='='||range) throw E('err.unordered',{f:fieldName(f)});
    const val=CATS[f][norm(v)];
    if(!val) throw E('err.value',{v,f:fieldName(f),list:Object.keys(EN_VAL[f]).map(x=>valName(f,x)).join(', ')});
    return R(c=>cardVal(c,f)===val);
  }
  if(f==='src'){
    const conv=x=>{const L=normLetter(x); if(!/^[A-F]$/.test(L)) throw E('err.src'); return L;};
    if(range){const a=conv(range[0]),b=conv(range[1]); return R(c=>c.src>=a&&c.src<=b);}
    const L=conv(v); return R(c=>cmp(op,c.src,L));
  }
  if(f==='info'){
    const conv=x=>{if(!/^[1-6]$/.test(x)) throw E('err.info'); return +x;};
    if(range){const a=conv(range[0]),b=conv(range[1]); return R(c=>c.info>=a&&c.info<=b);}
    const n=conv(v); return R(c=>cmp(op,c.info,n));
  }
  if(f==='rating'){
    if(op!=='='||range) throw E('err.rating',{a:fieldName('src'),b:fieldName('info'),ex:T('джерело:<=B інфо:<=2')});
    const s=normLetter(v); if(!/^[A-F][1-6]$/.test(s)) throw E('err.ratingfmt');
    return R(c=>c.src===s[0]&&c.info===+s[1]);
  }
  if(f==='date'||f==='shot'){
    const ok=x=>{if(!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(x)) throw E('err.date'); return x;};
    const get=c=>cardVal(c,f)||'';
    if(range){const a=ok(range[0]),b=ok(range[1]); return R(c=>!!get(c)&&get(c)>=a&&get(c).slice(0,b.length)<=b);}
    const d=ok(v);
    if(op==='=') return R(c=>!!get(c)&&get(c).startsWith(d));
    return R(c=>!!get(c)&&cmp(op,get(c).slice(0,d.length),d));
  }
  if(f==='img'){
    if(op!=='='||range) throw E('err.unordered',{f:fieldName(f)});
    const h=v.replace(/^#/,'').toUpperCase();
    if(!/^[0-9A-F]{3}$/.test(h)) throw E('err.img');
    return R(c=>cardVal(c,'img')===h);
  }
  if(f==='sq'){
    const conv=x=>{if(!/^\d{4}$/.test(x)) throw E('err.sq'); return [+x.slice(0,2),+x.slice(2)];};
    const get=c=>c.sq?[+c.sq.slice(0,2),+c.sq.slice(2)]:null;
    if(op!=='=') throw E('err.unordered',{f:fieldName(f)});
    if(range){const [e1,n1]=conv(range[0]),[e2,n2]=conv(range[1]);
      return R(c=>{const s=get(c); return !!s&&s[0]>=Math.min(e1,e2)&&s[0]<=Math.max(e1,e2)&&s[1]>=Math.min(n1,n2)&&s[1]<=Math.max(n1,n2);});}
    conv(v); return R(c=>c.sq===v);
  }
}

/* ---------- пошук за схожістю (TF–IDF) ---------- */
const SIM_MIN = 0.3;
const STOP = new Set(['на','в','у','з','із','зі','до','про','біля','для','та','і','й','а','що','як','по','від','над','під','через','після','щодо','за']);
const stem = w => w.replace(/(ами|ями|ові|еві|ого|ому|ими|ій|ий|ою|ею|ах|ях|ом|ем|ів|ам|ям|у|ю|а|я|о|е|і|и|ь|й)$/,'').slice(0,7);
const words = s => norm(s).split(/[^a-zа-яіїєґ']+/).filter(w=>w&&!STOP.has(w)).map(stem).filter(w=>w.length>1);
let LAST_SIM = null; // Map id → схожість для останнього запиту з «схоже:»
function tfidf(docs,query){
  const D=docs.map(d=>words(d.text)), N=D.length, df={};
  D.forEach(ws=>new Set(ws).forEach(w=>df[w]=(df[w]||0)+1));
  const idf=w=>Math.log((N+1)/((df[w]||0)+1))+1;
  const vec=ws=>{const v={}; ws.forEach(w=>v[w]=(v[w]||0)+1); let n=0;
    for(const w in v){v[w]*=idf(w); n+=v[w]*v[w];} n=Math.sqrt(n)||1; for(const w in v) v[w]/=n; return v;};
  const qv=vec(words(query)), res=new Map();
  docs.forEach((d,i)=>{const dv=vec(D[i]); let s=0; for(const w in qv) if(dv[w]) s+=qv[w]*dv[w]; res.set(d.id,s);});
  return res;
}
function simTerm(text){
  if(!words(text).length) throw E('err.sim');
  const scores=tfidf(cards.map(c=>({id:c.id,text:c.title})),text);
  LAST_SIM=scores;
  return {test:c=>(scores.get(c.id)||0)>=SIM_MIN, actual:c=>t('why.simv',{s:(scores.get(c.id)||0).toFixed(2),min:SIM_MIN.toFixed(2)}), sim:true};
}

/* ---------- парсер у дерево ---------- */
function term(tok){
  const w=tok.v, k=w.indexOf(':');
  if(k>0){ const r=fieldTerm(w.slice(0,k),w.slice(k+1)); return {k:'leaf',text:tok.quoted?`${w.slice(0,k+1)}"${w.slice(k+1)}"`:w,...r}; }
  if(k===0) throw E('err.colon');
  const v=norm(w);
  return {k:'leaf',text:w,text0:true,test:c=>norm(c.title).includes(v),actual:()=>t('why.notitle',{q:w})};
}
function parse(q){
  LAST_SIM=null;
  const toks=tokenize(q); let p=0;
  if(!toks.length) return null;
  const peek=()=>toks[p];
  const startsUnary=x=>x&&(x.k==='and'||x.k==='not'||x.k==='word'||x.k==='phrase'||x.k==='(');
  function parseOr(){ let l=parseAnd(); while(peek()&&peek().k==='or'){p++; l={k:'or',a:l,b:parseAnd()};} return l; }
  function parseAnd(){ let l=parseUnary(); while(startsUnary(peek())){ if(peek().k==='and') p++; l={k:'and',a:l,b:parseUnary()}; } return l; }
  function parseUnary(){
    const x=peek();
    if(!x) throw E('err.dangling');
    if(x.k==='not'){p++; return {k:'not',a:parseUnary()};}
    if(x.k==='('){p++; const f=parseOr(); if(!peek()||peek().k!==')') throw E('err.paren'); p++; return f;}
    if(x.k===')') throw E('err.extraparen');
    if(x.k==='or') throw E('err.or',{op:OPS[cmd()].or});
    if(x.k==='and') throw E('err.and',{op:OPS[cmd()].and});
    p++;
    if(x.k==='phrase'){ const v=norm(x.v); if(!v.trim()) throw E('err.emptyq');
      return {k:'leaf',text:`"${x.v}"`,text0:true,test:c=>norm(c.title).includes(v),actual:()=>t('why.notitle',{q:x.v})}; }
    return term(x);
  }
  const f=parseOr();
  if(p<toks.length) throw E(toks[p].k===')'?'err.extraparen':'err.parse');
  return f;
}
const run=(n,c)=>n.k==='leaf'?n.test(c):n.k==='and'?run(n.a,c)&&run(n.b,c):n.k==='or'?run(n.a,c)||run(n.b,c):!run(n.a,c);

/* ---------- пояснення ---------- */
const label=n=>n.k==='leaf'?n.text:n.k==='and'?`${label(n.a)} ${label(n.b)}`:n.k==='or'?`(${label(n.a)} АБО ${label(n.b)})`:`-${label(n.a)}`;
const orParts=n=>n.k==='or'?[...orParts(n.a),...orParts(n.b)]:[n];
// Чому вузол НЕ виконується для картки: список коротких причин.
function whyNot(n,c){
  if(n.k==='leaf') return [t('why.leaf',{q:T(n.text),v:n.actual(c)})];
  if(n.k==='and') return [...(run(n.a,c)?[]:whyNot(n.a,c)),...(run(n.b,c)?[]:whyNot(n.b,c))];
  if(n.k==='or') return [t('why.or',{list:orParts(n).map(x=>'«'+T(label(x).replace(/^\((.*)\)$/,'$1'))+'»').join(' / ')})];
  return [t('why.not',{q:T(label(n.a))})];
}

/* ---------- переклад команд ---------- */
// Перекладає оператори, назви полів і значення; текст для пошуку в заголовку не змінюється.
function toLang(q,lang){
  return q.replace(/"[^"]*"|«[^»]*»|[^\s()"«»]+/g,w=>{
    if(/^["«]/.test(w)) return w;
    const neg=w.length>1&&/^[-!]/.test(w)?w[0]:''; const b=w.slice(neg.length);
    const up=b.toUpperCase();
    if(up==='АБО'||up==='OR') return neg+OPS[lang].or;
    if(up==='І'||up==='ТА'||up==='AND') return neg+OPS[lang].and;
    if(up==='НЕ'||up==='NOT') return neg+OPS[lang].not;
    const k=b.indexOf(':'); if(k<=0) return w;
    const f=FIELDS[norm(b.slice(0,k))]; if(!f) return w;
    let v=b.slice(k+1);
    const canon=CATS[f]&&CATS[f][norm(v)];
    if(canon){const tr=valName(f,canon,lang); v=v===v.toLowerCase()?tr.toLowerCase():tr;}
    return neg+fieldName(f,lang)+':'+v;
  });
}
function T(q){return toLang(q,cmd());}
// Для фрагментів <code> у тексті уроку: окремі назви полів і значення теж перекладаються.
function codeLang(x){
  if(cmd()==='ua') return x;
  if(x==='поле:значення') return 'field:value';
  if(FIELDS[norm(x)]) return fieldName(FIELDS[norm(x)],'en');
  for(const f in EN_VAL) if(x in EN_VAL[f]) return EN_VAL[f][x];
  return toLang(x,'en');
}
