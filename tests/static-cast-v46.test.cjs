const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../scene-catalog.js'),A=require('../actor-animation.js'),L=require('../stage-layout.js');
const {staticCastCatalog}=require('../scripts/static-cast-catalog.cjs'),{editor}=require('./helpers/bubble-editor-fixture.cjs');
const source=require('../show/scenes.json').catalog,delivered=require('../integration/scene-block/scenes.json').scenes;

test('all 25 scenes remove the animated background block and keep the currently delivered foreground portraits',()=>{
 const before=structuredClone(source),catalog=staticCastCatalog(source);
 assert.deepEqual(source,before);assert.doesNotThrow(()=>require('../cue-plan.js').assert(require('../show/script.json').script,catalog));
 for(const m of catalog.maps)for(const s of m.scenes){
  const v=C.visualScene(s);assert.ok(C.isStaticCast(s));assert.equal(C.isDynamic(s),false);assert.equal(C.isComposite(s),false);assert.equal(require('../scene-block.js').enabled(s),false);
  assert.deepEqual(v.sceneryLayers,[]);assert.deepEqual(v.occluders,[]);assert.equal(v.foreground,'');
  for(const a of s.actors.filter(a=>a.present&&!a.visualHidden)){
   assert.ok(a.animation,'keep registered expression pack');assert.equal(a.motion.breathing,false);assert.equal(a.motion.walking,false);assert.equal(a.step,0);assert.equal(a.roamRadius,0);
   assert.deepEqual(a.animation.clips.breath,[]);assert.ok(a.animation.clips.blink.length);assert.ok(a.animation.clips.talk.length);
   if(s.sceneBlock?.code!=='S0'&&s.id!=='sc-doc924-standby')assert.equal(a.poses.idle.split('/').pop(),delivered[s.sceneBlock.code].actors[a.id].poses.idle.split('/').pop());
  }
 }
});

test('stationary portraits cycle only idle, blink and mouth frames without moving or enlarging the body',()=>{
 const catalog=staticCastCatalog(source),s=C.locate(catalog,'sc-q925-a1').scene,a=s.actors[0],allowed=new Set(['idle','blink','talk','talkBlink'].flatMap(k=>a.animation.clips[k]));
 const frames=new Set();for(let time=0;time<18000;time+=80)for(const phase of ['idle','speaking']){const frame=A.frameAt(a.animation,a.motion,{phase},time,a.id);assert.ok(allowed.has(frame));frames.add(frame);}
 assert.ok(frames.has(a.animation.clips.blink[0]));assert.ok(frames.has(a.animation.clips.talk[0]));
 const rect={left:0,top:0,width:1280,height:720},base=L.scenePosition(a,a,{phase:'idle'},0,rect,1280,720);
 assert.deepEqual(L.scenePosition(a,a,{phase:'speaking'},0,rect,1280,720),base);
});

test('static scene editor supports character move and corner resize, cancels drafts and saves only the chosen scene',async()=>{
 const f=await editor('A1',{staticCast:true,dynamic:true}),preview=f.$('scene-preview'),before=structuredClone(f.record().catalog);
 assert.ok(f.$('scene-dialog').classList.contains('scene-staticcast-editor'));assert.equal(preview.querySelectorAll('.scene-preview-person').length,2);
 assert.equal(preview.querySelectorAll('iframe').length,0);assert.equal(f.$('scene-layer-list').closest('section').hidden,true);
 const target=f.$('scene-edit-target');target.value='actor:0';target.onchange();
 const pointer=(target,type,x,y)=>{const e=new f.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:2,button:0,clientX:x,clientY:y});target.dispatchEvent(e);};
 let frame=preview.querySelector('.scene-selection-frame');pointer(frame,'pointerdown',200,200);pointer(preview,'pointermove',220,190);pointer(preview,'pointerup',220,190);
 const x=f.document.querySelector('[data-placement-target="actor:0"][data-placement-key="x"]').value;
 assert.notEqual(Number(x),C.locate(before,'sc-q925-a1').scene.actors[0].x);
 frame=preview.querySelector('.scene-selection-frame');pointer(frame.querySelector('[data-corner="se"]'),'pointerdown',220,200);pointer(preview,'pointermove',195,175);pointer(preview,'pointerup',195,175);
 const scale=Number(f.document.querySelector('[data-placement-target="actor:0"][data-placement-key="scale"]').value);assert.notEqual(scale,C.locate(before,'sc-q925-a1').scene.actors[0].scale);
 assert.equal(f.record().revision,1);await f.$('scene-save').onclick();const saved=C.locate(f.record().catalog,'sc-q925-a1').scene;
 assert.ok(Math.abs(saved.actors[0].scale-scale)<.001);assert.deepEqual(saved.actors[1],C.locate(before,'sc-q925-a1').scene.actors[1]);assert.deepEqual(C.locate(f.record().catalog,'sc-q925-a2').scene,C.locate(before,'sc-q925-a2').scene);
 assert.deepEqual(f.sent.map(c=>c[0]),['scene-reload']);f.open();target.value='actor:0';target.onchange();
 const input=f.document.querySelector('[data-placement-target="actor:0"][data-placement-key="x"]');input.value='55';input.oninput();f.$('scene-close').click();f.open();assert.notEqual(Number(f.document.querySelector('[data-placement-target="actor:0"][data-placement-key="x"]').value),55);
});
