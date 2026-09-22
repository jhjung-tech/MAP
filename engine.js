/* Pure, deterministic planning engine. No customer data leaves the browser. */
function createEngine() {
  'use strict';
  const sum = a => a.reduce((s, x) => s + x, 0);
  // OSM waterway=river/name=한강, retrieved 2026-09-22 via Overpass.
  // © OpenStreetMap contributors, ODbL 1.0. Original unsimplified coordinates.
  const hanLine = [[126.4135758,37.8447035],[126.425127,37.8413279],[126.442173,37.8370237],[126.4532022,37.827967],[126.4567556,37.8199126],[126.4592687,37.8181961],[126.4684887,37.8118981],[126.4855775,37.8060324],[126.4942272,37.8023033],[126.4965087,37.8013197],[126.501748,37.7990608],[126.5199827,37.7920214],[126.5290106,37.7901819],[126.5497334,37.7813108],[126.5632157,37.7716766],[126.5664447,37.7690749],[126.566554,37.7689788],[126.5709729,37.7650931],[126.575145,37.7625993],[126.5779942,37.761996],[126.5796866,37.7619774],[126.5816575,37.7619558],[126.5912737,37.7631222],[126.6034847,37.7652942],[126.6047489,37.7659869],[126.6051152,37.7661876],[126.6086234,37.7681097],[126.6134242,37.7741278],[126.616126,37.7775145],[126.6252412,37.7821376],[126.6376009,37.7837657],[126.6474714,37.7828601],[126.6521667,37.7809602],[126.6615915,37.7743784],[126.6639733,37.7719699],[126.6650033,37.770613],[126.6686296,37.7662707],[126.6693592,37.7651172],[126.6727924,37.7608255],[126.6738224,37.7591461],[126.6742515,37.7580433],[126.6748094,37.7564996],[126.676526,37.7478809],[126.6778993,37.7407545],[126.678586,37.7351208],[126.6786718,37.7324734],[126.6787576,37.7294866],[126.6777706,37.7255831],[126.6757965,37.7221208],[126.6734346,37.7172243],[126.6718912,37.7137697],[126.6700458,37.7093562],[126.6684579,37.7042293],[126.6677099,37.7014863],[126.66765,37.7005648],[126.6673422,37.6958253],[126.666913,37.6928879],[126.6663766,37.6905277],[126.6663237,37.6897167],[126.6662693,37.6888807],[126.6664409,37.6871487],[126.6667843,37.6852977],[126.6678357,37.6829203],[126.6700673,37.6796428],[126.6711831,37.678403],[126.6724705,37.6771463],[126.6739297,37.6757707],[126.6775989,37.6729174],[126.6779381,37.6726799],[126.6815042,37.6701829],[126.6962671,37.6634057],[126.6996574,37.6615203],[126.7027902,37.6599405],[126.7041635,37.65921],[126.7058158,37.657987],[126.707983,37.6564581],[126.7095923,37.6554728],[126.7112875,37.6540967],[126.713283,37.6523809],[126.7150426,37.6508179],[126.7166519,37.6494928],[126.7183685,37.6484904],[126.721673,37.6465705],[126.7260932,37.6443788],[126.733303,37.6408447],[126.7410278,37.6370385],[126.7461347,37.6343197],[126.7480316,37.6332869],[126.7516279,37.6313289],[126.7589235,37.6275223],[126.7645025,37.625177],[126.7699098,37.6231376],[126.7771625,37.6202483],[126.7823338,37.6183617],[126.7854951,37.6170214],[126.7868721,37.6163901],[126.7887497,37.6155402],[126.7948866,37.6123107],[126.8035278,37.6054007],[126.8071291,37.602438],[126.8083409,37.6011195],[126.810919,37.598792],[126.8163071,37.5940328],[126.8248714,37.5890935],[126.8530937,37.5733698],[126.8785265,37.5587787],[126.8853331,37.5550623],[126.8918307,37.55126],[126.9090633,37.540611],[126.9108482,37.5395079],[126.9112301,37.5392775],[126.9115841,37.5391839],[126.9227958,37.5378227],[126.9237613,37.5376696],[126.935091,37.5347089],[126.9363614,37.533944],[126.9482185,37.5223411],[126.9504547,37.520491],[126.9534802,37.5183552],[126.9548473,37.5176637],[126.9606197,37.5156003],[126.967299,37.5132322],[126.9727706,37.5119386],[126.9777488,37.511428],[126.9818687,37.5112918],[126.9872331,37.5119046],[126.9906663,37.5128577],[126.9990311,37.5170669],[127.0046567,37.5206528],[127.0120173,37.5267878],[127.0202994,37.5356618],[127.0215825,37.5366475],[127.0229778,37.5374938],[127.0251596,37.5380099],[127.0276787,37.5382369],[127.0299812,37.5379937],[127.0539646,37.5312405],[127.0660166,37.5248623],[127.0674334,37.5243271],[127.0796926,37.5231409],[127.0893881,37.5238232],[127.0902314,37.5241933],[127.0907783,37.5244629],[127.0955575,37.5268182],[127.0975954,37.5281932],[127.111516,37.5418041],[127.1124601,37.542842],[127.1130603,37.5438173],[127.1163654,37.5504807],[127.1196055,37.558646],[127.1204209,37.5598538],[127.1214294,37.5609254],[127.126419,37.5656603],[127.1303773,37.5677289],[127.1327591,37.5687324],[127.1354071,37.5696339],[127.1436329,37.57164],[127.1494573,37.5727808],[127.1516021,37.5733544],[127.1533773,37.5741688],[127.153602,37.5742719],[127.1629052,37.5785394],[127.1782064,37.5847861],[127.1838712,37.5864865],[127.1911668,37.5870986],[127.1947288,37.5868605],[127.1985054,37.5859083],[127.2005439,37.584616],[127.2082734,37.5782593],[127.2142838,37.5733601],[127.216827,37.5713233],[127.2168787,37.5712819],[127.2192714,37.5693657],[127.2213363,37.5677119],[127.2221886,37.5671097],[127.2235465,37.5657559],[127.2254777,37.5630685],[127.2285917,37.5570386],[127.2328222,37.5506953],[127.2342114,37.5488152],[127.2352731,37.5475461],[127.2367328,37.5465203],[127.2404122,37.5445178],[127.2431532,37.5432378],[127.2446422,37.5425425],[127.2505939,37.5404174],[127.2594345,37.5356022],[127.2646594,37.5325479],[127.2717667,37.5295344],[127.2771799,37.5273323],[127.278969,37.5266686],[127.279551,37.5264474],[127.2807205,37.526022],[127.2830164,37.5247967],[127.2839498,37.523682],[127.2846687,37.5222184],[127.2856466,37.5196759],[127.2872838,37.5152236],[127.2904414,37.5106621],[127.2928118,37.509862],[127.2978974,37.5100322],[127.3022532,37.5104408],[127.3037123,37.5120067],[127.3056221,37.5154448],[127.3077249,37.5193933],[127.3105144,37.5248733]];
  const hanSource = {date:'2026-09-22',license:'ODbL-1.0',url:'https://www.openstreetmap.org/way/378066781',wayIds:[366856674, 378066781, 379766914, 549929142, 549929146, 587684502, 727265578, 906802842]};
  function inPolygon(point, ring) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],b=ring[j];
      if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  const northRing=[...hanLine,[hanLine.at(-1)[0],39],[hanLine[0][0],39]];
  function riverSide(z, polygons) {
    if(!/서울|경기|인천/.test(z.region))return 'outside';
    if(z.bounds[0]<hanLine[0][0]||z.bounds[2]>hanLine.at(-1)[0])return 'unknown';
    const sides=new Set();
    for(const rings of polygons)for(const point of rings[0]) {
      sides.add(inPolygon(point,northRing)?'north':'south');
      if(sides.size>1)return 'unknown';
    }
    return [...sides][0]||'unknown';
  }
  function riverCompatible(ids,zones) {
    const sides=new Set(ids.map(z=>zones[z]?.river||'unknown'));
    return !sides.has('unknown')&&!(sides.has('north')&&sides.has('south'));
  }
  const weightCap=c=>Math.min(c.maxWeight??Infinity,c.vehicleCap??Infinity);

  const zip = value => {
    const s = String(value == null ? '' : value).trim();
    return /^\d{3,5}$/.test(s) ? s.padStart(5, '0') : '';
  };
  function date(value) {
    if (value instanceof Date) return Number.isNaN(+value) ? '' : value.toISOString().slice(0, 10);
    let s = String(value == null ? '' : value).trim(), m;
    if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 90000)
      return new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 86400000).toISOString().slice(0, 10);
    m = s.match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})(?:[ T].*)?$/);
    if (!m) return '';
    const y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : '';
  }
  function distance(a, b) {
    const r = Math.PI / 180, dy = (b.lat - a.lat) * r, dx = (b.lng - a.lng) * r;
    const h = Math.sin(dy / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dx / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function normal(s) { return String(s == null ? '' : s).normalize('NFKC').replace(/\s+/g, ' ').trim(); }
  function stopKey(recv, address, mode) {
    let a = normal(address);
    if (mode === 'building') {
      // Only strip after a road-name building number; never truncate a district number.
      const m = a.match(/^(.*?(?:로|길)\s*\d+(?:-\d+)?)(?=\s|$|[,(])/);
      if (m) a = m[1];
    }
    return (mode === 'building' ? '' : normal(recv) + '|') + a;
  }
  function geometry(gj, key) {
    if (!gj || gj.type !== 'FeatureCollection' || !Array.isArray(gj.features) || !gj.features.length)
      throw Error('비어 있지 않은 GeoJSON FeatureCollection이 필요합니다.');
    const props = gj.features[0].properties || {};
    key = key || ['BAS_ID', 'ZIP', 'ZIP_CODE', 'POSTCODE', '우편번호'].find(k => k in props);
    if (!key) throw Error('우편번호 속성을 찾지 못했습니다. 경계 속성명을 직접 입력해 주세요.');
    const zones = {}, edges = new Map(), adjacency = {}, valid = [], rejected = [];
    for (const f of gj.features) {
      const z = zip((f.properties || {})[key]), g = f.geometry;
      if (!z || !g || !['Polygon', 'MultiPolygon'].includes(g.type)) { rejected.push(z || '속성/도형 오류'); continue; }
      const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, ok = true;
      for (const rings of polygons) for (const ring of rings) for (const p of ring) {
        if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) { ok = false; break; }
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      if (!ok || !Number.isFinite(x0)) { rejected.push(z); continue; }
      const old = zones[z];
      if (old) { x0 = Math.min(x0, old.bounds[0]); y0 = Math.min(y0, old.bounds[1]); x1 = Math.max(x1, old.bounds[2]); y1 = Math.max(y1, old.bounds[3]); }
      zones[z] = { z, lat: (y0 + y1) / 2, lng: (x0 + x1) / 2, bounds: [x0, y0, x1, y1], region: normal(f.properties.CTP_KOR_NM || f.properties.sido || '미지정'), city: normal(f.properties.SIG_KOR_NM || '') };
      const side=riverSide(zones[z],polygons);
      zones[z].river=old&&old.river!==side?'unknown':side;
      adjacency[z] ||= new Set();
      for (const rings of polygons) for (const ring of rings) for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1].slice(0, 2).map(v => v.toFixed(6)).join(','), b = ring[i].slice(0, 2).map(v => v.toFixed(6)).join(',');
        if (a === b) continue;
        const e = a < b ? a + ':' + b : b + ':' + a;
        if (!edges.has(e)) edges.set(e, new Set());
        for (const other of edges.get(e)) if (other !== z) { adjacency[z].add(other); adjacency[other].add(z); }
        edges.get(e).add(z);
      }
      valid.push({ ...f, properties: { ...f.properties, __zip: z } });
    }
    if (!valid.length) throw Error('유효한 WGS84 우편번호 경계가 없습니다.');
    return { zones, adjacency: Object.fromEntries(Object.entries(adjacency).map(([z, s]) => [z, [...s]])), gj: { type: 'FeatureCollection', features: valid }, rejected, key };
  }
  function ingest(rows, mapping, zones, mode, corrections = {}) {
    const records = [], errors = [], weightErrors = [], daily = {}, conflicts = new Map();
    const hasWeight=!!mapping.weight;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], d = date(r[mapping.date]);
      const raw = r[mapping.box], b = typeof raw === 'number' ? raw : Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
      const wr=hasWeight?r[mapping.weight]:null, wn=Number(String(wr??'').replace(/,/g,'').trim());
      const w=hasWeight&&wr!==null&&wr!==undefined&&String(wr).trim()!==''&&Number.isFinite(wn)&&wn>=0?wn:null;
      if(hasWeight&&w===null)weightErrors.push({row:i+2,reason:'중량 누락/형식 오류 (행 총중량 kg)',date:d});
      const address = normal(r[mapping.address]), recv = normal(r[mapping.recv]);
      const original = normal(r[mapping.zip]), z = zip(corrections[original] || original);
      let reason = !d ? '날짜 오류' : raw === '' || raw == null || !Number.isFinite(b) || b <= 0 ? '수량 오류 (양수 필요)' : !address ? '주소 누락' : !z ? '우편번호 형식' : !zones[z] ? '경계 없음' : '';
      const sk = stopKey(recv, address, mode);
      if (z && address) { if (!conflicts.has(sk)) conflicts.set(sk, new Set()); conflicts.get(sk).add(z); }
      if (reason) errors.push({ row: i + 2, date: d, zip: original, box: Number.isFinite(b) ? b : 0, reason });
      // Keep date-valid rows for selected-period auditing, including rejected deliveries.
      if (d) {
        daily[d] ||= { rows: 0, boxes: 0, rejected: 0 };
        daily[d].rows++; daily[d].boxes += Number.isFinite(b) && b > 0 ? b : 0;
        if (reason) daily[d].rejected++;
        records.push({ d, z, b, w, sk: z + '|' + sk, reason });
      }
    }
    return { records, errors, weightErrors, hasWeight, daily, conflictCount: [...conflicts.values()].filter(s => s.size > 1).length, totalRows: rows.length, mode };
  }
  function aggregate(data, days) {
    const dates = [...new Set(days)].sort(), sel = new Map(dates.map((d, i) => [d, i])), n = dates.length;
    if (!n) throw Error('배송일을 한 개 이상 선택하세요.');
    const demand = {}, stops = new Set(), excludedZips = new Set();
    let rejectedRows = 0, rejectedBoxes = 0, acceptedRows = 0;
    for (const r of data.records) {
      if (!sel.has(r.d)) continue;
      if (r.reason) { rejectedRows++; rejectedBoxes += r.b > 0 ? r.b : 0;if(r.z)excludedZips.add(r.z); continue; }
      acceptedRows++;
      const v = demand[r.z] ||= { z: r.z, boxes: Array(n).fill(0), stops: Array(n).fill(0), weights:Array(n).fill(0), unknownWeight:Array(n).fill(0) }, i = sel.get(r.d);
      v.boxes[i] += r.b;
      if(r.w===null||r.w===undefined)v.unknownWeight[i]++;else v.weights[i]+=r.w;
      const k = r.d + '|' + r.sk;
      if (!stops.has(k)) { stops.add(k); v.stops[i]++; }
    }
    for (const v of Object.values(demand)) { v.avgBox = sum(v.boxes) / n; v.avgStop = sum(v.stops) / n; v.avgWeight=data.hasWeight&&!sum(v.unknownWeight)?sum(v.weights)/n:null; }
    return { demand, dates, excludedZips:[...excludedZips], acceptedRows, rejectedRows, rejectedBoxes, hasWeight:!!data.hasWeight, unknownWeight:sum(Object.values(demand).map(v=>sum(v.unknownWeight))), knownWeight:sum(Object.values(demand).map(v=>sum(v.weights))), totalBox: sum(Object.values(demand).map(v => sum(v.boxes))), avgBox: sum(Object.values(demand).map(v => v.avgBox)), avgStop: stops.size / n, mode: data.mode };
  }
  function validate(c) {
    for (const k of ['minBox', 'maxBox', 'targetStop', 'tolerance', 'diameter', 'gap']) if (!Number.isFinite(c[k])) throw Error('모든 조건을 숫자로 입력해 주세요.');
    if (c.minBox < 0 || c.maxBox <= 0 || c.minBox > c.maxBox || c.targetStop <= 0 || c.tolerance < 0 || c.diameter <= 0 || c.gap <= 0) throw Error('박스 범위·착지·거리 조건을 확인하세요.');
    if (!['avg', 'peak'].includes(c.basis) || !['near', 'strict'].includes(c.link)) throw Error('알 수 없는 최적화 기준입니다.');
    if(c.weightOn) {
      for(const k of ['minWeight','maxWeight','vehicleCap'])if(!Number.isFinite(c[k]))throw Error('중량 조건을 숫자로 입력하세요.');
      if(c.minWeight<0||c.maxWeight<=0||c.minWeight>c.maxWeight||c.vehicleCap<=0)throw Error('중량 범위와 실제 차량 적재한도를 확인하세요.');
      if(c.maxWeight>c.vehicleCap)throw Error('목표 중량 상한이 실제 차량 적재한도를 초과합니다. 차량 등록증 기준 한도 또는 작업 목표를 수정하세요.');
    }
    return c;
  }
  function graph(zones, adjacency, demand, c) {
    const ids = Object.keys(demand).sort(), active = new Set(ids), g = Object.fromEntries(ids.map(z => [z, new Set()]));
    const limits = Object.fromEntries(ids.map(z=>[z,{gap:c.gap,diameter:c.diameter}]));
    if(c.density) {
      const step=.04,cells=new Map();
      for(const z of ids){const k=Math.floor(zones[z].lng/step)+','+Math.floor(zones[z].lat/step);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(z);}
      for(const z of ids){const x=Math.floor(zones[z].lng/step),y=Math.floor(zones[z].lat/step);let count=0;
        for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(const b of cells.get((x+dx)+','+(y+dy))||[])if(b!==z&&distance(zones[z],zones[b])<=3)count++;
        const factor=Math.max(.4,1/Math.sqrt(1+count/15));limits[z]={gap:c.gap*factor,diameter:c.diameter*Math.max(.55,factor)};
      }
    }
    Object.defineProperty(g,'limits',{value:limits});
    const allowed = (a, b) => (!c.sameRegion || zones[a].region === zones[b].region) && (!c.han||riverCompatible([a,b],zones)) && distance(zones[a], zones[b]) <= Math.min(limits[a].diameter,limits[b].diameter) + 1e-8;
    for (const z of ids) for (const b of adjacency[z] || []) if (active.has(b) && allowed(z, b)) { g[z].add(b); g[b].add(z); }
    if (c.link === 'near') {
      // A latitude/longitude grid bounds candidates; haversine distance decides acceptance.
      const latStep = c.gap / 111.2, lngStep = c.gap / 70, cells = new Map();
      for (const z of ids) {
        const a = zones[z], x = Math.floor(a.lng / lngStep), y = Math.floor(a.lat / latStep);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (const b of cells.get((x + dx) + ',' + (y + dy)) || [])
          if (allowed(z, b) && distance(a, zones[b]) <= Math.min(limits[z].gap,limits[b].gap) + 1e-8) { g[z].add(b); g[b].add(z); }
        const key = x + ',' + y; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(z);
      }
    }
    return g;
  }
  function connected(ids, g) {
    if (ids.length < 2) return true;
    const set = new Set(ids), seen = new Set([ids[0]]), queue = [ids[0]];
    for (let i = 0; i < queue.length; i++) for (const z of g[queue[i]] || []) if (set.has(z) && !seen.has(z)) { seen.add(z); queue.push(z); }
    return seen.size === ids.length;
  }
  function stats(ids, demand, dates, zones, c) {
    const boxes = Array(dates.length).fill(0), stops = Array(dates.length).fill(0), weights=Array(dates.length).fill(0), unknownWeight=Array(dates.length).fill(0);
    for(const z of ids)if(demand[z]){dates.forEach((_,i)=>{weights[i]+=demand[z].weights?.[i]||0;unknownWeight[i]+=demand[z].unknownWeight?.[i]??(demand[z].weights?0:1);});}
    for (const z of ids) if (demand[z]) { demand[z].boxes.forEach((b, i) => boxes[i] += b); demand[z].stops.forEach((s, i) => stops[i] += s); }
    const avgBox = sum(boxes) / Math.max(1, dates.length), avgStop = sum(stops) / Math.max(1, dates.length);
    const peakBox = Math.max(0, ...boxes), peakStop = Math.max(0, ...stops), box = c.basis === 'peak' ? peakBox : avgBox, stop = c.basis === 'peak' ? peakStop : avgStop;
    let diameter = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (zones[ids[i]] && zones[ids[j]]) diameter = Math.max(diameter, distance(zones[ids[i]], zones[ids[j]]));
    const complete=(!ids.some(z=>demand[z])||ids.some(z=>demand[z]?.weights))&&!sum(unknownWeight), totalWeight=complete?sum(weights):null, avgWeight=complete?sum(weights)/Math.max(1,dates.length):null, peakWeight=complete?Math.max(0,...weights):null;
    const peakDate=v=>dates[v.indexOf(Math.max(0,...v))]||'';
    return { avgBox, avgStop, peakBox, peakStop, box, stop, boxes, stops, weights,unknownWeight,avgWeight,peakWeight,totalWeight,weight:c.basis==='peak'?peakWeight:avgWeight,totalStops:sum(stops),empty:ids.filter(z=>!demand[z]).length,peakBoxDate:peakDate(boxes),peakStopDate:peakDate(stops),peakWeightDate:complete?peakDate(weights):'',diameter,totalBox:sum(boxes),overDays:boxes.filter((b,i)=>b>c.maxBox+1e-8||stops[i]>c.targetStop+c.tolerance+1e-8||c.weightOn&&(weights[i]>weightCap(c)+1e-8||unknownWeight[i])).length };
  }
  function optimize(zones, adjacency, agg, c, locked = [], progress = () => {}) {
    validate(c);
    if(c.weightOn&&(!agg.hasWeight||agg.unknownWeight))throw Error('중량 최적화는 선택 기간의 매칭된 모든 행에 유효한 kg 값이 있어야 합니다. 열 매핑과 중량 오류를 확인하세요.');
    const { demand, dates } = agg, g = graph(zones, adjacency, demand, c), lockset = new Set(locked.flatMap(a => a.zips));
    const ids = Object.keys(demand).filter(z => !lockset.has(z)).sort(), n = dates.length;
    const stopHi = c.targetStop + c.tolerance, stopLo = Math.max(0, c.targetStop - c.tolerance), target = (c.minBox + c.maxBox) / 2;
    const measure = v => c.basis === 'peak' ? Math.max(0, ...v) : sum(v) / n;
    const create = a => {
      const b = Array(n).fill(0), s = Array(n).fill(0);
      a.forEach(z => { demand[z].boxes.forEach((v, i) => b[i] += v); demand[z].stops.forEach((v, i) => s[i] += v); });
      const w=Array(n).fill(0);a.forEach(z=>demand[z].weights?.forEach((v,i)=>w[i]+=v));
      return { zips: a, b, s, w, diameter:0,limit:Math.min(...a.map(z=>g.limits[z].diameter)),box: measure(b), stop: measure(s), weight:measure(w) };
    };
    const penalty = a => Math.max(0, c.minBox - a.box) / Math.max(1, c.minBox) * 4 + Math.max(0, stopLo - a.stop) / Math.max(1, stopLo) + Math.abs(a.box - target) / c.maxBox * .2 + (c.weightOn?Math.max(0,c.minWeight-a.weight)/Math.max(1,c.minWeight):0);
    const combine = (a, other) => {
      const b = a.b.map((v, i) => v + other.b[i]), s = a.s.map((v, i) => v + other.s[i]), box = measure(b), stop = measure(s);
      const w=a.w.map((v,i)=>v+other.w[i]), weight=measure(w);
      if (box > c.maxBox + 1e-8 || stop > stopHi + 1e-8 || c.weightOn&&(weight>c.maxWeight+1e-8||Math.max(...w)>c.vehicleCap+1e-8)) return null;
      if(c.han&&!riverCompatible([...a.zips,...other.zips],zones))return null;
      const limit=Math.min(a.limit,other.limit);let diameter=Math.max(a.diameter,other.diameter);
      if(diameter>limit+1e-8)return null;
      for(const z of a.zips)for(const v of other.zips){diameter=Math.max(diameter,distance(zones[z],zones[v]));if(diameter>limit+1e-8)return null;}
      return { zips: [...a.zips, ...other.zips], b, s, w, weight, box, stop,diameter,limit };
    };
    const singles = Object.fromEntries(ids.map(z => [z, create([z])]));
    let best = null, bestScore = Infinity;
    for (let trial = 0; trial < 3; trial++) {
      progress('인접 그래프 기반 후보 ' + (trial + 1) + '/3 계산');
      const un = new Set(ids), groups = [];
      const order = [...ids].sort((a, b) => trial === 0 ? (g[a].size - g[b].size || singles[b].box - singles[a].box || a.localeCompare(b)) : trial === 1 ? zones[a].lng - zones[b].lng || zones[a].lat - zones[b].lat : zones[b].lat - zones[a].lat || zones[b].lng - zones[a].lng);
      for (const seed of order) {
        if (!un.has(seed)) continue;
        let cur = singles[seed]; un.delete(seed);
        const frontier = new Set(g[seed]);
        while (frontier.size) {
          let choice = null, merged = null, score = Infinity;
          for (const z of frontier) {
            if (!un.has(z)) { frontier.delete(z); continue; }
            const candidate = combine(cur, singles[z]); if (!candidate) continue;
            const d = distance(zones[seed], zones[z]);
            const p = Math.abs(candidate.box - target) / c.maxBox + Math.abs(candidate.stop - c.targetStop) / stopHi * .3 + d / c.diameter * .2;
            if (p < score) { score = p; choice = z; merged = candidate; }
          }
          if (!choice) break;
          cur = merged; un.delete(choice); frontier.delete(choice); for (const z of g[choice]) if (un.has(z)) frontier.add(z);
        }
        groups.push(cur);
      }
      // Only graph-adjacent feasible unions; no implicit cap or distance relaxation.
      for (let pass = 0; pass < 3; pass++) {
        const owner = new Map(); groups.forEach((a, i) => { if (a) a.zips.forEach(z => owner.set(z, i)); });
        for (let i = 0; i < groups.length; i++) {
          const a = groups[i]; if (!a || (a.box >= c.minBox && a.stop >= stopLo)) continue;
          const neighbors = new Set(a.zips.flatMap(z => [...g[z]].map(v => owner.get(v))).filter(j => j != null && j !== i));
          let bj = -1, bc = null, gain = 0;
          for (const j of neighbors) if (groups[j]) {
            const b = groups[j], ab = combine(a, b); if (!ab) continue;
            const improvement = 1 + penalty(a) + penalty(b) - penalty(ab);
            if (improvement > gain) { gain = improvement; bj = j; bc = ab; }
          }
          if (bj >= 0) { groups[i] = bc; groups[bj] = null; bc.zips.forEach(z => owner.set(z, i)); }
        }
      }
      const out = groups.filter(Boolean), score = out.reduce((s, a) => s + 1 + penalty(a), 0);
      if (score < bestScore) { best = out; bestScore = score; }
    }
    const sequence = {};
    return [...locked, ...best.map(a => {
      const region = zones[a.zips[0]].region, short = region.replace(/특별자치|특별|광역|도|시/g, '') || '권역';
      sequence[short] = (sequence[short] || 0) + 1;
      return { name: short + '-' + String(sequence[short]).padStart(2, '0'), zips: a.zips, core:[], locked: false };
    })];
  }
  function diagnose(groups, geo, agg, c) {
    const g = graph(geo.zones, geo.adjacency, agg.demand, c);
    const owners = new Set(), result = groups.map(a => {
      const s = stats(a.zips, agg.demand, agg.dates, geo.zones, c), issues = [], active = a.zips.filter(z => agg.demand[z]);
      if (s.box > c.maxBox + 1e-8) issues.push('박스 초과');
      if (s.stop > c.targetStop + c.tolerance + 1e-8) issues.push('착지 초과');
      if (s.box < c.minBox - 1e-8) issues.push('박스 미달');
      if (s.stop < Math.max(0, c.targetStop - c.tolerance) - 1e-8) issues.push('착지 미달');
      s.allowedDiameter=Math.min(c.diameter,...active.map(z=>g.limits[z]?.diameter||c.diameter));
      if(s.diameter>s.allowedDiameter+1e-8)issues.push('거리 초과');
      if(c.weightOn){if(s.weight===null)issues.push('중량 미확인');else{if(s.weight>c.maxWeight+1e-8)issues.push('중량 초과');if(s.weight<c.minWeight-1e-8)issues.push('중량 미달');if(s.peakWeight>c.vehicleCap+1e-8)issues.push('실차 적재한도 초과');}}
      if(c.han){const sides=new Set(a.zips.map(z=>geo.zones[z]?.river||'unknown'));if(sides.has('unknown'))issues.push('한강 분리 미확인');if(sides.has('north')&&sides.has('south'))issues.push('강남·강북 혼합');}
      if(a.core?.some(z=>!a.zips.includes(z)))issues.push('고정 중심부 누락');
      if(a.zips.some(z=>agg.excludedZips?.includes(z)))issues.push('제외 데이터 확인');
      s.empty=a.zips.filter(z=>!agg.demand[z]&&!agg.excludedZips?.includes(z)).length;
      const coverage=Object.fromEntries(a.zips.map(z=>[z,new Set([...(g[z]||[]),...(geo.adjacency[z]||[]).filter(b=>(!c.han||riverCompatible([z,b],geo.zones))&&(!c.sameRegion||geo.zones[z]?.region===geo.zones[b]?.region))])]));
      if (!connected(a.zips, coverage)) issues.push('연결 끊김');
      if (a.zips.some(z => !geo.zones[z])) issues.push('경계 없음');
      if (c.sameRegion && new Set(a.zips.map(z => geo.zones[z]?.region)).size > 1) issues.push('시도 혼합');
      if (a.zips.some(z => owners.has(z))) issues.push('중복 배정');
      a.zips.forEach(z => owners.add(z));
      const strict = Object.fromEntries(a.zips.map(z => [z, geo.adjacency[z] || []]));
      if (!connected(a.zips, strict)) s.proximity = true;
      return { ...s, issues, valid: !issues.length };
    });
    return { groups: result, unassigned: Object.keys(agg.demand).filter(z => !owners.has(z)), valid: result.filter(s => s.valid).length, over: result.filter(s => s.issues.some(x => /초과/.test(x))).length };
  }
  function feasibility(agg,c) {
    // Necessary average-load bounds only, not a routing optimum or sufficient condition.
    if(c.basis!=='avg')return null;
    const minStop=Math.max(0,c.targetStop-c.tolerance),maxStop=c.targetStop+c.tolerance;
    let lower=Math.max(Math.ceil((agg.avgBox-1e-8)/c.maxBox),Math.ceil((agg.avgStop-1e-8)/maxStop));
    let upper=Math.min(c.minBox>0?Math.floor((agg.avgBox+1e-8)/c.minBox):Infinity,minStop>0?Math.floor((agg.avgStop+1e-8)/minStop):Infinity);
    if(c.weightOn&&agg.hasWeight&&!agg.unknownWeight){const w=agg.knownWeight/agg.dates.length;lower=Math.max(lower,Math.ceil((w-1e-8)/Math.min(c.maxWeight,c.vehicleCap)));if(c.minWeight>0)upper=Math.min(upper,Math.floor((w+1e-8)/c.minWeight));}
    return {lower:Math.max(0,lower),upper,conflict:lower>upper};
  }
  function fillEmpty(groups,geo,agg,c,scope) {
    if(!Array.isArray(scope)||!scope.length)throw Error('운영지역을 먼저 명시적으로 선택하세요.');
    const out=groups.map(g=>({...g,zips:[...g.zips]})),owner=new Map(),allowed=new Set(scope),queue=[];
    const excluded=new Set(agg.excludedZips||[]), graphLimits=graph(geo.zones,geo.adjacency,agg.demand,c).limits;
    out.forEach((g,i)=>g.zips.forEach(z=>{owner.set(z,i);if(!g.locked&&allowed.has(z))queue.push([z,i]);}));
    let added=0;
    for(let k=0;k<queue.length;k++){
      const [z,i]=queue[k],group=out[i];
      for(const b of geo.adjacency[z]||[]){
        if(!allowed.has(b)||owner.has(b)||agg.demand[b]||excluded.has(b))continue;
        if(c.han&&!riverCompatible([...group.zips,b],geo.zones))continue;
        if(c.sameRegion&&group.zips.some(a=>geo.zones[a].region!==geo.zones[b].region))continue;
        const maxDiameter=Math.min(c.diameter,...group.zips.map(a=>graphLimits[a]?.diameter||c.diameter));
        if(group.zips.some(a=>distance(geo.zones[a],geo.zones[b])>maxDiameter+1e-8))continue;
        owner.set(b,i);group.zips.push(b);queue.push([b,i]);added++;
      }
    }
    return {groups:out,added,remaining:scope.filter(z=>!owner.has(z)&&!agg.demand[z])};
  }
  return { zip, date, distance, stopKey, geometry, ingest, aggregate, validate, graph, connected, stats, optimize, diagnose, fillEmpty, feasibility, hanLine, hanSource, riverCompatible, inPolygon };

}
if (typeof module !== 'undefined') module.exports = createEngine();
