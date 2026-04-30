const API_BASE_URL = 'https://chabotierdev.alwaysdata.net/api.php?channel=';

const CHANNELS = [
  { id: '12', lbl: 'ערוץ 12', color: '#4070ff' },
  { id: '13', lbl: 'ערוץ 13', color: '#cc99ff' },
  { id: '14', lbl: 'ערוץ 14', color: '#ffcc44' },
  { id: '11', lbl: 'כאן 11', color: '#ff8888' },
  { id: 'i24', lbl: 'i24News', color: '#60e0a0' },
  { id: 'knesset', lbl: 'ערוץ הכנסת', color: '#e8c060' },
  { id: 'aljazeera', lbl: 'אל ג\'זירה', color: '#ffaa66' },
  { id: 'cnn', lbl: 'CNN', color: '#ff4040' },
  { id: 'foxnews', lbl: 'FOX News', color: '#1432a0' },
  { id: 'nbc', lbl: 'NBC News', color: '#ff4040' },
  { id: 'dw', lbl: 'DW News', color: 'var(--text-2)' },
  { id: 'france24', lbl: 'France 24', color: '#4070ff' }
];

function renderChannelBar() {
  const bar = document.getElementById('chBar');
  if(!bar) return;
  let html = `<span class="ch-bar-lbl">שידור:</span>
              <button class="collage-btn" id="collageBtn" onclick="toggleCollage()">⊞ &nbsp;קולאז ערוצים</button>`;
  
  CHANNELS.forEach((ch, i) => {
    html += `<button class="ch" data-index="${i}" onclick="switchChByIndex(${i})">${ch.lbl}</button>`;
  });
  bar.innerHTML = html;
}

function buildSafeIframeUrl(src) {
  try {
    let url = new URL(src);
    url.searchParams.delete('mute');
    url.searchParams.delete('muted');
    url.searchParams.delete('autoplay');
    url.searchParams.delete('volume');
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('mute', '1');
    url.searchParams.set('muted', 'true');
    url.searchParams.set('volume', '0');
    if (url.hostname.includes('youtube.com')) {
      url.searchParams.set('enablejsapi', '1');
    }
    return url.toString();
  } catch (e) {
    return src;
  }
}

let hlsInstance = null;
let isMuted = true;

async function switchChByIndex(index) {
  if (collageActive) {
    toggleCollage();
  }
  const ch = CHANNELS[index];
  document.querySelectorAll('.ch').forEach(b => b.classList.remove('on'));
  const btn = document.querySelector(`.ch[data-index="${index}"]`);
  if(btn) btn.classList.add('on');
  document.getElementById('chLabel').textContent = ch.lbl;
  hideError();
  document.getElementById('videoFrame').style.display = 'none';
  document.getElementById('videoFrame').src = 'about:blank';
  document.getElementById('hlsVideo').classList.remove('active');
  document.getElementById('hlsControls').classList.remove('show');
  const hlsLoader = document.getElementById('hlsLoading');
  hlsLoader.classList.add('show');
  document.querySelector('.hls-loading-txt').textContent = 'מייבא נתונים מהשרת...';
  stopHLS();
  try {
    const response = await fetch(`${API_BASE_URL}${ch.id}&t=${Date.now()}`);
    const data = await response.json();
    if (data.success) {
      if (data.type === 'hls') {
        loadHLS(data.url);
      } else if (data.type === 'iframe') {
        showIframe(data.url);
      }
    } else {
      hlsLoader.classList.remove('show');
      showError(data.message || 'הערוץ לא זמין כרגע דרך השרת', '');
    }
  } catch (error) {
    hlsLoader.classList.remove('show');
    showError('שגיאת תקשורת מול ה-API', '');
  }
}

function showIframe(rawSrc) {
  document.getElementById('hlsLoading').classList.remove('show');
  const frame = document.getElementById('videoFrame');
  frame.style.display = 'block';
  frame.src = buildSafeIframeUrl(rawSrc);
}

function loadHLS(src) {
  const video = document.getElementById('hlsVideo');
  video.classList.add('active');
  document.querySelector('.hls-loading-txt').textContent = 'טוען שידור חי...';
  if (Hls.isSupported()) {
    hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
    hlsInstance.loadSource(src);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      document.getElementById('hlsLoading').classList.remove('show');
      document.getElementById('hlsControls').classList.add('show');
      video.muted = true;
      isMuted = true;
      document.getElementById('muteBtn').textContent = '🔇';
      video.play().catch(() => {
        video.muted = true;
        video.play();
      });
      updateQuality();
    });
    hlsInstance.on(Hls.Events.LEVEL_SWITCHED, updateQuality);
    hlsInstance.on(Hls.Events.ERROR, (e, data) => {
      if (data.fatal) {
        document.getElementById('hlsLoading').classList.remove('show');
        showError('שגיאה בטעינת השידור — בדוק חיבור אינטרנט', src);
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    video.muted = true;
    isMuted = true;
    document.getElementById('muteBtn').textContent = '🔇';
    document.getElementById('hlsLoading').classList.remove('show');
    document.getElementById('hlsControls').classList.add('show');
    video.play();
  } else {
    showError('הדפדפן לא תומך ב-HLS', src);
  }
}

function stopHLS() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  const video = document.getElementById('hlsVideo');
  video.pause();
  video.src = '';
}

function updateQuality() {
  if (!hlsInstance) return;
  const lvl = hlsInstance.currentLevel;
  const levels = hlsInstance.levels;
  if (levels && levels[lvl]) {
    const h = levels[lvl].height;
    document.getElementById('hlsQuality').textContent = h ? h + 'p' : 'AUTO';
  }
}

function toggleMute() {
  const video = document.getElementById('hlsVideo');
  isMuted = !isMuted;
  video.muted = isMuted;
  document.getElementById('muteBtn').textContent = isMuted ? '🔇' : '🔊';
}

function toggleFS() {
  const wrap = document.querySelector('.video-wrap');
  if (!document.fullscreenElement) {
    wrap.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

function showError(txt, src) {
  document.getElementById('vidErrorTxt').textContent = txt;
  document.getElementById('vidErrorLink').href = src || '#';
  document.getElementById('vidError').classList.add('show');
}
function hideError() {
  document.getElementById('vidError').classList.remove('show');
}

let collageActive = false;
const collageHlsInstances = {};

function toggleCollage() {
  collageActive = !collageActive;
  const overlay = document.getElementById('collageOverlay');
  const btn     = document.getElementById('collageBtn');
  if (collageActive) {
    overlay.classList.add('show');
    btn.classList.add('active');
    btn.innerHTML = '⊠ &nbsp;סגור קולאז';
    document.querySelectorAll('.ch').forEach(b => b.classList.remove('on'));
    stopHLS();
    document.getElementById('videoFrame').src = 'about:blank';
    buildCollage();
  } else {
    overlay.classList.remove('show');
    btn.classList.remove('active');
    btn.innerHTML = '⊞ &nbsp;קולאז ערוצים';
    destroyCollage();
  }
}

function buildCollage() {
  const overlay = document.getElementById('collageOverlay');
  overlay.innerHTML = '';
  CHANNELS.forEach((ch, i) => {
    const cell = document.createElement('div');
    cell.className = 'collage-cell';
    cell.innerHTML = `<div class="cell-loading"><div class="cell-spinner"></div></div><div class="collage-cell-label" style="color:${ch.color};">${ch.lbl}</div>`;
    overlay.appendChild(cell);
    fetch(`${API_BASE_URL}${ch.id}&t=${Date.now()}`).then(res => res.json()).then(data => {
        if (data.success) {
          let mediaHtml = '';
          let actionsHtml = `<button class="cell-action-btn expand" onclick="expandCell(event, ${i})" title="הגדל לערוץ מרכזי">⛶</button>`;
          if (data.type === 'iframe') {
            const safeUrl = buildSafeIframeUrl(data.url);
            mediaHtml = `<iframe id="cellvid_${i}" data-muted="true" src="${safeUrl}" allow="autoplay; fullscreen" style="pointer-events:none;"></iframe>`;
            actionsHtml += `<button class="cell-action-btn mute" onclick="toggleCellMute(event, ${i})" title="השתק / הפעל שמע">🔇</button>`;
          } else if (data.type === 'hls') {
            mediaHtml = `<video id="cellvid_${i}" autoplay muted playsinline></video>`;
            actionsHtml += `<button class="cell-action-btn mute" onclick="toggleCellMute(event, ${i})" title="השתק / הפעל שמע">🔇</button>`;
          }
          cell.innerHTML = `${mediaHtml}<div class="cell-click-overlay" onclick="expandCell(event, ${i})"></div><div class="cell-actions">${actionsHtml}</div><div class="collage-cell-label" style="color:${ch.color};">${ch.lbl}</div>`;
          if (data.type === 'hls') {
            const video = document.getElementById(`cellvid_${i}`);
            if (Hls.isSupported()) {
              const hls = new Hls({ enableWorker:true, lowLatencyMode:true, maxBufferLength:10 });
              hls.loadSource(data.url);
              hls.attachMedia(video);
              hls.on(Hls.Events.MANIFEST_PARSED, () => { video.muted = true; video.play().catch(()=>{}); });
              collageHlsInstances[i] = hls;
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = data.url; video.muted = true; video.play();
            }
          }
        } else {
          cell.innerHTML = `<div class="cell-placeholder"><div class="cell-ph-icon">📺</div><div class="cell-ph-name" style="color:#ff4040;">שגיאה: ${data.message}</div></div><div class="cell-click-overlay" onclick="expandCell(event, ${i})"></div><div class="collage-cell-label" style="color:${ch.color};">${ch.lbl}</div>`;
        }
      }).catch(err => {
        cell.innerHTML = `<div class="cell-placeholder"><div class="cell-ph-icon">⚠️</div><div class="cell-ph-name" style="color:#ff4040;">שגיאת תקשורת</div></div><div class="cell-click-overlay" onclick="expandCell(event, ${i})"></div><div class="collage-cell-label" style="color:${ch.color};">${ch.lbl}</div>`;
      });
  });
}

function destroyCollage() {
  Object.values(collageHlsInstances).forEach(h => h.destroy());
  for (const k in collageHlsInstances) delete collageHlsInstances[k];
  document.getElementById('collageOverlay').innerHTML = '';
}

function expandCell(event, index) { if (event) event.stopPropagation(); switchChByIndex(index); }

function toggleCellMute(event, index) {
  if (event) event.stopPropagation();
  const vid = document.getElementById(`cellvid_${index}`);
  if (!vid) return;
  if (vid.tagName === 'VIDEO') {
    vid.muted = !vid.muted; event.target.textContent = vid.muted ? '🔇' : '🔊';
  } else if (vid.tagName === 'IFRAME') {
    let isMuted = vid.getAttribute('data-muted') === 'true';
    if (vid.src.includes('youtube.com')) {
      const command = isMuted ? 'unMute' : 'mute';
      vid.contentWindow.postMessage('{"event":"command","func":"' + command + '","args":""}', '*');
      vid.setAttribute('data-muted', !isMuted); event.target.textContent = isMuted ? '🔊' : '🔇';
    } else {
      try {
        let urlObj = new URL(vid.src); urlObj.searchParams.set('mute', isMuted ? '0' : '1'); urlObj.searchParams.set('muted', isMuted ? 'false' : 'true');
        vid.src = urlObj.toString(); vid.setAttribute('data-muted', !isMuted); event.target.textContent = isMuted ? '🔊' : '🔇';
      } catch(e) {}
    }
  }
}

const tickClock = () => {
  const n = new Date();
  document.getElementById('clockT').textContent = n.toLocaleTimeString('he-IL');
  document.getElementById('clockD').textContent = n.toLocaleDateString('he-IL',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
};
tickClock(); setInterval(tickClock, 1000);

const SOURCES = [
  {id:'ynet', lbl:'ynet', cls:'sy', rss:'https://www.ynet.co.il/Integration/StoryRss2.xml'},
  {id:'israelhayom', lbl:'ישראל היום', cls:'sih', rss:'https://www.israelhayom.co.il/rss.xml'},
  {id:'mako', lbl:'mako', cls:'sn12', rss:'https://www.mako.co.il/rss/31750a2610f26110VgnVCM1000004463fa0aRCRD.xml'},
  {id:'arutz7', lbl:'ערוץ 7', cls:'sa7', rss:'https://www.inn.co.il/api/rss'},
  {id:'knesset', lbl:'כנסת', cls:'skn', rss:'https://main.knesset.gov.il/Activity/News/Pages/rss.aspx'},
  {id:'walla', lbl:'וואלה', cls:'sw', rss:'https://rss.walla.co.il/feed/1'},
  {id:'maariv', lbl:'מעריב', cls:'sm', rss:'https://www.maariv.co.il/rss/rssChadashot'},
  {id:'haaretz', lbl:'הארץ', cls:'sh', rss:'https://www.haaretz.co.il/cmlink/1.1599034'},
  {id:'kan', lbl:'כאן', cls:'sk', rss:'https://www.kan.org.il/rss/'},
];

const KW_URG = ['פיגוע','דקירה','ירי','נפגע','הרוג','פצוע','פיצוץ','חטיפה','כוננות','חירום','אזעקה','טיל','סכין','שוד','התקפה','רצח'];
const KW_POL = ['משטרה','שוטר','מעצר','עצור','פשיטה','חקירה','כוחות','מד"א','יחל','ניידת','ניידות','פשע'];
const KW_SEC = ['ביטחון','צבא','צהל','מוסד','לחימה','גבול','רצועה','שטחים','טרור'];
const classify = t => ({isU:KW_URG.some(k=>t.includes(k)),isP:KW_POL.some(k=>t.includes(k)),isS:KW_SEC.some(k=>t.includes(k))});

let items=[], filter='all', activeM=null;
const seen = new Set();

function parseItem(title,desc,link,pub,src){
  const clean = s => (s||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
  const hl=clean(title), sum=clean(desc).substring(0,220);
  const id=link||hl; if(seen.has(id))return null; seen.add(id);
  const {isU,isP,isS}=classify(hl+' '+sum);
  const dt=pub?new Date(pub):new Date();
  return{id,src:src.id,lbl:src.lbl,cls:src.cls,hl,sum,link:link||'#',time:dt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}),dt,isU,isP,isS,isNew:true};
}

function parseXML(xml,src){
  const doc=new DOMParser().parseFromString(xml,'text/xml');
  return Array.from(doc.querySelectorAll('item')).slice(0,25).map(el=>parseItem(el.querySelector('title')?.textContent, el.querySelector('description')?.textContent, el.querySelector('link')?.textContent, el.querySelector('pubDate')?.textContent, src)).filter(Boolean);
}

async function fetchSource(src){
  const methods=[
    async()=>{const r=await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(src.rss)}&count=25`,{signal:AbortSignal.timeout(8000)});const d=await r.json();if(d.status!=='ok'||!d.items?.length)throw 0;return d.items.map(x=>parseItem(x.title,x.description,x.link,x.pubDate,src)).filter(Boolean);},
    async()=>{const r=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(src.rss)}`,{signal:AbortSignal.timeout(10000)});const d=await r.json();return parseXML(d.contents,src);},
    async()=>{const r=await fetch(`https://corsproxy.io/?${encodeURIComponent(src.rss)}`,{signal:AbortSignal.timeout(10000)});return parseXML(await r.text(),src);}
  ];
  for(const m of methods){try{const res=await m();if(res.length)return res;}catch{}}
  return[];
}

async function fetchAll(){
  setRss('load','מתחבר לאתרי חדשות...','');
  const results=await Promise.allSettled(SOURCES.map(fetchSource));
  const fresh=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value).sort((a,b)=>b.dt-a.dt);
  const ok=results.filter(r=>r.status==='fulfilled'&&r.value.length>0).length;
  if(fresh.length){
    items=[...fresh,...items.filter(i=>!i.isNew)].slice(0,200); items.forEach(i=>i.isNew=false);
    renderFeed();renderTicker();renderBadge();
    setRss('ok',`✓ ${ok} מקורות · ${fresh.length} ידיעות`,'עודכן: '+new Date().toLocaleTimeString('he-IL'));
  }else{loadDemo();}
  document.getElementById('feedLoading').classList.add('gone');
}

function loadDemo(){
  if(items.length>0){setRss('ok','נתוני דמו','');return;}
  const now=new Date();
  const D=[
    {src:'ynet',lbl:'ynet',cls:'sy',hl:'פיצוץ בסמוך למתחם מסחרי',sum:'כוחות מד"א ומשטרה הגיעו.',isU:true,isP:true,isS:false},
    {src:'n12',lbl:'N12',cls:'sn12',hl:'מעצר בחשד לאיומים על קצין בכיר',sum:'החשוד נעצר.',isU:true,isP:true,isS:false}
  ];
  items=D.map((d,i)=>({...d,id:'demo-'+i,link:'#',time:new Date(now-i*8*60000).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}),dt:new Date(now-i*8*60000),isNew:false}));
  renderFeed();renderTicker();renderBadge();
  setRss('ok','מצב הדגמה','');
  document.getElementById('feedLoading').classList.add('gone');
}

function getFiltered(){if(filter==='urgent')return items.filter(i=>i.isU);if(filter==='police')return items.filter(i=>i.isP);if(filter==='security')return items.filter(i=>i.isS);return items;}

function renderFeed(){
  const list=getFiltered();
  document.getElementById('feedCount').textContent=list.length+' פריטים';
  document.getElementById('feedList').innerHTML=list.map(item=>{
    const tags=[];if(item.isU)tags.push('<span class="ftag ft-urg">דחוף</span>');if(item.isP)tags.push('<span class="ftag ft-pol">משטרה</span>');if(item.isS)tags.push('<span class="ftag ft-sec">ביטחון</span>');
    const cls=item.isU?'urg':item.isP?'pol':'';const nc=item.isNew?' new-item':'';
    const sid=encodeURIComponent(item.id);
    return `<div class="fi ${cls}${nc}" onclick="openM('${sid}')"><div class="fi-top"><span class="stag ${item.cls}">${item.lbl}</span><span class="fi-time">${item.time}</span></div><div class="fi-hl">${item.hl}</div><div class="fi-sum">${item.sum}</div>${tags.length?'<div class="fi-tags">'+tags.join('')+'</div>':''}</div>`;
  }).join('')||'<div style="padding:20px;text-align:center;color:var(--text-3);font-size:12px;">אין פריטים</div>';
}

function renderTicker(){
  const html=items.slice(0,25).map(i=>`<span class="ti"><span class="ti-src ${i.cls}">${i.lbl}</span><span class="${i.isU?'ti-urg':''}">${i.hl}</span><span class="ti-sep">|</span></span>`).join('');
  document.getElementById('tickerInner').innerHTML=html+html;
}

function renderBadge(){document.getElementById('urgBadge').textContent=items.filter(i=>i.isU).length;}
function setRss(s,t,r){document.getElementById('rssDot').className='rss-d '+(s==='load'?'load':s==='err'?'err':'ok');document.getElementById('rssTxt').textContent=t;document.getElementById('rssUpd').textContent=r;}
function setF(f,btn){filter=f;document.querySelectorAll('.flt').forEach(b=>b.className='flt');btn.classList.add('f-'+f);renderFeed();}

function openM(sid){
  const id=decodeURIComponent(sid);const item=items.find(i=>i.id===id);if(!item)return;
  activeM=item;
  document.getElementById('mSrc').textContent=item.lbl;document.getElementById('mSrc').className='modal-src '+item.cls;
  document.getElementById('mMeta').textContent=item.time+' · '+item.dt.toLocaleDateString('he-IL');
  document.getElementById('mHl').textContent=item.hl;document.getElementById('mTxt').textContent=item.sum||'אין תיאור';
  const lnk=document.getElementById('mLink');lnk.href=item.link!=='#'?item.link:'#';lnk.style.display=item.link!=='#'?'':'none';
  document.getElementById('modalBg').classList.add('open');
}
function closeM(){document.getElementById('modalBg').classList.remove('open');}
function flagM(){if(activeM)alert('✓ סומן:\n'+activeM.hl);}
function copyM(){if(activeM)navigator.clipboard.writeText(activeM.hl).then(()=>alert('הועתק!'));}

async function init(){
  renderChannelBar(); switchChByIndex(0); await fetchAll(); setInterval(fetchAll,3*60*1000);
}

init();
async function loadCustomMarquee() {
    try {
        const response = await fetch(`custom-marquee-text.json?t=${new Date().getTime()}`);
        
        if (!response.ok) {
            throw new Error(`שגיאה בטעינת הקובץ: ${response.status}`);
        }
        
        const data = await response.json();
        const marqueeElement = document.querySelector('.custom-marquee-text');
        
        if (marqueeElement && data.marqueeText) {
            marqueeElement.textContent = data.marqueeText;
        }
    } catch (error) {
        console.error('שגיאה בעדכון הטקסט הרץ:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadCustomMarquee);
setInterval(loadCustomMarquee, 30000); // רענון אוטומטי כל 30 שניות
