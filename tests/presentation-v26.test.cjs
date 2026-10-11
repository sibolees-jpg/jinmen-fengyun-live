const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {stage}=require('./helpers/stage-fixture.cjs'),C=require('../scene-catalog.js'),A=require('../actor-animation.js');
const script=require('../speeches/2026-120周年校庆/津门风云-9.24-v26.json'),catalog=require('../speeches/2026-120周年校庆/津门风云-9.24-v26-场次.json');
const settle=()=>new Promise(r=>setImmediate(r));
test('S0 has no nameplates; opening, idle, replies, and cleared bubbles keep all present S1 names',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await settle();s.tick(1);
 const visible=()=>vm.runInContext('labelNodes.filter(n=>!n.hidden&&n.style.visibility!=="hidden"&&Number(n.style.opacity)>.99).length',s.context);
 assert.equal(visible(),0);s.command('voice-state',{active:true,session:'names26'});s.command('voice-transcript',{session:'names26',seq:1,text:'尊敬的',final:false});s.tick(1800);assert.equal(visible(),9);assert.equal(s.posted.at(-1).cues.length,0);
 vm.runInContext('engine.clear();dialogueDisplay.reset()',s.context);s.tick(500);assert.equal(visible(),9);s.command('scene-reset');s.tick(500);assert.equal(visible(),0);
});
test('new compositions retain all original backgrounds, unchanged reference anchors, nine independent actors, and only matching pose packs',()=>{
 const old=require('../speeches/2026-120周年校庆/津门风云-9.24-v25-场次.json'),norm=C.normalize(catalog);
 for(let k=0;k<norm.maps.length;k++){const s=norm.maps[k].scenes[0];assert.equal(s.background,old.maps[k].scenes[0].background);assert.equal(s.actors.length,9);assert.equal(norm.maps[k].sharedAssets,false);if([2,3,4,6,7,8,12].includes(k))s.actors.forEach((a,i)=>{const previous=C.actorAnchor(old.maps[k].scenes[0].actors[i],s.backgroundAspect),next=C.actorAnchor(a,s.backgroundAspect);for(const key of ['x','y','height','layer'])assert.ok(Math.abs(previous[key]-next[key])<1e-6,`S${k} actor${i} ${key}`);});
  for(const a of s.actors){if(a.animation){assert.equal(A.active(a),true);assert.equal(a.motion.stationary,true);assert.equal(a.motion.walking,false);assert.equal(a.personMask,'');assert.equal(a.bodyClip.length,0);assert.ok(new Set(a.animation.clips.breath).size>1);assert.ok(a.animation.clips.talk.length);} }
 }
 assert.equal(norm.maps.flatMap(m=>m.scenes.flatMap(s=>s.actors)).filter(A.active).length,56);
});
test('updated scene compositions and persistent labels preserve continuous 220 CPM full-script delivery',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await settle();s.command('rehearsal-start');
 for(let t=0;t<1800000;t+=500){s.tick(500);const state=s.posted.at(-1);if(!state.rehearsal.active&&state.cues.length===77&&state.cues.every(c=>c.state==='played')&&!state.queue)break;}
 const state=s.posted.at(-1);assert.equal(state.cues.length,77);assert.ok(state.cues.every(c=>c.state==='played'));assert.equal(state.cues.reduce((n,c)=>n+c.completed,0),141);assert.equal(state.cueTracking.completed,217);assert.equal(state.cueTracking.missing.length,0);assert.equal(state.queue,0);s.command('clear');
});
