const {test}=require('node:test'),assert=require('node:assert/strict');
const {stage}=require('./helpers/stage-fixture.cjs'),Script=require('../speech-script.js');
const catalog=require('../show/scenes.json').catalog,script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json'));
async function fixture(){const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('scene-take',{sceneId:'sc-q925-t2',revision:0});s.command('script-improv',{enabled:true});s.command('voice-state',{active:true,session:'live'});return s;}
const say=(s,seq,text,final=true,source='doubao-api')=>s.command('voice-transcript',{session:'live',seq,text,final,source});
const advance=(s,n)=>{for(let i=0;i<n;i++)s.tick(100);};
test('all saved scenes before T2 drop off-script voice and typed input while keeping fixed cue routing',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('script-improv',{enabled:true});
 for(const scene of catalog.maps.flatMap(m=>m.scenes).filter(s=>!s.liveDialogue)){
  s.command('scene-take',{sceneId:scene.id,revision:0});s.command('voice-state',{active:true,session:scene.id});s.command('voice-transcript',{session:scene.id,seq:1,text:'今天临时聊聊校园的小猫。',final:true});s.tick(1500);assert.equal(s.calls.length,0,scene.id);assert.equal(s.posted.at(-1).improvActors.length,0,scene.id);
  s.command('voice-state',{active:false,session:scene.id});s.elements.get('test-text').value='这里没有写在剧本里面。';s.tick(1500);assert.equal(s.calls.length,0,scene.id);
 }s.command('topic',{topic:1});s.command('voice-state',{active:true,session:'fixed'});s.command('voice-transcript',{session:'fixed',seq:1,text:script.blocks[1].sentences[0].text,final:true});advance(s,100);assert.ok(s.posted.at(-1).cues.some(c=>c.key.startsWith('1:')));assert.equal(s.calls.length,0);s.command('clear');
});
test('T2 displays interim words immediately; a confirmed API utterance needs no sentence punctuation',async()=>{
 const s=await fixture();say(s,1,'校园里的小猫今天也来听课',false);s.tick();assert.equal(s.calls.length,0);assert.equal(s.elements.get('live-caption').textContent,'校园里的小猫今天也来听课');say(s,2,'校园里的小猫今天也来听课',true);s.tick();assert.equal(s.calls.length,1);assert.equal(s.calls[0].body.liveSceneId,'sc-q925-t2');assert.equal(s.calls[0].body.text,'校园里的小猫今天也来听课');await s.answer([{actor:3,text:'它的出勤率倒不低。'}]);advance(s,8);assert.ok(s.posted.at(-1).actors.some(a=>a.captionVisible));s.command('clear');
});
test('T2 switch-off cancels both in-flight and visible replies without turning off recognition',async()=>{
 const s=await fixture();say(s,1,'校园里的小猫真有趣。');s.tick();s.command('script-improv',{enabled:false});await s.answer([{actor:0,text:'这条迟到回复不该出现。'}]);advance(s,20);assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));
 s.command('script-improv',{enabled:true});say(s,2,'再说一个校园故事。');s.tick();await s.answer([{actor:1,text:'我们一起来听听。'}]);advance(s,10);assert.ok(s.posted.at(-1).actors.some(a=>a.captionVisible));s.command('script-improv',{enabled:false});s.tick();assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));assert.equal(s.posted.at(-1).follow.active,true);s.command('clear');
});
test('T2 expired results and old typed responses never reach the screen',async()=>{
 const s=await fixture();say(s,1,'先说一个校园故事。');s.tick();advance(s,90);await s.answer([{actor:3,text:'过时的话不应该播出。'}]);advance(s,20);assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));
 s.command('voice-state',{active:false,session:'live'});s.elements.get('test-text').value='老故事已经过去。';s.tick();const old=s.calls.at(-1);s.elements.get('test-text').value='现在讲新的故事。';s.tick();old.resolve(new Response(JSON.stringify({messages:[{actor:3,text:'旧故事过时的回应。'}]})));await new Promise(r=>setImmediate(r));await s.answer([{actor:4,text:'这是新故事的回应。'}]);const seen=new Set();for(let i=0;i<80;i++){s.tick();s.posted.at(-1).actors.filter(a=>a.captionVisible).forEach(a=>seen.add(a.text));}assert.deepEqual([...seen],['这是新故事的回应。']);s.command('clear');
});
test('T2 keeps only the latest voice sentence and drops disabled or aged backlog',async()=>{
 const s=await fixture();say(s,1,'校园小猫坐在窗边。它也想报名听课。');s.tick();assert.equal(s.calls[0].body.text,'它也想报名听课。');await s.answer([{actor:2,text:'给它留个旁听的位置。'}]);advance(s,180);assert.equal(s.calls.length,1);
 s.command('script-improv',{enabled:false});say(s,2,'关掉时积压的稿外内容。');s.command('script-improv',{enabled:true});s.tick();assert.equal(s.calls.length,1);s.command('play');say(s,3,'暂停期间积压的内容。');s.tick(8100);s.command('play');s.tick();assert.equal(s.calls.length,1);s.command('clear');
});
test('T2 motion-only mode uses no model and next speech clears its brief action',async()=>{
 const s=await fixture();s.command('improv-style',{value:'motion'});say(s,1,'校园小猫真有趣。');advance(s,24);assert.equal(s.calls.length,0);assert.ok(s.posted.at(-1).actors.some(a=>a.phase!=='idle'));for(const b of s.elements.get('bubbles').children)assert.equal(b.classList.contains('visible'),false);say(s,2,'接下来我们继续讨论',false);s.tick();assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));s.command('clear');
});
