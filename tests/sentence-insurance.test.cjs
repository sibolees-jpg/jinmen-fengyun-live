const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {stage}=require('./helpers/stage-fixture.cjs');
const Script=require('../speech-script.js');
const Scenes=require('../scene-catalog.js');
const script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.23-v21.json'));
const catalog=Scenes.normalize(require('../speeches/2026-120周年校庆/文档场次-9.23-v18.json'));
async function fixture(){
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('voice-state',{active:true,session:'sentence-insurance'});s.command('hello');return s;
}
function advance(s,status=s.posted.at(-1)){
 s.command('force-sentence',{expectedIndex:status.presentation.index,expectedSentenceIndex:status.presentation.sentenceIndex,epoch:status.controlEpoch,scriptSignature:status.scriptSignature});
 return s.posted.at(-1);
}
test('insurance advances one speech sentence at a time within the same shot and rejects a stale click',async()=>{
 const s=await fixture(),before=s.posted.at(-1),scene=before.scenery.activeId;
 let now=advance(s,before);assert.equal(now.presentation.index,0);assert.equal(now.presentation.sentenceIndex,1);assert.equal(now.scenery.activeId,scene);assert.ok(now.cues.some(c=>c.key===`0:${script.blocks[0].sentences[1].id}`));assert.equal(now.follow.active,true);
 advance(s,before);assert.equal(s.posted.at(-1).presentation.sentenceIndex,1);
 s.tick(900);now=advance(s);assert.equal(now.presentation.sentenceIndex,2);assert.equal(now.scenery.activeId,scene);
 assert.equal(now.trace.at(-1).type,'manual-sentence');s.command('clear');
});
test('manual next sentence retains only its own dialogue and changes scene only at the next scene-bound sentence',async()=>{
 const s=await fixture(),scene=s.posted.at(-1).scenery.activeId;
 vm.runInContext("setPresentation(0,1,'manual','next');queueCue(0,1)",s.context);s.command('hello');const queued=s.posted.at(-1).cues;assert.ok(queued.some(c=>c.key===`0:${script.blocks[0].sentences[1].id}`));
 s.tick(900);let current=advance(s);assert.equal(current.presentation.sentenceIndex,2);assert.equal(current.scenery.activeId,scene);assert.ok(current.cues.some(c=>c.key===queued[0].key));
 for(let i=3;i<=script.blocks[0].sentences.length;i++){s.tick(900);current=advance(s);assert.equal(current.presentation.index,i===script.blocks[0].sentences.length?1:0);assert.equal(current.presentation.sentenceIndex,i===script.blocks[0].sentences.length?0:i);if(i<script.blocks[0].sentences.length)assert.equal(current.scenery.activeId,scene);}
 s.tick(900);assert.equal(s.posted.at(-1).scenery.activeId,'sc-doc923-2');s.command('clear');
});
test('insurance cannot wrap beyond the final sentence',async()=>{
 const s=await fixture(),last=script.blocks.length-1,si=script.blocks[last].sentences.length-1;
 vm.runInContext(`setPresentation(${last},${si},'manual','next')`,s.context);s.command('hello');const before=s.posted.at(-1),after=advance(s,before);
 assert.equal(after.presentation.index,last);assert.equal(after.presentation.sentenceIndex,si);s.command('clear');
});
test('live recognition still triggers the next sentence reply after a manual step',async()=>{
 const s=await fixture();advance(s);const row=script.blocks[0].sentences[1];
 const rescued=s.posted.at(-1);s.command('voice-state',{active:true,session:'fresh-sentence',resetToken:rescued.voiceReset.token});
 s.command('voice-transcript',{session:'fresh-sentence',seq:1,epoch:rescued.controlEpoch,text:row.text,final:true,source:'doubao-api'});
 const cues=s.posted.at(-1).cues;assert.ok(cues.some(c=>c.key===`0:${row.id}`&&c.state!=='cancelled'));
 assert.equal(s.posted.at(-1).follow.active,true);s.command('clear');
});
