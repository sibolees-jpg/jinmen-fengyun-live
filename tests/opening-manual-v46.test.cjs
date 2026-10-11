const {test}=require('node:test'),assert=require('node:assert/strict');
const {stage}=require('./helpers/stage-fixture.cjs'),Opening=require('../opening-cast.js');
const {staticCastCatalog}=require('../scripts/static-cast-catalog.cjs');
const script=require('../show/script.json').script,catalog=staticCastCatalog(require('../show/scenes.json').catalog);
const tick=(f,ms=900)=>{for(let t=0;t<ms;t+=100)f.tick(100);};
const visible=f=>f.elements.get('actors').children.flatMap((a,id)=>a.hidden?[]:[id]);
async function setup(){const f=stage({sceneCatalog:catalog,width:1920,height:1080});f.command('speech-script',{script});await new Promise(r=>setImmediate(r));tick(f);return f;}
function next(f){const s=f.posted.at(-1);f.command('force-sentence',{epoch:s.controlEpoch,scriptSignature:s.scriptSignature,expectedIndex:s.presentation.index,expectedSentenceIndex:s.presentation.sentenceIndex});tick(f);}

test('manual rescue reaches the unified name card, reveals its eight actors and then enters A1',async()=>{
 const f=await setup();assert.deepEqual(visible(f),[]);
 for(let si=1;si<script.blocks[0].sentences.length;si++){
  next(f);assert.deepEqual(visible(f),si===4?[0,1,2,3,4,5,6,8]:[]);assert.equal(f.posted.at(-1).scenery.activeId,catalog.standbySceneId);
 }
 next(f);tick(f,2400);assert.equal(f.posted.at(-1).scenery.activeId,'sc-q925-a1');
 f.command('scene-reset');tick(f);assert.deepEqual(visible(f),[]);
});
test('previewing the unified list returns to S0 and progressively introduces its cast',async()=>{
 const f=await setup();f.command('scene-take',{sceneId:'sc-q925-a2',revision:0});tick(f);
 f.command('rehearsal-cue',{index:0,sentenceIndex:4});tick(f,2000);
 assert.equal(f.posted.at(-1).scenery.activeId,catalog.standbySceneId);assert.ok(visible(f).length<8);
 tick(f,20000);assert.equal(visible(f).length,8);f.command('clear');
});

test('whole S0 preview advances name by name instead of revealing all names or skipping the silent introduction',async()=>{
 const f=await setup();f.command('rehearsal-discuss',{index:0});const counts=new Set([0]);
 for(let t=0;t<180000;t+=100){f.tick(100);const n=visible(f).length;counts.add(n);assert.equal(f.posted.at(-1).scenery.activeId,catalog.standbySceneId);if(!f.posted.at(-1).rehearsal.active&&n===8)break;}
 assert.deepEqual([...counts],[0,1,2,3,4,5,6,7,8]);f.command('clear');
});

test('static S0 still reveals individual recognized names, split packets and duplicates without requiring earlier names',async()=>{
 const f=await setup();f.command('voice-state',{active:true,session:'opening-static'});let seq=0;
 const feed=(text,final)=>{f.command('voice-transcript',{session:'opening-static',seq:++seq,text,final});tick(f,700);};
 feed('严',true);assert.deepEqual(visible(f),[]);feed('复',true);assert.deepEqual(visible(f),[2]);
 feed('蔡元培',false);assert.deepEqual(visible(f),[2,4]);feed('蔡元培',true);assert.deepEqual(visible(f),[2,4]);
 for(const [name] of new Opening(script).names)feed(name,false);
 assert.deepEqual(visible(f),[0,1,2,3,4,5,6,8]);assert.equal(f.calls.length,0);
 feed('我们一起来说说',false);tick(f,2400);assert.equal(f.posted.at(-1).scenery.activeId,'sc-q925-a1');f.command('clear');
});
