const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../scene-catalog.js'),D=require('../dialogue-overlay.js'),L=require('../stage-layout.js');
const {flatCatalog}=require('../scripts/flat-image-catalog.cjs'),{editor}=require('./helpers/bubble-editor-fixture.cjs');
const source=require('../show/scenes.json').catalog,script=require('../show/script.json').script;

test('flat variant preserves original assets, logical cast and cue bindings while showing only one image',()=>{
 const before=structuredClone(source),catalog=flatCatalog(source);
 assert.deepEqual(source,before);
 for(const map of catalog.maps)for(const s of map.scenes){
  const original=C.locate(C.normalize(source),s.id).scene,v=C.visualScene(s);
  assert.ok(C.isFlat(s));assert.equal(C.isDynamic(s),false);assert.equal(require('../scene-block.js').enabled(s),false);
  assert.equal(v.background,s.composition.image);assert.equal(v.backgroundAspect,16/9);
  assert.deepEqual(v.sceneryLayers,[]);assert.deepEqual(v.occluders,[]);assert.equal(v.foreground,'');
  assert.ok(v.actors.every(a=>a.embedded&&!a.poses.idle));assert.deepEqual(s.sceneBlock,original.sceneBlock);
  assert.deepEqual(s.actors.map(a=>[a.present,a.poses,a.x,a.y,a.scale]),original.actors.map(a=>[a.present,a.poses,a.x,a.y,a.scale]));
  assert.deepEqual(C.playbackAssets(s),[s.composition.image]);
 }
 assert.doesNotThrow(()=>require('../cue-plan.js').assert(script,catalog));
});

const item=(id=0,config={})=>({id,message:{text:'这是一整段保留在同一个气泡里的台词。'},text:'这是一整段保留在同一个气泡里的台词。',x:640,y:500,config:D.normalize({manual:true,x:25,y:20,tailMode:'point',tailX:70,tailY:80,...config})});
function fit(items,rect={left:0,top:0,width:1280,height:720}){return D.fitFree(items.map(i=>D.decorate(i,i.config,rect)),rect);}
test('free layout displays overlapping bubbles without displacement or dropping any speaker',()=>{
 const r=fit(Array.from({length:9},(_,i)=>item(i)));
 assert.equal(r.boxes.length,9);
 for(const box of r.boxes){assert.equal(box.left,320);assert.equal(box.top,144);assert.equal(box.left+box.tail.handleTip.x,896);assert.equal(box.top+box.tail.handleTip.y,576);}
 assert.ok(r.cards.every(c=>c.layout.columns.join('').replace(/\s/g,'')==='这是一整段保留在同一个气泡里的台词。'));
 const moved=fit([item(0,{x:40,y:30})]).boxes[0];assert.equal(moved.left+moved.tail.handleTip.x,896);assert.equal(moved.top+moved.tail.handleTip.y,576);
});

test('same percentage layout, text dimensions and tail endpoint at preview, windowed and fullscreen sizes',()=>{
 const baseline=fit([item()]);
 for(const rect of [{left:20,top:110,width:640,height:360},{left:0,top:0,width:1920,height:1080},{left:0,top:74,width:828,height:465.75}]){
  const r=fit([item()],rect),a=r.boxes[0],b=baseline.boxes[0],scale=rect.width/1280;
  for(const [key,offset] of [['left',rect.left],['top',rect.top],['width',0],['height',0]])assert.ok(Math.abs(a[key]-offset-b[key]*scale)<1e-7,key);
  assert.ok(Math.abs(a.tail.handleTip.x-b.tail.handleTip.x*scale)<1e-7);
  assert.equal(r.cards[0].layout.fontSize,baseline.cards[0].layout.fontSize*scale);
 }
});

test('flat editor drag, tail drag, undo, redo, cancel and save leave speech and other scenes untouched',async()=>{
 const f=await editor('A1',{flat:true,dynamic:true,frontendTrial:true,editScope:'cue'}),before=structuredClone(f.record().catalog);
 const key=script.blocks[1].sentences.find(s=>s.replies.length).id,who=Number(f.control('actor').value),preview=f.$('scene-preview');
 assert.equal(preview.querySelectorAll('.scene-preview-person').length,0);assert.equal(preview.querySelectorAll('iframe').length,0);
 const pointer=(target,type,x,y)=>{const e=new f.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:x,clientY:y});target.dispatchEvent(e);};
 let frame=preview.querySelector('.bubble-edit-frame'),initial=parseFloat(frame.style.left);
 pointer(frame,'pointerdown',100,80);pointer(frame,'pointermove',150,105);pointer(frame,'pointerup',150,105);
 assert.ok(Math.abs(parseFloat(frame.style.left)-initial-50)<1e-7);
 const moved=f.control('x').value;f.control('undo').click();assert.equal(parseFloat(preview.querySelector('.bubble-edit-frame').style.left),initial);
 f.control('redo').click();assert.equal(f.control('x').value,moved);
 frame=preview.querySelector('.bubble-edit-frame');const tip=frame.querySelector('.bubble-tail-tip-handle'),beforeX=parseFloat(frame.style.left)+parseFloat(tip.style.left);
 pointer(tip,'pointerdown',100,100);pointer(frame,'pointermove',200,130);pointer(frame,'pointerup',200,130);
 assert.ok(Math.abs(parseFloat(frame.style.left)+parseFloat(tip.style.left)-beforeX-100)<1e-6);
 assert.equal(f.control('tailMode').value,'point');assert.equal(f.record().revision,1);
 await f.$('scene-save').onclick();const saved=C.locate(f.record().catalog,'sc-q925-a1').scene;
 assert.equal(saved.actors[who].bubbleCues[key].tailMode,'point');assert.deepEqual(f.sent.map(c=>c[0]),['scene-reload']);
 assert.deepEqual(C.locate(before,'sc-q925-a2').scene,C.locate(f.record().catalog,'sc-q925-a2').scene);
 f.open();assert.equal(f.control('x').value,moved);f.control('x').value='66';f.control('x').oninput();f.$('scene-close').click();f.open();assert.equal(f.control('x').value,moved);
});

test('T1 shared frame retains multiple independently pinned tails; normal replies remain vertical',async()=>{
 const f=await editor('T1',{flat:true,dynamic:true,frontendTrial:true,editScope:'cue'}),preview=f.$('scene-preview');
 const bubbles=()=>preview.querySelector('jmf-dialogue-layer').shadowRoot.querySelectorAll('.bubble.visible');
 assert.equal(bubbles().length,1);assert.equal(bubbles()[0].dataset.writingMode,'horizontal');
 assert.ok(Number(bubbles()[0].dataset.tailCount)>=8);
 const a=fit([item()]).cards[0];assert.notEqual(a.layout.writingMode,'horizontal');
});

test('stage triggers fixed replies in flat mode even where every actor and presenter would obstruct bubbles',async()=>{
 const {stage}=require('./helpers/stage-fixture.cjs'),catalog=flatCatalog(source);
 for(const m of catalog.maps)for(const s of m.scenes){s.presenter={x:0,y:0,width:100,height:100};for(const a of s.actors){a.bubble.x=25;a.bubble.y=20;for(const b of Object.values(a.bubbleCues||{})){b.x=25;b.y=20;}}}
 const f=stage({width:1280,height:720,sceneCatalog:catalog,frontendTrial:true});await new Promise(r=>setImmediate(r));
 f.command('speech-script',{script});f.command('rehearsal-cue',{index:1,sentenceIndex:script.blocks[1].sentences.findIndex(s=>s.replies.length)});await new Promise(r=>setImmediate(r));
 for(let i=0;i<50;i++)f.tick(100);
 assert.ok(f.posted.at(-1).cueEvents.some(e=>e.type==='cue-visible'));
 assert.equal(f.posted.at(-1).replyFlow.blocked.length,0);
 assert.ok(f.elements.get('bubbles').children.some(b=>b.classList.contains('visible')));f.command('clear');
});
