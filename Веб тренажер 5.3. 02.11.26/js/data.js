/* ================== ДАНІ НАВЧАЛЬНОГО СЦЕНАРІЮ ==================
   Усі дані вигадані. Рядок картки:
   тип|оцінка|район|дата|мова|пріоритет|заголовок|техніка|додатково
   «додатково»: sq=квадрат кілометрової сітки; img=ключ знімка, якщо він повторює чужий;
   shot=дата зйомки з метаданих; meta=стан метаданих (є / видалено / змінено). */
const POOL_RAW = `
фото|B2|Схід|2026-10-18|укр|високий|Колона вантажівок біля мосту|вантажівка|sq=4510
звіт|A1|Північ|2026-10-03|укр|середній|Щотижневий звіт про обстановку
відео|C3|Південь|2026-10-10|англ|низький|Рух колони на світанку|вантажівка
допис|F6|Схід|2026-10-20|укр|низький|Очевидець: чути вибухи біля мосту||sq=4510
фото|D4|Захід|2026-10-07|укр|низький|Пошкоджений міст через річку
звіт|B2|Схід|2026-10-25|укр|високий|Пункт пропуску закрито||sq=4712
аудіо|C2|Північ|2026-10-15|інша|середній|Запис радіоефіру поблизу порту
карта|A2|Південь|2026-10-28|укр|середній|Оновлена схема доріг району
звіт|E5|Захід|2026-10-09|англ|низький|Чернетка: аналіз логістики
фото|A1|Схід|2026-10-29|укр|високий|Скупчення техніки в лісосмузі|танк|sq=4309
відео|B3|Схід|2026-10-22|англ|середній|Черга на пункт пропуску
допис|D5|Південь|2026-10-05|укр|низький|Міст закрито для руху
звіт|C3|Північ|2026-10-20|укр|середній|Чернетка: обстановка в порту
фото|F3|Південь|2026-10-26|англ|середній|Супутниковий знімок порту
аудіо|B1|Схід|2026-10-30|укр|високий|Доповідь про рух колони||sq=4511
карта|D2|Захід|2026-10-11|укр|низький|Схема пункту пропуску
допис|A6|Північ|2026-10-24|англ|середній|Агенція: новий пункт пропуску
відео|E2|Захід|2026-10-16|укр|середній|Ремонт мосту триває
звіт|A2|Південь|2026-10-31|англ|високий|Звіт партнерів про ситуацію в порту
фото|C6|Північ|2026-10-02|інша|низький|Невідома техніка на узбіччі|бтр
допис|B4|Схід|2026-10-27|укр|середній|Волонтери: евакуація триває
звіт|D3|Схід|2026-10-14|укр|низький|Евакуація населення з району
відео|A1|Північ|2026-10-21|укр|високий|Колона техніки, зйомка з дрона|бтр
фото|B5|Південь|2026-10-13|укр|низький|Мости після паводку
аудіо|F6|Захід|2026-10-08|інша|низький|Запис невідомого походження
карта|B2|Схід|2026-10-30|укр|високий|Маршрут руху колони||sq=4510
допис|C1|Південь|2026-10-17|англ|середній|Журналіст: порт працює
звіт|B2|Захід|2026-10-23|укр|середній|Чернетка: оцінка мостів району
фото|E4|Схід|2026-10-06|укр|низький|Пропуску немає: пункт спостереження перенесено
відео|D6|Південь|2026-10-29|англ|середній|Порт у соцмережах: відео з причалу
допис|A2|Схід|2026-10-28|укр|середній|Офіційний канал: ситуація стабільна
фото|B2|Схід|2026-10-27|укр|високий|Техніка на розмоклій ґрунтовій дорозі|танк|sq=4511
фото|A1|Південь|2026-10-12|укр|середній|Стрільба на полігоні|танк
фото|B2|Схід|2026-10-24|укр|високий|Позиція біля лісосмуги, видно постріл|сау|sq=4511
фото|C3|Схід|2026-10-19|англ|середній|Колісна машина біля адмінбудівлі|бтр|sq=4713
фото|B3|Північ|2026-10-22|укр|середній|Замаскована техніка в посадці|сау
фото|A2|Південь|2026-10-26|укр|високий|Пуск з позиції в полі|рсзв
відео|B2|Схід|2026-10-28|укр|високий|Серія пусків, зйомка з укриття|рсзв
фото|C2|Захід|2026-10-15|укр|низький|Транспорт на вулиці міста|вантажівка
фото|D3|Північ|2026-10-18|укр|низький|Апарат у транспортному кейсі|бпла|meta=видалено;shot=2026-10-17
фото|B1|Південь|2026-10-21|англ|середній|Апарат на злітній смузі|бпла
фото|A2|Схід|2026-10-29|укр|високий|Запуск з рук у полі|бпла|meta=видалено;shot=2026-10-29
відео|C2|Північ|2026-10-16|англ|середній|Рух гусеничної техніки по піску|танк
звіт|A2|Схід|2026-10-25|укр|середній|Довідка щодо застосування БПЛА
фото|F3|Захід|2026-10-09|інша|низький|Знімок з виставки, джерело невідоме|бпла|meta=є;shot=2021-10-12
фото|B2|Схід|2026-10-30|укр|високий|Укриття в траншеї під маскувальною сіткою|танк|sq=4410
фото|B2|Схід|2026-10-23|укр|середній|Машина з протикумулятивними ґратами|бтр|sq=4612
відео|A1|Південь|2026-10-31|англ|високий|Пуск, зйомка з дистанції|рсзв
фото|B2|Схід|2026-10-26|укр|високий|Зенітна установка біля переправи|ппо|sq=4510
фото|A2|Північ|2026-10-14|укр|середній|Пускова установка на гусеничному шасі|ппо
фото|C3|Південь|2026-10-08|англ|низький|Колона пускових установок на марші|ппо
фото|B2|Схід|2026-10-27|укр|високий|Пара гвинтокрилів над полем|гелікоптер|sq=4612
фото|A1|Захід|2026-10-11|укр|середній|Гвинтокрил на майданчику|гелікоптер
фото|C2|Північ|2026-10-19|англ|середній|Десантування з борту|гелікоптер
допис|E5|Схід|2026-10-29|укр|високий|Канал: «танки щойно зайшли в село»|танк|img=c10;shot=2025-03-14;meta=видалено
допис|D4|Південь|2026-10-30|англ|середній|Репост: «удар по позиціях сьогодні»|танк|img=c33;shot=2026-10-12;meta=змінено
фото|B2|Схід|2026-10-28|укр|середній|Знімок очевидця з місця пуску|рсзв|img=c37;shot=2026-10-26;meta=є
допис|C3|Схід|2026-10-21|укр|середній|Очевидець: техніка на трасі|вантажівка|img=c39;shot=2026-10-20;meta=є
допис|F6|Північ|2026-10-24|інша|високий|Анонімний канал: «нова техніка на кордоні»|бтр|img=c20;shot=2024-08-02;meta=змінено
фото|C3|Захід|2026-10-13|укр|низький|Архівний знімок колони|вантажівка|img=c01;shot=2019-08-24;meta=є`;

// Переклад заголовків для англійського інтерфейсу (пошук за текстом іде за українським оригіналом).
const TITLE_EN = ['',
 'Truck convoy near the bridge','Weekly situation report','Convoy on the move at dawn','Eyewitness: explosions heard near the bridge',
 'Damaged bridge over the river','Checkpoint closed','Radio traffic recorded near the port','Updated road map of the area',
 'Draft: logistics analysis','Vehicles massing in a tree line','Queue at the checkpoint','Bridge closed to traffic',
 'Draft: situation at the port','Satellite image of the port','Report on convoy movement','Checkpoint diagram',
 'Agency: new checkpoint','Bridge repairs continue','Partners’ report on the situation at the port','Unknown vehicle on the roadside',
 'Volunteers: evacuation continues','Evacuation of residents from the area','Vehicle convoy, drone footage','Bridges after the flood',
 'Recording of unknown origin','Convoy route','Journalist: the port is operating','Draft: assessment of bridges in the area',
 'No passage: observation post relocated','Port on social media: video from the pier','Official channel: situation stable','Vehicle on a muddy dirt road',
 'Live firing at a training range','Position near a tree line, shot visible','Wheeled vehicle near an administrative building','Camouflaged vehicle in a tree line',
 'Launch from a field position','Series of launches, filmed from cover','Vehicle on a city street','Aircraft in a transport case',
 'Aircraft on a runway','Hand launch in a field','Tracked vehicle moving across sand','Briefing note on UAV use',
 'Photo from an exhibition, source unknown','Shelter in a trench under camouflage netting','Vehicle with slat armour','Launch, filmed from a distance',
 'Anti-aircraft gun near the river crossing','Launcher on a tracked chassis','Column of launchers on the march','Two rotorcraft over a field',
 'Rotorcraft on a landing pad','Troops fast-roping from the aircraft','Channel: “tanks have just entered the village”','Repost: “positions struck today”',
 'Eyewitness photo from the launch site','Eyewitness: vehicles on the highway','Anonymous channel: “new vehicles at the border”','Archive photo of a convoy'];

const MED = typeof MEDIA!=='undefined' ? MEDIA : {}; // media/credits.js
const mkey = id => 'c'+String(id).padStart(2,'0');
// «Відбиток» знімка: три шістнадцяткові символи, однакові для однакових зображень.
const fingerprint = key => { let h=2166136261; for(const ch of key){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return (h%4096).toString(16).toUpperCase().padStart(3,'0'); };

const POOL = POOL_RAW.trim().split('\n').map((l,i)=>{
  const [type,r,reg,date,lang,pri,title,equip='',extra='']=l.split('|');
  const x=Object.fromEntries(extra.split(';').filter(Boolean).map(kv=>kv.split('=')));
  const id=i+1, mk=x.img||mkey(id), media=MED[mk]?mk:null;
  return {id,type,src:r[0],info:+r[1],reg,date,lang,pri,title,titleEn:TITLE_EN[id]||'',equip,
    sq:x.sq||'',shot:x.shot||'',meta:x.meta||'',media,img:media?fingerprint(media):''};
});
const byId = id => POOL[id-1];
const cardVal = (c,f) => c[f];

const SRC_TXT = {ua:{A:'повністю надійне',B:'зазвичай надійне',C:'досить надійне',D:'зазвичай ненадійне',E:'ненадійне',F:'неможливо оцінити'},
  en:{A:'completely reliable',B:'usually reliable',C:'fairly reliable',D:'not usually reliable',E:'unreliable',F:'reliability cannot be judged'}};
const INFO_TXT = {ua:{1:'підтверджена',2:'ймовірно правдива',3:'можливо правдива',4:'сумнівна',5:'малоймовірна',6:'неможливо оцінити'},
  en:{1:'confirmed by other sources',2:'probably true',3:'possibly true',4:'doubtful',5:'improbable',6:'truth cannot be judged'}};

// Довідник розпізнавання: еталонний знімок (media/img/ref-*.jpg) і ознаки.
const EQ_INFO = {
  'танк':{ref:'ref-tank',name:'Танк',nameEn:'Tank',f:'Гусениці, башта посередині корпусу, довга тонка гармата далеко виступає вперед.',fEn:'Tracks, turret in the middle of the hull, a long thin gun projecting far forward.'},
  'бтр':{ref:'ref-apc',name:'БТР',nameEn:'APC',f:'Колеса (у БТР-4 їх вісім), високий коробчастий корпус, невеликий бойовий модуль.',fEn:'Wheels (eight on the BTR-4), a tall box-shaped hull, a small weapon station.'},
  'сау':{ref:'ref-spg',name:'САУ',nameEn:'SPG',f:'Гусениці, як у танка, але башта велика й зміщена назад, гармата коротша й товща.',fEn:'Tracks like a tank, but a large turret set to the rear and a shorter, thicker gun.'},
  'рсзв':{ref:'ref-mlrs',name:'РСЗВ',nameEn:'MLRS',f:'Шасі вантажівки, замість кузова пакет труб-напрямних. Пуск залишає довгі димні сліди.',fEn:'Truck chassis with a pack of launch tubes instead of a cargo bed. Launches leave long smoke trails.'},
  'вантажівка':{ref:'ref-truck',name:'Вантажівка',nameEn:'Truck',f:'Кабіна й кузов під тентом, озброєння немає. Основа колон забезпечення.',fEn:'Cab and a covered cargo bed, no armament. The backbone of supply convoys.'},
  'бпла':{ref:'ref-uav',name:'БПЛА',nameEn:'UAV',f:'Літальний апарат без кабіни пілота, довге крило. Злітає зі смуги, з катапульти або з рук.',fEn:'An aircraft without a pilot’s cockpit, long wings. Takes off from a runway, a catapult or by hand.'},
  'ппо':{ref:'ref-sam',name:'ППО',nameEn:'Air defence',f:'Зенітні гармати з радаром або великі ракети в транспортно-пускових контейнерах, спрямовані вгору.',fEn:'Anti-aircraft guns with a radar, or large missiles in launch canisters pointing upwards.'},
  'гелікоптер':{ref:'ref-heli',name:'Гелікоптер',nameEn:'Helicopter',f:'Несучий гвинт над кабіною, хвостова балка з малим гвинтом. Зависає й сідає на майданчик.',fEn:'Main rotor above the cabin, tail boom with a small rotor. Hovers and lands on a pad.'}
};

/* Карта ділянки «Схід»: кілометрова сітка, стовпці 41–48 (схід), рядки 08–13 (північ). Населені пункти вигадані. */
const MAP = {e0:41,e1:48,n0:8,n1:13,
  places:[{e:42.3,n:12.5,ua:'Вербівка',en:'Verbivka'},{e:45.7,n:9.7,ua:'Кам\'яний Брід',en:'Kamianyi Brid'},{e:47.2,n:9.3,ua:'Озерне',en:'Ozerne'}]};

/* ================== РІВНІ ==================
   Тексти уроків українською (body) та англійською (bodyEn). Команди в <code> записано українською:
   під час показу їх перекладає перемикач мови команд. {ADM_SRC}, {ADM_INFO}, {SIM} підставляються. */
const LEVELS = [
 {part:'Поля та ключові слова', partEn:'Fields and keywords', key:'fields',
  title:'Вибірка за типом матеріалу', titleEn:'Selecting by material type',
  task:'Відберіть усі фотоматеріали', taskEn:'Select all photo materials', syntax:'тип:фото',
  cards:[1,2,5,9,10,13,24], sol:'тип:фото',
  body:`<p>Кожна картка в картотеці має <b>поля</b>: тип, район, дата, мова, пріоритет та оцінка джерела. Запит <code>поле:значення</code> відбирає картки з потрібним значенням поля.</p><p>Типи матеріалів: <code>звіт</code>, <code>фото</code>, <code>відео</code>, <code>аудіо</code>, <code>допис</code>, <code>карта</code>.</p><p>Поки ви друкуєте, картки, що відповідають запиту, підсвічуються зеленим. Enter перевіряє відповідь.</p>`,
  bodyEn:`<p>Every card in the card index has <b>fields</b>: type, region, date, language, priority and the source assessment. The query <code>поле:значення</code> selects cards with the required field value.</p><p>Material types: <code>звіт</code>, <code>фото</code>, <code>відео</code>, <code>аудіо</code>, <code>допис</code>, <code>карта</code>.</p><p>As you type, the cards matching the query are highlighted in green. Enter checks the answer.</p>`,
  ex:[['тип:звіт','усі звіти','all reports'],['тип:карта','усі карти й схеми','all maps and schemes']],
  hints:[['Подивіться на іконки й підписи вгорі карток: усі картки, що підстрибують, мають однаковий тип.','Look at the icons and labels at the top of the cards: all the bouncing cards are the same type.'],
   ['Потрібне поле {{тип:}}. Між назвою поля і значенням ставиться двокрапка без пробілу.','You need the {{тип:}} field. A colon goes between the field name and the value, with no space.'],
   ['Запит має вигляд {{тип:…}}, де замість «…» назва типу матеріалу.','The query looks like {{тип:…}}, with the material type instead of «…».']]},

 {title:'Вибірка за районом', titleEn:'Selecting by region',
  task:'Відберіть усі матеріали з району «Схід»', taskEn:'Select all materials from the “East” region', syntax:'район:Схід',
  cards:[1,2,4,7,10,14,21,19], sol:'район:Схід',
  body:`<p>Так само працюють інші поля. Район відповідальності: <code>Північ</code>, <code>Південь</code>, <code>Схід</code>, <code>Захід</code>.</p><p>Великі й малі літери значення не мають: <code>район:схід</code> теж спрацює.</p>`,
  bodyEn:`<p>Other fields work the same way. Areas of responsibility: <code>Північ</code>, <code>Південь</code>, <code>Схід</code>, <code>Захід</code>.</p><p>Letter case does not matter: <code>район:схід</code> works too.</p>`,
  ex:[['район:Захід','усе із заходу','everything from the West'],['мова:англ','англомовні матеріали','English-language materials']],
  hints:[['Усі потрібні картки з одного району. Перевірте нижній рядок карток або облікові записи.','All the required cards come from one region. Check the bottom line of the cards or the records.'],
   ['Використайте поле {{район:}}.','Use the {{район:}} field.'],
   ['Значення поля — назва району: {{район:…}}. Регістр літер не важливий.','The value is the name of the region: {{район:…}}. Letter case does not matter.']]},

 {title:'Пошук за основою слова', titleEn:'Searching by word stem',
  task:'Знайдіть усі матеріали, де згадано колону', taskEn:'Find all materials that mention a convoy', syntax:'колон',
  cards:[1,3,15,5,10,6,22], sol:'колон',
  body:`<p>Слово без поля шукається в заголовку картки як <b>частина тексту</b>.</p><p>Українська мова відмінюється: «колона», «колони», «колону». Запит <code>колона</code> пропустить половину матеріалів. Шукайте за <b>основою</b> слова без закінчення.</p>`,
  bodyEn:`<p>A word without a field is matched against the card title as <b>part of the text</b>.</p><p>The materials are in Ukrainian, and Ukrainian nouns change their endings: «колона», «колони», «колону» (convoy). The query <code>колона</code> would miss half of them. Search by the <b>stem</b> of the word, without the ending. Free-text search always uses the original Ukrainian words.</p>`,
  ex:[['евакуац','евакуація, евакуації, евакуацію','evacuation in any form'],['порт','порт, порту, портом','port in any form']],
  hints:[['Слово «колона» в заголовках стоїть у різних формах: «колона», «колони», «колону».','The word «колона» (convoy) appears in different forms in the titles: «колона», «колони», «колону».'],
   ['Пошук без поля перевіряє частину заголовка, тож закінчення можна відкинути. Текст для пошуку завжди пишеться українською.','A search without a field matches part of the title, so you can drop the ending. Search text is always written in Ukrainian.'],
   ['Залиште тільки спільну основу всіх форм: п\'ять літер.','Keep only the stem common to all forms: five letters.']]},

 {title:'Точна фраза', titleEn:'Exact phrase',
  task:'Знайдіть матеріали саме про «пункт пропуску»', taskEn:'Find materials specifically about the «пункт пропуску» (checkpoint)', syntax:'"пункт пропуску"',
  cards:[6,11,16,17,29,2], sol:'"пункт пропуску"',
  body:`<p>Кілька слів без лапок шукаються <b>окремо</b>: <code>пункт пропуску</code> знайде й «Пропуску немає: пункт спостереження…», бо там є обидва слова.</p><p>Фраза в лапках <code>"…"</code> шукається як точний фрагмент тексту, з тими ж закінченнями і в тому ж порядку.</p>`,
  bodyEn:`<p>Several words without quotes are searched <b>separately</b>: <code>пункт пропуску</code> also finds «Пропуску немає: пункт спостереження…», because both words occur there.</p><p>A phrase in quotes <code>"…"</code> is searched as an exact text fragment, with the same endings and in the same order.</p>`,
  ex:[['"ремонт мосту"','саме ця фраза','this exact phrase'],['"зйомка з дрона"','точний збіг','exact match']],
  hints:[['Спробуйте {{пункт пропуску}} без лапок і подивіться, яка зайва картка підсвітилась.','Try {{пункт пропуску}} without quotes and see which extra card lights up.'],
   ['Зайва картка містить обидва слова, але не поруч і не в тій формі.','The extra card contains both words, but not next to each other and not in that form.'],
   ['Візьміть фразу в подвійні лапки: {{"…"}}.','Put the phrase in double quotes: {{"…"}}.']]},

 {title:'Кілька умов одночасно (І)', titleEn:'Several conditions at once (AND)',
  task:'Відберіть відео, на яких є колона', taskEn:'Select videos that show a convoy', syntax:'тип:відео колон',
  cards:[3,23,1,15,11,18,26], sol:'тип:відео колон',
  body:`<p>Умови, записані через пробіл, мають виконуватися <b>всі одночасно</b>. Це логічне «І». Можна писати явно: <code>І</code>, <code>ТА</code> або <code>AND</code>.</p><p>Кожна нова умова <b>звужує</b> вибірку.</p>`,
  bodyEn:`<p>Conditions separated by a space must <b>all</b> be met at the same time. This is logical AND. You can also write it explicitly: <code>І</code>, <code>ТА</code> or <code>AND</code>.</p><p>Each new condition <b>narrows</b> the selection.</p>`,
  ex:[['тип:фото район:Схід','фото зі Сходу','photos from the East'],['тип:звіт І порт','звіти про порт','reports about the port']],
  hints:[['Потрібні дві умови: тип матеріалу та слово в заголовку.','You need two conditions: the material type and a word in the title.'],
   ['Умову за типом ви знаєте з рівня 1, а основу слова «колона» з рівня 3.','You know the type condition from level 1, and the stem of «колона» from level 3.'],
   ['Запишіть обидві умови через пробіл: {{тип:відео …}}.','Write both conditions separated by a space: {{тип:відео …}}.']]},

 {part:'Логічні оператори', partEn:'Logical operators', key:'logic',
  title:'Будь-яка з умов (АБО)', titleEn:'Either condition (OR)',
  task:'Відберіть усі фото- та відеоматеріали', taskEn:'Select all photo and video materials', syntax:'тип:фото АБО тип:відео',
  cards:[3,1,2,11,7,14,8,17], sol:'тип:фото АБО тип:відео',
  body:`<p><code>АБО</code> (чи <code>OR</code>) відбирає картки, що відповідають <b>хоча б одній</b> з умов. Кожне «АБО» <b>розширює</b> вибірку.</p><p>Типова помилка: <code>тип:фото тип:відео</code> без «АБО» вимагає, щоб картка була водночас і фото, і відео. Таких немає.</p>`,
  bodyEn:`<p><code>АБО</code> (or <code>OR</code>) selects cards that match <b>at least one</b> condition. Each OR <b>widens</b> the selection.</p><p>A common mistake: <code>тип:фото тип:відео</code> without OR requires a card to be a photo and a video at the same time. There are no such cards.</p>`,
  ex:[['район:Схід АБО район:Південь','обидва райони','both regions'],['тип:аудіо АБО тип:відео','аудіо- та відеозаписи','audio and video recordings']],
  hints:[['Жодна картка не буває водночас фото і відео. Умови треба не звужувати, а об\'єднати.','No card is both a photo and a video. The selection needs to be widened, not narrowed.'],
   ['Між умовами поставте оператор {{АБО}}.','Put the {{АБО}} operator between the conditions.'],
   ['Запит має вигляд {{тип:фото АБО тип:…}}.','The query looks like {{тип:фото АБО тип:…}}.']]},

 {title:'Чергування голосних', titleEn:'Vowel alternation',
  task:'Знайдіть усі матеріали про мости', taskEn:'Find all materials about bridges', syntax:'міст АБО мост',
  cards:[5,12,1,24,14,22,10], sol:'міст АБО мост',
  body:`<p>В українській основа слова може змінюватися: <b>міст</b> → <b>мосту</b>, <b>мости</b>, <b>мостів</b>. Одна основа всіх форм не охоплює.</p><p>Об'єднайте варіанти через <code>АБО</code>. Так само: «ріг/рогу», «віз/воза», «Київ/Києва».</p>`,
  bodyEn:`<p>In Ukrainian the vowel inside a word stem can change: <b>міст</b> (bridge) → <b>мосту</b>, <b>мости</b>, <b>мостів</b>. A single stem cannot cover every form.</p><p>Combine the variants with <code>АБО</code>. The same applies to «ріг/рогу» (corner), «віз/воза» (cart) and «Київ/Києва» (Kyiv).</p>`,
  ex:[['ріг АБО рог','ріг, рогу, роги','all forms of «ріг» (corner)'],['Київ АБО Києв','Київ, Києва, Києві','all forms of «Київ» (Kyiv)']],
  hints:[['Порівняйте «міст» і «мосту»: голосна в основі змінюється.','Compare «міст» and «мосту»: the vowel in the stem changes.'],
   ['Однієї основи не вистачить. Потрібні дві: з «і» та з «о».','One stem is not enough. You need two: with «і» and with «о».'],
   ['Об\'єднайте їх: {{міст АБО …}}.','Combine them: {{міст АБО …}}.']]},

 {title:'Виключення (НЕ)', titleEn:'Exclusion (NOT)',
  task:'Відберіть звіти, окрім чернеток', taskEn:'Select reports, excluding drafts', syntax:'тип:звіт -чернетка',
  cards:[2,9,13,6,19,28,4], sol:'тип:звіт -чернетка',
  body:`<p>Мінус перед умовою (без пробілу) або слово <code>НЕ</code> <b>виключають</b> картки, що їй відповідають.</p><p>Виключення допомагає прибрати шум: чернетки, дублікати, матеріали з непотрібного району.</p>`,
  bodyEn:`<p>A minus before a condition (no space) or the word <code>НЕ</code> <b>excludes</b> the cards that match it.</p><p>Exclusion helps to remove noise: drafts, duplicates and materials from irrelevant regions. The Ukrainian word for draft is «Чернетка».</p>`,
  ex:[['тип:фото -район:Захід','фото з усіх районів, крім Заходу','photos from all regions except the West'],['порт НЕ тип:допис','про порт, але не дописи','about the port, but not posts']],
  hints:[['Спочатку відберіть усі звіти, а потім приберіть зайве.','First select all reports, then remove the extras.'],
   ['Зайві картки мають у заголовку слово «Чернетка».','The extra cards have the word «Чернетка» (draft) in the title.'],
   ['Поставте мінус перед словом без пробілу: {{тип:звіт -…}}.','Put a minus before the word, with no space: {{тип:звіт -…}}.']]},

 {title:'Дужки та пріоритет операцій', titleEn:'Brackets and operator precedence',
  task:'Відберіть фото та відео, але тільки з району «Схід»', taskEn:'Select photos and videos, but only from the “East” region', syntax:'(тип:фото АБО тип:відео) район:Схід',
  cards:[1,10,11,3,14,4,29,21], sol:'(тип:фото АБО тип:відео) район:Схід',
  body:`<p>«І» зв'язує сильніше, ніж «АБО». Тому запит <code>тип:фото АБО тип:відео район:Схід</code> читається як «будь-яке фото <b>АБО</b> відео зі Сходу»: фото з інших районів теж потраплять у вибірку.</p><p>Дужки задають порядок явно: спочатку об'єднуємо типи, потім звужуємо за районом.</p>`,
  bodyEn:`<p>AND binds tighter than OR. So the query <code>тип:фото АБО тип:відео район:Схід</code> reads as “any photo, <b>OR</b> a video from the East”: photos from other regions get in as well.</p><p>Brackets set the order explicitly: first combine the types, then narrow by region.</p>`,
  ex:[['(міст АБО мост) -тип:допис','про мости, без дописів','about bridges, no posts'],['тип:звіт (порт АБО евакуац)','звіти про порт або евакуацію','reports about the port or evacuation']],
  hints:[['Спробуйте {{тип:фото АБО тип:відео район:Схід}}. Чому підсвітились зайві фото?','Try {{тип:фото АБО тип:відео район:Схід}}. Why did extra photos light up?'],
   ['«І» виконується раніше, ніж «АБО», тому район застосувався тільки до відео.','AND is applied before OR, so the region only applied to videos.'],
   ['Візьміть частину з «АБО» в дужки: {{(… АБО …) район:Схід}}.','Put the OR part in brackets: {{(… АБО …) район:Схід}}.']]},

 {part:'Оцінка джерела та інформації', partEn:'Source and information assessment', key:'adm',
  title:'Надійність джерела', titleEn:'Source reliability',
  task:'Відберіть матеріали від повністю надійних джерел', taskEn:'Select materials from completely reliable sources', syntax:'джерело:A',
  cards:[2,10,8,6,15,17,13], sol:'джерело:A',
  body:`<p>Кожен матеріал оцінюється за <b>адміралтейською системою</b> (система НАТО, AJP-2.1): літера оцінює <b>джерело</b>, цифра оцінює саму <b>інформацію</b>. Ці дві оцінки незалежні.</p>{ADM_SRC}<p>Літери можна вводити як латиницею, так і кирилицею.</p>`,
  bodyEn:`<p>Every material is graded using the <b>Admiralty Code</b> (NATO, AJP-2.1): the letter rates the <b>source</b>, the digit rates the <b>information</b> itself. The two grades are independent.</p>{ADM_SRC}<p>Letters can be typed in Latin or Cyrillic.</p>`,
  ex:[['джерело:B','зазвичай надійні джерела','usually reliable sources'],['джерело:A тип:звіт','звіти від повністю надійних джерел','reports from completely reliable sources']],
  hints:[['Надійність джерела позначає літера в кольоровій позначці на картці.','Source reliability is the letter in the coloured badge on the card.'],
   ['Повністю надійне джерело позначається першою літерою шкали.','A completely reliable source is marked with the first letter of the scale.'],
   ['Використайте поле {{джерело:}} з потрібною літерою.','Use the {{джерело:}} field with the right letter.']]},

 {title:'Достовірність інформації', titleEn:'Information credibility',
  task:'Відберіть інформацію, підтверджену іншими джерелами', taskEn:'Select information confirmed by other sources', syntax:'інфо:1',
  cards:[2,15,27,6,3,7,8], sol:'інфо:1',
  body:`<p>Цифра оцінює достовірність самої інформації незалежно від джерела:</p>{ADM_INFO}<p>Зверніть увагу: джерело C (досить надійне) може передати підтверджену інформацію (C1), а надійне джерело може помилитися.</p>`,
  bodyEn:`<p>The digit rates the credibility of the information itself, regardless of the source:</p>{ADM_INFO}<p>Note that a fairly reliable source (C) can pass on confirmed information (C1), and a reliable source can still be wrong.</p>`,
  ex:[['інфо:2','ймовірно правдива','probably true'],['інфо:1 район:Південь','підтверджене з Півдня','confirmed, from the South']],
  hints:[['Цифра в позначці оцінює саму інформацію, а не джерело.','The digit in the badge rates the information itself, not the source.'],
   ['Підтверджена інформація має найкращу оцінку на шкалі 1–6.','Confirmed information has the best grade on the 1–6 scale.'],
   ['Використайте поле {{інфо:}} з потрібною цифрою.','Use the {{інфо:}} field with the right digit.']]},

 {title:'Повна оцінка', titleEn:'Full grade',
  task:'Відберіть матеріали з оцінкою B2', taskEn:'Select materials graded B2', syntax:'оцінка:B2',
  cards:[1,6,26,28,7,8,11,21], sol:'оцінка:B2',
  body:`<p>Поле <code>оцінка</code> перевіряє літеру та цифру разом. <b>B2</b> («зазвичай надійне джерело, інформація ймовірно правдива») є типовим робочим рівнем для доповідей.</p><p>Той самий результат дасть <code>джерело:B інфо:2</code>.</p>`,
  bodyEn:`<p>The <code>оцінка</code> (rating) field checks the letter and the digit together. <b>B2</b> (“usually reliable source, information probably true”) is the typical working level for reports.</p><p><code>джерело:B інфо:2</code> gives the same result.</p>`,
  ex:[['оцінка:A1','найвища оцінка','the highest grade'],['оцінка:C3 АБО оцінка:B3','кілька конкретних оцінок','several specific grades']],
  hints:[['Потрібна точна комбінація літери й цифри.','You need an exact combination of letter and digit.'],
   ['Поле {{оцінка:}} приймає обидві частини разом.','The {{оцінка:}} field takes both parts together.'],
   ['Інший спосіб: дві умови {{джерело:… інфо:…}}.','Another way: two conditions {{джерело:… інфо:…}}.']]},

 {title:'Порівняння: «не гірше ніж»', titleEn:'Comparison: “no worse than”',
  task:'Відберіть матеріали від надійних джерел (A або B)', taskEn:'Select materials from reliable sources (A or B)', syntax:'джерело:<=B',
  cards:[2,6,11,13,22,20,17,9], sol:'джерело:<=B',
  body:`<p>Для впорядкованих полів доступні <code>&lt;</code> <code>&lt;=</code> <code>&gt;</code> <code>&gt;=</code>. Шкала йде від кращого до гіршого: A &lt; B &lt; … &lt; F, 1 &lt; 2 &lt; … &lt; 6.</p><p>Отже, <code>джерело:&lt;=B</code> означає «A або B», тобто не гірше за B.</p>`,
  bodyEn:`<p>Ordered fields support <code>&lt;</code> <code>&lt;=</code> <code>&gt;</code> <code>&gt;=</code>. The scale runs from best to worst: A &lt; B &lt; … &lt; F, 1 &lt; 2 &lt; … &lt; 6.</p><p>So <code>джерело:&lt;=B</code> means “A or B”, i.e. no worse than B.</p>`,
  ex:[['джерело:<C','те саме: A або B','the same: A or B'],['інфо:>=4','сумнівна та гірша інформація','doubtful or worse information']],
  hints:[['Потрібні два значення, A і B. Можна через «АБО», але є коротший запис.','You need two values, A and B. OR works, but there is a shorter notation.'],
   ['Шкала йде від кращого до гіршого: A < B < C. «Не гірше за B» означає «менше або дорівнює B».','The scale runs from best to worst: A < B < C. “No worse than B” means “less than or equal to B”.'],
   ['Знак порівняння ставиться після двокрапки: {{джерело:<=…}}.','The comparison sign goes after the colon: {{джерело:<=…}}.']]},

 {title:'Надійне джерело + правдива інформація', titleEn:'Reliable source + true information',
  task:'Відберіть матеріали: джерело не гірше B, інформація не гірша 2', taskEn:'Select materials: source no worse than B, information no worse than 2', syntax:'джерело:<=B інфо:<=2',
  cards:[2,6,11,17,21,8,13], sol:'джерело:<=B інфо:<=2',
  body:`<p>Надійне джерело ще не гарантує правдивої інформації: A6 означає надійне джерело, але інформацію оцінити неможливо (наприклад, джерело переказує чутки).</p><p>Для доповіді керівництву зазвичай відбирають матеріали, де <b>обидві</b> оцінки досить високі.</p>`,
  bodyEn:`<p>A reliable source does not guarantee true information: A6 means a reliable source whose information cannot be judged (for example, the source is passing on rumours).</p><p>Reports to commanders are usually based on materials where <b>both</b> grades are high enough.</p>`,
  ex:[['джерело:A інфо:<=2','A1 та A2','A1 and A2'],['джерело:<=C інфо:<=3','ширша робоча вибірка','a wider working selection']],
  hints:[['Тут дві незалежні умови: одна для літери, друга для цифри.','There are two independent conditions here: one for the letter, one for the digit.'],
   ['Кожну запишіть через порівняння, як на рівні 13.','Write each with a comparison, as in level 13.'],
   ['Запит має вигляд {{джерело:<=B інфо:<=…}}.','The query looks like {{джерело:<=B інфо:<=…}}.']]},

 {title:'Діапазон значень', titleEn:'Range of values',
  task:'Відберіть інформацію з оцінкою від 2 до 3 включно', taskEn:'Select information graded from 2 to 3 inclusive', syntax:'інфо:2..3',
  cards:[3,7,16,2,24,20,17], sol:'інфо:2..3',
  body:`<p>Запис <code>від..до</code> задає діапазон <b>включно з межами</b>. Він замінює дві умови: <code>інфо:&gt;=2 інфо:&lt;=3</code>.</p><p>Діапазон працює для джерела (<code>джерело:B..D</code>), достовірності та дат.</p>`,
  bodyEn:`<p>The <i>from..to</i> notation sets a range <b>including both bounds</b>. It replaces two conditions: <code>інфо:&gt;=2 інфо:&lt;=3</code>.</p><p>Ranges work for source (<code>джерело:B..D</code>), credibility and dates.</p>`,
  ex:[['джерело:A..C','A, B або C','A, B or C'],['інфо:4..5','сумнівна та малоймовірна','doubtful or improbable']],
  hints:[['Межі діапазону входять у вибірку: потрібні цифри 2 і 3.','The bounds of a range are included: you need digits 2 and 3.'],
   ['Можна записати двома порівняннями, але коротше діапазоном.','It can be written with two comparisons, but a range is shorter.'],
   ['Діапазон записується через дві крапки: {{інфо:від..до}}.','A range is written with two dots: {{інфо:2..3}} means from 2 to 3.']]},

 {title:'«Неможливо оцінити» ≠ «погано»', titleEn:'“Cannot be judged” ≠ “bad”',
  task:'Знайдіть матеріали, які ще неможливо оцінити (джерело F або інформація 6)', taskEn:'Find materials that cannot yet be assessed (source F or information 6)', syntax:'джерело:F АБО інфо:6',
  cards:[4,14,17,2,12,9,22], sol:'джерело:F АБО інфо:6',
  body:`<p><b>F</b> та <b>6</b> означають брак даних для оцінки, а не низьку якість. Нове джерело завжди отримує F, а одиничне повідомлення без підтвердження отримує 6.</p><p>Такі матеріали не відкидають, а передають на <b>додаткову перевірку</b>. Через це запит <code>джерело:&gt;=E</code> для пошуку «ненадійних» помилково захопить і F.</p>`,
  bodyEn:`<p><b>F</b> and <b>6</b> mean there is not enough data for a grade, not that the quality is low. A new source always gets F, and a single unconfirmed report gets 6.</p><p>Such materials are not discarded but sent for <b>further checking</b>. That is why the query <code>джерело:&gt;=E</code> for “unreliable” sources wrongly catches F as well.</p>`,
  ex:[['джерело:E','справді ненадійні джерела','truly unreliable sources'],['інфо:6 -джерело:F','відоме джерело, неперевірена інформація','known source, unverified information']],
  hints:[['«Неможливо оцінити» на шкалі джерела позначається F, на шкалі інформації 6.','“Cannot be judged” is F on the source scale and 6 on the information scale.'],
   ['Картка підходить, якщо виконується хоча б одна з двох умов.','A card fits if at least one of the two conditions holds.'],
   ['Запит має вигляд {{джерело:F АБО інфо:…}}.','The query looks like {{джерело:F АБО інфо:…}}.']]},

 {part:'Час, мова, пріоритет', partEn:'Time, language, priority', key:'time',
  title:'Свіжість інформації', titleEn:'Freshness of information',
  task:'Відберіть матеріали, отримані 25 жовтня 2026 і пізніше', taskEn:'Select materials received on 25 October 2026 or later', syntax:'дата:>=2026-10-25',
  cards:[6,19,3,12,22,9,14], sol:'дата:>=2026-10-25',
  body:`<p>Дати записуються у форматі <code>РРРР-ММ-ДД</code>. Їх можна порівнювати так само, як оцінки.</p><p>Інформація швидко старіє: розвідувальні дані про рух техніки за минулий тиждень можуть уже не відповідати обстановці.</p>`,
  bodyEn:`<p>Dates are written as YYYY-MM-DD. They can be compared just like grades.</p><p>Information goes out of date quickly: last week’s intelligence on vehicle movements may no longer reflect the current situation.</p>`,
  ex:[['дата:2026-10-18','конкретний день','a specific day'],['дата:2026-10','увесь жовтень (початок дати)','the whole of October (date prefix)']],
  hints:[['Дата записується у форматі РРРР-ММ-ДД.','Dates are written as YYYY-MM-DD.'],
   ['«25 жовтня і пізніше» означає «більше або дорівнює».','“25 October or later” means “greater than or equal to”.'],
   ['Запит має вигляд {{дата:>=…}}.','The query looks like {{дата:>=…}}.']]},

 {title:'Період часу', titleEn:'Time period',
  task:'Відберіть матеріали за період з 10 по 20 жовтня 2026 включно', taskEn:'Select materials for the period 10 to 20 October 2026 inclusive', syntax:'дата:2026-10-10..2026-10-20',
  cards:[3,7,9,13,2,23,18,20], sol:'дата:2026-10-10..2026-10-20',
  body:`<p>Діапазон дат охоплює обидві межі. Слідкуйте за граничними днями: матеріали за 9 та 21 жовтня до вибірки не входять.</p>`,
  bodyEn:`<p>A date range includes both bounds. Watch the boundary days: materials from 9 and 21 October are not in the selection.</p>`,
  ex:[['дата:>=2026-10-10 дата:<=2026-10-20','те саме двома умовами','the same with two conditions'],['дата:2026-10-01..2026-10-07','перший тиждень','the first week']],
  hints:[['Потрібен проміжок з двома межами, обидві включно.','You need a period with two bounds, both inclusive.'],
   ['Діапазон дат записується так само, як діапазон оцінок: через дві крапки.','A date range is written like a grade range: with two dots.'],
   ['Запит має вигляд {{дата:2026-10-10..…}}.','The query looks like {{дата:2026-10-10..…}}.']]},

 {title:'Виключення за полем', titleEn:'Excluding by field',
  task:'Відберіть усі матеріали не українською мовою', taskEn:'Select all materials not in Ukrainian', syntax:'-мова:укр',
  cards:[3,7,2,6,10,25], sol:'-мова:укр',
  body:`<p>Мова матеріалу: <code>укр</code>, <code>англ</code>, <code>інша</code>. Іншомовні матеріали зазвичай потребують перекладу, тому їх доручають окремій групі.</p><p>Замість <code>мова:англ АБО мова:інша</code> коротше виключити українську.</p>`,
  bodyEn:`<p>Material language: <code>укр</code>, <code>англ</code>, <code>інша</code>. Foreign-language materials usually need translating, so they are passed to a separate team.</p><p>Instead of <code>мова:англ АБО мова:інша</code> it is shorter to exclude Ukrainian.</p>`,
  ex:[['мова:англ','лише англомовні','English only'],['пріоритет:високий','термінові матеріали','urgent materials']],
  hints:[['Іншомовних варіантів два: англійська та інша. Їх можна перелічити, але є коротший шлях.','There are two foreign-language options: English and other. You could list them, but there is a shorter way.'],
   ['Мінус працює не тільки для слів, а й для полів.','A minus works not only for words but also for fields.'],
   ['Запит має вигляд {{-мова:…}}.','The query looks like {{-мова:…}}.']]},

 {part:'Розпізнавання техніки', partEn:'Equipment recognition', key:'eye',
  title:'Танк чи САУ', titleEn:'Tank or SPG',
  task:'Відберіть знімки, на яких зафіксовано танки', taskEn:'Select images showing tanks', syntax:'техніка:танк',
  cards:[10,32,34,35,46,36,20,33], sol:'техніка:танк', guide:['танк','сау','бтр'],
  body:`<p>Поле <code>техніка</code> аналітик заповнює сам, переглянувши знімок. В облікових записах тут стоїть <b>?</b>: визначте тип техніки за зображенням. <b>Клацніть картку</b>, щоб розглянути знімок великим.</p>{GUIDE}<p>Танк і САУ найчастіше плутають: обидва на гусеницях і з баштою.</p>`,
  bodyEn:`<p>The analyst fills in the <code>техніка</code> (equipment) field after viewing the image. The records show <b>?</b> here: identify the vehicle type from the picture. <b>Click a card</b> to view the image at full size.</p>{GUIDE}<p>Tanks and SPGs are confused most often: both are tracked and have a turret.</p>`,
  ex:[['техніка:бтр','колісні бронетранспортери','wheeled armoured personnel carriers'],['техніка:танк район:Схід','танки на Сході','tanks in the East']],
  hints:[['Танк і САУ схожі: обидва на гусеницях і з баштою. Дивіться на гармату й місце башти.','Tanks and SPGs look alike: both are tracked and have a turret. Look at the gun and where the turret sits.'],
   ['У танка башта посередині корпусу, гармата довга й тонка. У САУ башта велика й зміщена назад, гармата коротша й товща.','A tank’s turret is in the middle of the hull and its gun is long and thin. An SPG has a large turret set to the rear and a shorter, thicker gun.'],
   ['Скористайтеся полем {{техніка:}} зі значенням для танка.','Use the {{техніка:}} field with the value for a tank.']]},

 {title:'Артилерія: САУ та РСЗВ', titleEn:'Artillery: SPG and MLRS',
  task:'Відберіть усі матеріали з артилерією: самохідні гаубиці та реактивні системи', taskEn:'Select all artillery materials: self-propelled howitzers and rocket systems', syntax:'техніка:сау АБО техніка:рсзв',
  cards:[34,37,1,38,33,36,39,48], sol:'техніка:сау АБО техніка:рсзв', guide:['сау','рсзв','вантажівка'],
  body:`<p><b>САУ</b> (самохідна артилерійська установка) стріляє снарядами, <b>РСЗВ</b> (реактивна система залпового вогню) випускає ракети з пакета напрямних. Відео з пусками можна переглянути, клацнувши картку.</p>{GUIDE}<p>РСЗВ стоїть на шасі вантажівки, тож не сплутайте її зі звичайним транспортом.</p>`,
  bodyEn:`<p>An <b>SPG</b> (self-propelled gun) fires artillery shells; an <b>MLRS</b> (multiple launch rocket system) fires a salvo of rockets from a pack of launch tubes. Click a card to watch the launch videos.</p>{GUIDE}<p>An MLRS sits on a truck chassis, so do not confuse it with ordinary transport.</p>`,
  ex:[['техніка:рсзв','лише реактивна артилерія','rocket artillery only'],['техніка:сау тип:відео','відео з САУ','videos with SPGs']],
  hints:[['Артилерія тут двох видів: самохідні гаубиці на гусеницях і реактивні системи з пакетом труб.','There are two kinds of artillery here: tracked self-propelled howitzers and rocket systems with a pack of tubes.'],
   ['Звичайна вантажівка має кузов під тентом, а РСЗВ має пакет напрямних замість кузова.','An ordinary truck has a covered cargo bed, while an MLRS has launch tubes instead of a bed.'],
   ['Об\'єднайте два значення поля: {{техніка:сау АБО техніка:…}}.','Combine two field values: {{техніка:сау АБО техніка:…}}.']]},

 {title:'Безпілотники: знімок проти згадки', titleEn:'UAVs: image versus mention',
  task:'Відберіть знімки безпілотників від надійних джерел (A–B)', taskEn:'Select images of UAVs from reliable sources (A–B)', syntax:'техніка:бпла джерело:<=B',
  cards:[41,42,40,45,44,38,46], sol:'техніка:бпла джерело:<=B', guide:['бпла'],
  body:`<p>Слово без поля шукає в <b>заголовку</b>, а поле <code>техніка</code> в тому, що <b>видно на знімку</b>. «Довідка щодо застосування БПЛА» згадує безпілотники, але знімка апарата в ній немає.</p>{GUIDE}<p>Знімки безпілотників часто поширюють без перевірки, тому відсійте ненадійні джерела.</p>`,
  bodyEn:`<p>A word without a field searches the <b>title</b>; the <code>техніка</code> field searches what is <b>visible in the image</b>. «Довідка щодо застосування БПЛА» (briefing note on UAV use) mentions drones, but contains no image of one.</p>{GUIDE}<p>Images of drones often spread unchecked, so filter out unreliable sources.</p>`,
  ex:[['техніка:бпла','усі знімки безпілотників','all UAV images'],['БПЛА -техніка:бпла','згадки в тексті без знімка апарата','text mentions without an image of the aircraft']],
  hints:[['Спробуйте знайти безпілотники словом {{БПЛА}} і подивіться, що підсвітиться.','Try finding drones with the word {{БПЛА}} and see what lights up.'],
   ['Слово в заголовку не означає, що на знімку є апарат. Шукайте за полем техніки й додайте умову на джерело.','A word in the title does not mean the image shows an aircraft. Search by the equipment field and add a source condition.'],
   ['Запит має вигляд {{техніка:бпла джерело:<=…}}.','The query looks like {{техніка:бпла джерело:<=…}}.']]},

 {title:'Бронетехніка на напрямку', titleEn:'Armour in the sector',
  task:'Відберіть знімки танків і бронетранспортерів з району «Схід»', taskEn:'Select images of tanks and APCs from the “East” region', syntax:'(техніка:танк АБО техніка:бтр) район:Схід',
  cards:[32,35,47,46,43,20,34,23], sol:'(техніка:танк АБО техніка:бтр) район:Схід', guide:['танк','бтр'],
  body:`<p>Танки й БТР разом називають <b>бронетехнікою</b>. Її скупчення є важливою ознакою підготовки противника до дій на напрямку.</p>{GUIDE}<p>Поєднайте розпізнавання з полем району, не забувши про пріоритет «І» над «АБО».</p>`,
  bodyEn:`<p>Tanks and APCs together are called <b>armour</b>. A build-up of armour is a key indicator that the enemy is preparing to act in a sector.</p>{GUIDE}<p>Combine recognition with the region field, and remember that AND takes precedence over OR.</p>`,
  ex:[['техніка:танк АБО техніка:бтр','уся бронетехніка','all armour'],['техніка:бтр -район:Схід','БТР поза Сходом','APCs outside the East']],
  hints:[['Тут дві групи техніки й один район.','There are two groups of vehicles and one region here.'],
   ['Як на рівні 9: «І» сильніше за «АБО», тому групу техніки візьміть у дужки.','As in level 9: AND binds tighter than OR, so put the vehicle group in brackets.'],
   ['Запит має вигляд {{(техніка:танк АБО техніка:…) район:Схід}}.','The query looks like {{(техніка:танк АБО техніка:…) район:Схід}}.']]},

 {title:'Засоби ППО', titleEn:'Air defence systems',
  task:'Відберіть знімки засобів протиповітряної оборони', taskEn:'Select images of air defence systems', syntax:'техніка:ппо',
  cards:[49,50,51,10,33,37,53,35], sol:'техніка:ппо', guide:['ппо','танк','рсзв'],
  body:`<p>Засоби <b>ППО</b> (протиповітряної оборони) збивають літаки, гелікоптери, ракети й дрони. Їх легко сплутати з іншою технікою: зенітна установка Gepard стоїть на танковому шасі, а пускові установки ЗРК схожі на РСЗВ.</p>{GUIDE}<p>Дивіться на озброєння: у ППО спарені скорострільні гармати й радар на башті або великі ракети в контейнерах, спрямовані вгору.</p>`,
  bodyEn:`<p><b>Air defence</b> systems shoot down aircraft, helicopters, missiles and drones. They are easy to confuse with other vehicles: the Gepard anti-aircraft gun sits on a tank chassis, and SAM launchers look like an MLRS.</p>{GUIDE}<p>Look at the armament: air defence systems carry twin rapid-fire guns with a radar on the turret, or large missiles in canisters angled upwards.</p>`,
  ex:[['техніка:ппо район:Схід','ППО на Сході','air defence in the East'],['техніка:ппо АБО техніка:рсзв','ППО та реактивна артилерія','air defence and rocket artillery']],
  hints:[['Три картки показують ППО, але одна з них дуже схожа на танк.','Three cards show air defence, but one of them looks very much like a tank.'],
   ['Порівняйте з довідником: спарені гармати з радаром або ракети в контейнерах означають ППО.','Compare with the guide: twin guns with a radar, or missiles in canisters, mean air defence.'],
   ['Скористайтеся полем {{техніка:}} зі значенням для ППО.','Use the {{техніка:}} field with the value for air defence.']]},

 {title:'Повітряні цілі', titleEn:'Air targets',
  task:'Відберіть знімки повітряних цілей: гелікоптери та безпілотники', taskEn:'Select images of air targets: helicopters and UAVs', syntax:'техніка:гелікоптер АБО техніка:бпла',
  cards:[52,53,54,41,42,49,50,48], sol:'техніка:гелікоптер АБО техніка:бпла', guide:['гелікоптер','бпла'],
  body:`<p>Повітряні цілі для ППО — це гелікоптери й безпілотники. На знімку з землі їх часто видно лише силуетом.</p>{GUIDE}<p>Не плутайте ціль із засобом, який по ній стріляє: зенітна установка належить до ППО, а ракета в небі на відео з пуском — до РСЗВ.</p>`,
  bodyEn:`<p>Air targets for air defence are helicopters and drones. On an image taken from the ground they are often visible only as a silhouette.</p>{GUIDE}<p>Do not confuse the target with the weapon that fires at it: an anti-aircraft vehicle is air defence, and a rocket in the sky on a launch video is an MLRS.</p>`,
  ex:[['техніка:гелікоптер','лише гелікоптери','helicopters only'],['(техніка:гелікоптер АБО техніка:бпла) район:Схід','повітряні цілі на Сході','air targets in the East']],
  hints:[['Повітряних цілей тут два види.','There are two kinds of air targets here.'],
   ['На картці №52 гелікоптери видно лише силуетами в небі. Клацніть, щоб збільшити.','On card No. 52 the helicopters are visible only as silhouettes in the sky. Click to enlarge.'],
   ['Об\'єднайте два значення: {{техніка:гелікоптер АБО техніка:…}}.','Combine two values: {{техніка:гелікоптер АБО техніка:…}}.']]},

 {part:'Перевірка інформації (OSINT)', partEn:'Information verification (OSINT)', key:'osint',
  title:'Повторне використання знімка', titleEn:'Reused images',
  task:'Знайдіть усі матеріали, де використано той самий знімок, що й у картці №10', taskEn:'Find all materials that use the same image as card No. 10', syntax:'знімок:…',
  cards:[10,55,32,46,33,56,57,37], sol:'знімок:'+fingerprint('c10'),
  body:`<p>Старі або чужі знімки часто видають за нові. Аналітик перевіряє це <b>зворотним пошуком зображень</b>: сервіси на кшталт Google Lens або TinEye знаходять, де знімок публікувався раніше.</p><p>У картотеці для кожного знімка обчислено <b>відбиток</b> <code>знімок</code>: однакові зображення мають однаковий відбиток. Знайдіть відбиток картки №10 в облікових записах.</p>`,
  bodyEn:`<p>Old or borrowed images are often passed off as new. An analyst checks this with a <b>reverse image search</b>: services such as Google Lens or TinEye find where an image was published before.</p><p>In the card index each image has a computed <b>fingerprint</b>, the <code>знімок</code> (image) field: identical images have identical fingerprints. Find the fingerprint of card No. 10 in the records.</p>`,
  ex:[['знімок:…','усі картки з цим відбитком','all cards with this fingerprint'],['знімок:… -тип:допис','лише оригінали, без дописів','originals only, no posts']],
  hints:[['Знімок картки №55 ви вже бачили раніше. Порівняйте зображення.','You have seen the image on card No. 55 before. Compare the pictures.'],
   ['Знайдіть картку №10 в облікових записах і перепишіть значення поля {{знімок:}}.','Find card No. 10 in the records and copy the value of the {{знімок:}} field.'],
   ['Запит має вигляд {{знімок:…}} з трьома символами відбитка.','The query looks like {{знімок:…}} with the three characters of the fingerprint.']]},

 {title:'Старий знімок під новим заголовком', titleEn:'An old image under a new headline',
  task:'Відберіть дописи, знімки в яких зроблено до 1 жовтня 2026', taskEn:'Select posts whose images were taken before 1 October 2026', syntax:'тип:допис зйомка:<2026-10-01',
  cards:[55,58,59,60,57,56], sol:'тип:допис зйомка:<2026-10-01',
  body:`<p>Поле <code>дата</code> показує, коли матеріал <b>надійшов</b>. Поле <code>зйомка</code> взято з метаданих файлу (EXIF): це дата, коли знімок <b>зроблено</b>.</p><p>Якщо допис про «сьогоднішні» події містить знімок, зроблений місяці чи роки тому, це ознака дезінформації. Архівний знімок з позначкою «архів» нормальний, тож шукайте саме дописи.</p>`,
  bodyEn:`<p>The <code>дата</code> field shows when a material was <b>received</b>. The <code>зйомка</code> (shot) field comes from the file metadata (EXIF): it is the date the image was <b>taken</b>.</p><p>If a post about “today’s” events contains an image taken months or years ago, that is a sign of disinformation. A photo clearly labelled as archive material is fine, so look specifically at posts.</p>`,
  ex:[['зйомка:2026-10','знімки, зроблені в жовтні','images taken in October'],['зйомка:<2026-01-01','знімки, старші за 2026 рік','images older than 2026']],
  hints:[['Порівняйте поля {{дата:}} і {{зйомка:}} в облікових записах.','Compare the {{дата:}} and {{зйомка:}} fields in the records.'],
   ['Потрібні дві умови: тип матеріалу й дата зйомки.','You need two conditions: the material type and the shot date.'],
   ['Запит має вигляд {{тип:допис зйомка:<…}}.','The query looks like {{тип:допис зйомка:<…}}.']]},

 {title:'Метадані', titleEn:'Metadata',
  task:'Відберіть матеріали з видаленими або зміненими метаданими від джерел D–F', taskEn:'Select materials with removed or edited metadata from sources D–F', syntax:'-метадані:є джерело:>=D',
  cards:[55,56,59,45,40,57,58,42], sol:'-метадані:є джерело:>=D',
  body:`<p>Поле <code>метадані</code> показує стан метаданих файлу: <code>є</code> (збережені), <code>видалено</code> або <code>змінено</code>. Соцмережі часто видаляють метадані самі, тож це ще не доказ підробки.</p><p>Але видалені чи змінені метадані разом з ненадійним джерелом є приводом передати матеріал на поглиблену перевірку.</p>`,
  bodyEn:`<p>The <code>метадані</code> (metadata) field shows the state of the file metadata: <code>є</code> (present), <code>видалено</code> (removed) or <code>змінено</code> (edited). Social networks often strip metadata automatically, so this alone does not prove the image was faked.</p><p>But removed or edited metadata combined with an unreliable source is a reason to send the material for in-depth checking.</p>`,
  ex:[['метадані:змінено','лише змінені','edited only'],['метадані:видалено АБО метадані:змінено','видалені або змінені','removed or edited']],
  hints:[['Метадані бувають у трьох станах. Вам потрібні два з них, тобто все, крім збережених.','Metadata has three states. You need two of them, i.e. everything except present.'],
   ['Виключіть збережені метадані мінусом і додайте умову на джерело.','Exclude present metadata with a minus and add a condition on the source.'],
   ['Запит має вигляд {{-метадані:є джерело:>=…}}.','The query looks like {{-метадані:є джерело:>=…}}.']]},

 {part:'Карта', partEn:'Map', key:'map',
  title:'Квадрат кілометрової сітки', titleEn:'Kilometre grid square', map:true,
  task:'Відберіть усі матеріали з квадрата 4510 (переправа біля Кам\'яного Броду)', taskEn:'Select all materials from square 4510 (the crossing near Kamianyi Brid)', syntax:'квадрат:4510',
  cards:[1,4,6,15,26,32,10,49], sol:'квадрат:4510',
  body:`<p>Місце на карті позначають <b>квадратом кілометрової сітки</b>: чотири цифри, де перші дві — вертикальна лінія ліворуч від квадрата (схід), а останні дві — горизонтальна лінія під ним (північ).</p><p>Квадрат 4510 лежить праворуч від лінії 45 і вище від лінії 10. Наведіть курсор на позначку на карті, щоб побачити картку.</p>`,
  bodyEn:`<p>A place on the map is given by a <b>kilometre grid square</b>: four digits, where the first two are the vertical line to the left of the square (easting) and the last two the horizontal line below it (northing).</p><p>Square 4510 lies to the right of line 45 and above line 10. Hover over a marker on the map to see its card.</p>`,
  ex:[['квадрат:4511','квадрат на північ від 4510','the square north of 4510'],['квадрат:4510 тип:фото','лише фото з квадрата','photos from the square only']],
  hints:[['Знайдіть на карті квадрат з переправою через річку.','Find the square with the river crossing on the map.'],
   ['Кожна позначка на карті має номер картки. Ті самі квадрати є в облікових записах.','Each marker on the map carries a card number. The same squares are in the records.'],
   ['Запит має вигляд {{квадрат:…}} з чотирма цифрами.','The query looks like {{квадрат:…}} with four digits.']]},

 {title:'Ділянка на карті', titleEn:'Area on the map', map:true,
  task:'Відберіть танки й БТР на ділянці від квадрата 4410 до квадрата 4612', taskEn:'Select tanks and APCs in the area from square 4410 to square 4612', syntax:'квадрат:4410..4612 (техніка:танк АБО техніка:бтр)',
  cards:[32,46,47,35,10,34,49,52], sol:'квадрат:4410..4612 (техніка:танк АБО техніка:бтр)',
  body:`<p>Діапазон квадратів <code>квадрат:4410..4612</code> задає <b>прямокутник</b>: від лівого нижнього квадрата 4410 до правого верхнього 4612, тобто стовпці 44–46 і рядки 10–12.</p><p>Поєднайте ділянку з розпізнаванням техніки. Щойно ви введете діапазон, ділянку буде підсвічено на карті.</p>`,
  bodyEn:`<p>A range of squares <code>квадрат:4410..4612</code> defines a <b>rectangle</b>: from the lower-left square 4410 to the upper-right 4612, i.e. columns 44–46 and rows 10–12.</p><p>Combine the area with equipment recognition. As soon as you type the range, the area is highlighted on the map.</p>`,
  ex:[['квадрат:4509..4611','центр ділянки','the centre of the area'],['квадрат:4410..4612 -техніка:ппо','усе на ділянці, крім ППО','everything in the area except air defence']],
  hints:[['Спершу задайте ділянку діапазоном квадратів і подивіться на підсвічування на карті.','First set the area with a range of squares and look at the highlight on the map.'],
   ['Потім додайте групу техніки в дужках, як на рівні 23.','Then add the vehicle group in brackets, as in level 23.'],
   ['Запит має вигляд {{квадрат:4410..4612 (техніка:танк АБО техніка:…)}}.','The query looks like {{квадрат:4410..4612 (техніка:танк АБО техніка:…)}}.']]},

 {part:'Пошук за схожістю', partEn:'Similarity search', key:'sim',
  title:'Ранжування TF–IDF', titleEn:'TF–IDF ranking',
  task:'Знайдіть матеріали, схожі на запит «рух колони техніки»', taskEn:'Find materials similar to the query «рух колони техніки» (movement of a vehicle convoy)', syntax:'схоже:"рух колони техніки"',
  cards:[3,15,23,26,1,10,2,5,32], sol:'схоже:"рух колони техніки"',
  body:`<p>Булевий запит відповідає «так» або «ні». Пошук <b>за схожістю</b> рахує для кожної картки число від 0 до 1: наскільки її заголовок близький до запиту. Так працюють пошукові системи, а в практиці 4.15 так шукали службові повідомлення.</p><p>Метод <b>TF–IDF</b> зважує слова: часте в картотеці слово важить менше, рідкісне більше. Картки зі схожістю від {SIM} потрапляють у вибірку, а число видно на кожній картці. Слова зводяться до основи, тож «колони» і «колона» збігаються.</p>`,
  bodyEn:`<p>A Boolean query answers “yes” or “no”. <b>Similarity</b> search computes a number from 0 to 1 for every card: how close its title is to the query. This is how search engines work, and how service messages were searched in practical assignment 4.15.</p><p>The <b>TF–IDF</b> method weights words: a word that is common in the card index carries less weight, a rare one carries more. Cards with a similarity of {SIM} or more get into the selection, and the number is shown on each card. Words are reduced to their stem, so «колони» and «колона» match.</p>`,
  ex:[['схоже:"колона вантажівок"','колони вантажівок','truck convoys'],['схоже:"техніка" тип:фото','схожість разом з умовою','similarity combined with a condition']],
  hints:[['Значення поля {{схоже:}} пишеться в лапках.','The value of the {{схоже:}} field is written in quotes.'],
   ['Спробуйте різні формулювання й подивіться, як змінюються числа на картках.','Try different wordings and watch how the numbers on the cards change.'],
   ['Запит має вигляд {{схоже:"рух колони …"}}.','The query looks like {{схоже:"рух колони …"}}.']]},

 {part:'Підсумок', partEn:'Final task', key:'final',
  title:'Вибірка для доповіді', titleEn:'Selection for a report',
  task:'Підготуйте вибірку для доповіді: джерело A–B, інформація 1–2, район «Схід», з 20 жовтня 2026, без дописів', taskEn:'Prepare a selection for a report: source A–B, information 1–2, region “East”, from 20 October 2026, no posts',
  syntax:'… усе разом', syntaxEn:'… all together',
  cards:[1,6,10,15,26,21,4,11,31], sol:'джерело:<=B інфо:<=2 район:Схід дата:>=2026-10-20 -тип:допис',
  body:`<p>Підсумкове завдання поєднує все вивчене. Будуйте запит поступово: додавайте одну умову й дивіться, як змінюється зелене підсвічування.</p><p>Перевірте кожну вимогу: оцінку джерела, оцінку інформації, район, дату та тип.</p>`,
  bodyEn:`<p>The final task combines everything you have learned. Build the query step by step: add one condition at a time and watch the green highlighting change.</p><p>Check every requirement: source grade, information grade, region, date and type.</p>`,
  ex:[['джерело:<=B інфо:<=2','почніть з оцінки','start with the grade'],['… район:Схід дата:>=2026-10-20','потім район і дата','then region and date']],
  hints:[['Розбийте завдання на п\'ять умов і додавайте їх по одній, стежачи за підсвічуванням.','Split the task into five conditions and add them one at a time, watching the highlighting.'],
   ['Оцінки: {{джерело:<=B інфо:<=2}}. Район і дата: {{район:Схід дата:>=2026-10-20}}.','Grades: {{джерело:<=B інфо:<=2}}. Region and date: {{район:Схід дата:>=2026-10-20}}.'],
   ['Залишилось прибрати дописи: {{-тип:…}}.','All that is left is to remove posts: {{-тип:…}}.']]}
];
{let blk; LEVELS.forEach(L=>{ if(L.part) blk=L; L.block=blk.key; L.blockPart=blk; });}
