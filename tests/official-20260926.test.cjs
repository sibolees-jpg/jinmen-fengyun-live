const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Opening=require('../opening-cast.js'),{stage}=require('./helpers/stage-fixture.cjs'),{editor}=require('./helpers/bubble-editor-fixture.cjs');
const Script=require('../speech-script.js'),Plan=require('../cue-plan.js'),Catalog=require('../scene-catalog.js'),script=Script.create(require('../show/script.json').script),catalog=require('../show/scenes.json').catalog;
const settle=()=>new Promise(r=>setImmediate(r)),advance=(s,ms)=>{for(let t=0;t<ms;t+=100)s.tick(100);};
test('named introduction reveals each exact identity once, ignores greetings and resets cleanly',()=>{
 const cast=new Opening();cast.feed('尊敬的各位领导',false,0);assert.equal(cast.seen.size,0);
 let phrase='他们是';for(const [i,[name,id]] of Opening.names.entries()){phrase+=name+'、';cast.feed(phrase,false,i*1000);assert.equal(cast.seen.size,i+1);assert.equal(cast.opacity(id,i*1000),0);assert.equal(cast.opacity(id,i*1000+500),1);cast.feed(phrase,true,i*1000+500);assert.equal(cast.seen.size,i+1);assert.equal(cast.transitioned,false);}
 assert.equal(cast.feed('我们一起来说说',false,11000),true);assert.equal(cast.feed('天津美院办学120年矣',true,12000),false);cast.reset();assert.equal(cast.seen.size,0);assert.equal(cast.transitioned,false);
});
test('live S0 stays through greeting and all eight manuscript names, then changes only on the following sentence',async()=>{
 const f=stage({sceneCatalog:catalog,frontendTrial:true,width:1920,height:1080});f.command('speech-script',{script});await settle();f.command('voice-state',{active:true,session:'opening-official'});let seq=0;
 const feed=text=>{f.command('voice-transcript',{session:'opening-official',seq:++seq,text,final:false});advance(f,700);};
 feed('尊敬的');assert.equal(f.posted.at(-1).scenery.activeId,catalog.standbySceneId);assert.equal(f.elements.get('actors').children.filter(a=>!a.hidden).length,0);
 let words='他们是';for(const [i,[name]] of new Opening(script).names.entries()){words+=name+'、';feed(words);assert.equal(f.posted.at(-1).scenery.activeId,catalog.standbySceneId);assert.equal(f.elements.get('actors').children.filter(a=>!a.hidden).length,i+1);}
 feed('我们一起来说说');advance(f,2200);assert.equal(f.posted.at(-1).scenery.activeId,'sc-q925-a1');f.command('scene-reset');advance(f,1000);assert.equal(f.posted.at(-1).scenery.activeId,catalog.standbySceneId);assert.equal(f.elements.get('actors').children.filter(a=>!a.hidden).length,0);f.command('clear');
});
test('new opening arrangement preserves every manuscript word and all prior non-chorus replies',()=>{
 const before=require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json'),texts=s=>s.blocks.flatMap(b=>b.sentences).flatMap(s=>s.replies).filter(r=>!r.chorus).map(r=>[r.actor,r.text]);const latest=fs.readFileSync(require.resolve('../speeches/2026-120周年校庆/邱志杰校庆致辞925-正文.txt'),'utf8').trim();assert.equal(script.text,latest);assert.equal(script.blocks.map(b=>b.source).join('').replace(/\s/g,''),latest.replace(/\s/g,''));assert.deepEqual(texts(script),texts(before));assert.equal(Plan.audit(script,catalog).ok,true);assert.equal(script.blocks[0].sentences.at(-1).id,'q925-r02-s01');assert.equal(script.blocks[1].visualTrigger,'我们一起来说说');
});
test('T1 three blessings each produce one shared card and exactly nine completed replies without replay',async()=>{
 const block=script.blocks.at(-1),indices=block.sentences.flatMap((s,i)=>s.replies.length?[i]:[]);assert.equal(indices.length,3);assert.deepEqual(indices.map(i=>block.sentences[i].text.trim()),['祝天津美术学院生日快乐！','祝我们的老先生们身体健康、长命百岁！','祝我们的校友们事业发达、前程似锦！']);
 const f=stage({sceneCatalog:catalog,frontendTrial:true,width:1920,height:1080});f.command('speech-script',{script});await settle();f.command('scene-take',{sceneId:'sc-q925-t1',revision:0});f.command('voice-state',{active:true,session:'three-chorus'});let seq=0;
 for(const [i,line] of block.sentences.entries()){if(!line.replies.length){f.command('voice-transcript',{session:'three-chorus',seq:++seq,text:line.trigger,final:true});advance(f,500);continue;}assert.ok(line.replies.every(r=>r.chorus&&r.text===line.text.trim()));f.command('voice-transcript',{session:'three-chorus',seq:++seq,text:line.trigger,final:true});let saw=false;for(let k=0;k<450;k++){f.tick(100);const cards=f.elements.get('bubbles').children.filter(n=>n.classList.contains('visible'));if(cards.length){saw=true;assert.equal(cards.length,1);assert.equal(cards[0].dataset.text,line.text.trim());assert.equal(cards[0].dataset.writingMode,'horizontal');}}
 assert.ok(saw,line.id);f.command('voice-transcript',{session:'three-chorus',seq:++seq,text:line.text,final:true});advance(f,500);}
 const cues=f.posted.at(-1).cues.filter(c=>c.state!=='skipped');assert.equal(cues.length,3);assert.ok(cues.every(c=>c.completed===9&&c.state==='played'));f.command('clear');
});
test('M1 puts only Yan Fu above the table without moving him, the table or the perspective',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../integration/scene-block/plane-renderer.js'),'utf8'),ctx);
 const source=require('../integration/scene-block/scenes.json').scenes.M1,before=JSON.parse(require('node:child_process').execFileSync('git',['show','accepted-frontend-20260926:integration/scene-block/scenes.json'])).scenes.M1;
 assert.deepEqual(source.actors,before.actors);assert.deepEqual(source.plane,before.plane);assert.deepEqual(source.objects,before.objects);
 ctx.isTextSpeaking=()=>false;ctx.speechMouthOpen=()=>false;
 const view=Object.create(ctx.PlaneView.prototype);Object.assign(view,{scene:source,projection:{w:1600,h:900,cell:10,actor:a=>[100,500,1]},sceneryKey:'1600,900,'+source.backgroundAspect,sceneryCache:[{object:{id:'split-8-table-completed'},foot:860}],sim:{actors:[{id:'stage_2',settings:{size:1},breath:0}],time:0},native:new Map([['stage_2',{slot:source.actors[2]}]]),water:{quads:()=>[]},boats:{quads:()=>[]},traffic:{quads:()=>[]},hostTime:0,speakerState:()=>null,nativeGeometry:()=>({x:10,y:20,width:30,height:40})});
 const q=view.drawables().find(q=>q.actor);assert.equal(q.order,860.1);assert.equal(q.foot,500);assert.equal(q.x,10);view.scene={...source,actorAboveObjects:{}};assert.equal(view.drawables().find(q=>q.actor).order,undefined);
});
test('S0 actor size and bubble edits coexist: cancel, save and reopen never send scene-take or speech commands',async()=>{
 const f=await editor('起始幕',{dynamic:true,frontendTrial:true}),before=structuredClone(f.record()),scale=f.document.querySelector('[data-placement-target="actor:1"][data-placement-key=scale]');assert.ok(scale);scale.value='0.91';scale.oninput();f.control('fill').value='#ffffff';f.control('fill').oninput();assert.deepEqual(f.record(),before);f.$('scene-close').click();f.open();assert.equal(Number(f.document.querySelector('[data-placement-target="actor:1"][data-placement-key=scale]').value),.76);
 const input=f.document.querySelector('[data-placement-target="actor:1"][data-placement-key=scale]');input.value='0.91';input.oninput();await f.$('scene-save').onclick();const saved=Catalog.locate(f.record().catalog,catalog.standbySceneId).scene;assert.equal(saved.actors[1].scale,.91);assert.deepEqual(f.record().catalog.maps.slice(1),before.catalog.maps.slice(1));assert.deepEqual(f.sent.map(m=>m[0]),['scene-reload']);f.open();assert.equal(Number(f.document.querySelector('[data-placement-target="actor:1"][data-placement-key=scale]').value),.91);
});

test('continuous 220 cpm rehearsal follows the new introduction and finishes all 51 groups / 103 lines',async()=>{
 const f=stage({sceneCatalog:catalog,frontendTrial:true,width:1920,height:1080});f.command('speech-script',{script});await settle();f.command('rehearsal-start');let ticks=0;
 while(ticks++<2600){f.tick(1000);const m=f.posted.at(-1);if(!m.rehearsal.active&&m.presentation.complete)break;}
 assert.ok(ticks<2600,'rehearsal stalled');for(let i=0;i<300;i++)f.tick(1000);const m=f.posted.at(-1);assert.equal(m.cues.length,51);assert.equal(m.cues.reduce((n,c)=>n+c.completed,0),103);assert.ok(m.cues.every(c=>c.state==='played'),JSON.stringify(m.cues.filter(c=>c.state!=='played')));assert.equal(m.replyFlow.blocked.length,0);assert.equal(f.calls.length,0);f.command('clear');
});

test('director loads both layout dependencies before the bubble adapter and editor',()=>{
 const html=fs.readFileSync(require.resolve('../director.html'),'utf8'),index=n=>html.indexOf('src="'+n);for(const file of ['caption-layout.js','stage-layout.js'])assert.ok(index(file)<index('integration/colleague-bubbles/adapter.js'));assert.ok(index('integration/colleague-bubbles/adapter.js')<index('bubble-editor.js'));
});
