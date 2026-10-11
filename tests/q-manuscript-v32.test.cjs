const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Plan=require('../cue-plan.js'),Script=require('../speech-script.js'),Scenes=require('../scene-script.js'),C=require('../scene-catalog.js'),{CueTracker}=require('../cue-tracker.js'),{stage}=require('./helpers/stage-fixture.cjs');
const script=Script.create(require('./fixtures/q-pending-v32.json')),source=require('../integration/manuscript-20260925/q-script.draft.json'),catalog=require('./fixtures/legacy-scenes-v32.json').catalog;
const rows=script.blocks.flatMap(b=>b.sentences),keys=script.blocks.flatMap((b,bi)=>b.sentences.map(s=>`${bi}:${s.id}`)),strip=s=>s.replace(/\s/g,'');
test('latest Q script preserves source rows and full character turns, with 113 keyed units and 23 complete sequence targets',()=>{
 assert.equal(strip(script.text),strip(source.rows.map(r=>r.columns[0]).join('')));
 assert.equal(script.blocks.length,24);assert.equal(rows.length,113);assert.equal(Plan.audit(script).groups,50);assert.equal(Plan.audit(script).replies,85);
 assert.ok(rows.every(s=>s.trigger&&s.text.includes(s.trigger)&&Plan.splitStops(s.text).length===1));
 for(const row of source.rows){const units=rows.filter(s=>s.sourceRow===row.sourceRow);assert.equal(strip(units.map(s=>s.text).join('')),strip(row.columns[0]));
  const replies=units.flatMap(s=>s.replies);if(row.replyTurns.some(t=>t.kind==='chorus')){assert.equal(replies.length,9);assert.ok(replies.every(r=>r.text===row.replyTurns[0].text));}
  else{assert.equal(replies.length,row.replyTurns.length);for(const [i,t] of row.replyTurns.entries()){assert.equal(replies[i].text,t.raw.trimStart().startsWith('（')&&t.text.endsWith('）')?t.text.slice(0,-1):t.text);}}
 }
 assert.deepEqual(rows.filter(s=>s.sourceRow===39).flatMap(s=>s.replies.map(r=>r.actor)),[1,8]);
 assert.equal(script.stageBinding.sourceSha256,source.source.sha256);assert.deepEqual(Scenes.bind(catalog,script).rows,[]);
 assert.ok(script.blocks.every(b=>!b.sceneId));assert.equal(Plan.audit(script,catalog).ok,true);
});
test('opening and final prelude are explicit exceptions; ordinary missing replies and invalid scene codes still fail closed',()=>{
 assert.equal(script.blocks[0].sentences.length,3);assert.ok(script.blocks[0].sentences.every(s=>Plan.silentReason(script,0,s)));
 for(const mutate of [s=>s.blocks[1].sentences[0].replies=[],s=>s.blocks[1].sentences[0].trigger='',s=>s.blocks[1].sequenceCode='S1-M1',s=>s.blocks[1].sceneId='sc-old-1',s=>{s.blocks[1].sentences[0].replies=[];s.blocks[1].sentences[0].silenceReason='opening';},s=>s.blocks[2].sequenceCode='A1']){
  const bad=structuredClone(script);mutate(bad);assert.throws(()=>Script.create(bad));
 }
 const same=Plan.replaceText(script,{title:script.title,text:script.blocks.map(b=>b.source).join('\n\n')});assert.deepEqual(same.blocks,script.blocks);
 assert.throws(()=>Plan.replaceText(script,{title:'changed',text:script.blocks.map(b=>b.source.replace('。','。新的一句。')).join('\n\n')}),/同行接话/);
});
for(const mode of ['full','keyword','keyword-typo'])test(`latest Q ${mode} replay reaches every sentence once without requiring sentence-ending recognition`,()=>{
 const tracker=new CueTracker(script),seen=[];for(const s of rows){let heard=mode==='full'?s.text:s.trigger;if(mode==='keyword-typo'&&heard.length>=8)heard=heard.slice(0,3)+'嗯'+heard.slice(4);seen.push(...tracker.feed(heard,true));}
 assert.deepEqual(seen.map(c=>c.key),keys);assert.equal(tracker.missing().length,0);
});
test('three opening utterances stay silent; A1 triggers Li on saved artwork; manual scenery remains independent',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('voice-state',{active:true,session:'q-opening'});
 let seq=0;for(const u of script.blocks[0].sentences){s.command('voice-transcript',{session:'q-opening',seq:++seq,text:u.trigger,final:true});s.tick(500);}
 assert.equal(s.posted.at(-1).cues.length,0);s.command('voice-transcript',{session:'q-opening',seq:++seq,text:script.blocks[1].sentences[0].trigger,final:true});
 for(let i=0;i<35;i++)s.tick(100);assert.equal(s.posted.at(-1).cues.length,1);assert.equal(s.posted.at(-1).scenery.progress.code,'A1');
 assert.equal(s.posted.at(-1).scenery.activeId,catalog.maps[1].scenes[0].id);assert.ok(s.posted.at(-1).actors.some(a=>a.id===1&&a.captionVisible));
 s.command('scene-take',{sceneId:catalog.maps[2].scenes[0].id,revision:0});s.tick(100);assert.equal(s.posted.at(-1).scenery.activeId,catalog.maps[2].scenes[0].id);assert.equal(s.posted.at(-1).scenery.progress.code,'A1');s.command('topic',{topic:10});s.tick(2000);assert.equal(s.posted.at(-1).scenery.activeId,catalog.maps[2].scenes[0].id);s.command('clear');
});
test('latest Q one-shot rescue crosses A1 to A2, replies offline and rejects delayed old recognition',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('topic',{topic:1});s.command('voice-state',{active:true,session:'before-rescue'});
 vm.runInContext("setPresentation(1,2,'speech')",s.context);s.command('hello');const before=s.posted.at(-1);
 s.command('force-sentence',{expectedIndex:1,expectedSentenceIndex:2,epoch:before.controlEpoch,scriptSignature:before.scriptSignature});
 for(let i=0;i<35;i++)s.tick(100);const after=s.posted.at(-1);
 assert.equal(after.presentation.index,2);assert.equal(after.presentation.sentenceIndex,0);assert.equal(after.scenery.progress.code,'A2');assert.equal(after.voiceReset.pending,true);
 assert.ok(after.actors.some(a=>a.captionVisible&&a.cueKey===`2:${script.blocks[2].sentences[0].id}`));
 s.command('voice-transcript',{session:'before-rescue',seq:999,text:script.blocks[3].source,final:true});s.command('hello');assert.equal(s.posted.at(-1).inputSeq,0);assert.equal(s.posted.at(-1).presentation.index,2);s.command('clear');
});
test('all latest Q keywords produce 50 played groups and 85 complete lines with the real cue and caption path',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('voice-state',{active:true,session:'q-all'});let seq=0;
 for(const u of rows){s.command('voice-transcript',{session:'q-all',seq:++seq,text:u.trigger,final:true});for(let i=0;i<50;i++)s.tick(1000);}
 for(let i=0;i<180;i++)s.tick(1000);const cues=s.posted.at(-1).cues;
 assert.equal(cues.length,50);assert.ok(cues.every(c=>c.state==='played'),JSON.stringify(cues.filter(c=>c.state!=='played')));assert.equal(cues.reduce((n,c)=>n+c.completed,0),85);assert.equal(s.posted.at(-1).scenery.progress.code,'T1');assert.equal(s.calls.length,0);s.command('clear');
});
test('220 cpm continuous rehearsal reaches the end and drains every authored reply without old scene binding',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('rehearsal-start');let ticks=0;
 while(ticks++<2400){s.tick(1000);const m=s.posted.at(-1);if(!m.rehearsal.active&&m.presentation.complete)break;}
 assert.ok(ticks<2400,'rehearsal stalled');for(let i=0;i<300;i++)s.tick(1000);
 const m=s.posted.at(-1);assert.equal(m.cues.length,50);assert.equal(m.cues.reduce((n,c)=>n+c.completed,0),85);assert.ok(m.cues.every(c=>c.state==='played'));s.command('clear');
});
test('director rail lists the latest sequence codes and selects speech blocks without editing the legacy catalog',async()=>{
 const {parseHTML}=require('linkedom'),{document}=parseHTML('<html><body><div class="layout"></div></body></html>'),sent=[];
 const scope={document,Date,crypto:globalThis.crypto,SceneCatalog:C,SceneScript:Scenes,CuePlan:Plan,Image:class{},setInterval(){},setTimeout(){},fetch:async()=>({ok:true,json:async()=>({revision:75,catalog})})};scope.globalThis=scope;
 vm.runInNewContext(fs.readFileSync(require.resolve('../scene-director.js'),'utf8'),scope);
 const ui=scope.setupSceneDirector({send:(...a)=>sent.push(a),getStatus:()=>({stageVersion:13,receivedAt:Date.now()}),getScript:()=>script,toast(e){throw Error(e);}});await new Promise(r=>setImmediate(r));
 assert.equal(document.querySelectorAll('[data-sequence-code]').length,24);assert.match(document.getElementById('scene-count').textContent,/23/);assert.equal(document.getElementById('scene-take').hidden,false);assert.equal(document.querySelectorAll('[data-scene-id]').length,14);
 document.querySelector('[data-sequence-code="H2"]').click();assert.equal(JSON.stringify(sent.at(-1)),JSON.stringify(['topic',{topic:script.blocks.findIndex(b=>b.sequenceCode==='H2')}]));
 ui.status({topic:10,scenery:{ready:true}});assert.match(document.getElementById('scene-live').textContent,/现有场次可手动切换/);
});

test('latest Q loads the original standby and greeting fades to original S1 with exact saved actor assets and positions',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.tick(100);
 assert.equal(s.posted.at(-1).scenery.activeId,catalog.standbySceneId);
 assert.equal(vm.runInContext('activeScenery.background',s.context),catalog.maps[0].scenes[0].background);
 s.command('voice-state',{active:true,session:'greeting-restored'});s.tick(100);assert.equal(s.posted.at(-1).scenery.activeId,catalog.standbySceneId);
 s.command('voice-transcript',{session:'greeting-restored',seq:1,text:'尊敬的',final:false});
 for(let i=0;i<25;i++)s.tick(100);
 assert.equal(s.posted.at(-1).scenery.activeId,catalog.maps[1].scenes[0].id);assert.equal(s.posted.at(-1).cues.length,0);
 const saved=C.normalize(catalog).maps[1].scenes[0];assert.equal(vm.runInContext('JSON.stringify(activeScenery)',s.context),JSON.stringify(saved));
 s.command('scene-take',{sceneId:catalog.maps[3].scenes[0].id,revision:0});s.command('topic',{topic:9});s.tick(2000);assert.equal(s.posted.at(-1).scenery.activeId,catalog.maps[3].scenes[0].id);
 s.command('scene-reload');await new Promise(r=>setImmediate(r));s.tick(100);assert.equal(s.posted.at(-1).scenery.activeId,catalog.maps[3].scenes[0].id);
 s.command('scene-reset');s.tick(100);assert.equal(s.posted.at(-1).scenery.activeId,catalog.standbySceneId);assert.equal(s.posted.at(-1).scenery.progress.code,'起始幕');s.command('clear');
});
