const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../scene-catalog.js'),D=require('../dialogue-overlay.js');
const {editor}=require('./helpers/bubble-editor-fixture.cjs');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('all character resize corners exceed the old maximum, retain opposite anchors and round-trip offstage',()=>{
 for(const corner of ['nw','ne','sw','se']){
  const catalog=C.normalize(C.seed()),s=catalog.maps[1].scenes[0],a=s.actors[0];Object.assign(a,{x:-420,y:680,scale:3});
  const b=C.placementBounds(s,'actor:0'),next=C.resizePlacement(s,'actor:0',a,corner,(corner.includes('e')?1:-1)*b.width*3,(corner.includes('s')?1:-1)*b.height*3);
  close(next.scale,12);Object.assign(a,next);const n=C.placementBounds(s,'actor:0');
  close(n.left+(corner.includes('w')?n.width:0),b.left+(corner.includes('w')?b.width:0));close(n.top+(corner.includes('n')?n.height:0),b.top+(corner.includes('n')?b.height:0));
  assert.deepEqual(C.normalize(catalog).maps[1].scenes[0].actors[0],a);
 }
});
test('large free bubbles scale text and box proportionally without being pushed inside the canvas',()=>{
 for(const sharedChorus of [false,true]){
  const rect={left:0,top:0,width:1280,height:720},make=scale=>D.fitFree([D.decorate({id:0,x:500,y:600,text:'这是同一段完整的接话，放大后原来的全文和换列必须保留。',sharedChorus},{scale,manual:true,x:-140,y:250,writingMode:sharedChorus?'horizontal':'vertical'},rect)],rect);
  const a=make(1),b=make(8);close(b.boxes[0].width,a.boxes[0].width*8);close(b.boxes[0].height,a.boxes[0].height*8);close(b.cards[0].layout.fontSize,a.cards[0].layout.fontSize*8);
  close(b.boxes[0].left,-1792);close(b.boxes[0].top,1800);assert.deepEqual(b.cards[0].layout.columns,a.cards[0].layout.columns);
 }
});
test('editor numeric sizes and corner drags exceed old limits, save and reopen, without changing other scenes',async()=>{
 const f=await editor('A1',{staticCast:true,dynamic:true}),before=structuredClone(f.record().catalog),target=f.$('scene-edit-target');target.value='actor:0';target.onchange();
 const input=f.document.querySelector('[data-placement-target="actor:0"][data-placement-key="scale"]');assert.equal(input.hasAttribute('max'),false);input.value='8';input.oninput();
 f.control('scale').value='4';f.control('scale').oninput();assert.equal(f.control('scale').hasAttribute('max'),false);
 const preview=f.$('scene-preview'),frame=preview.querySelector('.bubble-edit-frame'),pointer=(node,type,x,y)=>{const e=new f.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:x,clientY:y});node.dispatchEvent(e);};
 pointer(frame.querySelector('.bubble-edit-resize'),'pointerdown',100,100);pointer(frame,'pointermove',600,600);pointer(frame,'pointerup',600,600);assert.ok(Number(f.control('scale').value)>4);
 const bubbleScale=Number(f.control('scale').value);await f.$('scene-save').onclick();assert.equal(C.locate(f.record().catalog,'sc-q925-a1').scene.actors[0].scale,8);f.open();assert.equal(Number(f.control('scale').value),bubbleScale);
 assert.deepEqual(C.locate(f.record().catalog,'sc-q925-a2').scene,C.locate(before,'sc-q925-a2').scene);assert.deepEqual(f.sent.map(s=>s[0]),['scene-reload']);
});

test('current live dialogue protocol still enables the T2 take button',async()=>{
 const f=await editor('T2',{staticCast:true,dynamic:true});assert.equal(f.$('scene-take').disabled,false);f.$('scene-close').click();f.$('scene-take').onclick();assert.equal(f.sent.at(-1)[0],'scene-take');assert.equal(f.sent.at(-1)[1].sceneId,'sc-q925-t2');
});
