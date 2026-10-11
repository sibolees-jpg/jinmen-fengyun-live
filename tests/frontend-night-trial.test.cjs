const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../integration/colleague-bubbles/adapter.js'),Type=require('../integration/colleague-bubbles/typography.js'),D=require('../dialogue-overlay.js'),C=require('../scene-catalog.js');
const catalog=require('../show/scenes.json').catalog,script=require('../show/script.json').script;
test('night frontend keeps the unchanged transport and scheduling modules after the 9.25 manuscript refresh',()=>{
 assert.equal(require('../integration/scene-block/provenance.json').sourceRevision,'6b029d24c321df2fa91bf40a4aaf0d528f3ea440');
 assert.equal(script.blocks.flatMap(b=>b.sentences).length,127);assert.equal(script.blocks.flatMap(b=>b.sentences).flatMap(s=>s.replies).length,103);
 for(const filename of ['backend/doubao-speech.mjs','cue-ledger.js','speech-capture.js','script-follow.js','engine.js','round-pipeline.js']){
  const baseline=require('child_process').execFileSync('git',['show','95fb9d1:'+filename]);assert.deepEqual(fs.readFileSync(path.join(__dirname,'..',filename)),baseline,filename);
 }
});
test('colleague typography keeps complete sentence paragraphs and finishes before the current v42 speech window',()=>{
 const text='第一句话。第二句话！最后一句。',l=B.proseLayout(text,{maxWidth:120});assert.equal(l.paragraphs.length,3);assert.equal(l.paragraphs.join(''),text);
 const clock=new Type.RevealClock();assert.equal(clock.update(0,80,{durationMs:2000,remainingMs:2000}),1);assert.ok(clock.update(500,80,{durationMs:2000,remainingMs:1500})>1);assert.equal(clock.update(1900,80,{durationMs:2000,remainingMs:100}),80);
 const before=clock.count;clock.update(1900,80,{visible:true});assert.equal(clock.count,before);
});
test('new bubble style is scoped and manual styling preserves the same saved data format',()=>{
 const {document}=require('linkedom').parseHTML('<main/>'),node=D.createCard(document,0),cfg=D.normalize({fill:'#ffffff',ink:'#221100',tailMode:'actor',scale:1.2});D.styleCard(node,cfg);
 const layout=B.layoutParts({text:'今晚的新气泡，逐字显示。',captionScale:1.2},280,18);B.render(node,'今晚的新气泡，逐字显示。',layout,document);B.advance(node,0,{key:'first'});
 assert.equal(node.dataset.writingMode,'vertical');assert.ok(node.querySelector('.caption-glyph.revealed'));assert.ok(node.querySelectorAll('.caption-glyph:not(.revealed)').length);
 B.advance(node,1900,{key:'first',remainingMs:100});assert.equal(node.querySelectorAll('.caption-glyph:not(.revealed)').length,0);
 B.advance(node,2000,{key:'replay'});assert.ok(node.querySelectorAll('.caption-glyph:not(.revealed)').length);assert.equal(node.style.background,'#ffffff');
});
test('connected original turns keep both texts and switching modes never rewrites cue messages',()=>{
 const {document}=require('linkedom').parseHTML('<main/>'),scope={};scope.globalThis=scope;vm.runInNewContext(fs.readFileSync(require.resolve('../frontend-trial.js'),'utf8'),scope);
 const F=scope.FrontendTrial,m1={actor:0,text:'第一段原台词。',cueKey:'2:abc'},m2={actor:0,text:'第二段原台词。',cueKey:'2:abc'},before=JSON.stringify([m1,m2]);
 F.prepare([{id:0,message:m1,text:m1.text}],'A1');const item=F.prepare([{id:0,message:m2,text:m2.text}],'A1')[0];assert.equal(item.parts.length,2);
 const node=D.createCard(document,0);D.styleCard(node,D.normalize());B.render(node,item.text,B.layoutParts(item,360,16),document);assert.equal(node.querySelectorAll('.caption-card').length,2);assert.equal(node.textContent,m1.text+m2.text);assert.equal(JSON.stringify([m1,m2]),before);
 assert.equal(F.set('v42'),true);assert.equal(F.colleague(),false);assert.equal(F.set('invalid'),false);assert.equal(F.mode(),'v42');F.set('colleague');assert.equal(F.prepare([{id:0,message:m2,text:m2.text}],'A2')[0].parts.length,1);
});
test('every current scripted reply can fit the trial renderer with all text present',()=>{
 for(const block of script.blocks)for(const s of block.sentences)for(const reply of s.replies){const item=D.decorate({id:reply.actor,x:960,y:650,text:reply.text,message:reply},D.normalize(),{left:0,top:0,width:1920,height:1080}),f=B.fitCards([item],1920,1080,{obstacles:[]});assert.equal(f.boxes.length,1,s.id);assert.ok(f.cards[0].layout.columns.join('').replace(/[\p{P}\p{S}\s]/gu,'').includes(reply.text.replace(/[\p{P}\p{S}\s]/gu,'')),s.id);}
});
test('live trial switches bubbles without stopping voice, resetting position or changing queued replies',async()=>{
 const f=require('./helpers/stage-fixture.cjs').stage({frontendTrial:true,sceneCatalog:catalog,width:1920,height:1080});f.command('speech-script',{script});await new Promise(r=>setImmediate(r));f.command('scene-take',{sceneId:'sc-q925-a1',revision:0});f.tick(100);
 f.command('rehearsal-cue',{index:1,sentenceIndex:0});for(let i=0;i<25;i++)f.tick(100);
 const before=vm.runInContext('JSON.stringify({topic:engine.topic,queue:engine.queue,follow:followState,voice:voiceActive,session:voiceSession,ledger:cueLedger.snapshot()})',f.context);
 f.command('frontend-bubbles',{value:'v42'});const after=vm.runInContext('JSON.stringify({topic:engine.topic,queue:engine.queue,follow:followState,voice:voiceActive,session:voiceSession,ledger:cueLedger.snapshot()})',f.context);assert.equal(after,before);assert.equal(f.posted.at(-1).frontendTrial.mode,'v42');f.command('frontend-bubbles',{value:'colleague'});assert.equal(f.posted.at(-1).frontendTrial.mode,'colleague');
});
test('night graphics keep S0 static, and T2 an independent clone of T1',()=>{
 assert.equal(C.locate(catalog,catalog.standbySceneId).scene.sceneBlock.enabled,false);const pack=require('../integration/scene-block/scenes.json');assert.deepEqual(pack.scenes.T1,pack.scenes.T2);assert.ok(!Object.values(pack.scenes).some(s=>s.actors.some(a=>a.id===9)));
});
test('director bubble preview uses the same selectable renderer and keeps tail handles editable',()=>{
 const {document}=require('linkedom').parseHTML('<main/>'),L=require('../stage-layout.js'),scope=vm.createContext({document,CaptionLayout:require('../caption-layout.js'),...L});
 for(const filename of ['dialogue-overlay.js','frontend-trial.js','integration/colleague-bubbles/typography.js','integration/colleague-bubbles/geometry.js','integration/colleague-bubbles/style.js','integration/colleague-bubbles/adapter.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),scope);
 const layer=scope.DialogueOverlay.mount(document.querySelector('main'));
 const item={id:0,key:'editor',text:'可编辑的完整气泡。',x:600,y:500,config:{manual:true,x:20,y:8,tailMode:'manual',tailAngle:70,tailLength:30,fill:'#ffffff'}};
 const result=layer.update({items:[item],width:1280,height:720});assert.equal(result.boxes.length,1);let node=layer.element.shadowRoot.querySelector('.bubble');assert.ok(node.classList.contains('colleague-bubble'));assert.ok(result.boxes[0].tail.handleTip);assert.equal(node.style.background,'#ffffff');assert.equal(node.querySelectorAll('.caption-glyph:not(.revealed)').length,0);
 scope.FrontendTrial.set('v42');layer.update({items:[{...item,key:'legacy'}],width:1280,height:720});node=layer.element.shadowRoot.querySelector('.bubble');assert.ok(!node.classList.contains('colleague-bubble'));assert.equal(node.dataset.writingMode,'vertical');layer.destroy();
});
test('T1 chorus progresses all nine logical replies under the trial renderer',async()=>{
 const f=require('./helpers/stage-fixture.cjs').stage({frontendTrial:true,sceneCatalog:catalog,width:1920,height:1080});f.command('speech-script',{script});await new Promise(r=>setImmediate(r));f.command('scene-take',{sceneId:'sc-q925-t1',revision:0});f.tick(100);f.command('rehearsal-cue',{index:script.blocks.length-1,sentenceIndex:script.blocks.at(-1).sentences.length-1});let seen=false;
 for(let i=0;i<240;i++){f.tick(100);const cards=f.elements.get('bubbles').children.filter(b=>b.classList.contains('visible'));if(cards.length){seen=true;assert.equal(cards.length,1);assert.equal(cards[0].dataset.tailCount,'8');}}
 assert.ok(seen);assert.equal(f.posted.at(-1).cues.at(-1).completed,9);
});
