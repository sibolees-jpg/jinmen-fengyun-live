const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const Script=require('../speech-script.js'),Plan=require('../cue-plan.js'),C=require('../scene-catalog.js'),Scenes=require('../scene-script.js'),{stage}=require('./helpers/stage-fixture.cjs');
const script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json')),catalog=require('../show/scenes.json').catalog,manifest=require('../integration/manuscript-20260925/visuals/scene-manifest.json'),source=require('../integration/manuscript-20260925/q-script.draft.json'),pending=require('./fixtures/q-pending-v32.json');
const advance=(s,seconds)=>{for(let i=0;i<seconds*10;i++)s.tick(100);};
test('23 new 4K backgrounds preserve speech verbatim, inherited Word image coverage, all speakers and scene-local edits',()=>{
 assert.equal(script.stageBinding.status,'bound');assert.equal(catalog.maps.length,21);assert.equal(Scenes.bind(catalog,script).rows.length,23);assert.equal(Plan.audit(script,catalog).ok,true);
 assert.equal(script.text,pending.text);for(const [i,b] of script.blocks.entries())assert.deepEqual(b.sentences,Script.create(pending).blocks[i].sentences);
 for(const item of manifest.sequences){const scene=C.locate(catalog,item.sceneId).scene,bytes=fs.readFileSync(require.resolve('../show/scene-assets/'+item.background.split('/').pop()));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.background.split('/').pop().slice(0,64));assert.equal(bytes.readUInt32BE(16),3840);assert.equal(bytes.readUInt32BE(20),2160);assert.equal(scene.backgroundAspect,16/9);
  const inherited=source.rows.filter(r=>r.effectiveSequence===item.sequenceCode);assert.deepEqual(item.sourceRows,inherited.map(r=>r.sourceRow));assert.ok(inherited[0].referenceImages.length);assert.ok(inherited.slice(1).every(r=>!r.referenceImages.length));assert.ok(scene.actors.filter(a=>a.present).every(a=>a.poses.idle));assert.ok(!C.locate(catalog,item.sceneId).map.sharedAssets);
 }
 const modified=structuredClone(catalog);modified.maps[1].scenes[0].actors[0].x=5;assert.notEqual(modified.maps[1].scenes[1].actors[0].x,5);
 const bad=structuredClone(script);bad.blocks[1].sceneId='sc-missing';assert.equal(Plan.audit(bad,catalog).ok,false);
 const missing=structuredClone(catalog);C.locate(missing,script.blocks[1].sceneId).scene.actors[1].present=false;assert.match(Plan.audit(script,missing).errors.join(' '),/接话人物未在配置中出场/);
});
test('greeting fades to A1, scene boundaries trigger at the next fixed keyword and never at the previous sentence end',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('voice-state',{active:true,session:'bound'});advance(s,.1);
 assert.equal(s.posted.at(-1).scenery.activeId,catalog.standbySceneId);
 s.command('voice-transcript',{session:'bound',seq:1,text:'尊敬的',final:false});advance(s,2);assert.equal(s.posted.at(-1).scenery.activeId,script.blocks[1].sceneId);assert.equal(s.posted.at(-1).cues.length,0);
 vm.runInContext('followBoundScene({matched:true,cueAligned:true,confidence:100,index:1,sentenceIndex:speechScript.blocks[1].sentences.length-1},true)',s.context);advance(s,.1);assert.equal(s.posted.at(-1).scenery.activeId,script.blocks[1].sceneId);
 s.command('voice-transcript',{session:'bound',seq:2,text:script.blocks[2].visualTrigger,final:false});advance(s,.1);assert.equal(s.posted.at(-1).scenery.activeId,script.blocks[2].sceneId);s.command('clear');
});
test('bound manual block selection and one-shot sentence rescue select the corresponding complete configuration',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('topic',{topic:10});advance(s,.1);assert.equal(s.posted.at(-1).scenery.activeId,script.blocks[10].sceneId);
 s.command('topic',{topic:1});advance(s,2);s.command('voice-state',{active:true,session:'old'});vm.runInContext("setPresentation(1,2,'speech')",s.context);s.command('hello');const m=s.posted.at(-1);
 s.command('force-sentence',{expectedIndex:1,expectedSentenceIndex:2,epoch:m.controlEpoch,scriptSignature:m.scriptSignature});advance(s,3);const after=s.posted.at(-1);assert.equal(after.presentation.index,2);assert.equal(after.scenery.activeId,script.blocks[2].sceneId);assert.equal(after.voiceReset.pending,true);assert.ok(after.actors.some(a=>a.captionVisible));s.command('clear');
});
test('continuous 220 cpm rehearsal visits all 23 configurations and completes all 50 groups / 85 lines',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('rehearsal-start');let ticks=0;const visited=new Set();
 while(ticks++<3000){s.tick(1000);const m=s.posted.at(-1);visited.add(m.scenery.activeId);if(!m.rehearsal.active&&m.presentation.complete&&!m.replyFlow.pendingLines)break;}
 for(let i=0;i<350;i++){s.tick(1000);visited.add(s.posted.at(-1).scenery.activeId);}const m=s.posted.at(-1);
 assert.ok(ticks<3000,'rehearsal stalled');assert.equal(m.cues.length,50);assert.equal(m.cues.reduce((n,c)=>n+c.completed,0),85,JSON.stringify(m.cues.filter(c=>c.state!=='played')));assert.ok(m.cues.every(c=>c.state==='played'));for(const item of manifest.sequences)assert.ok(visited.has(item.sceneId),item.sequenceCode+' not shown');s.command('clear');
});

test('fresh recognition after one-shot rescue can enter the next sequence by its first reply keyword without replaying stale audio',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('topic',{topic:1});advance(s,2);s.command('voice-state',{active:true,session:'before'});vm.runInContext("setPresentation(1,2,'speech')",s.context);s.command('hello');const before=s.posted.at(-1);
 s.command('force-sentence',{expectedIndex:1,expectedSentenceIndex:2,epoch:before.controlEpoch,scriptSignature:before.scriptSignature});advance(s,1);const rescue=s.posted.at(-1);s.command('voice-state',{active:true,session:'after',resetToken:rescue.voiceReset.token});let seq=0;
 for(const sentence of script.blocks[2].sentences){s.command('voice-transcript',{session:'after',seq:++seq,text:sentence.trigger,final:true});advance(s,35);}
 s.command('voice-transcript',{session:'after',seq:++seq,text:script.blocks[3].sentences[0].trigger,final:true});advance(s,50);
 assert.equal(s.posted.at(-1).scenery.activeId,script.blocks[3].sceneId);assert.equal(s.posted.at(-1).follow.index,3);assert.ok(s.posted.at(-1).cues.some(c=>c.key==='3:'+script.blocks[3].sentences[0].id&&c.state==='played'));s.command('clear');
});
