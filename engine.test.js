const assert = require('node:assert/strict');
const test = require('node:test');
const e = require('./engine.js');
const c = {basis:'avg',minBox:30,maxBox:50,targetStop:5,tolerance:5,diameter:20,gap:3,link:'strict',sameRegion:true};
const polygon = (z,x,y=37,region='서울특별시') => ({type:'Feature',properties:{BAS_ID:z,CTP_KOR_NM:region},geometry:{type:'Polygon',coordinates:[[[x,y],[x+.01,y],[x+.01,y+.01],[x,y+.01],[x,y]]]}});
const makeGeo = () => e.geometry({type:'FeatureCollection',features:[polygon('01001',127),polygon('01002',127.01),polygon('01003',127.02),polygon('01004',128)]});
const agg = {dates:['2026-09-01','2026-09-02'],demand:Object.fromEntries(['01001','01002','01003','01004'].map(z=>[z,{z,boxes:[20,20],stops:[2,2],avgBox:20,avgStop:2}]))};
test('dates support integer YYYYMMDD, Excel serial and leap-year validation',()=>{
  assert.equal(e.date(20260801),'2026-08-01');assert.equal(e.date('2026/08/01'),'2026-08-01');
  assert.equal(e.date(46235),'2026-08-01');assert.equal(e.date('2026-02-30'),'');assert.equal(e.date('2024-02-29'),'2024-02-29');
});
test('postal codes pad legitimate numeric cells and reject malformed values',()=>{
  assert.equal(e.zip(1234),'01234');assert.equal(e.zip('123456'),'');assert.equal(e.zip('12A45'),'');assert.equal(e.zip(''),'');
});
test('haversine returns known longitude distance at latitude 37 degrees',()=>{
  assert.ok(Math.abs(e.distance({lat:37,lng:127},{lat:37,lng:128})-88.8)<.1);
});
test('geometry uses postal key not numeric administrative code; only shared edges connect',()=>{
  const g=makeGeo();assert.deepEqual(g.adjacency['01001'],['01002']);assert.deepEqual(g.adjacency['01004'],[]);
  assert.equal(Object.keys(g.zones).length,4);assert.throws(()=>e.geometry({type:'FeatureCollection',features:[]}));
});
test('building aggregation removes unit numbers but preserves district digits',()=>{
  assert.equal(e.stopKey('A','서울 강남구 도산대로 12 301호','building'),e.stopKey('B','서울 강남구 도산대로 12 401호','building'));
  assert.notEqual(e.stopKey('A','서울 제1구 산동 12','building'),e.stopKey('A','서울 제1구 산동 13','building'));
});
test('ingestion preserves box sums, deduplicates daily stops, and reports exclusions',()=>{
  const mapping={date:'d',zip:'z',box:'b',address:'a',recv:'r'},rows=[
    {d:20260901,z:1001,b:2,a:'주소 1',r:'A'},{d:20260901,z:1001,b:3,a:'주소 1',r:'A'},
    {d:20260902,z:1001,b:4,a:'주소 1',r:'A'},{d:20260901,z:99999,b:6,a:'주소 2',r:'B'},
    {d:20260230,z:1001,b:9,a:'주소 1',r:'A'},{d:20260901,z:1001,b:-2,a:'주소 1',r:'A'},
    {d:20260901,z:1001,b:'',a:'주소 1',r:'A'},{d:20260901,z:1001,b:1,a:'',r:'A'}];
  const d=e.ingest(rows,mapping,makeGeo().zones,'recipient'),a=e.aggregate(d,['2026-09-01','2026-09-02']);
  assert.equal(d.errors.length,5);assert.equal(a.totalBox,9);assert.equal(a.avgBox,4.5);assert.equal(a.avgStop,1);assert.equal(a.rejectedRows,4);assert.equal(a.rejectedBoxes,7);
  assert.equal(e.aggregate(d,['2026-09-02']).totalBox,4);
});
test('optimization partitions all demand exactly once with hard caps and connectivity',()=>{
  const geo=makeGeo(),groups=e.optimize(geo.zones,geo.adjacency,agg,c),d=e.diagnose(groups,geo,agg,c);
  assert.deepEqual(groups.flatMap(g=>g.zips).sort(),Object.keys(agg.demand).sort());assert.equal(d.unassigned.length,0);
  for(const s of d.groups){assert.ok(s.box<=50);assert.ok(s.stop<=10);assert.ok(s.diameter<=20);assert.ok(!s.issues.includes('연결 끊김'));}
  assert.ok(groups.find(g=>g.zips.includes('01004')).zips.length===1);
});
test('single postal overload is retained and flagged rather than hidden or over-merged',()=>{
  const geo=makeGeo(),a=structuredClone(agg);a.demand['01001'].boxes=[100,100];
  const groups=e.optimize(geo.zones,geo.adjacency,a,c),index=groups.findIndex(g=>g.zips.includes('01001'));
  assert.deepEqual(groups[index].zips,['01001']);assert.ok(e.diagnose(groups,geo,a,c).groups[index].issues.includes('박스 초과'));
});
test('peak mode uses combined daily vectors, not sums of individual peaks',()=>{
  const geo=makeGeo(),a={dates:agg.dates,demand:{'01001':{boxes:[40,0],stops:[4,0]},'01002':{boxes:[0,40],stops:[0,4]}}};
  const g=e.optimize(geo.zones,geo.adjacency,a,{...c,basis:'peak'});assert.equal(g.length,1);assert.equal(e.diagnose(g,geo,a,{...c,basis:'peak'}).groups[0].peakBox,40);
});
test('locked groups retain names, assignments, and overcapacity without adding members',()=>{
  const geo=makeGeo(),locked={name:'잠금',zips:['01001','01002','01003'],locked:true};
  const groups=e.optimize(geo.zones,geo.adjacency,agg,c,[locked]);assert.deepEqual(groups[0],locked);assert.equal(groups.length,2);assert.ok(e.diagnose(groups,geo,agg,c).groups[0].issues.includes('박스 초과'));
});
test('near connections are opt-in and region restriction is respected',()=>{
  const geo=e.geometry({type:'FeatureCollection',features:[polygon('01001',127),polygon('01002',127.015,37,'경기도')]}),a={dates:agg.dates,demand:{'01001':agg.demand['01001'],'01002':agg.demand['01002']}};
  assert.equal(e.optimize(geo.zones,geo.adjacency,a,{...c,link:'near'}).length,2);
  const g=e.optimize(geo.zones,geo.adjacency,a,{...c,link:'near',sameRegion:false});assert.equal(g.length,1);assert.equal(e.diagnose(g,geo,a,{...c,link:'near',sameRegion:false}).groups[0].proximity,true);
});
test('diameter limits all members not only distance from initial seed',()=>{
  const geo=makeGeo(),g=e.optimize(geo.zones,geo.adjacency,agg,{...c,diameter:.5,link:'near',gap:3});assert.equal(g.length,4);
});
test('empty selection and invalid limits fail explicitly',()=>{
  assert.throws(()=>e.aggregate({records:[]},[]));assert.throws(()=>e.validate({...c,minBox:60,maxBox:50}));assert.throws(()=>e.validate({...c,targetStop:0}));assert.throws(()=>e.validate({...c,tolerance:-1}));
});
test('same exact input yields deterministic assignments',()=>{
  const geo=makeGeo();assert.deepEqual(e.optimize(geo.zones,geo.adjacency,agg,c),e.optimize(geo.zones,geo.adjacency,agg,c));
});

const wc={...c,weightOn:true,minWeight:1000,maxWeight:1100,vehicleCap:1400};
const wm={date:'d',zip:'z',box:'b',address:'a',recv:'r',weight:'w'};
test('weights are row totals; daily stop dedup never removes box or kg totals',()=>{
 const geo=makeGeo(),rows=[{d:20260901,z:'01001',b:2,w:125.5,a:'A',r:'A'},{d:20260901,z:'01001',b:3,w:200,a:'A',r:'A'},{d:20260902,z:'01001',b:1,w:0,a:'A',r:'A'}];
 const data=e.ingest(rows,wm,geo.zones,'recipient'),a=e.aggregate(data,agg.dates),s=e.stats(['01001'],a.demand,a.dates,geo.zones,c);
 assert.equal(s.totalWeight,325.5);assert.equal(s.avgWeight,162.75);assert.equal(s.totalBox,6);assert.equal(s.totalStops,2);assert.equal(s.peakWeightDate,'2026-09-01');assert.equal(a.unknownWeight,0);
});
test('missing and negative kg remain unknown, preserve box counts, and block kg optimization',()=>{
 const geo=makeGeo(),data=e.ingest([{d:20260901,z:'01001',b:2,w:'',a:'A'},{d:20260901,z:'01002',b:3,w:-1,a:'B'}],wm,geo.zones,'recipient'),a=e.aggregate(data,['2026-09-01']);
 assert.equal(a.totalBox,5);assert.equal(data.errors.length,0);assert.equal(data.weightErrors.length,2);assert.equal(a.unknownWeight,2);assert.throws(()=>e.optimize(geo.zones,geo.adjacency,a,wc),/중량/);assert.equal(e.stats(['01001'],a.demand,a.dates,geo.zones,c).avgWeight,null);
});
test('old workbooks without kg remain usable but cannot certify weight compliance',()=>{
 const geo=makeGeo(),data=e.ingest([{d:20260901,z:'01001',b:2,a:'A'}],{...wm,weight:''},geo.zones,'recipient'),a=e.aggregate(data,['2026-09-01']);
 assert.equal(a.hasWeight,false);assert.equal(e.optimize(geo.zones,geo.adjacency,a,c).length,1);assert.throws(()=>e.optimize(geo.zones,geo.adjacency,a,wc));
});
test('a 1 tonne actual vehicle cannot accept an 1100kg operating cap',()=>{
 assert.throws(()=>e.validate({...wc,vehicleCap:1000}),/적재한도/);assert.equal(e.validate(wc).maxWeight,1100);
});
test('kg constraints use daily vectors and enforce physical peak even in average mode',()=>{
 const geo=makeGeo(),a={dates:agg.dates,hasWeight:true,unknownWeight:0,demand:{'01001':{boxes:[10,10],stops:[1,1],weights:[800,200],unknownWeight:[0,0]},'01002':{boxes:[10,10],stops:[1,1],weights:[800,200],unknownWeight:[0,0]}}};
 const groups=e.optimize(geo.zones,geo.adjacency,a,wc);assert.equal(groups.length,2);
 a.demand['01002'].weights=[200,800];const merged=e.optimize(geo.zones,geo.adjacency,a,wc);assert.equal(merged.length,1);assert.equal(e.stats(merged[0].zips,a.demand,a.dates,geo.zones,wc).peakWeight,1000);
});
test('Han geometry correctly separates known north/south locations and isolates uncertain areas',()=>{
 const geo=e.geometry({type:'FeatureCollection',features:[polygon('01001',126.97,37.58),polygon('01002',127.03,37.49),polygon('01003',128,37.5)]});
 assert.equal(geo.zones['01001'].river,'north');assert.equal(geo.zones['01002'].river,'south');assert.equal(geo.zones['01003'].river,'unknown');
 assert.equal(e.riverCompatible(['01001','01002'],geo.zones),false);assert.equal(e.riverCompatible(['01003'],geo.zones),false);
 const a={dates:agg.dates,demand:Object.fromEntries(Object.keys(geo.zones).map(z=>[z,agg.demand['01001']]))};
 const groups=e.optimize(geo.zones,geo.adjacency,a,{...c,han:true,link:'near',gap:100,diameter:100});assert.equal(groups.length,3);
});
test('zero-volume fill needs explicit scope, keeps totals and does not relocate existing ownership',()=>{
 const geo=makeGeo(),a={dates:agg.dates,demand:{'01001':agg.demand['01001']}},groups=[{name:'A',zips:['01001'],core:['01001']}];
 assert.throws(()=>e.fillEmpty(groups,geo,a,c,[]));
 const fill=e.fillEmpty(groups,geo,a,c,['01001','01002']);assert.deepEqual(fill.groups[0].zips,['01001','01002']);assert.equal(fill.added,1);assert.equal(e.stats(fill.groups[0].zips,a.demand,a.dates,geo.zones,c).totalBox,40);assert.deepEqual(groups[0].zips,['01001']);assert.equal(fill.groups[0].core[0],'01001');
 const locked=e.fillEmpty([{...groups[0],locked:true}],geo,a,c,['01001','01002']);assert.equal(locked.added,0);
 const excluded=e.fillEmpty(groups,geo,{...a,excludedZips:['01002']},c,['01001','01002']);assert.equal(excluded.added,0);
});
test('empty coverage may connect active polygons and density limits never exceed configured maximum',()=>{
 const geo=makeGeo(),a={dates:agg.dates,demand:{'01001':agg.demand['01001'],'01003':agg.demand['01003']}};
 const d=e.diagnose([{name:'A',zips:['01001','01002','01003']}],geo,a,c);assert.equal(d.groups[0].issues.includes('연결 끊김'),false);assert.equal(d.groups[0].empty,1);
 const graph=e.graph(geo.zones,geo.adjacency,agg.demand,{...c,density:true});assert.ok(graph.limits['01001'].gap<c.gap);assert.ok(graph.limits['01001'].diameter<=c.diameter);
});
test('preserved responsibility remains fixed even on days with zero demand',()=>{
 const geo=makeGeo(),locked=[{name:'기사 A',zips:['01001','01002'],core:['01001'],locked:false}],a={dates:agg.dates,demand:{'01003':agg.demand['01003']}};
 const output=e.optimize(geo.zones,geo.adjacency,a,c,locked);assert.deepEqual(output[0],locked[0]);assert.equal(output.flatMap(g=>g.zips).filter(z=>z==='01001').length,1);
});
test('necessary feasibility bounds warn when boxes and stop targets cannot coexist',()=>{
 const bounds=e.feasibility({avgBox:5355.1,avgStop:2554.6,dates:agg.dates},{...c,minBox:60,maxBox:75,targetStop:15,tolerance:5});
 assert.deepEqual(bounds,{lower:128,upper:89,conflict:true});assert.equal(e.feasibility(agg,{...c,basis:'peak'}),null);
});
test('mixed density group union respects strictest member diameter for all pairs',()=>{
 const features=[],demand={};for(let i=0;i<60;i++){const z=String(20000+i);features.push(polygon(z,127+(i%10)*.009,37+Math.floor(i/10)*.012));demand[z]={boxes:[1,1],stops:[.1,.1]};}
 const geo=e.geometry({type:'FeatureCollection',features}),a={dates:agg.dates,demand},cfg={...c,density:true,link:'near',gap:4,diameter:6};const groups=e.optimize(geo.zones,geo.adjacency,a,cfg),ds=e.diagnose(groups,geo,a,cfg);
 assert.ok(ds.groups.every(g=>g.diameter<=g.allowedDiameter+1e-8));
});
