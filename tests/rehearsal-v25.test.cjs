const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {stage}=require('./helpers/stage-fixture.cjs'),C=require('../scene-catalog.js');
const script=require('../speeches/2026-120周年校庆/津门风云-9.24-v24.json'),catalog=require('../speeches/2026-120周年校庆/津门风云-9.24-v25-场次.json');
const settle=()=>new Promise(r=>setImmediate(r));
test('exact three-character interim greeting starts S0 fade once with no cue or premature sentence completion',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await settle();s.tick(1);s.command('voice-state',{active:true,session:'intro25'});
 for(const text of ['准备开始','尊','尊敬']){s.command('voice-transcript',{session:'intro25',seq:1,text,final:false});s.tick(100);assert.equal(s.posted.at(-1).scenery.activeId,catalog.standbySceneId);}
 s.command('voice-transcript',{session:'intro25',seq:2,text:'尊敬的',final:false});s.tick(100);assert.equal(s.posted.at(-1).scenery.activeId,script.blocks[0].sceneId);assert.equal(s.posted.at(-1).cues.length,0);const opening=vm.runInContext('openingAt',s.context);s.command('voice-transcript',{session:'intro25',seq:3,text:'尊敬的',final:false});s.tick(100);assert.equal(vm.runInContext('openingAt',s.context),opening);assert.ok(s.posted.at(-1).presentation.sentenceIndex<=0);
 s.tick(1700);assert.equal(Number(vm.runInContext('openingLayer.style.opacity',s.context)),0);s.command('scene-reset');assert.equal(s.posted.at(-1).scenery.activeId,catalog.standbySceneId);s.command('clear');
});
test('continuous 220 CPM rehearsal traverses the live keyword path and drains all 77 groups and 141 lines',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await settle();s.command('rehearsal-start');let finished=0,maxQueue=0;const seen=new Set(),visited=new Set();
 for(let t=0;t<1800000;t+=500){s.tick(500);const state=s.posted.at(-1);seen.add(state.scenery.activeId);maxQueue=Math.max(maxQueue,state.queue);if(state.presentation.sentenceIndex>=0)visited.add(`${state.presentation.index}:${state.presentation.sentenceIndex}`);if(!state.rehearsal.active&&!finished)finished=t;if(finished&&state.cues.length===77&&state.cues.every(c=>c.state==='played')&&!state.queue)break;}
 const state=s.posted.at(-1),expected=script.blocks.flatMap(b=>b.sentences).reduce((n,s)=>n+s.text.length*60000/220+s.holdMs,0);assert.ok(finished>=expected-1000&&finished<=expected+217*500+1000,`read ${finished}, expected ${expected}`);assert.equal(state.cues.length,77);assert.ok(state.cues.every(c=>c.state==='played'));assert.equal(state.cues.reduce((n,c)=>n+c.completed,0),141);assert.equal(state.cueTracking.completed,217);assert.equal(state.cueTracking.missing.length,0);assert.ok(script.blocks.every(b=>seen.has(b.sceneId)));assert.equal(state.queue,0);assert.ok(maxQueue<=20);assert.equal(s.calls.length,0);s.command('clear');
});
test('new catalog retains exact backgrounds and untouched scenes, migrates legacy ten slots to nine',()=>{
 const old=require('../speeches/2026-120周年校庆/津门风云-9.24-v24-场次.json');const n=C.normalize(catalog);assert.equal(C.NAMES.length,9);for(let i=0;i<n.maps.length;i++){assert.equal(n.maps[i].scenes[0].background,old.maps[i].scenes[0].background);assert.equal(n.maps[i].scenes[0].actors.length,9);if(![2,3,4,6,7,8,12].includes(i))assert.deepEqual(n.maps[i],C.normalize(old).maps[i]);}assert.equal(C.normalize(old).maps[0].scenes[0].actors.length,9);assert.ok(C.seed().maps.every(m=>m.scenes.every(s=>s.actors.length===9)));assert.ok(n.maps.every(m=>!m.sharedAssets));
});
