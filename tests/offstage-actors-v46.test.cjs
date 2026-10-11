const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=require('../scene-catalog.js'),L=require('../stage-layout.js'),{staticCastCatalog}=require('../scripts/static-cast-catalog.cjs');
const {editor}=require('./helpers/bubble-editor-fixture.cjs'),{stage}=require('./helpers/stage-fixture.cjs');
const source=require('../show/scenes.json').catalog;
const within=(b,r)=>{assert.ok(b.left>=r.left&&b.top>=r.top);assert.ok(b.left+b.width<=r.left+r.width&&b.top+b.height<=r.top+r.height);};

test('offstage actor coordinates survive storage and scaling without changing backgrounds or other actors',async()=>{
 const {SceneStore}=await import('../backend/scene-store.mjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'jinmen-offstage-'));
 try{const store=new SceneStore(path.join(dir,'scenes.json')),catalog=C.normalize(C.seed()),s=catalog.maps[1].scenes[0],before=structuredClone(s),a=s.actors[0];
  Object.assign(a,C.movePlacement('actor:0',a,-80,50));assert.ok(a.x<0&&a.y>100);
  const b=C.placementBounds(s,'actor:0'),resized=C.resizePlacement(s,'actor:0',a,'se',b.width*.1,b.height*.1);Object.assign(a,resized);
  const afterBox=C.placementBounds(s,'actor:0');assert.ok(Math.abs(b.left-afterBox.left)<1e-8);assert.ok(Math.abs(b.top-afterBox.top)<1e-8);
  store.save(catalog,0);const loaded=store.get().catalog.maps[1].scenes[0];assert.deepEqual(loaded.actors[0],a);assert.deepEqual(loaded.actors.slice(1),before.actors.slice(1));assert.equal(loaded.background,before.background);
  assert.deepEqual(C.movePlacement('background',{x:0,y:0,scale:1},1000,1000),{x:100,y:100,scale:1});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('all scene edges retain every nameplate, including multiple entirely offscreen owners',()=>{
 for(const [w,h] of [[1920,1080],[828,807],[640,360]])for(const [x,y] of [[-60,90],[160,90],[50,-40],[50,200],[-100,200]]){
  const scene=L.sceneRect(w,h,16/9,true),figures=Array.from({length:8},(_,id)=>{const actor={id,x,y,scale:1,aspect:.6,contentBounds:[.1,.02,.9,.96],motion:{stationary:true}},p=L.scenePosition(actor,actor,{phase:'speaking'},1,scene,w,h);
   assert.equal(p.x,x/100);assert.equal(p.y,y/100);
   return {...L.nameplateFigure({id,x:scene.left+p.x*scene.width,foot:scene.top+p.y*scene.height,width:60,height:100},actor),labelWidth:18,labelHeight:44};
  });
  const labels=L.placeNameplates(figures,w,h,{bounds:scene,keepVisible:true,reserved:{left:0,top:h+1,width:0,height:0}});assert.equal(labels.length,8);
  for(const b of labels){within(b,scene);for(const other of labels.filter(o=>o.id!==b.id))assert.ok(!(b.left<other.left+other.width&&b.left+b.width>other.left&&b.top<other.top+other.height&&b.top+b.height>other.top));}
 }
});

test('editor drag crosses the bottom; its nameplate retrieves the actor, and save/reopen retains offstage placement',async()=>{
 const f=await editor('A1',{staticCast:true,dynamic:true}),preview=f.$('scene-preview'),target=f.$('scene-edit-target');target.value='actor:0';target.onchange();
 const pointer=(node,type,x,y)=>{const e=new f.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:2,button:0,clientX:x,clientY:y});node.dispatchEvent(e);};
 const field=()=>f.document.querySelector('[data-placement-target="actor:0"][data-placement-key="y"]');
 let label=preview.querySelector('.scene-preview-nameplate[data-edit-target="actor:0"]');pointer(label,'pointerdown',220,200);pointer(preview,'pointermove',220,650);pointer(preview,'pointerup',220,650);
 const out=Number(field().value);assert.ok(out>100);within({left:parseFloat(label.style.left),top:parseFloat(label.style.top),width:15,height:39},{left:0,top:0,width:640,height:360});
 await f.$('scene-save').onclick();assert.ok(Math.abs(C.locate(f.record().catalog,'sc-q925-a1').scene.actors[0].y-out)<.001);f.open();assert.ok(Math.abs(Number(field().value)-out)<.001);
 target.value='actor:0';target.onchange();label=preview.querySelector('.scene-preview-nameplate[data-edit-target="actor:0"]');pointer(label,'pointerdown',220,330);pointer(preview,'pointermove',220,10);pointer(preview,'pointerup',220,10);assert.ok(Number(field().value)<out);
 const saved=structuredClone(f.record());f.$('scene-close').click();assert.deepEqual(f.record(),saved,'cancelled retrieval must not overwrite saved placement');
});

test('live stage clips offscreen portraits to the scene but retains visible edge nameplates',async()=>{
 const catalog=staticCastCatalog(source),s=C.locate(catalog,'sc-q925-a1').scene;Object.assign(s.actors[0],{x:-70,y:180});
 const f=stage({sceneCatalog:catalog,width:1280,height:900});await new Promise(r=>setImmediate(r));f.command('scene-take',{sceneId:s.id,revision:0});await new Promise(r=>setImmediate(r));f.tick(1000);f.tick(1000);
 const label=f.elements.get('labels').children[0],actor=f.elements.get('actors').children[0],rect=L.sceneRect(1280,900,s.backgroundAspect,false);
 assert.equal(label.hidden,false);assert.equal(label.style.visibility,'visible');assert.equal(Number(label.style.opacity),1);assert.match(f.elements.get('actors').style.clipPath,/^inset\(/);
 within({left:parseFloat(label.style.left),top:parseFloat(label.style.top),width:18,height:40},rect);assert.match(actor.style.transform,/translate\(-/);
});
