/* Browser UI; imports and optimization run in an isolated Web Worker. */
'use strict';
const $ = id => document.getElementById(id);
const E = createEngine();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, decimals = 1) => Number(n || 0).toLocaleString('ko-KR', {maximumFractionDigits:decimals});
const palette = ['#359b8e','#628ac2','#b79264','#9575bc','#589aab','#9cab5a','#b8798c','#647bb0','#58a877','#b8a061','#7c91a5','#967f69'];
const clone = a => JSON.parse(JSON.stringify(a));
let geo = null, agg = null, groups = [], diagnostics = null, meta = null, workbookMeta = null;
let welcomeDismissed=false;
let selected = -1, editing = -1, filter = 'all', showLabels = true, demo = false, history = [], scenarios = [], mapping = null, corrections = {};
let selectedDates = [], layer = null, labels = null, rectMode = false, rectStart = null, rectLayer = null, tile = null, toastTimer, layerMap = {}, nextWorkerID = 0;
let operationScope = new Set(), outlines = [], hoverGroup=-1, lastValidConfig=null;
const logistics={depotAddress:'경기도 용인시 처인구 남사읍 처인성로 1027',returnToDepot:false,roadProvider:null};
const waiting = new Map();
const busy = message => { $('busy').classList.remove('hidden'); $('busyText').textContent = message; };
const idle = () => $('busy').classList.add('hidden');
function toast(message) { $('status').textContent = message; $('status').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('status').style.display = 'none', 5500); }
function workerMain() {
  const e = createEngine(); let geo = null, wb = null, rows = null, data = null, agg = null;
  const sheets = name => {
    const next = XLSX.utils.sheet_to_json(wb.Sheets[name], {defval:'',raw:true});
    if (!next.length) throw Error('선택한 시트에 데이터가 없습니다.');
    rows = next;
    return { names:wb.SheetNames, sheet:name, columns:Object.keys(rows[0]), rowCount:rows.length };
  };
  onmessage = async ev => {
    const { id, type, payload:p } = ev.data;
    try {
      let result;
      if (type === 'geo') { geo = e.geometry(JSON.parse(p.text), p.key); wb = null; rows = null; data = null; agg = null; result = geo; }
      if (type === 'book') { wb = XLSX.read(p.buffer, {type:'array',cellDates:false}); result = sheets(wb.SheetNames[0]); }
      if (type === 'sheet') result = sheets(p.name);
      if (type === 'ingest') {
        if (!geo || !rows) throw Error('경계와 엑셀 파일을 먼저 선택하세요.');
        const next = e.ingest(rows, p.mapping, geo.zones, p.mode, p.corrections);
        if (!Object.keys(next.daily).length) throw Error('해석 가능한 배송일이 없습니다. 날짜 열을 다시 선택하세요.');
        data = next;
        result = { daily:data.daily, errors:data.errors, conflictCount:data.conflictCount, totalRows:data.totalRows, mode:data.mode, hasWeight:data.hasWeight, weightErrors:data.weightErrors };
      }
      if (type === 'aggregate') { if (!data) throw Error('열 매핑을 먼저 적용하세요.'); agg = e.aggregate(data, p.days); result = agg; }
      if (type === 'fill') result = e.fillEmpty(p.groups,geo,agg,p.config,p.scope);
      if (type === 'optimize') result = e.optimize(geo.zones, geo.adjacency, agg, p.config, p.locked, message => postMessage({id,progress:message}));
      if (type === 'demo') {
        geo = e.geometry(p.gj); rows = p.rows;
        data = e.ingest(rows, p.mapping, geo.zones, 'recipient'); agg = e.aggregate(data, Object.keys(data.daily));
        result = {geo,agg,meta:{daily:data.daily,errors:data.errors,conflictCount:data.conflictCount,totalRows:data.totalRows,mode:data.mode,hasWeight:data.hasWeight,weightErrors:data.weightErrors}};
      }
      postMessage({id,result});
    } catch (error) { postMessage({id,error:error.message}); }
  };
}
// Standalone exports embed XLSX; the development version imports the same pinned release.
const xlsxSource = $('xlsx-lib')?.textContent?.trim();
const workerSource = (xlsxSource || 'importScripts("https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js");') + '\n' + createEngine.toString() + '\n(' + workerMain.toString() + ')();';
const workerURL = URL.createObjectURL(new Blob([workerSource], {type:'text/javascript'}));
const worker = new Worker(workerURL); URL.revokeObjectURL(workerURL);
let workerFailed = false;
worker.onmessage = ev => { const p = ev.data, w = waiting.get(p.id); if (!w) return; if (p.progress) { $('busyText').textContent = p.progress; return; } waiting.delete(p.id); p.error ? w.reject(Error(p.error)) : w.resolve(p.result); };
worker.onerror = () => { workerFailed = true; for (const w of waiting.values()) w.reject(Error('백그라운드 처리기를 시작하지 못했습니다. 인터넷 연결 후 다시 열거나 단일 HTML 파일을 사용하세요.')); waiting.clear(); idle(); toast('처리기 오류: 페이지를 다시 열어 주세요.'); };
function rpc(type, payload, transfer = []) { return new Promise((resolve, reject) => { if (workerFailed) return reject(Error('처리기가 중단되었습니다. 페이지를 다시 열어 주세요.')); const id = ++nextWorkerID; waiting.set(id,{resolve,reject}); try { worker.postMessage({id,type,payload},transfer); } catch (error) { waiting.delete(id); reject(error); } }); }
async function task(message, fn) { busy(message); try { return await fn(); } catch (error) { console.error(error.message); toast(error.message); } finally { idle(); } }
if (typeof L === 'undefined' || typeof XLSX === 'undefined') { idle(); alert('지도 또는 엑셀 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하거나 단일 HTML 파일을 사용하세요.'); }
const map = L.map('map', {preferCanvas:true,zoomControl:false}).setView([36.5,127.6],7);
L.control.zoom({position:'bottomright'}).addTo(map); L.control.scale({imperial:false,position:'bottomright'}).addTo(map);
labels = L.layerGroup().addTo(map);
// VWORLD is the only online basemap. Never fall back to the blocked OSM tile service.
let baseTimer=null,baseGeneration=0,vworldKey='';
const validVworldKey=key=>/^[A-Za-z0-9-]{12,128}$/.test(key);
try{const saved=localStorage.getItem('mfc_vworld_key')||localStorage.getItem('vkey')||'';if(validVworldKey(saved))vworldKey=saved;}catch{}
function baseMessage(text){$('baseNoticeText').textContent=text;$('baseNotice').classList.toggle('hidden',!text);}
function setBase(){
  const generation=++baseGeneration;clearTimeout(baseTimer);baseMessage('');
  if(tile){tile.off();map.removeLayer(tile);tile=null;}
  if($('baseMap').value==='none'){$('baseState').textContent='배경 없음 · 권역 분석 가능';return;}
  $('baseMap').value='vworld';$('baseState').textContent='VWORLD 연결 중';
  const url=vworldKey?'https://api.vworld.kr/req/wmts/1.0.0/'+encodeURIComponent(vworldKey)+'/Base/{z}/{y}/{x}.png':'https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png';
  const active=L.tileLayer(url,{minZoom:6,maxZoom:19,maxNativeZoom:19,bounds:[[32,123],[39.5,132]],updateWhenIdle:true,keepBuffer:1,attribution:'&copy; <a href="https://www.vworld.kr/" target="_blank" rel="noopener">VWORLD</a>'});
  tile=active;let failures=0,loaded=0,stopped=false;
  const stop=reason=>{
    if(stopped||generation!==baseGeneration)return;stopped=true;clearTimeout(baseTimer);active.off();map.removeLayer(active);if(tile===active)tile=null;
    $('baseState').textContent='VWORLD 연결 확인 필요';
    baseMessage(reason+' 경계·물량 데이터 오류는 아닙니다. 지도 설정에서 연결을 확인하세요.');
  };
  active.on('tileload',()=>{if(generation!==baseGeneration||stopped)return;loaded++;clearTimeout(baseTimer);$('baseState').textContent='VWORLD 일반';});
  active.on('tileerror',event=>{if(event.tile)event.tile.style.visibility='hidden';if(++failures>=3)stop('VWORLD 배경지도 요청에 실패했습니다.');});
  baseTimer=setTimeout(()=>{if(!loaded)stop('VWORLD 배경지도 응답이 지연되고 있습니다.');},15000);
  active.addTo(map);active.bringToBack();
}
function basemapSettings(){
  modal('VWORLD 배경지도 설정',`<div class="banner">OpenStreetMap 타일 차단 화면을 없애기 위해 기본 배경을 VWORLD로 변경했습니다. OSM으로 자동 전환하지 않습니다.</div><p>기본 연결이 안 되면 기존 HTML에서 사용하던 VWORLD 인증키를 가져오거나 본인 키를 입력하세요. 인증키는 이 브라우저에서 VWORLD 지도 요청에만 사용하며 계획 JSON·분석 엑셀에는 넣지 않습니다.</p><label class="field" style="margin-top:15px">VWORLD 인증키 (선택)<input id="vworldKeyInput" type="password" autocomplete="off" spellcheck="false" placeholder="미입력: VWORLD 기본 타일 연결"></label><label class="check" style="margin:10px 0"><input type="checkbox" id="rememberVworldKey" checked> 이 브라우저에 키 기억</label><label class="filecard"><span>기존 MAP HTML에서 인증키 가져오기</span><input id="legacyMapInput" type="file" accept=".html,.htm,.txt"></label><p id="keyImportStatus" class="hint"></p><p class="hint" style="margin-top:12px">접속 환경: ${esc(location.protocol==='file:'?'다운로드 HTML (file://)':location.origin)}<br>네트워크·인증키·등록 도메인·서비스 상태에 따라 지도가 제한될 수 있습니다. 키를 입력해도 실패하면 VWORLD의 키 등록 도메인이 실행 주소와 맞는지 확인하세요. 키를 비우면 기본 타일 연결로 돌아갑니다. 무료 배경지도 연결만 사용하며 길찾기 API는 추가하지 않았습니다.</p>`,[{text:'배경 없이 작업',action:close=>{$('baseMap').value='none';setBase();close();}},{text:'적용 / 다시 연결',primary:true,action:close=>{
    const key=$('vworldKeyInput').value.trim();if(key&&!validVworldKey(key))return toast('VWORLD 인증키 형식을 확인하세요.');
    vworldKey=key;try{localStorage.removeItem('vkey');if($('rememberVworldKey').checked&&key)localStorage.setItem('mfc_vworld_key',key);else localStorage.removeItem('mfc_vworld_key');}catch{toast('브라우저 저장을 사용할 수 없어 이번 실행에만 적용합니다.');}
    $('baseMap').value='vworld';setBase();close();
  }}]);
  $('vworldKeyInput').value=vworldKey;
  $('legacyMapInput').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try{const text=await file.text();const found=text.match(/\b(?:const|let|var)\s+VDEF\s*=\s*['"]([A-Za-z0-9-]{12,128})['"]/i)||text.match(/\bid\s*=\s*['"]vkey['"][^>]*\bvalue\s*=\s*['"]([A-Za-z0-9-]{12,128})['"]/i);
      if(!found)throw Error('기존 HTML에서 인증키를 찾지 못했습니다. 직접 입력해 주세요.');
      if(!$('vworldKeyInput'))return;$('vworldKeyInput').value=found[1];$('keyImportStatus').textContent='인증키를 가져왔습니다. 적용 / 다시 연결을 눌러 주세요.';
    }catch(error){toast(error.message);}
  };
}
setBase();$('baseMap').onchange=setBase;$('baseSettingsBtn').onclick=basemapSettings;$('baseNoticeSettings').onclick=basemapSettings;
new ResizeObserver(() => map.invalidateSize()).observe($('map'));
const configIDs = ['basis','minBox','maxBox','targetStop','tolerance','link','gap','diameter','sameRegion','weightOn','minWeight','maxWeight','vehicleCap','density','planPolicy'];
function config() { return E.validate({basis:$('basis').value,minBox:+$('minBox').value,maxBox:+$('maxBox').value,targetStop:+$('targetStop').value,tolerance:+$('tolerance').value,link:$('link').value,gap:+$('gap').value,diameter:+$('diameter').value,sameRegion:$('sameRegion').checked,weightOn:$('weightOn').checked,minWeight:+$('minWeight').value,maxWeight:+$('maxWeight').value,vehicleCap:+$('vehicleCap').value,density:$('density').checked,planPolicy:$('planPolicy').value,han:true}); }
function setConfig(c) { for (const k of configIDs) if (k in c) ['sameRegion','weightOn','density'].includes(k) ? $(k).checked = !!c[k] : $(k).value = c[k]; }
function groupColor(i) { return groups[i]?.color || palette[i % palette.length]; }
function snapshotHistory() { history.push({groups:clone(groups),scope:[...operationScope]}); if (history.length > 30) history.shift(); $('undoBtn').disabled = false; }
function resetPlanning() { operationScope=new Set();groups=[]; selected=-1; editing=-1; history=[]; scenarios=[]; $('undoBtn').disabled=true; $('editPanel').classList.add('hidden'); }
function markData() {
  $('demoBadge').classList.toggle('hidden',!demo); $('intro').classList.toggle('hidden',!!agg||welcomeDismissed);
  $('geoMeta').textContent = geo ? fmt(Object.keys(geo.zones).length,0)+'개 경계 · '+geo.key : 'GeoJSON · .json / .txt';
  $('xlsMeta').textContent = meta ? fmt(meta.totalRows,0)+'행 · '+Object.keys(meta.daily).length+'일' : 'Excel · .xlsx / .xls / .csv';
  $('selectedDays').textContent = selectedDates.length+'일';
  $('auditCount').textContent = meta ? fmt(meta.errors.length+(meta.weightErrors?.length||0),0) : '0';
  $('auditCount').className='badge'+(meta?.errors.length||meta?.weightErrors?.length?' warn':'');
  $('scopeSummary').textContent='0물량 편입 운영지역: '+(operationScope.size?fmt(operationScope.size,0)+'개 구역':'미지정');
  if (selectedDates.length) { $('dateFrom').value=selectedDates[0]; $('dateTo').value=selectedDates.at(-1); }
  $('runHint').textContent = agg ? '기존 담당 유지 · 자동 경계 교환 없음' : '경계와 배송 데이터를 먼저 불러오세요';
}
function render(rebuild=false,fit=false) {
  markData();
  let c; try { c=config();lastValidConfig=c; } catch { return; }
  diagnostics = agg && geo ? E.diagnose(groups,geo,agg,c) : null;
  const sumMode=$('displayMode').value==='sum',factor=sumMode?(agg?.dates.length||1):1,label=sumMode?'기간합계':'일평균';
  $('kpiBox').textContent=agg?fmt(agg.avgBox*factor):'—'; $('kpiStop').textContent=agg?fmt(agg.avgStop*factor):'—';
  $('boxLabel').textContent=label+' 박스';$('stopLabel').textContent=label+' 착지';$('weightLabel').textContent=label+' 중량';
  $('kpiWeight').textContent=agg?.hasWeight&&!agg.unknownWeight?fmt(agg.knownWeight/(sumMode?1:agg.dates.length)):'—';
  $('weightStatus').textContent=!agg?.hasWeight?'중량 열 미지정':agg.unknownWeight?'미확인 '+fmt(agg.unknownWeight,0)+'행':'행 총중량 kg 합산';
  $('stopModeLabel').textContent=meta?.mode==='building'?'일자 + 건물 주소 기준':'일자 + 수취인 + 상세주소 기준';
  $('kpiGroups').textContent=groups.length; $('groupCount').textContent=groups.length;
  $('kpiValid').textContent=groups.length?Math.round(diagnostics.valid/groups.length*100):'—';
  $('kpiGroupSub').textContent=groups.length?'잠금 '+groups.filter(g=>g.locked).length+'개 · 검토 '+(groups.length-diagnostics.valid)+'개':'최적화 실행 후 표시';
  $('kpiValidSub').textContent=groups.length?diagnostics.valid+'개 충족 / '+groups.length+'개 권역':'박스 · 착지 · 공간 조건';
  $('mapBadge').textContent=demo?'가상 샘플':agg?'분석 중':'데이터 대기';
  $('groupSubtitle').textContent=c.basis==='avg'?'일평균 기준 · 상한 및 연결성 검토':'일별 최대 기준 · 모든 선택일 검토';
  $('unassignedText').textContent='미배정 '+(diagnostics?.unassigned.length||0)+'개 구역';
  $('mapFoot').textContent=agg?'매칭 '+fmt(Object.keys(agg.demand).length,0)+'개 구역 · '+agg.dates.length+'일 · 제외 '+fmt(agg.rejectedRows,0)+'행':'경계와 배송 데이터를 기다리고 있습니다';
  if (agg) {
    const capacityLB=Math.max(Math.ceil(agg.avgBox/c.maxBox),Math.ceil(agg.avgStop/(c.targetStop+c.tolerance)));
    $('noticeText').textContent='물량 기준 권역 수 하한 약 '+capacityLB+'개 (일평균 기준, 공간 조건 미반영). '+(c.link==='strict'?'공유 선분 인접 기준.':'근거리 연결은 실제 도로 동선이 아닙니다.');
  }
  const feasibility=agg?E.feasibility(agg,c):null;
  if(feasibility?.conflict)$('noticeText').textContent='조건 충돌: 상한 준수에는 최소 '+feasibility.lower+'개 권역, 하한 충족에는 최대 '+feasibility.upper+'개 권역이 필요합니다. 전체 권역의 동시 목표 충족은 불가능합니다. 하한/착지 목표를 검토하세요 (공간 제약 이전의 필요조건).';
  $('noticeText').parentElement.classList.toggle('banner',!!feasibility?.conflict);
  renderList();
  if (rebuild) rebuildMap(fit); else paintMap();
}
function qvalue(n,kind='avg',over=false){return `<b class="${n==null?'unknown-value':over?'over-value':kind==='peak'?'peak-value':kind==='sum'?'sum-value':'avg-value'}">${n==null?'미확인':fmt(n)}</b>`;}
function quantities(s,peaks=true) {
  const sumMode=$('displayMode').value==='sum',kind=sumMode?'sum':'avg';
  let html=`<div class="quantity-line">${sumMode?'기간합계':'일평균'} · ${qvalue(sumMode?s.totalBox:s.avgBox,kind)} 박스 / ${qvalue(sumMode?s.totalStops:s.avgStop,kind)} 착지 / ${qvalue(sumMode?s.totalWeight:s.avgWeight,kind)} kg</div>`;
  if(peaks)html+=`<div class="quantity-line">최대일 · ${qvalue(s.peakBox,'peak',s.peakBox>+$('maxBox').value)} 박스 / ${qvalue(s.peakStop,'peak',s.peakStop>+$('targetStop').value + +$('tolerance').value)} 착지 / ${qvalue(s.peakWeight,'peak',$('weightOn').checked&&s.peakWeight>Math.min(+$('maxWeight').value,+$('vehicleCap').value))} kg</div><div class="hint">지표별 최대일은 서로 다를 수 있습니다.</div>`;
  return html;
}
function summary(i=selected) {
  const g=groups[i],s=diagnostics?.groups[i];$('selectedSummary').classList.toggle('hidden',!g||!s);
  if(g&&s)$('selectedSummary').innerHTML=`<h3>${esc(g.name)} <span class="badge">${hoverGroup>=0?'마우스오버':'선택 권역'}</span></h3>${quantities(s)}<div class="hint">${g.zips.length}개 구역 · 0물량 ${s.empty}개 · 중심부 ${g.core?.length||0}개</div>`;
}
function renderList() {
  const q=$('groupSearch').value.trim().toLowerCase();
  const visible=groups.map((g,i)=>({g,i,s:diagnostics.groups[i]})).filter(({g,s})=>(!q||g.name.toLowerCase().includes(q)||g.zips.some(z=>z.includes(q)))&&(filter!=='issue'||!s.valid)&&(filter!=='valid'||s.valid)&&(filter!=='locked'||g.locked));
  $('groupList').innerHTML=visible.map(({g,i,s})=>`<article class="groupcard ${selected===i?'selected':''}" style="--group-color:${groupColor(i)}" data-group="${i}" tabindex="0" role="button" aria-label="${esc(g.name)} 상세"><div class="between"><span class="name">${esc(g.name)}</span><span class="badge ${s.valid?'green':s.issues.some(x=>/초과|혼합/.test(x))?'red':'warn'}">${g.locked?'잠금 · ':''}${s.valid?'범위 충족':'검토 필요'}</span></div>${quantities(s)}<div class="bartrack"><div style="background:${groupColor(i)};width:${Math.min(100,s.box/+$('maxBox').value*100)}%"></div></div><div class="gmeta" style="margin-top:8px"><span>${g.zips.length}구역 · 0물량 ${s.empty} · 직경 ${fmt(s.diameter)}/${fmt(s.allowedDiameter)}km</span><div class="mini-actions"><button data-action="lock" data-i="${i}">${g.locked?'해제':'잠금'}</button><button data-action="edit" data-i="${i}">편집</button><button data-action="detail" data-i="${i}">상세</button></div></div>${g.core?.length?`<div class="hint">중심부 ${g.core.length}개 고정</div>`:''}${s.issues.length?`<div class="gissues">${s.issues.map(esc).join(' · ')}</div>`:''}${s.proximity?'<div class="hint">근거리 연결 포함 · 경계 연속 아님</div>':''}</article>`).join('')||`<div class="empty-results">${groups.length?'조건에 맞는 권역이 없습니다.':'데이터를 불러와 권역을 설계하세요.'}</div>`;
  summary();
}

let owners={};
function style(z) {
  const i=owners[z],on=selected===i,dim=selected>=0&&!on,has=!!agg?.demand[z],value=(agg?.demand[z]?.avgBox||0)*($('displayMode').value==='sum'?(agg?.dates.length||1):1);
  let color=i==null?'#c0bdaf':groupColor(i);
  if(agg?.excludedZips?.includes(z))color='#d17a87';
  else if($('mapView').value==='volume')color=value===0?'#e9eef2':value<5?'#d2eee7':value<15?'#8ac9b9':value<30?'#359e8c':value<60?'#e8ac69':'#c9544e';
  return {fillColor:color,color:i==null?'#989e9b':'#5b7f83',weight:.45,fillOpacity:dim?.09:has?.64:i==null?.08:.22,dashArray:!has&&i==null?'3,3':null};
}
function legend3(){
  const sumMode=$('displayMode').value==='sum';
  $('mapLegend').innerHTML=$('mapView').value==='volume'?`<b>${sumMode?'기간합계':'일평균'} 박스</b>`+[[0,'#e9eef2','0'],[5,'#d2eee7','0 초과~5 미만'],[15,'#8ac9b9','5~15 미만'],[30,'#359e8c','15~30 미만'],[60,'#e8ac69','30~60 미만'],[999,'#c9544e','60 이상']].map(([,c,t])=>`<span><i style="background:${c}"></i>${t}</span>`).join(''):'<b>담당 권역</b><span><i style="background:#d17a87"></i>제외 데이터</span><span><i style="background:#359b8e"></i>물량 있음</span><span><i style="background:#359b8e;opacity:.3"></i>같은 권역 · 0물량</span><span><i style="background:#c0bdaf"></i>미배정</span><span style="color:#2d76ba">파란 점선: 한강 분리 기준</span>';
}
function buildOutlines(){
  outlines.forEach(l=>map.removeLayer(l));outlines=[];if(!geo)return;
  const maps=groups.map(()=>new Map());
  for(const f of geo.gj.features){const i=owners[f.properties.__zip];if(i==null)continue;const ps=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    for(const rings of ps)for(const ring of rings)for(let j=1;j<ring.length;j++){const a=ring[j-1],b=ring[j],ak=a.slice(0,2).map(v=>v.toFixed(6)).join(','),bk=b.slice(0,2).map(v=>v.toFixed(6)).join(','),key=ak<bk?ak+':'+bk:bk+':'+ak;if(maps[i].has(key))maps[i].delete(key);else maps[i].set(key,[[a[1],a[0]],[b[1],b[0]]]);}
  }
  maps.forEach((edges,i)=>{const l=L.polyline([...edges.values()],{interactive:false,color:groupColor(i),weight:1.5,opacity:.85}).addTo(map);l.groupIndex=i;outlines.push(l);});
}

function rebuildMap(fit) {
  if (layer) map.removeLayer(layer); layer=null; layerMap={}; labels.clearLayers();
  if (!geo||!agg) {outlines.forEach(l=>map.removeLayer(l));outlines=[];return;}
  const assigned=new Set(groups.flatMap(g=>g.zips));
  const features=geo.gj.features.filter(f=>agg.demand[f.properties.__zip]||assigned.has(f.properties.__zip)||operationScope.has(f.properties.__zip));
  layer=L.geoJSON({type:'FeatureCollection',features},{smoothFactor:1.3,style:f=>style(f.properties.__zip),onEachFeature:(f,l)=>{
    const z=f.properties.__zip; (layerMap[z] ||= []).push(l);
    l.bindTooltip(()=>{const i=owners[z],d=E.stats([z],agg.demand,agg.dates,geo.zones,lastValidConfig||config());return `<b>${esc(z)}</b> ${esc(geo.zones[z].city)} <span class="badge">${{north:'강북',south:'강남',outside:'분리대상 외',unknown:'한강 미확인'}[geo.zones[z].river]}</span><div class="hint">해당 폴리곤${agg.excludedZips?.includes(z)?' · 제외 데이터 확인':agg.demand[z]?'':' · 선택기간 0물량'}</div>${agg.excludedZips?.includes(z)?'<div class="over-value">오류로 제외된 행이 있습니다. 0물량으로 판단하지 마세요.</div>':''}${quantities(d,false)}${i!=null?`<hr><b>권역 전체 · ${esc(groups[i].name)}</b>${quantities(diagnostics.groups[i])}`:'미배정'}${editing>=0?'<br>클릭: 현재 선택 동작으로 편집':''}`;},{sticky:true});
    l.on('mouseover',()=>{hoverGroup=owners[z]??-1;summary(hoverGroup>=0?hoverGroup:selected);});
    l.on('mouseout',()=>{hoverGroup=-1;summary();});
    l.on('click',e=>{if(rectMode)return; L.DomEvent.stopPropagation(e); if(editing>=0) {if($('drawAction').value==='remove')changeZips([z],true);else toggleZip(z);} else if(owners[z]!=null) selectGroup(owners[z]); else toast(z+' · 미배정 구역입니다. 빈 권역을 만들거나 편집으로 추가하세요.');});
  }}).addTo(map);
  paintMap();buildOutlines();paintMap(); if(fit&&features.length) map.fitBounds(layer.getBounds(),{padding:[24,24],maxZoom:12});
}
function paintMap() {
  owners={};groups.forEach((g,i)=>g.zips.forEach(z=>owners[z]=i));
  for(const [z,ls] of Object.entries(layerMap)) for(const l of ls) l.setStyle(style(z));
  legend3();summary();outlines.forEach(l=>l.setStyle({color:selected===l.groupIndex?'#153d48':groupColor(l.groupIndex),weight:selected===l.groupIndex?2.8:1.4,opacity:selected>=0&&selected!==l.groupIndex?.18:.9}));
  labels.clearLayers();
  if(showLabels) groups.forEach((g,i)=>{if(!g.zips.length||selected>=0&&selected!==i)return; const zs=g.zips.map(z=>geo.zones[z]).filter(Boolean);if(!zs.length)return;
    const lat=zs.reduce((s,z)=>s+z.lat,0)/zs.length,lng=zs.reduce((s,z)=>s+z.lng,0)/zs.length;
    L.marker([lat,lng],{interactive:false,icon:L.divIcon({className:'',html:`<span class="zone-label" style="border-color:${groupColor(i)}">${esc(g.name)}</span>`})}).addTo(labels);
  });
}
function selectGroup(i,zoom=false) {selected=i;renderList();paintMap();if(zoom){const layers=groups[i].zips.flatMap(z=>layerMap[z]||[]);if(layers.length)map.fitBounds(L.featureGroup(layers).getBounds(),{padding:[35,35],maxZoom:14});}}
function modal(title,html,buttons=[]) {
  const before=document.activeElement;
  $('modalRoot').innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><h2 id="modalTitle">${esc(title)}</h2><button id="closeModal" aria-label="닫기">×</button></div><div class="modal-body">${html}</div><div class="modal-foot">${buttons.map((b,i)=>`<button id="modalAction${i}" class="${b.primary?'primary':''}">${esc(b.text)}</button>`).join('')}</div></section></div>`;
  const close=()=>{$('modalRoot').innerHTML='';before?.focus();}; $('closeModal').onclick=close;
  $('modalRoot').firstChild.onclick=e=>{if(e.target===$('modalRoot').firstChild)close();};
  buttons.forEach((b,i)=>$('modalAction'+i).onclick=()=>b.action(close));
  $('closeModal').focus();
  $('modalRoot').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const a=[...$('modalRoot').querySelectorAll('button:not(:disabled),input,select,textarea,[tabindex="0"]')];if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0].focus();}}};
}
async function loadGeo(file) {
  if(!file)return;
  if(agg&&!confirm('경계 파일을 변경하면 현재 분석·계획이 초기화됩니다. 계획을 저장하셨나요?'))return;
  await task('경계 파일 검사 및 인접 그래프 구성 중',async()=>{
    const text=await file.text(); let candidate;
    try{candidate=await rpc('geo',{text});}catch(error){if(!error.message.includes('속성'))throw error;const key=prompt('우편번호 속성명 (예: BAS_ID)');if(!key)return;candidate=await rpc('geo',{text,key});}
    geo=candidate;agg=null;meta=null;workbookMeta=null;mapping=null;selectedDates=[];demo=false;corrections={};resetPlanning();
    $('geoName').textContent=file.name;$('xlsName').textContent='배송 RAWDATA 선택';render(true);
    toast('경계 '+fmt(Object.keys(geo.zones).length,0)+'개 준비 완료'+(geo.rejected.length?' · 제외 '+geo.rejected.length+'개':'')+' · 배송 엑셀을 선택하세요.');
  });
}
async function loadWorkbook(file) {
  if(!file)return;
  if(!geo)return toast('먼저 경계 파일을 불러오세요.');
  if(agg&&!confirm('배송 데이터를 교체합니다. 기존 담당 권역은 유지하고 새 물량으로 재평가합니다. 계속할까요?'))return;
  await task('엑셀 읽는 중 · 대용량 파일은 잠시 기다려 주세요',async()=>{
    const buffer=await file.arrayBuffer();workbookMeta=await rpc('book',{buffer},[buffer]);
    $('xlsName').textContent=file.name;showMapping();
  });
}
function guessMapping(columns) {
  const pick=re=>columns.find(k=>re.test(k))||'';
  return {date:pick(/배송종료일자|배송일|날짜|일자|date/i),zip:pick(/우편|zip|post/i),box:pick(/수량|박스|box|qty/i),address:pick(/배송지주소|주소|addr/i),recv:pick(/받는|수취|수하|고객|거래처|receiver/i),weight:pick(/중량|무게|weight|kg/i)};
}
function showMapping() {
  if(!workbookMeta)return toast('실제 엑셀 파일을 먼저 불러오세요.');
  const m=mapping||guessMapping(workbookMeta.columns);
  const fields=[['date','배송일 (필수)'],['zip','우편번호 (필수)'],['box','박스 수량 (필수)'],['address','배송지 주소 (필수)'],['recv','수취인 (선택)'],['weight','행 총중량 kg (선택·G열 권장)']];
  modal('엑셀 열 매핑',`<p class="hint">자동 추정된 열을 반드시 확인하세요. 수량은 박스 단위로 환산된 열을 선택해야 합니다. 첫 번째 행을 헤더로 사용합니다. G열 헤더는 ‘중량(kg)’ 권장. 각 행의 총중량을 입력하며 박스당 중량을 입력하면 안 됩니다. 빈 중량은 0으로 간주하지 않습니다.</p><div class="fields" style="margin-top:15px"><label class="field wide">시트<select id="sheetSelect">${workbookMeta.names.map(n=>`<option ${n===workbookMeta.sheet?'selected':''}>${esc(n)}</option>`).join('')}</select></label>${fields.map(([k,l])=>`<label class="field">${l}<select id="col_${k}"><option value="">선택 안 함</option>${workbookMeta.columns.map(h=>`<option value="${esc(h)}" ${m[k]===h?'selected':''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}<label class="field wide">착지 집계 기준<select id="stopMode"><option value="recipient" ${meta?.mode!=='building'?'selected':''}>일자 + 수취인 + 상세주소 (보수적 기준)</option><option value="building" ${meta?.mode==='building'?'selected':''}>일자 + 건물주소 (같은 건물 수취인 통합)</option></select></label></div><div class="banner">같은 배송 건의 여러 행은 박스를 모두 더하고, 같은 날의 착지는 한 번만 셉니다. 0·음수·잘못된 수량은 제외하고 검증 목록에 남깁니다.</div><p class="hint">${fmt(workbookMeta.rowCount,0)}행 · 주소가 없는 행은 착지 과소 집계를 막기 위해 제외됩니다. 건물 통합은 도로명 주소에 한해 건물번호 뒤를 제거하며, 지번 주소는 상세주소를 그대로 사용합니다.</p>`,[{text:'데이터 적용',primary:true,action:async close=>{
    const chosen=Object.fromEntries(fields.map(([k])=>[k,$('col_'+k).value])),mode=$('stopMode').value;
    if(['date','zip','box','address'].some(k=>!chosen[k]))return toast('필수 열 네 개를 모두 선택하세요.');
    if(new Set(Object.values(chosen).filter(Boolean)).size!==Object.values(chosen).filter(Boolean).length)return toast('서로 다른 열을 선택해 주세요.');
    close();await task('우편번호 매칭 및 착지 중복 제거 중',async()=>{
      const result=await rpc('ingest',{mapping:chosen,mode,corrections});
      const days=Object.keys(result.daily).sort();if(!days.length)throw Error('해석 가능한 배송일이 없습니다. 날짜 열을 다시 선택하세요.');
      const next=await rpc('aggregate',{days});mapping=chosen;meta=result;agg=next;selectedDates=days;demo=false;scenarios=[];history=[];selected=-1;editing=-1;$('editPanel').classList.add('hidden');$('undoBtn').disabled=true;render(true,true);
      toast('적용 완료 · '+fmt(agg.acceptedRows,0)+'행 매칭 / '+fmt(meta.errors.length,0)+'행 검토');
    });
  }}]);
  $('sheetSelect').onchange=async e=>{await task('시트 변경 중',async()=>{workbookMeta=await rpc('sheet',{name:e.target.value});mapping=null;showMapping();});};
}
async function applyDates(days) {
  if(!meta)return toast('배송 데이터를 먼저 적용하세요.');
  if(!days.length)return toast('배송일을 한 개 이상 선택하세요.');
  await task('선택 기간 재집계 중',async()=>{const next=await rpc('aggregate',{days});agg=next;selectedDates=next.dates;render(true);toast('기간 적용 완료 · 기존 권역을 새 물량으로 재평가했습니다. 필요하면 최적화를 다시 실행하세요.');});
}
function showCalendar() {
  if(!meta)return toast('배송 데이터를 먼저 적용하세요.');
  const all=Object.keys(meta.daily).sort(), chosen=new Set(selectedDates), months=[...new Set(all.map(d=>d.slice(0,7)))];
  const body=()=>`<p class="hint">개별 날짜를 눌러 선택합니다. 데이터가 존재하는 날만 선택할 수 있습니다.</p><div class="flex" style="margin:12px 0"><button data-day-preset="all">전체</button><button data-day-preset="none">해제</button><button data-day-preset="weekday">평일</button><button data-day-preset="weekend">주말</button><b id="calendarCount" style="margin-left:auto;font-size:calc(12px + var(--ui-font-increase));color:var(--teal)">${chosen.size}일 선택</b></div>${months.map(m=>{const start=new Date(m+'-01T12:00:00').getDay(),last=new Date(+m.slice(0,4),+m.slice(5,7),0).getDate();return `<h3>${m}</h3><div class="calendar-grid">${['일','월','화','수','목','금','토'].map(d=>`<span class="daylabel">${d}</span>`).join('')}${'<span></span>'.repeat(start)}${Array.from({length:last},(_,i)=>{const d=m+'-'+String(i+1).padStart(2,'0'),v=meta.daily[d];return `<button ${v?'':'disabled'} data-day="${d}" class="${chosen.has(d)?'active':''}">${i+1}<small>${v?fmt(v.boxes,0)+'박스':'—'}</small></button>`;}).join('')}</div>`;}).join('')}`;
  modal('분석할 배송일 선택',body(),[{text:'선택한 날짜 적용',primary:true,action:close=>{if(!chosen.size)return toast('한 개 이상 선택하세요.');close();applyDates([...chosen].sort());}}]);
  const update=()=>{document.querySelectorAll('[data-day]').forEach(b=>b.classList.toggle('active',chosen.has(b.dataset.day)));$('calendarCount').textContent=chosen.size+'일 선택';};
  document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{chosen.has(b.dataset.day)?chosen.delete(b.dataset.day):chosen.add(b.dataset.day);update();});
  document.querySelectorAll('[data-day-preset]').forEach(b=>b.onclick=()=>{chosen.clear();all.forEach(d=>{const w=new Date(d+'T12:00:00').getDay();if(b.dataset.dayPreset==='all'||b.dataset.dayPreset==='weekday'&&w>0&&w<6||b.dataset.dayPreset==='weekend'&&(w===0||w===6))chosen.add(d);});update();});
}
async function run() {
  if(!agg||!Object.keys(agg.demand).length)return toast('매칭된 배송 데이터를 먼저 조회하세요.');
  let c;try{c=config();}catch(e){return toast(e.message);}
  if(c.planPolicy==='rebuild'&&groups.some(g=>!g.locked&&!g.core?.length)&&!confirm('명시적 재설계: 잠금/중심부가 없는 권역만 재생성합니다. 기존 경계를 교환할 수 있습니다. 계속할까요?'))return;
  const check=E.feasibility(agg,c);
  if(check?.conflict&&!confirm('현재 물량과 목표가 상충합니다. 상한을 지키려면 최소 '+check.lower+'개 권역이지만 하한을 채울 수 있는 권역 수는 최대 '+check.upper+'개입니다. 미달을 표시한 채 제안안을 계산할까요?'))return;
  await task('인접 지역과 용량 제약 분석 중',async()=>{
    const start=performance.now(),result=await rpc('optimize',{config:c,locked:c.planPolicy==='preserve'?groups:groups.filter(g=>g.locked||g.core?.length)});
    snapshotHistory();groups=result.map((g,i)=>({...g,color:g.color||palette[i%palette.length]}));selected=-1;editing=-1;$('editPanel').classList.add('hidden');render(true);
    toast(groups.length+'개 권역 생성 · 목표 충족 '+diagnostics.valid+'개 · '+fmt((performance.now()-start)/1000)+'초');
  });
}
function audit() {
  if(!meta)return toast('배송 데이터를 먼저 불러오세요.');
  const qualityErrors=[...meta.errors,...(meta.weightErrors||[]).map(r=>({...r,zip:'',box:null}))];
  const reasons={};qualityErrors.forEach(r=>reasons[r.reason]=(reasons[r.reason]||0)+1);
  modal('데이터 품질 검증',`<p class="hint">전체 파일 검사 결과와 선택 기간 집계는 구분됩니다. 날짜·주소·우편번호 오류 행은 제외됩니다. 중량 오류 행의 박스·착지는 유지하되, 중량 조건 실행을 차단합니다.</p><div class="summary-strip"><span>전체 파일 <b>${fmt(meta.totalRows,0)}</b>행</span><span>전체 오류 <b>${fmt(qualityErrors.length,0)}</b>행</span><span>선택기간 제외 <b>${fmt(agg?.rejectedRows,0)}</b>행 / <b>${fmt(agg?.rejectedBoxes)}</b>박스</span></div>${meta.conflictCount?`<div class="banner">같은 착지 키에 서로 다른 우편번호가 있는 경우 ${fmt(meta.conflictCount,0)}건. 임의로 첫 우편번호에 합치지 않고 원본 우편번호별로 집계했습니다. 원본을 확인해 주세요.</div>`:''}<div class="flex" style="flex-wrap:wrap">${Object.entries(reasons).map(([k,v])=>`<span class="badge warn">${esc(k)} ${fmt(v,0)}행</span>`).join('')||'<span class="badge green">오류가 발견되지 않았습니다</span>'}</div><div class="table-scroll"><table><thead><tr><th>원본 행</th><th>배송일</th><th>원본 우편번호</th><th>박스</th><th>제외 사유</th></tr></thead><tbody>${qualityErrors.slice(0,100).map(r=>`<tr><td>${r.row}</td><td>${esc(r.date)}</td><td>${esc(r.zip)}</td><td>${fmt(r.box)}</td><td>${esc(r.reason)}</td></tr>`).join('')}</tbody></table></div><p class="hint">화면은 최대 100행 표시. 전체 내역은 오류 CSV 또는 결과 엑셀로 내보낼 수 있습니다.<br>우편번호 보정 CSV: <b>원본우편번호,신우편번호</b> 두 열. 같은 원본 번호 전체에 적용되므로 거래처별 보정이 필요하면 원본 엑셀을 수정하세요. 보정표는 현재 브라우저 작업에만 유지됩니다.</p>`,[{text:'전체 오류 CSV',action:()=>downloadCSV('데이터검증.csv',[['원본행','배송일','원본우편번호','수량','사유'],...qualityErrors.map(r=>[r.row,r.date,r.zip,r.box,r.reason])])},{text:'보정 CSV 적용',action:()=>$('fixInput').click()}]);
}
function csvSafe(v) {let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function download(content,name,type) {const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadCSV(name,rows) {download('\ufeff'+rows.map(r=>r.map(csvSafe).join(',')).join('\r\n'),name,'text/csv;charset=utf-8');}
function edit(i) {
  if(groups[i].locked)return toast('잠금을 해제한 뒤 편집하세요.');editing=i;selectGroup(i);$('editPanel').classList.remove('hidden');$('editTitle').textContent=groups[i].name+' 편집';$('editZips').value='';toast('지도에서 구역을 클릭하거나 우편번호를 입력하세요. 변경 후 제약을 다시 검사합니다.');
}
function changeZips(zips,remove=false) {
  const g=groups[editing];if(!g||g.locked)return toast('편집 가능한 권역을 선택하세요.');
  const missing=zips.filter(z=>!geo.zones[z]);if(missing.length)return toast('경계 없는 우편번호: '+missing.slice(0,8).join(', '));
  if(!remove&&groups.some((a,i)=>i!==editing&&a.locked&&a.zips.some(z=>zips.includes(z))))return toast('잠긴 권역의 구역은 이동할 수 없습니다.');
  if(remove&&zips.some(z=>g.core?.includes(z)))return toast('고정 중심부는 제외할 수 없습니다. 고정 해제 후 편집하세요.');
  if(!remove&&groups.some((a,i)=>i!==editing&&a.core?.some(z=>zips.includes(z))))return toast('다른 권역의 고정 중심부는 이동할 수 없습니다.');
  if(!remove&&config().han&&!E.riverCompatible([...g.zips,...zips],geo.zones))return toast('강남·강북 혼합 또는 한강 분리 미확인 구역은 함께 편입할 수 없습니다.');
  snapshotHistory();if(remove)g.zips=g.zips.filter(z=>!zips.includes(z));else{groups.forEach((a,i)=>{if(i!==editing)a.zips=a.zips.filter(z=>!zips.includes(z));});g.zips=[...new Set([...g.zips,...zips])];}
  render(true);const s=diagnostics.groups[editing];toast(s.issues.length?'편집 반영 · '+s.issues.join(' / '):'편집 반영 · 모든 조건 충족');
}
function parseZips() {const a=$('editZips').value.trim().split(/[\s,;]+/).filter(Boolean);if(!a.length||a.some(z=>!E.zip(z))){toast('3~5자리 우편번호를 정확히 입력하세요.');return [];}return [...new Set(a.map(E.zip))];}
function toggleZip(z) {changeZips([z],groups[editing].zips.includes(z));}
function detail(i) {
  const g=groups[i],s=diagnostics.groups[i];selectGroup(i,true);
  const max=Math.max(1,...s.boxes,+$('maxBox').value);
  modal(g.name+' · 권역 상세',`<div class="between"><span class="badge ${s.valid?'green':'warn'}">${s.valid?'설정 범위 충족':s.issues.map(esc).join(' · ')}</span><span class="hint">${g.zips.length}개 구역 · 대표점 직경 ${fmt(s.diameter)}km</span></div><div class="summary-strip">${quantities(s)}<span>상한 초과일 <b>${s.overDays}</b> / ${agg.dates.length}일</span></div><p class="hint">박스 최대: ${s.peakBoxDate} · 착지 최대: ${s.peakStopDate} · 중량 최대: ${s.peakWeightDate||'미확인'}</p><h3>날짜별 박스 물량</h3><div class="chart">${agg.dates.map((d,j)=>`<div class="col ${s.boxes[j]>+$('maxBox').value?'over':''}" title="${d}: ${fmt(s.boxes[j])}박스 / ${fmt(s.stops[j])}착지"><i style="height:${s.boxes[j]/max*100}%"></i><small>${d.slice(8)}</small></div>`).join('')}</div><p class="hint">주황 막대: 박스 상한 초과일. 평균 조건 충족과 매일의 용량 충족은 다를 수 있습니다.</p><div class="fields" style="margin-top:18px"><label class="field wide">권역명<input id="renameInput" maxlength="60" value="${esc(g.name)}" ${g.locked?'disabled':''}></label></div><div class="table-scroll"><table><thead><tr><th>우편번호</th><th>지역</th><th>평균 박스</th><th>평균 착지</th><th>평균 kg</th><th>담당 상태</th></tr></thead><tbody>${g.zips.map(z=>`<tr><td>${esc(z)}</td><td>${esc(geo.zones[z]?.city||'')}</td><td>${fmt(agg.demand[z]?.avgBox)}</td><td>${fmt(agg.demand[z]?.avgStop)}</td><td>${agg.demand[z]?.avgWeight==null?'미확인':fmt(agg.demand[z].avgWeight)}</td><td>${g.core?.includes(z)?'중심부 고정':agg.demand[z]?'물량 있음':'0물량'}</td></tr>`).join('')}</tbody></table></div><p class="hint">${s.proximity?'이 권역에는 경계가 직접 이어지지 않는 근거리 연결이 있습니다. 실제 도로 연결을 확인해 주세요.':'공유 선분 기준 연결성이 확인되었습니다 (실제 도로 연결과는 다름).'}</p>`,[{text:'권역 삭제',action:close=>{if(g.locked||g.core?.length)return toast('잠금/중심부가 있는 권역은 고정을 해제한 뒤 삭제하세요.');if(confirm(g.name+'을 삭제할까요?')){snapshotHistory();groups.splice(i,1);selected=-1;editing=-1;$('editPanel').classList.add('hidden');render(true);close();}}},{text:'이름 저장',primary:true,action:close=>{if(g.locked)return toast('잠긴 권역은 수정할 수 없습니다.');const name=$('renameInput').value.trim();if(!name)return toast('권역명을 입력하세요.');snapshotHistory();g.name=name;render();close();}}]);
}
function saveSnapshot() {
  if(!groups.length)return toast('비교할 권역이 없습니다.');
  const name=prompt('시나리오 이름','시나리오 '+(scenarios.length+1));if(!name?.trim())return;
  scenarios.push({name:name.trim().slice(0,60),config:config(),groups:clone(groups),dates:[...agg.dates],diagnostics:clone(diagnostics),total:agg.totalBox,mode:agg.mode,scope:[...operationScope],hasWeight:agg.hasWeight,knownWeight:agg.knownWeight,unknownWeight:agg.unknownWeight});if(scenarios.length>5)scenarios.shift();toast('비교 목록에 저장했습니다. 최대 5개까지 유지됩니다.');
}
function compare() {
  modal('시나리오 비교',`<p class="hint">같은 데이터 파일 안에서 조건과 분석 날짜를 바꿔 비교할 수 있습니다. 서로 다른 기간의 결과는 물량이 달라 직접적인 우열 비교가 어렵습니다. 최대 5개를 메모리에 보관하며 새 데이터 적용 시 초기화합니다.</p>${scenarios.length?`<div class="table-scroll"><table><thead><tr><th>지표</th>${scenarios.map(s=>`<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${[['권역 수',s=>s.groups.length],['범위 충족',s=>s.diagnostics.valid+' / '+s.groups.length],['상한 초과 권역',s=>s.diagnostics.over],['미배정 구역',s=>s.diagnostics.unassigned.length],['분석 날짜',s=>s.dates.length+'일 ('+s.dates[0]+' ~ '+s.dates.at(-1)+')'],['박스 총합',s=>fmt(s.total)],['중량 합계 kg',s=>s.hasWeight&&!s.unknownWeight?fmt(s.knownWeight):'미확인'],['중량 범위 kg',s=>s.config.weightOn?s.config.minWeight+' ~ '+s.config.maxWeight:'사용 안 함'],['차량 적재한도 kg',s=>s.config.vehicleCap||'미지정'],['판정 기준',s=>s.config.basis==='avg'?'일평균':'일별 최대'],['박스 범위',s=>s.config.minBox+' ~ '+s.config.maxBox],['착지 범위',s=>Math.max(0,s.config.targetStop-s.config.tolerance)+' ~ '+(s.config.targetStop+s.config.tolerance)],['연결 기준',s=>s.config.link==='strict'?'경계 인접':'인접 + '+s.config.gap+'km'],['최대 직경',s=>s.config.diameter+'km']].map(([l,fn])=>`<tr><td>${l}</td>${scenarios.map(s=>`<td>${esc(fn(s))}</td>`).join('')}</tr>`).join('')}<tr><td>작업</td>${scenarios.map((s,i)=>`<td><button data-restore="${i}">이 계획 복원</button></td>`).join('')}</tr></tbody></table></div>`:'<div class="empty-results">권역을 생성한 후 우측 아래 ‘비교에 저장’을 눌러 주세요.</div>'}`,[{text:'현재 계획을 비교에 저장',action:close=>{close();saveSnapshot();}}]);
  document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const s=scenarios[+b.dataset.restore];if(!confirm('현재 조건·날짜·권역을 저장된 시나리오로 바꿀까요?'))return;$('modalRoot').innerHTML='';task('시나리오 복원 중',async()=>{const next=await rpc('aggregate',{days:s.dates});snapshotHistory();agg=next;selectedDates=[...s.dates];setConfig(s.config);operationScope=new Set(s.scope||[]);groups=clone(s.groups);selected=-1;editing=-1;$('editPanel').classList.add('hidden');render(true);});});
}
function geoFingerprint() {let h=2166136261;for(const z of Object.keys(geo.zones).sort()){const s=z+geo.zones[z].bounds.join(',');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0).toString(16);}
function savePlan() {
  if(!geo||!agg)return toast('분석 데이터를 먼저 불러오세요.');
  download(JSON.stringify({schema:'delivery-planner',version:3,operationScope:[...operationScope],logistics,created:new Date().toISOString(),geo:geoFingerprint(),dates:agg.dates,mode:agg.mode,config:config(),groups},null,2),'배송권역_계획.json','application/json');toast('계획 파일 저장 · 원본 RAWDATA는 포함되지 않습니다.');
}
async function loadPlan(file) {
  if(!file)return;if(!geo||!agg)return toast('계획에 사용한 경계와 배송 엑셀을 먼저 불러오세요.');
  await task('계획 검증 중',async()=>{
    const p=JSON.parse(await file.text());
    // Also accept the old application's group-array format when exported manually.
    const legacy=Array.isArray(p), raw=legacy?p:p.groups;
    if(!legacy&&(p.schema!=='delivery-planner'||![2,3].includes(p.version)))throw Error('지원하는 계획 파일이 아닙니다.');
    if(!Array.isArray(raw)||raw.length>20000)throw Error('잘못된 권역 목록입니다.');
    if(!legacy&&p.geo!==geoFingerprint())throw Error('계획과 현재 경계가 다릅니다. 같은 경계 파일을 불러오세요.');
    if(!legacy&&p.mode!==agg.mode)throw Error('착지 집계 기준이 다릅니다. 열 매핑에서 계획과 같은 기준을 선택하세요.');
    const seen=new Set(), next=raw.map((g,i)=>{
      const zips=g.zips||g.s;if(!Array.isArray(zips))throw Error('권역 우편번호 배열이 필요합니다.');
      for(const z of zips){if(typeof z!=='string'||!geo.zones[z])throw Error('경계 없는 우편번호: '+String(z).slice(0,10));if(seen.has(z))throw Error('중복 배정된 우편번호: '+z);seen.add(z);}
      if(g.core&&(!Array.isArray(g.core)||g.core.some(z=>!zips.includes(z))))throw Error('고정 중심부가 담당 우편번호에 포함되지 않습니다.');
      return {name:String(g.name||g.n||'권역').slice(0,60),zips:[...zips],core:Array.isArray(g.core)?g.core.filter(z=>zips.includes(z)):[],locked:!!g.locked,color:/^#[0-9a-f]{6}$/i.test(g.color||g.c)?g.color||g.c:palette[i%palette.length]};
    });
    const c=legacy?config():E.validate({...config(),...p.config,han:true}), dates=legacy?selectedDates:p.dates;
    const scope=legacy?[]:p.operationScope||[];if(!Array.isArray(scope)||scope.some(z=>!geo.zones[z]))throw Error('운영지역에 현재 경계에 없는 우편번호가 있습니다.');
    if(!Array.isArray(dates)||!dates.length)throw Error('계획 날짜 형식이 올바르지 않습니다.');
    const useCurrentDates=dates.some(d=>!meta.daily[d]);if(useCurrentDates&&!confirm('이전 계획의 날짜가 현재 파일에 없습니다. 담당 권역을 현재 선택 날짜에 적용할까요?'))return;
    if(!confirm('계획을 불러오면 현재 권역·조건·날짜가 변경됩니다. 계속할까요?'))return;
    const nextAgg=await rpc('aggregate',{days:useCurrentDates?selectedDates:dates});snapshotHistory();agg=nextAgg;selectedDates=nextAgg.dates;setConfig(c);operationScope=new Set(scope);groups=next;selected=-1;editing=-1;$('editPanel').classList.add('hidden');render(true,true);toast('계획 복원 완료 · 현재 배송 데이터로 물량을 다시 계산했습니다.');
  });
}
function exportWorkbook() {
  if(!agg)return toast('배송 데이터를 먼저 적용하세요.');
  const c=config(),book=XLSX.utils.book_new(),safe=v=>typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v;
  const sheet=(name,rows)=>{const s=XLSX.utils.aoa_to_sheet(rows.map(r=>r.map(safe)));s['!cols']=(rows[0]||[]).map(()=>({wch:19}));XLSX.utils.book_append_sheet(book,s,name);};
  sheet('권역요약',[['권역명','구역수','0물량구역','합계박스','착지일합계','합계kg','평균박스','평균착지','평균kg','최대박스','박스최대일','최대착지','착지최대일','최대kg','중량최대일','직경km','상한초과일','검토사항','잠금','중심부수'],...groups.map((g,i)=>{const s=diagnostics.groups[i];return [g.name,g.zips.length,s.empty,s.totalBox,s.totalStops,s.totalWeight??'미확인',s.avgBox,s.avgStop,s.avgWeight??'미확인',s.peakBox,s.peakBoxDate,s.peakStop,s.peakStopDate,s.peakWeight??'미확인',s.peakWeightDate,s.diameter,s.overDays,s.issues.join(' / '),g.locked?'Y':'N',g.core?.length||0];})]);
  sheet('우편번호배정',[['권역명','우편번호','시도','시군구','평균박스','평균착지','평균kg','선택기간물량','운영지역','한강분류','중심부'],...[...new Set([...Object.keys(agg.demand),...groups.flatMap(g=>g.zips),...operationScope])].sort().map(z=>[owners[z]!=null?groups[owners[z]].name:'미배정',z,geo.zones[z]?.region,geo.zones[z]?.city,agg.demand[z]?.avgBox||0,agg.demand[z]?.avgStop||0,agg.demand[z]?.avgWeight??(agg.demand[z]?'미확인':0),agg.demand[z]?'있음':'0',operationScope.has(z)?'Y':'N',geo.zones[z]?.river,owners[z]!=null&&groups[owners[z]].core?.includes(z)?'Y':'N'])]);
  sheet('일별부하',[['권역명','배송일','박스','착지','kg','중량미확인행','상한초과'],...groups.flatMap((g,i)=>agg.dates.map((d,j)=>{const s=diagnostics.groups[i];return [g.name,d,s.boxes[j],s.stops[j],s.unknownWeight[j]?'미확인':s.weights[j],s.unknownWeight[j],s.boxes[j]>c.maxBox||s.stops[j]>c.targetStop+c.tolerance||c.weightOn&&s.weights[j]>Math.min(c.maxWeight,c.vehicleCap)?'Y':'N'];}))]);
  sheet('데이터오류',[['원본행','배송일','원본우편번호','수량','사유'],...meta.errors.map(r=>[r.row,r.date,r.zip,r.box,r.reason]),...(meta.weightErrors||[]).map(r=>[r.row,r.date,'','',r.reason])]);
  sheet('설정',[['항목','값'],['버전','3.2'],['분석일',agg.dates.join(', ')],['착지기준',agg.mode],['중량단위','행 총중량 kg'],['중량열',mapping?.weight||'미지정'],['경계해시',geoFingerprint()],['샘플',demo?'Y':'N'],['운영지역수',operationScope.size],...Object.entries(c),...Object.entries(logistics),['한강데이터','OSM / ODbL-1.0 / '+E.hanSource.date],['제한','실제 도로 이동시간·횡단경로·방문 순서 미연결. 미확인 한강 구역은 자동 병합 금지.']]);
  XLSX.writeFile(book,'배송권역_분석결과.xlsx');
}

async function demoData() {
  if(agg&&!confirm('현재 계획을 가상 샘플로 바꿀까요?'))return;
  await task('가상 배송 데이터 준비 중',async()=>{
    const features=[],rows=[],m={date:'날짜',zip:'우편번호',box:'박스',address:'주소',recv:'수취인',weight:'중량(kg)'};
    for(let y=0;y<6;y++)for(let x=0;x<8;x++){
      const z=String(10000+y*8+x),lng=126.92+x*.014,lat=37.49+y*.012;
      features.push({type:'Feature',properties:{BAS_ID:z,CTP_KOR_NM:'서울특별시',SIG_KOR_NM:'샘플 구역'},geometry:{type:'Polygon',coordinates:[[[lng,lat],[lng+.014,lat],[lng+.014,lat+.012],[lng,lat+.012],[lng,lat]]]}});
      if((x+y)%7===0)continue;
      for(let d=1;d<=7;d++)for(let s=0;s<3+(x+y)%4;s++)rows.push({'날짜':20260900+d,'우편번호':z,'박스':1+(x*y+d+s)%5,'중량(kg)':(1+(x*y+d+s)%5)*12,'주소':`가상 샘플로 ${x*10+y+1} ${s}호`,'수취인':'샘플 '+s});
    }
    const result=await rpc('demo',{gj:{type:'FeatureCollection',features},rows,mapping:m});geo=result.geo;agg=result.agg;meta=result.meta;selectedDates=agg.dates;demo=true;workbookMeta=null;mapping=null;corrections={};resetPlanning();
    $('geoName').textContent='가상 경계 · 48개 구역';$('xlsName').textContent='가상 배송 · 7일';render(true,true);toast('가상 샘플입니다. 조건을 바꾸거나 최적화를 실행해 보세요.');
  });
}
function setRect(on) {rectMode=on;$('rectBtn').classList.toggle('active',on);map.getContainer().style.cursor=on?'crosshair':'';on?map.dragging.disable():map.dragging.enable();map.boxZoom[on?'disable':'enable']();if(rectLayer)map.removeLayer(rectLayer);rectLayer=null;rectStart=null;}
map.on('mousedown',e=>{if(!rectMode||!agg)return;rectStart=e.latlng;rectLayer=L.rectangle([rectStart,rectStart],{color:'#137f77',weight:1,fillOpacity:.1}).addTo(map);});
map.on('mousemove',e=>{if(rectStart&&rectLayer)rectLayer.setBounds([rectStart,e.latlng]);});
map.on('mouseup',e=>{
  if(!rectStart)return;const bounds=L.latLngBounds(rectStart,e.latlng),action=$('drawAction').value;
  const candidates=action==='scope'?Object.keys(geo.zones):[...new Set([...Object.keys(agg.demand),...groups.flatMap(g=>g.zips),...operationScope])];
  const zs=candidates.filter(z=>bounds.contains([geo.zones[z].lat,geo.zones[z].lng]));setRect(false);if(!zs.length)return toast('선택한 영역에 구역이 없습니다.');
  if(action==='scope'){snapshotHistory();zs.forEach(z=>operationScope.add(z));render(true);return toast('운영지역에 '+zs.length+'개 구역 추가. 0물량 편입 버튼으로 배정하세요.');}
  if(action==='remove'){
    if(editing>=0)return changeZips(zs,true);
    if(groups.some(g=>g.zips.some(z=>zs.includes(z))&&(g.locked||g.core?.some(z=>zs.includes(z)))))return toast('잠금 또는 중심부가 포함되어 제외할 수 없습니다.');
    snapshotHistory();groups.forEach(g=>g.zips=g.zips.filter(z=>!zs.includes(z)));render(true);return toast('선택 폴리곤의 권역 배정을 해제했습니다.');
  }
  if(editing>=0)return changeZips(zs);
  if(groups.some(g=>g.zips.some(z=>zs.includes(z))&&(g.locked||g.core?.some(z=>zs.includes(z)))))return toast('잠금/고정 중심부는 다른 권역으로 이동할 수 없습니다.');
  if(!E.riverCompatible(zs,geo.zones))return toast('강남·강북 혼합 또는 한강 분리 미확인 구역은 한 권역으로 묶을 수 없습니다.');
  snapshotHistory();groups.forEach(g=>g.zips=g.zips.filter(z=>!zs.includes(z)));groups.push({name:'선택 권역-'+(groups.length+1),zips:zs,core:[],locked:false,color:palette[groups.length%palette.length]});selected=groups.length-1;render(true);edit(selected);
});

function help() {modal('MFC 권역 작업 사용 안내',`<div class="stack"><h3>1. 데이터 불러오기</h3><p>zones.json 또는 zones.json.txt를 선택한 뒤 RAWDATA 엑셀을 불러옵니다. 시트와 날짜·우편번호·박스·주소 열을 확인하고 적용하세요.</p><h3>2. 날짜와 조건 설정</h3><p>달력에서 배송일을 선택합니다. 일평균 또는 일별 최대 기준, 박스 범위, 착지 목표와 편차, 연결 방식과 직경을 설정하세요. 하한과 착지 목표는 달성 목표이고, 상한은 자동으로 완화하지 않습니다.</p><h3>3. 최적화 및 수동 편집</h3><p>3가지 시작 순서의 인접 그래프 확장·병합 결과 중 평가값이 좋은 안을 제안합니다. 최적해를 보장하지 않습니다. 한 우편번호 자체가 상한을 넘으면 분할하지 않고 초과 권역으로 남깁니다. 기본 재실행은 기존 담당을 전부 유지하고 미배정만 설계합니다. 명시적 재설계에서도 잠금과 고정 중심부가 있는 권역 전체를 유지합니다. 지도 영역 선택과 우편번호 편집 후에는 진단이 갱신됩니다.</p><h3>4. 검토·비교·저장</h3><p>‘상세’에서 일별 물량을 확인하고 ‘비교에 저장’으로 여러 안을 비교하세요. 계획 JSON은 권역·조건·날짜만 저장하며, 복원하려면 경계와 배송 데이터를 다시 불러와야 합니다. 엑셀 결과에는 미배정과 오류 내역도 포함됩니다. 새로고침하면 메모리의 데이터가 지워집니다. 새 엑셀 적용 시 기존 담당 권역은 유지됩니다. 표시 합계/평균 선택은 최적화 기준을 바꾸지 않습니다.</p><div class="banner">공간 연결과 실제 차량 이동은 다릅니다. 경계 인접은 소수점 6자리로 정규화한 공유 선분으로 판단하므로 도형 분할 방식 차이에 따른 누락이 있을 수 있습니다. 근거리 연결은 대표점 간 직선거리입니다. 한강은 OSM 본류 기준으로 강남·강북 혼합을 금지하며, 범위 밖·경계 걸침은 미확인으로 격리합니다. 실제 차량이 다리를 건너는 경로는 아직 계산하지 않습니다. 운영지역을 명시적으로 지정하면 그 안의 0물량 구역만 기존 경계에 연결해 편입합니다. 시도·한강·직경 제약 또는 경계 불연속으로 남는 구역은 미배정으로 유지합니다.</div><p class="hint">원본 데이터는 서버로 보내지 않습니다. 개발 버전은 라이브러리를 CDN에서 받으며 지도 타일 요청에는 화면 좌표가 포함됩니다. 단일 HTML 버전은 라이브러리를 내장하고, ‘배경 지도 없음’ 선택 시 타일 요청도 하지 않습니다. 수취인 및 주소는 계획 JSON·분석 엑셀에 내보내지 않습니다.</p></div>`);}
$('geoInput').onchange=e=>{loadGeo(e.target.files[0]);e.target.value='';};$('xlsInput').onchange=e=>{loadWorkbook(e.target.files[0]);e.target.value='';};
$('startBtn').onclick=()=>$('geoInput').click();$('closeIntroBtn').onclick=()=>{welcomeDismissed=true;$('intro').classList.add('hidden');map.getContainer().focus({preventScroll:true});};$('mappingBtn').onclick=showMapping;
$('calendarBtn').onclick=showCalendar;$('applyDatesBtn').onclick=()=>{if(!meta)return toast('배송 데이터를 먼저 적용하세요.');const a=$('dateFrom').value,b=$('dateTo').value;if(!a||!b||a>b)return toast('올바른 시작일과 종료일을 선택하세요.');applyDates(Object.keys(meta.daily).filter(d=>d>=a&&d<=b).sort());};
$('runBtn').onclick=run;['auditBtn','auditTab','auditRail'].forEach(id=>$(id).onclick=audit);['compareTab','compareRail'].forEach(id=>$(id).onclick=compare);['designTab','designRail'].forEach(id=>$(id).onclick=()=>{$('modalRoot').innerHTML='';});
$('helpBtn').onclick=help;$('savePlanBtn').onclick=()=>{try{savePlan();}catch(e){toast(e.message);}};$('loadPlanBtn').onclick=()=>$('planInput').click();$('planInput').onchange=e=>{loadPlan(e.target.files[0]);e.target.value='';};$('exportBtn').onclick=()=>task('결과 엑셀 생성 중',async()=>{await new Promise(r=>setTimeout(r,30));exportWorkbook();});
$('undoBtn').onclick=()=>{if(!history.length)return;const previous=history.pop();groups=previous.groups;operationScope=new Set(previous.scope);selected=-1;editing=-1;$('editPanel').classList.add('hidden');$('undoBtn').disabled=!history.length;render(true);toast('이전 권역 배정을 복원했습니다. 현재 분석 날짜와 조건은 유지됩니다.');};
$('groupSearch').oninput=renderList;$('filters').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(a=>a.classList.toggle('active',a===b));renderList();};
$('groupList').onclick=e=>{const a=e.target.closest('[data-action]');if(a){const i=+a.dataset.i;if(a.dataset.action==='lock'){snapshotHistory();groups[i].locked=!groups[i].locked;if(groups[i].locked&&editing===i){editing=-1;$('editPanel').classList.add('hidden');}render();}else if(a.dataset.action==='edit')edit(i);else detail(i);return;}const card=e.target.closest('[data-group]');if(card)selectGroup(+card.dataset.group,true);};
$('groupList').onkeydown=e=>{if(e.key==='Enter'&&e.target.matches('[data-group]'))selectGroup(+e.target.dataset.group,true);};
$('newGroupBtn').onclick=()=>{if(!agg)return toast('데이터를 먼저 불러오세요.');snapshotHistory();groups.push({name:'수동-'+(groups.length+1),zips:[],locked:false,color:palette[groups.length%palette.length]});render();edit(groups.length-1);};
$('endEditBtn').onclick=()=>{editing=-1;$('editPanel').classList.add('hidden');};$('addZipsBtn').onclick=()=>{const a=parseZips();if(a.length)changeZips(a);};$('removeZipsBtn').onclick=()=>{const a=parseZips();if(a.length)changeZips(a,true);};
$('snapshotBtn').onclick=saveSnapshot;$('fitBtn').onclick=()=>{if(layer?.getLayers().length){selected=-1;paintMap();renderList();map.fitBounds(layer.getBounds(),{padding:[24,24]});}};$('rectBtn').onclick=()=>{if(!agg)return toast('데이터를 먼저 불러오세요.');setRect(!rectMode);};
$('labelsBtn').onclick=()=>{showLabels=!showLabels;$('labelsBtn').classList.toggle('active',showLabels);paintMap();};$('mapView').onchange=paintMap;
configIDs.forEach(id=>$(id).onchange=()=>{try{config();render();toast('변경된 조건으로 현재 권역을 재검사했습니다. 재설계는 최적화를 실행하세요.');}catch(e){toast(e.message);}});
$('fixInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||!workbookMeta)return toast('실제 엑셀 데이터를 먼저 불러오세요.');await task('우편번호 보정표 검사 중',async()=>{const wb=XLSX.read(await file.text(),{type:'string',raw:true}),rs=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rs.length)throw Error('보정 CSV가 비어 있습니다.');const fixes={...corrections};for(const r of rs){const original=String(r['원본우편번호']??'').trim(),z=E.zip(r['신우편번호']);if(!original||!z||!geo.zones[z])throw Error('보정 열 또는 새 우편번호 경계를 확인하세요.');if(original in fixes&&fixes[original]!==z)throw Error('같은 원본 우편번호의 보정값이 서로 다릅니다.');fixes[original]=z;}corrections=fixes;$('modalRoot').innerHTML='';showMapping();toast('보정표 준비 완료 · 데이터 적용을 누르면 반영됩니다.');});};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalRoot').children.length){setRect(false);editing=-1;selected=-1;$('editPanel').classList.add('hidden');paintMap();renderList();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!$('modalRoot').children.length){e.preventDefault();$('undoBtn').click();}});
$('displayMode').onchange=()=>render();
$('groupList').addEventListener('mouseover',e=>{const card=e.target.closest('[data-group]');if(card){hoverGroup=+card.dataset.group;summary(hoverGroup);}});
$('groupList').addEventListener('mouseleave',()=>{hoverGroup=-1;summary();});
$('coreBtn').onclick=()=>{const g=groups[editing];if(!g||g.locked)return toast('편집 가능한 권역을 선택하세요.');const zips=parseZips();if(!zips.length)return;if(zips.some(z=>!g.zips.includes(z)))return toast('중심부는 현재 권역에 속한 우편번호만 지정할 수 있습니다.');snapshotHistory();g.core=[...new Set([...(g.core||[]),...zips])];render();toast('선택 우편번호를 중심부로 고정했습니다. 자동 재설계에서 이 권역을 유지합니다.');};
$('clearCoreBtn').onclick=()=>{const g=groups[editing];if(!g||g.locked)return;if(confirm('이 권역의 중심부 고정을 모두 해제할까요?')){snapshotHistory();g.core=[];render();}};
$('scopeBtn').onclick=showScope;
$('fillEmptyBtn').onclick=()=>{if(!agg||!groups.length)return toast('담당 권역을 먼저 생성하세요.');if(!operationScope.size)return showScope();task('지정 운영지역의 0물량 구역 연결 중',async()=>{const result=await rpc('fill',{groups,scope:[...operationScope],config:config()});snapshotHistory();groups=result.groups;render(true);toast('0물량 '+result.added+'개 편입 · 연결/한강/직경/잠금 제약으로 미편입 '+result.remaining.length+'개');});};
$('logisticsBtn').onclick=()=>modal('센터 · 차량 · 도로 연계',`<div class="summary-strip"><div><b>출발 센터</b><p>${esc(logistics.depotAddress)}</p><span>복귀 없음 · 차량 적재한도는 등록증 확인값 사용</span></div></div><div class="banner">도로 API: 미연결. 주소를 임의로 좌표화하거나 직선거리를 도로 이동시간으로 표시하지 않습니다.</div><p>현재 기본 배경은 VWORLD이며 지도 설정에서 기존 HTML의 인증키를 가져올 수 있습니다. 이 키는 배경지도용입니다. 사용 중인 길찾기 서비스명 확인 후 서버 측 연계가 필요합니다.</p><ul><li>상용 경로 API: 국내 화물차 제한·교통정보·호출량 지원 확인</li><li>OSRM / Valhalla 자체 운영: 소프트웨어는 무료이나 서버·지도 갱신 비용 필요</li><li>공개 무료 데모 서버는 대량 업무용으로 자동 연결하지 않습니다.</li></ul><p class="hint">다음 도로 연계에서는 센터→배송지 이동과 권역 내부 이동을 구분합니다. 강남·강북 혼합 금지는 담당 권역 제약이며 센터 출발 구간의 횡단 정책은 별도입니다. 2.5~3.5톤 차량은 도로 폭·높이·중량 제한 검증 전 자동 추천하지 않습니다.</p><p class="hint">한강 데이터: <a href="${E.hanSource.url}" target="_blank" rel="noopener">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a> · ${E.hanSource.date}. 하구~팔당 본류 기준, 범위 밖은 미확인.</p>`,[{text:'연계 조건 JSON 저장',action:()=>download(JSON.stringify({...logistics,vehicleCap:+$('vehicleCap').value,weightUnit:'kg_per_row',hanPolicy:'no_north_south_mixed_zone',roadStatus:'not_connected'},null,2),'도로연계_운영조건.json','application/json')}]);
function showScope(){
  if(!geo)return toast('경계 파일을 먼저 선택하세요.');
  const cities={};Object.values(geo.zones).forEach(z=>{const key=z.region+' / '+(z.city||'시군구 미상');(cities[key]||=[]).push(z.z);});
  const entries=Object.entries(cities).sort(([a],[b])=>a.localeCompare(b));
  modal('0물량 담당 운영지역 지정',`<p class="hint">선택한 시·군·구의 모든 우편번호를 운영 대상으로 지정합니다. 전국을 자동 선택하지 않습니다. 지도에서 운영지역 추가 모드로 더 작은 범위를 지정할 수도 있습니다. 기존 물량 권역의 배정은 변경하지 않습니다.</p><input id="scopeSearch" placeholder="시도 / 시군구 검색" style="width:100%;margin:10px 0"><div class="scope-list">${entries.map(([name,zs],i)=>`<label data-city="${esc(name)}"><input type="checkbox" data-city-index="${i}" ${zs.every(z=>operationScope.has(z))?'checked':''}>${esc(name)} · ${zs.length}개</label>`).join('')}</div><p class="hint">현재 ${operationScope.size}개 선택. ‘선택 지역 추가’는 기존 지도 선택 범위를 유지합니다. 배정을 제거하지 않고 운영 범위만 초기화할 수 있습니다.</p>`,[{text:'운영 범위 초기화',action:close=>{snapshotHistory();operationScope.clear();render(true);close();}},{text:'지도에서 지정',action:close=>{close();$('drawAction').value='scope';setRect(true);toast('지도를 드래그해 운영지역을 추가하세요. 대표점 포함 기준입니다.');}},{text:'선택 지역 추가',primary:true,action:close=>{const indices=[...document.querySelectorAll('[data-city-index]:checked')].map(b=>+b.dataset.cityIndex);snapshotHistory();indices.forEach(i=>entries[i][1].forEach(z=>operationScope.add(z)));render(true);close();toast('운영지역 지정 완료 · 0물량 편입 버튼으로 권역에 배정하세요.');}}]);
  $('scopeSearch').oninput=e=>document.querySelectorAll('[data-city]').forEach(l=>l.classList.toggle('hidden',!l.dataset.city.includes(e.target.value.trim())));
}
const riverDisplay=L.polyline(E.hanLine.map(p=>[p[1],p[0]]),{color:'#287cb5',weight:2,dashArray:'6,5',opacity:.8}).addTo(map);
riverDisplay.bindTooltip('한강 분리 기준 · OSM 본류 / 실제 차량 경로 아님');
map.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Han river: © OpenStreetMap contributors · ODbL</a>');
window.addEventListener('beforeunload' ,e=>{if(groups.length){e.preventDefault();e.returnValue='';}});
render();
