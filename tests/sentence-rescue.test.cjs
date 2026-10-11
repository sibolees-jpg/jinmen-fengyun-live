const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {stage}=require('./helpers/stage-fixture.cjs');
// These cases exercise the legacy S/M scene-bound rescue path independently of the current show export.
const script=require('../speeches/2026-120周年校庆/津门风云-9.24-v28.json');
const {catalog}=require('./fixtures/legacy-scenes-v32.json');
async function fixture(index=2,si=0,{active=true}={}){
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.tick(1);
 s.command('scene-take',{sceneId:script.blocks[index].sceneId,revision:0});
 if(active)s.command('voice-state',{active:true,session:'old-speech'});
 vm.runInContext(`setPresentation(${index},${si},'speech')`,s.context);s.command('hello');return s;
}
function next(s,m=s.posted.at(-1)){
 s.command('force-sentence',{expectedIndex:m.presentation.index,expectedSentenceIndex:m.presentation.sentenceIndex,epoch:m.controlEpoch,scriptSignature:m.scriptSignature});
 return s.posted.at(-1);
}
function group(index,si){const sentence=script.blocks[index].sentences[si];return `${index}:${sentence.dialogueLead||sentence.id}`;}
test('sentence rescue abandons the old recognition session and starts the next sentence dialogue locally',async()=>{
 const s=await fixture(),before=s.posted.at(-1),after=next(s);
 assert.equal(after.presentation.sentenceIndex,1);assert.equal(after.controlEpoch,before.controlEpoch+1);
 assert.equal(after.voiceReset.kind,'sentence');assert.equal(after.voiceReset.pending,true);
 assert.equal(after.inputSession,'');assert.equal(after.inputSeq,0);assert.equal(after.speechRawCaption,'');
 assert.ok(after.cues.some(c=>c.key===group(2,1)&&['queued','playing'].includes(c.state)),'continuation must resolve its lead even though the lead precedes the new recognition floor');
 assert.equal(after.scenery.activeId,before.scenery.activeId);s.command('clear');
});
test('late old transcripts and old session announcements cannot refill a rescued queue',async()=>{
 const s=await fixture(),after=next(s),key=group(2,1);
 s.command('voice-state',{active:true,session:'old-speech',resetToken:after.voiceReset.token});
 s.command('voice-transcript',{session:'old-speech',seq:9999,epoch:after.controlEpoch,text:script.blocks[2].sentences.map(s=>s.text).join(''),final:true});
 s.command('hello');assert.equal(s.posted.at(-1).inputSeq,0);assert.ok(s.posted.at(-1).cues.filter(c=>['queued','playing'].includes(c.state)).every(c=>c.key===key));
 s.command('voice-state',{active:true,session:'fresh-speech',resetToken:after.voiceReset.token});
 s.command('voice-transcript',{session:'fresh-speech',seq:1,epoch:after.controlEpoch,text:script.blocks[2].sentences[2].text,final:true});
 s.command('hello');assert.equal(s.posted.at(-1).inputSession,'fresh-speech');assert.equal(s.posted.at(-1).voiceReset.pending,false);assert.equal(s.posted.at(-1).follow.sentenceIndex,2);s.command('clear');
});
test('rescue removes unrelated old and future reply backlog and preserves an already visible continuation group',async()=>{
 const s=await fixture();vm.runInContext('queueCue(2,0);advanceManualCues()',s.context);
 for(let i=0;i<40;i++)s.tick(100);
 const visible=vm.runInContext('dialogueDisplay.cards.get(0)',s.context);assert.ok(visible&&visible.visibleAt!==null);
 vm.runInContext('queueCue(2,2);queueCue(2,4)',s.context);s.command('hello');
 const key=group(2,1),after=next(s);
 assert.equal(vm.runInContext('dialogueDisplay.cards.get(0)',s.context),visible,'same dialogue keeps its existing card and reading time');
 assert.ok(after.cues.filter(c=>['queued','playing'].includes(c.state)).every(c=>c.key===key));
 assert.ok(after.cues.some(c=>c.key===group(2,2)&&c.state==='cancelled'));
 assert.ok(vm.runInContext('engine.queue.every(m=>m.cueKey==="'+key+'")&&manualCues.every(m=>m.key==="'+key+'")',s.context));
 assert.equal(after.trace.filter(e=>e.type==='cue-queued'&&e.key===key).length,1,'continuation is not replayed');s.command('clear');
});
test('offline rescue remains usable, advances exactly once and never wraps at the end',async()=>{
 const s=await fixture(2,0,{active:false}),before=s.posted.at(-1),after=next(s);
 assert.equal(after.voiceReset.pending,false);assert.equal(after.follow.active,false);assert.ok(after.cues.some(c=>c.key===group(2,1)));
 next(s,before);assert.equal(s.posted.at(-1).presentation.sentenceIndex,1);assert.equal(s.posted.at(-1).controlEpoch,after.controlEpoch);
 s.tick(1000);next(s);assert.equal(s.posted.at(-1).presentation.sentenceIndex,2);
 const index=script.blocks.length-1,si=script.blocks[index].sentences.length-1;
 vm.runInContext(`setPresentation(${index},${si},'manual')`,s.context);s.command('hello');s.tick(1000);const end=s.posted.at(-1);next(s);assert.equal(s.posted.at(-1).controlEpoch,end.controlEpoch);s.command('clear');
});
test('the target dialogue becomes visible while API reconnection is still pending',async()=>{
 const s=await fixture(),key=group(2,1);next(s);
 for(let i=0;i<12;i++)s.tick(100);
 const m=s.posted.at(-1);assert.equal(m.voiceReset.pending,true);assert.ok(m.cueEvents.some(e=>e.type==='cue-visible'&&e.key===key));
 assert.ok(m.actors.some(a=>a.cueKey===key&&a.captionVisible));s.command('clear');
});
test('cancelled future backlog can be triggered again from genuinely new recognition',async()=>{
 const s=await fixture(),key=group(2,2);vm.runInContext('queueCue(2,2)',s.context);s.command('hello');const rescued=next(s);
 assert.equal(rescued.cues.find(c=>c.key===key).state,'cancelled');
 s.command('voice-state',{active:true,session:'new-live',resetToken:rescued.voiceReset.token});
 s.command('voice-transcript',{session:'new-live',seq:1,epoch:rescued.controlEpoch,text:script.blocks[2].sentences[2].text,final:true});s.tick(100);
 assert.ok(s.posted.at(-1).cues.some(c=>c.key===key&&['queued','playing','played'].includes(c.state)));s.command('clear');
});
test('rescue into a continuation of a completed dialogue never replays that dialogue',async()=>{
 const s=await fixture(),key=group(2,1);
 vm.runInContext(`cueLedger.records.set(${JSON.stringify(key)},{key:${JSON.stringify(key)},state:'played',count:2,started:[0,1],finished:[0,1]})`,s.context);
 s.command('hello');const m=next(s);assert.equal(m.cues.find(c=>c.key===key).state,'played');assert.equal(m.replyFlow.pendingLines,0);s.command('clear');
});
test('rescue across a scene boundary does not wait for the abandoned scene dialogue',async()=>{
 const last=script.blocks[2].sentences.length-1,s=await fixture(2,last);
 vm.runInContext('queueCue(2,0);advanceManualCues()',s.context);s.tick(300);const m=next(s);
 assert.equal(m.presentation.index,3);assert.equal(m.presentation.sentenceIndex,0);assert.equal(m.scenery.activeId,script.blocks[3].sceneId);
 assert.ok(m.cues.filter(c=>['queued','playing'].includes(c.state)).every(c=>c.key.startsWith('3:')));s.command('clear');
});
test('a continuation card stays visible even after its actor has finished and returned to idle',async()=>{
 const s=await fixture();vm.runInContext('queueCue(2,0);advanceManualCues()',s.context);
 for(let i=0;i<400;i++)s.tick(100);
 assert.equal(vm.runInContext('engine.actors[0].phase',s.context),'idle');
 const bubble=vm.runInContext('bubbleNodes[0]',s.context);assert.equal(bubble.classList.contains('visible'),true);const text=bubble.querySelector('.bubble-text').textContent;
 next(s);assert.equal(bubble.classList.contains('visible'),true);assert.equal(bubble.querySelector('.bubble-text').textContent,text);s.command('clear');
});
test('an explicit manual rescue can start a target group previously skipped without showing any line',async()=>{
 const s=await fixture(),key=group(2,1);
 vm.runInContext(`cueLedger.records.set(${JSON.stringify(key)},{key:${JSON.stringify(key)},state:'skipped',count:2,started:[],finished:[]})`,s.context);s.command('hello');
 const m=next(s);assert.ok(m.cues.some(c=>c.key===key&&['queued','playing'].includes(c.state)));s.command('clear');
});
