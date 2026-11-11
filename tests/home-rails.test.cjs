const assert = require('node:assert/strict');
function node(){return {style:{},children:[],appendChild(n){this.children.push(n)},addEventListener(k,fn){this[k]=fn},set innerHTML(v){this.children=[]}}}
let state={continue_watching:[],favorites:[]};
global.window=global;global.document={createElement:node};global.setInterval=()=>0;
global.EP={Stage:{group:node,rect:node,el:node,label:node,poster:node,button:node,show:(n,v)=>n.visible=v,focus:(n,v)=>n.focused=v,toggle(){},setButton(){},move(){},setPoster(){}},LocalState:{load:()=>state,isFavorite:()=>false},Emitter:function(){this.emit=(...x)=>this.last=x},icon:node,clockText:()=>({}),Timer:function(){this.start=this.stop=()=>{}},lower:s=>String(s||'').toLowerCase(),displayTitle:s=>s.replace(/ (DUB|LEG)$/,''),qualityOf:()=>'',sizedImage:s=>s};
require('../public/src/views/homeView.js');
const v=new EP.HomeView(node());v.buildSlides=()=>{};
const movies=Array.from({length:35},(_,i)=>({id:'m'+i,title:'Movie '+i,type:'movies',year:2026,added_at:String(100+i)}));
const series={id:'series',title:'Series',type:'series',added_at:'200'};
const items=[...movies,series,{...movies[34],id:'dub',title:'Movie 34 DUB'},{id:'live',type:'live',added_at:'999'}];
v.setCatalog({items});assert.equal(v.rails[0].items.length,30);assert.equal(v.rails[1].group.visible,false);assert.equal(v.rails[0].items[0].item.id,'series');
v.handleKey('down');v.handleKey('down');assert.equal(v.railRow,0);assert.equal(v.scroller.style.transform,'translateY(-328px)');
const before=v.rails[0].items.map(x=>x.item.id);
state.continue_watching=[{id:'m0',updated_at:'2026-01-01',progress_seconds:10,duration_seconds:100},{id:'series:episode:7',updated_at:'2026-02-01',progress_seconds:50,duration_seconds:100}];
v.setActive(true);assert.deepEqual(v.rails[0].items.map(x=>x.item.id),before);assert.equal(v.rails[1].items[0].item,series);assert.equal(v.rails[1].items[0].progress,.5);
for(let i=0;i<12;i++)v.handleKey('right');assert.equal(v.rails[0].index,12);const offset=v.rails[0].offset;
v.handleKey('down');assert.equal(v.railRow,1);assert.equal(v.rails[1].index,1);assert.equal(v.scroller.style.transform,'translateY(-712px)');
v.handleKey('left');assert.equal(v.rails[1].index,0);v.handleKey('up');assert.equal(v.rails[0].offset,offset);assert.equal(v.rails[0].index,offset);
v.rails[1].posters[1].click();assert.equal(v.railRow,1);assert.equal(v.events.last[0],'playRequested');assert.equal(v.events.last[1].id,'m0');
state.continue_watching=[];v.setActive(true);assert.equal(v.railRow,0);assert.equal(v.rails[1].group.visible,false);assert.equal(v.scroller.style.transform,'translateY(-328px)');
v.handleKey('up');assert.equal(v.area,'tiles');assert.equal(v.scroller.style.transform,'translateY(0)');
console.log('Home: two rows, grouping, progress, navigation, pointer and refresh passed');

state.continue_watching=movies.slice(0,20).map((m,i)=>({id:m.id,updated_at:String(100+i),progress_seconds:20,duration_seconds:100}));
v.setActive(true);v.handleKey('down');v.handleKey('down');
for(let i=0;i<12;i++)v.handleKey('right');
const secondOffset=v.rails[1].offset;assert.ok(secondOffset>0);
v.handleKey('up');assert.equal(v.rails[0].offset,offset);
v.handleKey('down');assert.equal(v.rails[1].offset,secondOffset);
state.continue_watching=[state.continue_watching[0]];v.setActive(true);assert.equal(v.rails[1].index,0);
v.setCatalog({items:[]});assert.equal(v.railRow,0);assert.equal(v.rails[1].group.visible,false);

state.continue_watching=[{id:'series:episode:7',title:'Series episode 7',updated_at:'2026-02-01',progress_seconds:50,duration_seconds:100}];
v.setCatalog({items,metadataLoader:(item,cb)=>cb({item:{seasons:[{episodes:[{id:'7',stream_url:'https://example.test/series/7.mp4'}]}]}})});
v.area='rail';v.railRow=1;v.rails[1].index=0;v.handleKey('OK');
assert.equal(v.events.last[0],'playRequested');assert.equal(v.events.last[1].id,'series:episode:7');assert.equal(v.events.last[1].stream_url,'https://example.test/series/7.mp4');
