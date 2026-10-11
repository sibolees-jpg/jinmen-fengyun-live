const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const C=require('../scene-catalog.js'),Script=require('../speech-script.js'),Scenes=require('../scene-script.js'),{stage}=require('./helpers/stage-fixture.cjs');
const catalog=require('../show/scenes.json').catalog,script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json'));
const flush=()=>new Promise(r=>setImmediate(r));
async function fixture(){const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await flush();s.command('topic',{topic:23});s.tick(2000);s.command('scene-take',{sceneId:'sc-q925-t2',revision:0});s.tick(100);return s;}
const state=s=>{s.command('hello');return s.posted.at(-1);};
test('T2 is an independent exact visual copy of T1, outside the 23 manuscript bindings',()=>{
 const n=C.normalize(catalog),[t1,t2]=n.maps.at(-1).scenes;const visual=s=>{const {id,name,notes,liveDialogue,...v}=s;return {...v,actors:v.actors.map(a=>({...a,bubble:{...a.bubble,writingMode:'vertical'}})),sceneBlock:v.sceneBlock?{...v.sceneBlock,code:'T1',anchors:undefined}:undefined};};assert.deepEqual(visual(t1),visual(t2));assert.equal(t2.liveDialogue,true);assert.equal(t2.id,'sc-q925-t2');assert.equal(Scenes.bind(n,script).rows.length,23);
 t2.actors[0].x+=4;t2.actors[0].bubble.width=18;assert.notDeepEqual(t1.actors,t2.actors);assert.equal(n.maps.at(-1).sharedAssets,false);
});
test('T2 clears queued finale and makes all nine present actors available without replaying known script',async()=>{
 const s=await fixture(),m=state(s);assert.equal(m.scenery.progress.code,'T2');assert.equal(m.scenery.liveDialogue,true);assert.equal(m.presentation.liveDialogue,true);assert.deepEqual(Array.from(m.improvActors),[0,1,2,3,4,5,6,7,8]);
 s.command('voice-state',{active:true,session:'live'});s.command('voice-transcript',{session:'live',seq:1,text:script.blocks[23].source,final:true});s.tick(2000);
 for(const action of ['force-cue','rehearsal-discuss','rehearsal-start','scene-next'])s.command(action,{index:23,expectedTopic:23,epoch:m.controlEpoch});s.tick(5000);
 const after=state(s);assert.equal(after.scenery.activeId,'sc-q925-t2');assert.equal(after.replyFlow.pendingLines,0);assert.ok(after.actors.every(a=>a.phase==='idle'));assert.equal(s.calls.length,0,'switch remains off');s.command('clear');
});
test('T2 speech takes the existing model pipeline with live scene ID and no T1 manuscript context',async()=>{
 const s=await fixture();s.command('script-improv',{enabled:true});s.command('voice-state',{active:true,session:'live'});
 s.command('voice-transcript',{session:'live',seq:1,text:script.blocks[23].source,final:true});s.tick(1500);
 assert.equal(s.calls.length,1);const request=s.calls[0].body;assert.equal(request.liveSceneId,'sc-q925-t2');assert.equal(request.speech,undefined);assert.equal(request.improv,true);assert.equal(request.improvActors.length,9);
 await s.answer([{actor:0,text:'今日相聚，我也想听听大家的愿望。'}]);s.tick(1000);assert.ok(state(s).actors.some(a=>a.captionVisible));s.command('clear');
});
test('switching between T1/T2 retires the audio generation and rejects a late T2 model result',async()=>{
 const s=await fixture();s.command('scene-take',{sceneId:'sc-q925-t1',revision:0});s.command('voice-state',{active:true,session:'old'});s.command('scene-take',{sceneId:'sc-q925-t2',revision:0});const reset=state(s).voiceReset;assert.equal(reset.pending,true);assert.equal(reset.kind,'live-scene');
 s.command('voice-transcript',{session:'old',seq:100,text:'昨天校园来了一只小猫。',final:true});assert.equal(state(s).speechRawCaption,'');
 s.command('voice-state',{active:true,session:'new',resetToken:reset.token});s.command('script-improv',{enabled:true});s.command('voice-transcript',{session:'new',seq:1,text:'昨天校园来了一只小猫。',final:true});s.tick(1500);assert.equal(s.calls.length,1);
 s.command('scene-take',{sceneId:'sc-q925-t1',revision:0});await s.answer([{actor:0,text:'迟到的临场台词'}]);s.tick(2000);assert.equal(state(s).scenery.activeId,'sc-q925-t1');assert.equal(state(s).presentation.liveDialogue,false);assert.ok(state(s).actors.every(a=>a.phase==='idle'));s.command('clear');
});
