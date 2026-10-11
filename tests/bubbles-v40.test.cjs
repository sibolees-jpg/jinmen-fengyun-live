const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../scene-catalog.js'),D=require('../dialogue-overlay.js'),Caption=require('../caption-layout.js'),L=require('../stage-layout.js'),{editor}=require('./helpers/bubble-editor-fixture.cjs');
const catalog=require('../show/scenes.json').catalog,script=require('../show/script.json').script;
test('Ordinary scenes including T2 use vertical text, including independent cue/default styles and static fallback',()=>{
 for(const s of catalog.maps.flatMap(m=>m.scenes))for(const a of s.actors){const expected='vertical';assert.equal(D.resolve(s,a).writingMode,expected);const copy=structuredClone(s);copy.actors[a.id].bubbleCues={cue:{...D.normalize(),writingMode:expected==='vertical'?'horizontal':'vertical'}};assert.equal(D.resolve(copy,a.id,{cueKey:'20:cue'}).writingMode,expected);}
 const text='临场接话：你好，天津！Hello 120，全文保留。\n第二行。',layout=Caption.whole(text,{writingMode:'horizontal',maxWidth:130,maxHeight:310});assert.equal(layout.writingMode,'horizontal');assert.equal(layout.columns.join(''),text.replace(/\n/g,''));assert.ok(layout.width<=130);assert.ok(layout.columns.length>1);
});
test('each authored bubble saves independently while cue identity survives block reordering',{skip:!script && 'Fixed manuscript tests do not apply to the realtime edition'},async()=>{
 const f=await editor('A2',{editScope:'cue',dynamic:true}),key='sc-q925-a2',before=structuredClone(C.locate(f.record().catalog,key).scene),first=script.blocks.find(b=>b.sceneId===key).sentences.find(s=>s.replies.length),actor=first.replies[0].actor;
 assert.equal(f.control('scope').value,'cue');f.control('fill').value='#ffffff';f.control('fill').oninput();await f.$('scene-save').onclick();const saved=C.locate(f.record().catalog,key).scene;
 assert.equal(saved.actors[actor].bubbleCues[first.id].fill,'#ffffff');assert.deepEqual(saved.actors[actor].bubble,before.actors[actor].bubble);assert.equal(D.resolve(saved,actor,{cueKey:'99:'+first.id}).fill,'#ffffff');assert.equal(D.resolve(saved,actor,{cueKey:'99:another'}).fill,before.actors[actor].bubble.fill);
 assert.deepEqual({...saved.actors[actor],bubbleCues:undefined},{...before.actors[actor],bubbleCues:undefined});
 f.open();f.control('scope').value='cue';f.control('scope').onchange();f.control('fill').value='#ff0000';f.control('fill').oninput();f.$('scene-close').click();assert.equal(D.resolve(C.locate(f.record().catalog,key).scene,actor,{cueId:first.id}).fill,'#ffffff');
});
test('T2 editor displays vertical complete sample, and every visible character has an editable bubble',async()=>{
 const f=await editor('T2',{editScope:'actor',dynamic:true}),scene=C.locate(f.record().catalog,'sc-q925-t2').scene;
 for(const a of C.visualScene(scene).actors.filter(a=>a.present)){
  f.control('actor').value=String(a.id);f.control('actor').onchange();const layer=f.$('scene-preview').querySelector('jmf-dialogue-layer'),card=layer.shadowRoot.querySelector('.bubble[aria-hidden=false]');assert.ok(card,a.id);assert.equal(card.dataset.writingMode,'vertical');assert.ok(card.querySelector('.caption-column'));assert.ok(f.$('scene-preview').querySelector('.bubble-edit-frame'));
 }
});
test('pointed tails follow exact own head after bubble moves and actor walks; outline remains a single taper',()=>{
 const {parseHTML}=require('linkedom'),{document}=parseHTML('<div id="h"></div>'),layer=D.mount(document.getElementById('h'),{Caption,place:L.placeBubbles});
 for(const [x,y,manual,bx] of [[600,500,false,30],[640,480,true,10],[800,550,true,40]]){
  const result=layer.update({items:[{id:1,key:'same',text:'尾巴必须指向自己的角色。',x,y,config:{tailMode:'actor',tailSide:'left',tailAngle:130,tailLength:4,manual,x:bx,y:10}}],width:1280,height:720});const b=result.boxes[0];assert.ok(b);assert.ok(Math.abs(b.left+b.tail.handleTip.x-x)<1e-6);assert.ok(Math.abs(b.top+b.tail.handleTip.y-(y-6*1.15))<1e-6);assert.equal(b.tail.notch.length,3);assert.deepEqual(b.tail.connector,[]);
 }
 const b=layer.element.shadowRoot.querySelector('.bubble');assert.equal(b.querySelector('.bubble-notch').style.fill,b.style.background);assert.equal(b.querySelector('.bubble-seam').style.stroke,b.style.background);
});
test('bubble cue schema rejects malformed keys and persists independent local settings',()=>{
 const c=C.normalize(catalog),s=c.maps[1].scenes[0];s.actors[1].bubbleCues={cue:D.normalize({fill:'#ffffff'})};assert.equal(C.normalize(c).maps[1].scenes[0].actors[1].bubbleCues.cue.fill,'#ffffff');s.actors[1].bubbleCues={'../bad':{}};assert.throws(()=>C.normalize(c));
});
test('all 103 manuscript replies can select an individual editing frame, including crowded multi-person groups',{skip:!script && 'Fixed manuscript tests do not apply to the realtime edition'},async()=>{
 let count=0;
 for(const block of script.blocks.filter(b=>b.sentences.some(s=>s.replies.length))){
  const scene=C.locate(catalog,block.sceneId).scene,code=block.sequenceCode==='起始幕'?'起始幕':scene.sceneBlock.code,f=await editor(code,{editScope:'cue',dynamic:true});let group=0;
  for(const sentence of block.sentences.filter(s=>s.replies.length)){
   f.control('group').value=String(group++);f.control('group').onchange();
   for(const reply of sentence.replies){f.control('actor').value=String(reply.actor);f.control('actor').onchange();assert.ok(f.$('scene-preview').querySelector('.bubble-edit-frame'),sentence.id+':'+reply.actor);assert.match(f.control('note').textContent,/仅当前这条气泡/);count++;}
  }
 }
 assert.equal(count,103);
});
test('stage T2 renders the same complete vertical response as the editor without changing AI dispatch',async()=>{
 const {stage}=require('./helpers/stage-fixture.cjs'),vm=require('node:vm'),s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.command('scene-take',{sceneId:'sc-q925-t2',revision:0});s.tick(100);s.command('improv-enable',{value:true});s.command('speech-input',{text:'请大家谈谈艺术教育有什么意义',session:'v40',seq:1,final:true});
 // Inspect the same presentation function with a real queued actor message, without any external API.
 vm.runInContext("engine.enqueueDiscussion([{actor:0,text:'横排的完整接话。',improv:true,source:'DeepSeek'}]);",s.context);for(let i=0;i<30;i++)s.tick(100);
 const node=s.elements.get('bubbles').children[0];assert.equal(node.dataset.writingMode,'vertical');assert.equal(node.dataset.text,'横排的完整接话。');
});
