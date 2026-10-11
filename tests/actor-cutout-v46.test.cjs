const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Cut=require('../actor-cutout.js'),C=require('../scene-catalog.js'),{staticCastCatalog}=require('../scripts/static-cast-catalog.cjs'),source=require('../show/scenes.json').catalog;
const {stage}=require('./helpers/stage-fixture.cjs'),{editor}=require('./helpers/bubble-editor-fixture.cjs');
const ref=n=>'/api/scene-assets/'+String(n).repeat(64)+'.png';
test('erase/crop history and mirrored pointer coordinates are reversible without editing the source',()=>{
 const r={left:10,top:20,width:100,height:200};assert.deepEqual(Cut.point(30,80,r),[.2,.3]);assert.deepEqual(Cut.point(30,80,r,true),[.8,.3]);assert.deepEqual(Cut.point(-50,900,r),[0,1]);
 assert.deepEqual(Cut.crop([.9,.8],[.2,.1]),{left:.2,top:.1,right:.9,bottom:.8});
 const h=new Cut.History(),stroke={type:'erase',size:.1,points:[[.2,.3],[.4,.5]]};h.add(stroke);h.add({type:'reset'});h.undo();assert.deepEqual(h.ops,[stroke]);h.redo();assert.equal(h.ops.at(-1).type,'reset');h.undo();h.add({type:'crop',rect:Cut.crop([0,0],[.5,.5])});assert.equal(h.redoOps.length,0);
});
test('cutout storage keeps original geometry, frames and per-scene settings; replacement cannot reuse a stale mask',()=>{
 const c=staticCastCatalog(source),s=C.locate(c,'sc-q925-a1').scene,a=s.actors[0],before=structuredClone(a),other=structuredClone(C.locate(c,'sc-q925-a2').scene);
 a.cutout={source:a.poses.idle,mask:ref(1),mirror:ref(2)};const n=C.normalize(c),saved=C.locate(n,s.id).scene.actors[0];assert.deepEqual({...saved,cutout:undefined},{...before,cutout:undefined});assert.deepEqual(C.locate(n,'sc-q925-a2').scene,other);
 assert.ok(C.assets(s).includes(ref(1)));assert.ok(C.playbackAssets(s).includes(ref(2)));assert.equal(C.cutoutStyle(a).maskImage,`url("${ref(1)}")`);assert.equal(C.cutoutStyle({...a,facing:'left'}).maskImage,`url("${ref(2)}")`);
 a.poses.idle=ref(3);assert.equal(C.cutoutStyle(a).maskImage,'');assert.equal(C.locate(C.normalize(c),s.id).scene.actors[0].cutout,undefined);
 a.cutout={source:a.poses.idle,mask:'https://invalid.example/mask.png',mirror:ref(2)};assert.throws(()=>C.normalize(c));
});
test('backend save/export/import carries both mask orientations with the unchanged original asset',async()=>{
 const {SceneStore}=await import('../backend/scene-store.mjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'jinmen-cutout-'));
 try{const store=new SceneStore(path.join(dir,'one/scenes.json')),asset=store.upload(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=','base64'),'image/png').url,c=C.normalize(C.seed()),s=c.maps[1].scenes[0],a=s.actors[0];a.poses.idle=asset;a.cutout={source:asset,mask:asset,mirror:asset};store.save(c,0);const bundle=store.export(),dest=new SceneStore(path.join(dir,'two/scenes.json'));dest.import(bundle,0);assert.deepEqual(dest.get().catalog.maps[1].scenes[0].actors[0].cutout,a.cutout);assert.ok(bundle.assets[asset]);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('the cutout covers the entire animated art layer while labels and speech stay independent',async()=>{
 const catalog=staticCastCatalog(source),s=C.locate(catalog,'sc-q925-a1').scene,a=s.actors[0];a.cutout={source:a.poses.idle,mask:ref(1),mirror:ref(2)};a.facing='left';
 const f=stage({sceneCatalog:catalog});await new Promise(r=>setImmediate(r));f.command('scene-take',{sceneId:s.id,revision:0});await new Promise(r=>setImmediate(r));f.tick(1000);f.tick(1000);
 assert.equal(f.elements.get('actors').children[0].querySelector('.art').style.maskImage,`url("${ref(2)}")`);assert.equal(f.elements.get('labels').children[0].style.maskImage,undefined);assert.equal(f.calls.length,0);
});
test('actor editing exposes independent erase controls without intercepting drag or bubble controls',async()=>{
 const f=await editor('A1',{dynamic:true,staticCast:true});assert.ok(f.document.querySelector('[aria-label="梁启超擦除或裁剪人物"]'));assert.ok(f.document.querySelector('.scene-resize-handle'));assert.ok(f.control('tailMode'));assert.equal(f.record().revision,1);
});
test('in-scene erasing keeps draft backdrop, neighboring figures and geometry, without mutating the editor',async()=>{
 const f=await editor('A1',{dynamic:true,staticCast:true}),preview=f.$('scene-preview'),original=preview.innerHTML;
 const target=preview.querySelector('.scene-preview-person[data-edit-target="actor:0"]');target.style.maskImage='url("old-mask")';
 const targetImage=target.querySelector('img');targetImage.style.transform='scaleX(-1)';targetImage.style.clipPath='polygon(10% 0%,90% 0%,90% 100%)';targetImage.style.maskImage='url("body-mask")';
 const canvas=f.document.createElement('canvas'),context=Cut.sceneContext(preview,0,canvas),selected=context.querySelector('.actor-cutout-target');
 assert.ok(context.querySelector('.scene-preview-bg'));assert.equal(context.querySelector('.scene-preview-bg').src,preview.querySelector('.scene-preview-bg').src);
 assert.equal(context.querySelectorAll('.scene-preview-person').length,preview.querySelectorAll('.scene-preview-person').length);
 for(const key of ['left','top','width','height','zIndex'])assert.equal(selected.style[key],target.style[key]);
 assert.equal(canvas.style.transform,'scaleX(-1)');assert.equal(canvas.style.clipPath,targetImage.style.clipPath);assert.equal(canvas.style.maskImage,targetImage.style.maskImage);
 assert.equal(selected.firstElementChild,canvas);assert.equal(selected.style.maskImage,'none');assert.equal(target.style.maskImage,'url("old-mask")');
 assert.equal(context.querySelectorAll('[id],[data-edit-target],.scene-selection-frame,jmf-dialogue-layer').length,0);
 assert.ok(preview.querySelector('.scene-selection-frame'));assert.ok(target.querySelector('img'));assert.equal(f.record().revision,1);
 assert.ok(original.includes('scene-preview-bg'));
});
