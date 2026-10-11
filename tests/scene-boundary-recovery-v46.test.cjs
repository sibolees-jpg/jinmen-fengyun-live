const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {stage}=require('./helpers/stage-fixture.cjs'),{mergeOpeningNames}=require('../scripts/merge-opening-names.cjs');
const {AudienceSubtitles}=require('../speech-sentences.js');
const original=require('../show/script.json').script,script=mergeOpeningNames(original);
const catalog=require('../scripts/static-cast-catalog.cjs').staticCastCatalog(require('../show/scenes.json').catalog);
const tick=(f,ms=1000)=>{for(let t=0;t<ms;t+=100)f.tick(100);};
const snap=f=>f.posted.at(-1),run=(f,code)=>vm.runInContext(code,f.context);
async function setup(){const f=stage({sceneCatalog:catalog,width:1280,height:720,frontendTrial:true});f.command('speech-script',{script});await new Promise(r=>setImmediate(r));tick(f);return f;}
function voice(f,name='fresh'){f.command('voice-state',{active:true,session:name,resetToken:snap(f).voiceReset?.token});let seq=0;return (text,final=false)=>{f.command('voice-transcript',{session:name,seq:++seq,epoch:snap(f).controlEpoch,text,final});tick(f,400);};}
function next(f){const s=snap(f);f.command('force-sentence',{epoch:s.controlEpoch,scriptSignature:s.scriptSignature,expectedIndex:s.presentation.index,expectedSentenceIndex:s.presentation.sentenceIndex});tick(f);}
const visible=f=>run(f,'bubbleNodes.filter(b=>b.classList.contains("visible")||b.fadeUntil>engine.time).map(b=>({text:b.displayMessage?.text,section:b.displayMessage?.section,manual:b.overlayConfig?.manual,left:b.style.left,top:b.style.top}))');

test('name merge preserves manuscript, punctuation, all dialogue and all non-opening sentence IDs',()=>{
 assert.equal(script.text,original.text);assert.deepEqual(script.blocks.map(b=>b.source),original.blocks.map(b=>b.source));assert.deepEqual(script.blocks.slice(1),original.blocks.slice(1));
 assert.equal(script.blocks[0].sentences.length,5);assert.equal(script.blocks[0].sentences.at(-1).text,original.blocks[0].source.slice(original.blocks[0].source.indexOf('\n他们是')));
 assert.deepEqual(mergeOpeningNames(script),script);const s=new AudienceSubtitles(script),pages=s.rows.get('0:4');assert.equal(pages.length,1);assert.equal(pages[0].text,script.blocks[0].sentences[4].text.trim());
});
test('all eight short name packets share one authored subtitle and reveal only names actually heard',async()=>{
 const f=await setup(),say=voice(f),expected=[],names=run(f,'openingCast.names'),caption=script.blocks[0].sentences[4].text.trim();
 for(const [name,id]of names){say(name,true);expected.push(id);tick(f,700);assert.deepEqual(Array.from(snap(f).openingCast.introduced),expected);assert.equal(f.elements.get('live-caption').textContent,caption);assert.equal(snap(f).presentation.index,0);assert.equal(snap(f).presentation.sentenceIndex,4);assert.equal(visible(f).length,0);}
 say('我们一起来说说',false);tick(f,2300);assert.equal(snap(f).scenery.activeId,'sc-q925-a1');assert.equal(visible(f).length,0);
 say('百廿老人，何来少年心气？',true);tick(f,1600);assert.ok(snap(f).cueEvents.some(e=>e.type==='cue-visible'&&e.key===`1:${script.blocks[1].sentences[1].id}`));f.command('clear');
});
test('continuous interim name list does not reveal unread names or require final punctuation',async()=>{
 const f=await setup(),say=voice(f);let heard='他们是';const names=run(f,'openingCast.names');
 for(const [name,id]of names){heard+=name; say(heard,false);assert.ok(snap(f).openingCast.introduced.includes(id));assert.equal(snap(f).openingCast.introduced.length,names.findIndex(v=>v[1]===id)+1);}
 say(heard+'我们一起来说说天津美院办学120年矣',false);tick(f,2400);assert.equal(snap(f).scenery.activeId,'sc-q925-a1');f.command('clear');
});
test('rescue on the shared name subtitle reaches A1 offline immediately, rejects old audio and resumes the question',async()=>{
 const f=await setup(),old=voice(f,'old');old('他们是李鸿章',true);assert.equal(snap(f).presentation.sentenceIndex,4);next(f);tick(f,2300);
 assert.equal(snap(f).presentation.index,1);assert.equal(snap(f).scenery.activeId,'sc-q925-a1');assert.equal(snap(f).recognitionScope.sceneId,'sc-q925-a1');assert.equal(snap(f).voiceReset.pending,true);
 old('他们是李鸿章梁启超严复蔡元培',true);assert.equal(snap(f).scenery.activeId,'sc-q925-a1');const say=voice(f,'new');say('百廿老人何来少年心气',true);tick(f,1300);assert.ok(visible(f).length);f.command('clear');
});
test('manual scene take abandons held cards, queued/deferred scenes and old input as one operation',async()=>{
 const f=await setup();f.command('scene-take',{sceneId:'sc-q925-a1',revision:0});const say=voice(f,'old-a1');say('百廿老人何来少年心气',true);tick(f,1400);assert.ok(visible(f).length);
 run(f,'deferredReplyScene=shotFollower.rows[1];queueCue(2,0)');f.command('scene-take',{sceneId:'sc-q925-b1',revision:0});tick(f);
 assert.equal(snap(f).scenery.activeId,'sc-q925-b1');assert.equal(snap(f).recognitionScope.sceneId,'sc-q925-b1');assert.equal(snap(f).presentation.index,3);assert.equal(visible(f).length,0);assert.equal(snap(f).replyFlow.pendingLines,0);assert.equal(run(f,'deferredReplyScene'),null);
 say(script.blocks[1].source,true);tick(f,2400);assert.equal(snap(f).scenery.activeId,'sc-q925-b1');assert.equal(visible(f).length,0);
 const fresh=voice(f,'new-b1');fresh(script.blocks[3].sentences[0].text,true);tick(f,1500);assert.ok(snap(f).cues.some(c=>c.key.startsWith('3:')&&['playing','played','queued'].includes(c.state)));f.command('clear');
});
test('old continuation cards cannot inherit another scene defaults on automatic cut or fade',async()=>{
 const f=await setup();f.command('scene-take',{sceneId:'sc-q925-a1',revision:0});const say=voice(f);say('百廿老人何来少年心气',true);tick(f,1500);assert.ok(visible(f).length);
 // Reproduce the original transition where held cards survive after speakers return to idle.
 run(f,'for(const a of engine.actors)if(a.message){dialogueDisplay.finished(a.message,engine.time);a.phase="idle";a.message=null;}engine.queue=[];for(const c of dialogueDisplay.cards.values())c.closeAt=Infinity;cutShot(shotFollower.rows[1],true)');tick(f,100);
 assert.equal(snap(f).scenery.activeId,'sc-q925-a2');assert.equal(visible(f).length,0);tick(f,600);assert.equal(visible(f).length,0);f.command('clear');
});
test('returning manually to S0 resets recognition and permits names and the A1 phrase again',async()=>{
 const f=await setup();f.command('scene-take',{sceneId:'sc-q925-b1',revision:0});voice(f);f.command('scene-take',{sceneId:catalog.standbySceneId,revision:0});tick(f);assert.equal(snap(f).presentation.index,0);assert.equal(snap(f).recognitionScope,null);assert.equal(snap(f).scenery.shot.index,-1);
 const say=voice(f,'returned');say('严',true);say('复',true);assert.deepEqual(Array.from(snap(f).openingCast.introduced),[2]);say('我们一起来',true);say('说说',true);tick(f,2300);assert.equal(snap(f).scenery.activeId,'sc-q925-a1');f.command('clear');
});
