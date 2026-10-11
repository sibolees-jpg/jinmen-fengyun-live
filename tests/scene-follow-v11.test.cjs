const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {stage}=require('./helpers/stage-fixture.cjs'),C=require('../scene-catalog.js');
const {SceneCastMotion,placeBubbles}=require('../stage-layout.js');
const timeline=require('../speeches/2026-120周年校庆/镜头本场景序列-v12.json');
const script=require('../speeches/2026-120周年校庆/津门风云-9.22-v12.json');
async function fixture(){const catalog=C.seed();catalog.timeline=timeline;for(const m of catalog.maps)for(const s of m.scenes){s.background=C.STOCK;s.fallbackStanding=true;s.actors.forEach((a,i)=>a.present=m.id!=='sc-map-overview'&&i<9);}const s=stage({sceneCatalog:catalog,width:239});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));return s;}
test('220-character rehearsal exits overview and traverses the actual shot manuscript to the final map',async()=>{
 const s=await fixture();s.command('rehearsal-start');const seen=new Set();
 for(let i=0;i<2400;i++){s.tick(1000);const state=s.posted.at(-1);seen.add(state.scenery.activeId);if(!state.rehearsal.active)break;}
 assert.deepEqual([...seen],['sc-overview-1',...timeline.map(r=>r.sceneId)]);assert.equal(s.posted.at(-1).scenery.shot.ended,true);
 s.command('rehearsal-start');for(let i=0;i<5;i++)s.tick(1000);assert.equal(s.posted.at(-1).scenery.activeId,'sc-jingang-1');s.command('clear');
});
test('real voice transport streams each shot end before final results and retains the session through cuts',async()=>{
 const s=await fixture();s.command('voice-state',{active:true,session:'v11-live'});let seq=0;
 s.command('voice-transcript',{session:'v11-live',seq:++seq,text:'尊敬的各位领导',final:false,source:'doubao-api'});for(let i=0;i<3;i++)s.tick(1000);
 assert.equal(s.posted.at(-1).scenery.activeId,timeline[0].sceneId);
 for(let i=0;i<timeline.length-1;i++){
  const text=timeline[i].text.slice(-60);s.command('voice-transcript',{session:'v11-live',seq:++seq,text,final:false,source:'doubao-api'});s.tick(170);
  assert.equal(s.posted.at(-1).scenery.activeId,timeline[i+1].sceneId);
  s.command('voice-transcript',{session:'v11-live',seq:++seq,text,final:true,source:'doubao-api'});s.tick(1000);
  assert.equal(s.posted.at(-1).scenery.activeId,timeline[i+1].sceneId);assert.equal(s.posted.at(-1).inputSession,'v11-live');
 }s.command('clear');
});
test('prepared reply preview locates its scene without advancing the live speech cursor by a fabricated ending',async()=>{
 const s=await fixture();s.command('rehearsal-discuss',{index:0});for(let i=0;i<3;i++)s.tick(1000);assert.equal(s.posted.at(-1).scenery.activeId,'sc-jingang-1');assert.equal(s.posted.at(-1).scenery.shot.index,0);s.command('clear');
});
test('scene cast stays present after replies finish; pose transitions preserve continuity when interrupted',()=>{
 const m=new SceneCastMotion(),a=C.seed().maps[1].scenes[0].actors;m.move(a,0);const start=m.sample(0,1000);m.move(a.map(x=>({...x,x:x.x+5})),1000);assert.equal(m.sample(0,1000).x,start.x);assert.equal(m.sample(0,1300).opacity,1);const mid=m.sample(0,1300);m.move(a,1300);assert.deepEqual(m.sample(0,1300),mid);assert.equal(m.sample(0,3000).x,start.x);
 m.move(a.map(x=>({...x,present:false})),3000);assert.equal(m.sample(0,3000).opacity,1);assert.ok(m.sample(0,3300).opacity>0);assert.equal(m.sample(0,4000).opacity,0);
});
const overlap=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
test('three small captions avoid the entire nine-person cast and each other at preview and fullscreen sizes',()=>{
 const positions=[[.73,.95,1.95],[.2,.95,1.95],[.3,.66,1.3],[.42,.51,1.55],[.42,.69,1.55],[.75,.56,1.75],[.61,.69,1.55],[.53,.54,1.5],[.91,.9,2]];
 for(const [w,h] of [[1100,998],[1728,1084],[1440,900]]){
  const sh=Math.min(w/2,h-74),top=(h-74-sh)*.48,left=(w-sh*2)/2;
  const figures=positions.map(([x,y,s])=>({left:left+sh*2*x-sh*.285*s/3-4,top:top+sh*y-sh*.285*s-5,width:sh*.285*s*2/3+8,height:sh*.285*s+10}));
  const items=[0,1,3].map(id=>({id,x:figures[id].left+figures[id].width/2,y:figures[id].top,width:230,height:195}));
  const boxes=placeBubbles(items,w,h,{obstacles:figures});assert.equal(boxes.length,3,`${w}: lost caption`);
  for(const b of boxes){assert.ok(figures.every(f=>!overlap(b,f)),`${w}: covers actor`);assert.ok(boxes.every(o=>o.id===b.id||!overlap(b,o)),`${w}: covers caption`);}
 }
});

test('missing the first greeting or a known 百年老人 transcription still starts the opening from later opening sentences',()=>{
 const {ShotFollower}=require('../shot-follow.js');for(const text of ['天津美院办学一百二十年矣。','百年老人，何来少年心气？','尊敬各位领导']){let opens=0;const f=new ShotFollower(timeline,{opening:()=>opens++});f.feed(text,false);assert.equal(opens,1,text);assert.equal(f.index,0);f.feed(text,true);assert.equal(opens,1);}
});
