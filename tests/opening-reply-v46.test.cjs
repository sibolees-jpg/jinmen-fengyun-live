const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const Script=require('../speech-script.js'),CuePlan=require('../cue-plan.js'),{CueTracker}=require('../cue-tracker.js');
const {stage}=require('./helpers/stage-fixture.cjs'),{relocateOpeningReply}=require('../scripts/relocate-opening-reply.cjs');
const script=require('../show/script.json').script,catalog=require('../scripts/static-cast-catalog.cjs').staticCastCatalog(require('../show/scenes.json').catalog);
const question=script.blocks[1].sentences[1],key=`1:${question.id}`;
const tick=(f,ms)=>{for(let t=0;t<ms;t+=100)f.tick(100);};
async function fixture(){const f=stage({sceneCatalog:catalog,width:1920,height:1080});f.command('speech-script',{script});await new Promise(r=>setImmediate(r));tick(f,800);return f;}
function voice(f){f.command('voice-state',{active:true,session:'opening-reply'});let seq=0;return (text,final=true)=>{f.command('voice-transcript',{session:'opening-reply',seq:++seq,text,final});tick(f,500);};}

test('S0 has no replies and A1 keeps both authored replies after the complete question',()=>{
 assert.ok(script.blocks[0].sentences.every(s=>s.mode==='silent'&&s.replies.length===0&&!s.dialogueLead));
 assert.equal(script.blocks[1].sentences[0].silenceReason,'opening-transition');assert.equal(question.trigger,'少年心气');assert.equal(question.cuePolicy,'after-phrase');
 assert.deepEqual(question.replies.map(r=>r.actor),[1,0]);assert.deepEqual(question.replies.map(r=>r.replyTo),[null,0]);assert.ok(question.replies[0].text.includes('丈夫只手把吴钩'));
 assert.equal(CuePlan.audit(script,catalog).ok,true);assert.equal(CuePlan.audit(script).replies,103);
 const broken=structuredClone(script);broken.blocks[0].sentences.at(-1).replies=[question.replies[0]];broken.blocks[0].sentences.at(-1).mode='reply';assert.throws(()=>Script.create(broken),/暖场/);
});
test('moving dialogue preserves all speech and reply text and migrates only the matching bubble styles',()=>{
 const old=structuredClone(script),intro=old.blocks[0].sentences.at(-1),first=old.blocks[1].sentences[0],q=old.blocks[1].sentences[1];
 intro.mode='reply';intro.replies=[q.replies[0]];delete intro.silenceReason;
 first.mode='reply';first.replies=[{...q.replies[1],replyTo:null}];delete first.silenceReason;
 q.mode='silent';q.replies=[];q.dialogueLead=first.id;delete q.cuePolicy;
 const c=structuredClone(catalog),a1=c.maps.flatMap(m=>m.scenes).find(s=>s.id===old.blocks[1].sceneId),lhz=a1.actors[1],lq=a1.actors[0];
 lhz.bubbleCues={[intro.id]:{...lhz.bubble,x:77,scale:1.3}};lq.bubbleCues={[first.id]:{...lq.bubble,x:19,scale:1.1}};
 const result=relocateOpeningReply(old,c),migrated=result.catalog.maps.flatMap(m=>m.scenes).find(s=>s.id===a1.id);
 assert.equal(result.script.text,old.text);assert.deepEqual(result.script.blocks.map(b=>b.source),old.blocks.map(b=>b.source));
 const lines=s=>s.blocks.flatMap(b=>b.sentences.flatMap(x=>x.replies.map(r=>[r.actor,r.text])));assert.deepEqual(lines(result.script),lines(old));
 assert.deepEqual(migrated.actors[1].bubbleCues[q.id],lhz.bubbleCues[intro.id]);assert.deepEqual(migrated.actors[0].bubbleCues[q.id],lq.bubbleCues[first.id]);
 for(let i=0;i<c.maps.length;i++)for(let j=0;j<c.maps[i].scenes.length;j++){const before=c.maps[i].scenes[j],after=result.catalog.maps[i].scenes[j];assert.equal(after.background,before.background);assert.deepEqual(after.actors.map(({bubbleCues,...a})=>a),before.actors.map(({bubbleCues,...a})=>a));}
 assert.deepEqual(relocateOpeningReply(result.script,result.catalog),result);
});
test('all prefixes before 气 stay silent even on final packets; full phrase fires once',()=>{
 for(let end=1;end<question.text.indexOf('气')+1;end++){
  const t=new CueTracker(script);t.reset(1,1);assert.equal(t.feed(question.text.slice(0,end),true).some(c=>c.key===key),false,question.text.slice(0,end));
 }
 let now=0;const t=new CueTracker(script,{now:()=>now});t.reset(1,1);assert.equal(t.feed('少年心',true).length,0);assert.equal(t.feed('气',false).length,0);now=300;
 assert.equal(t.take().filter(c=>c.key===key).length,1);assert.equal(t.feed('气',true).filter(c=>c.key===key).length,0);
 const skipped=new CueTracker(script);skipped.reset(1,1);skipped.feed('百廿老人何来少年心',true);assert.equal(skipped.feed(script.blocks[2].sentences[0].text,true).some(c=>c.key===key),false);
});
test('real voice introduction shows all eight people without bubbles, then A1 replies only after 少年心气',async()=>{
 const f=await fixture(),say=voice(f);for(const line of script.blocks[0].sentences)say(line.text);
 tick(f,3000);let s=f.posted.at(-1);assert.equal(s.scenery.activeId,catalog.standbySceneId);assert.equal(s.openingCast.introduced.length,8);assert.equal(s.cues.length,0);assert.ok(s.actors.every(a=>!a.captionVisible));
 say(script.blocks[1].sentences[0].text);tick(f,1800);assert.equal(f.posted.at(-1).scenery.activeId,'sc-q925-a1');assert.equal(f.posted.at(-1).cues.length,0);
 say('百廿老人何来少年心',false);assert.equal(f.posted.at(-1).cues.length,0);say('百廿老人何来少年心气',false);tick(f,2500);
 s=f.posted.at(-1);assert.deepEqual(Array.from(s.cues,c=>c.key),[key]);assert.equal(s.cues[0].total,2);assert.ok(s.actors.some(a=>a.id===1&&a.captionVisible));
 const starts=s.trace.filter(e=>e.type==='cue-start');assert.equal(starts[0].line,0);assert.equal(f.calls.length,0);f.command('clear');
});
test('manual rescue crosses all S0 names and the A1 transition without a bubble, then starts the question group',async()=>{
 const f=await fixture();for(let i=0;i<script.blocks[0].sentences.length+1;i++){
  const s=f.posted.at(-1);f.command('force-sentence',{epoch:s.controlEpoch,scriptSignature:s.scriptSignature,expectedIndex:s.presentation.index,expectedSentenceIndex:s.presentation.sentenceIndex});tick(f,1000);
  if(i<script.blocks[0].sentences.length)assert.equal(f.posted.at(-1).cues.length,0);
 }
 assert.deepEqual(Array.from(f.posted.at(-1).cues,c=>c.key),[key]);f.command('clear');
});
test('warmup rendering hides even a stray manual dialogue, without hiding the revealed people',async()=>{
 const f=await fixture(),say=voice(f);say('李鸿章');
 f.command('say',{actor:1,text:'意外的现场提示'});tick(f,2500);
 assert.equal(f.elements.get('actors').children[1].hidden,false);
 assert.equal(vm.runInContext('bubbleNodes.some(b=>b.classList.contains("visible")||b.fadeUntil>engine.time)',f.context),false);f.command('clear');
});
