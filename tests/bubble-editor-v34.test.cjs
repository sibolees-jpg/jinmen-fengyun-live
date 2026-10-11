const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {parseHTML}=require('linkedom'),D=require('../dialogue-overlay.js'),C=require('../scene-catalog.js'),Caption=require('../caption-layout.js'),L=require('../stage-layout.js');
const script=require('../show/script.json').script;
test('bubble settings round-trip independently, reject invalid sizes/colors, and never change script or cast geometry',()=>{
 const catalog=C.normalize(require('../show/scenes.json').catalog),before=structuredClone(catalog),a=catalog.maps[1].scenes[0].actors[0];
 a.bubble=D.normalize({scale:1.3,manual:true,x:28,y:12,fill:'#ffffff',font:'song',radius:8});const saved=C.normalize(catalog);
 assert.deepEqual(saved.maps[1].scenes[0].actors[0].bubble,a.bubble);assert.deepEqual(saved.maps[1].scenes[1],before.maps[1].scenes[1]);
 assert.deepEqual({...saved.maps[1].scenes[0].actors[0],bubble:before.maps[1].scenes[0].actors[0].bubble},before.maps[1].scenes[0].actors[0]);
 for(const config of [{scale:0},{scale:Infinity},{x:NaN},{fill:'url(https://x)'},{borderWidth:100}])assert.throws(()=>D.normalize(config));
});
function overlay(){const {document}=parseHTML('<html><body><div id="host" style="position:relative"><button>同事的按钮</button></div></body></html>');const host=document.getElementById('host'),events=[];return {document,host,events,layer:D.mount(host,{Caption,place:L.placeBubbles,onVisible:e=>events.push(e)})};}
test('independent shadow layer does not alter host, leak global styles or capture mouse, and cleans up',()=>{
 const f=overlay(),before=f.host.firstElementChild,style=f.host.getAttribute('style'),items=[{id:1,key:'turn1',message:'turn1',x:700,y:540,text:'这是同一段完整人物台词。',config:{fill:'#ffffff'}}];
 const result=f.layer.update({items,width:1280,height:720,now:0});assert.equal(result.boxes.length,1);
 const shadow=f.layer.element.shadowRoot,b=shadow.querySelector('.bubble');assert.equal(f.host.firstElementChild,before);assert.equal(f.host.getAttribute('style'),style);assert.equal(f.document.querySelectorAll('.bubble').length,0);assert.match(shadow.querySelector('style').textContent,/pointer-events:none/);assert.equal(b.style.background,'#ffffff');assert.equal(b.style.borderRadius,'4px');assert.equal(b.dataset.pages,'1');
 f.layer.update({items,width:1280,height:720,now:500});assert.equal(f.events.length,1,'stable cue identity cannot acknowledge twice');
 f.layer.update({items:[],width:1280,height:720,now:1000});assert.equal(b.getAttribute('aria-hidden'),'true');assert.equal(b.querySelector('.bubble-text').textContent.replace(/\s/g,''),'这是同一段完整人物台词。');
 f.layer.destroy();assert.equal(f.host.children.length,1);assert.throws(()=>f.layer.update({width:1280,height:720}));
});
test('manual placement is honored when free, but offstage/overlapping presets still show complete readable replies',()=>{
 const f=overlay(),base={id:1,key:'one',message:'one',x:800,y:550,text:'手动气泡的位置仍然必须保证全文可见。'};
 let r=f.layer.update({items:[{...base,config:{manual:true,x:30,y:10}}],width:1280,height:720});assert.equal(r.boxes[0].left,384);assert.equal(r.boxes[0].top,72);
 r=f.layer.update({items:[{...base,config:{manual:true,x:99,y:99,scale:1.5}},{...base,id:2,key:'two',message:'two',x:500,config:{manual:true,x:99,y:99}}],width:1280,height:720});assert.equal(r.boxes.length,2);for(const b of r.boxes){assert.ok(b.left+b.width<=1280);assert.ok(b.top+b.height<=640);}
 assert.ok(Math.abs(r.boxes[0].top-r.boxes[1].top)>=20);for(const c of r.cards)assert.equal(c.layout.columns.join('').replace(/\s/g,''),base.text.replace(/\s/gu,''));
});
test('bundle is self-contained and preserves colleague global names',()=>{
 const sentinel=()=>{},scope={placeBubbles:sentinel,CaptionLayout:{colleague:true},DialogueOverlay:{colleague:true}};scope.globalThis=scope;
 vm.runInNewContext(fs.readFileSync(require.resolve('../integration/dialogue-overlay.bundle.js'),'utf8'),scope);
 assert.equal(scope.placeBubbles,sentinel);assert.equal(scope.CaptionLayout.colleague,true);assert.equal(scope.DialogueOverlay.colleague,true);assert.equal(scope.JinmenDialogue.VERSION,1);
 const {document}=parseHTML('<div id="host"></div>'),layer=scope.JinmenDialogue.mount(document.getElementById('host'));assert.equal(layer.update({width:1280,height:720,items:[{id:'a',key:'turn',x:600,y:500,text:'完整台词'}]}).boxes.length,1);layer.destroy();
});
const {editor}=require('./helpers/bubble-editor-fixture.cjs');

const firstA1Index=script.blocks[1].sentences.findIndex(s=>s.replies.length),firstA1Reply=script.blocks[1].sentences[firstA1Index].replies[0];
test('director preview shows real manuscript bubbles; appearance saves to just one actor and cancelling rolls back',async()=>{
 const f=await editor(),before=structuredClone(f.record().catalog),preview=f.$('scene-preview'),b=preview.querySelector('jmf-dialogue-layer').shadowRoot.querySelector(`.bubble[data-actor="${firstA1Reply.actor}"]`);assert.ok(b);assert.equal(b.dataset.text,firstA1Reply.text);
 f.control('scale').value='1.25';f.control('scale').oninput();f.control('fill').value='#ffffff';f.control('fill').oninput();assert.equal(f.record().revision,1);await f.$('scene-save').onclick();
 assert.equal(f.record().catalog.maps[1].scenes[0].actors[firstA1Reply.actor].bubble.scale,1.25);assert.equal(f.record().catalog.maps[1].scenes[0].actors[firstA1Reply.actor].bubble.fill,'#ffffff');assert.deepEqual(f.record().catalog.maps[1].scenes[1],before.maps[1].scenes[1]);assert.deepEqual(f.sent.map(a=>a[0]),['scene-reload']);
 f.open();assert.equal(Number(f.control('scale').value),1.25);f.control('scale').value='1.5';f.control('scale').oninput();f.$('scene-close').click();f.open();assert.equal(Number(f.control('scale').value),1.25);f.control('text').click();assert.deepEqual(f.edits,[1]);assert.equal(f.sent.length,1,'editor never takes a scene or microphone');
});
test('drag/resize bubble changes only its visual preference, supports pointer cancel, and keeps entire turn',async()=>{
 const f=await editor(),initial=structuredClone(f.record().catalog.maps[1].scenes[0].actors[firstA1Reply.actor]),preview=f.$('scene-preview');
 const pointer=(target,type,x,y)=>{const e=new f.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:x,clientY:y});target.dispatchEvent(e);};
 let frame=preview.querySelector('.bubble-edit-frame');pointer(frame,'pointerdown',100,80);pointer(frame,'pointermove',120,65);pointer(frame,'pointerup',120,65);
 assert.ok(Number(f.control('x').value)>0);assert.match(f.control('note').textContent,/手调位置/);
 frame=preview.querySelector('.bubble-edit-frame');pointer(frame.querySelector('button'),'pointerdown',200,200);pointer(frame,'pointermove',210,215);pointer(frame,'pointerup',210,215);assert.ok(Number(f.control('scale').value)>1);
 const scale=f.control('scale').value;pointer(frame.querySelector('button'),'pointerdown',200,200);pointer(frame,'pointermove',240,240);pointer(frame,'pointercancel',240,240);assert.equal(f.control('scale').value,scale);
 await f.$('scene-save').onclick();const edited=f.record().catalog.maps[1].scenes[0].actors[firstA1Reply.actor];assert.deepEqual({...edited,bubble:initial.bubble},initial);assert.equal(edited.bubble.manual,true);
});
test('current stage uses saved appearance and reports the visible cue without changing speech timing rules',async()=>{
 const {stage}=require('./helpers/stage-fixture.cjs'),catalog=C.normalize(require('../show/scenes.json').catalog);catalog.maps[1].scenes[0].actors[firstA1Reply.actor].bubble=D.normalize({scale:1.3,fill:'#ffffff',ink:'#442211'});catalog.maps[1].scenes[0].actors[firstA1Reply.actor].bubbleCues={}; // This case checks the role default; real cue overrides are tested separately.
 const f=stage({width:1280,height:720,sceneCatalog:catalog});await new Promise(r=>setImmediate(r));f.command('speech-script',{script});f.command('rehearsal-cue',{index:1,sentenceIndex:firstA1Index});await new Promise(r=>setImmediate(r));for(let i=0;i<35;i++)f.tick(100);
 const b=f.elements.get('bubbles').children[firstA1Reply.actor];assert.equal(b.style.background,'#ffffff');assert.equal(b.style.borderRadius,'5.2px');assert.equal(b.querySelector('.bubble-text').style.color,'#442211');assert.equal(b.dataset.text,firstA1Reply.text);assert.ok(f.posted.at(-1).cueEvents.some(e=>e.type==='cue-visible'));f.command('clear');
});
test('tail root and target drag independently of bubble/cast, cancel restores, and scene save retains both',async()=>{
 const f=await editor(),preview=f.$('scene-preview'),before=structuredClone(f.record().catalog.maps[1].scenes[0].actors[firstA1Reply.actor]);
 const pointer=(target,type,x,y)=>{const e=new f.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:9,button:0,clientX:x,clientY:y});target.dispatchEvent(e);};
 const frame=preview.querySelector('.bubble-edit-frame');pointer(frame.querySelector('.bubble-tail-base-handle'),'pointerdown',200,200);pointer(frame,'pointermove',180,200);pointer(frame,'pointerup',180,200);assert.ok(Number(f.control('tailBase').value)<100);
 pointer(frame.querySelector('.bubble-tail-tip-handle'),'pointerdown',200,200);pointer(frame,'pointermove',210,190);pointer(frame,'pointerup',210,190);assert.ok(Number(f.control('tailLength').value)>0);assert.ok(Number.isFinite(Number(f.control('tailAngle').value)));
 const x=f.control('tailAngle').value;pointer(frame.querySelector('.bubble-tail-tip-handle'),'pointerdown',200,200);pointer(frame,'pointermove',240,190);pointer(frame,'pointercancel',240,190);assert.equal(f.control('tailAngle').value,x);
 f.control('tailWidth').value='9';f.control('tailWidth').oninput();f.control('tailLength').value='22';f.control('tailLength').oninput();await f.$('scene-save').onclick();
 const a=f.record().catalog.maps[1].scenes[0].actors[firstA1Reply.actor];assert.equal(a.bubble.tailWidth,9);assert.equal(a.bubble.tailLength,22);assert.equal(a.bubble.manual,false,'tail edits do not pin the body');assert.deepEqual({...a,bubble:before.bubble},before);
 f.open();f.control('tailReset').click();assert.equal(Number(f.control('tailOffsetX').value),0);assert.equal(Number(f.control('tailOffsetY').value),0);
});
test('width reflow preserves every word and customized tail shares the outline while following its actor',()=>{
 const f=overlay(),text='这是一整段需要在同一框中完整呈现的台词，改变宽窄只改变分列方式，绝不能裁字或者切为两段。'.repeat(2),item={id:1,key:'shape',text,x:900,y:570,config:{tailMode:'manual',widthScale:1,tailBase:40,tailWidth:10,tailLength:24,tailOffsetX:2,tailOffsetY:-1}};
 const a=f.layer.update({items:[item],width:1280,height:720}),b=f.layer.update({items:[{...item,config:{...item.config,widthScale:2}}],width:1280,height:720});assert.ok(b.cards[0].layout.rows<a.cards[0].layout.rows);for(const c of [a.cards[0],b.cards[0]])assert.equal(c.layout.columns.join('').replace(/\s/gu,''),text.replace(/\s/gu,''));
 const box=b.boxes[0],t=box.tail;assert.ok(Math.abs(Math.hypot(t.handleTip.x-t.handleBase.x,t.handleTip.y-t.handleBase.y)-24*1.15)<1e-6);assert.ok(Math.abs(Math.hypot(t.notch[2][0]-t.notch[0][0],t.notch[2][1]-t.notch[0][1])-10*1.15)<1e-6);assert.deepEqual(t.connector,[]);assert.deepEqual(t.points,[]);
 const node=f.layer.element.shadowRoot.querySelector('.bubble');assert.equal(node.querySelector('.bubble-seam').style.stroke,node.style.background);assert.equal(node.querySelector('.bubble-connector').style.display,'none');assert.equal(node.querySelector('.bubble-tail>path:first-child').style.display,'none');assert.equal(node.querySelector('.bubble-notch').style.fill,node.style.background);
});

test('composite editor previews only the whole image plus editable bubbles and can restore original independent assets',async()=>{
 const f=await editor('L1'),scene=()=>C.locate(f.record().catalog,'sc-q925-l1').scene,before=structuredClone(scene());
 assert.equal(f.$('scene-preview').querySelectorAll('.scene-preview-person').length,0);
 assert.equal(f.$('scene-preview').querySelector('.scene-preview-bg').src,before.composition.image);
 assert.ok(f.$('scene-preview').querySelector('jmf-dialogue-layer').shadowRoot.querySelector('.bubble'));
 assert.equal(f.$('scene-edit-target').disabled,true);f.control('fill').value='#ffffff';f.control('fill').oninput();await f.$('scene-save').onclick();
 assert.equal(scene().actors[6].bubble.fill,'#ffffff');assert.deepEqual(scene().composition,before.composition);assert.deepEqual(scene().actors[6].poses,before.actors[6].poses);
 f.open();[...f.$('scene-visual-slots').querySelectorAll('button')].find(b=>b.textContent==='恢复原独立素材编辑').click();
 assert.ok(f.$('scene-preview').querySelectorAll('.scene-preview-person').length>0);assert.equal(f.$('scene-preview').querySelector('.scene-preview-bg').src,before.background);
 await f.$('scene-save').onclick();assert.equal(scene().composition.enabled,false);assert.equal(scene().composition.image,before.composition.image);
});

test('T2 previews live text without inheriting T1 chorus and saves only its own bubble style',async()=>{
 const f=await editor('T2'),before=structuredClone(f.record().catalog.maps.at(-1).scenes[0]);
 assert.match(f.control('group').textContent,/临场接话/);assert.match(f.$('scene-preview').querySelector('jmf-dialogue-layer').shadowRoot.querySelector('.bubble').dataset.text,/现场生成/);assert.equal(f.control('text').disabled,true);
 f.control('scale').value='1.2';f.control('scale').oninput();await f.$('scene-save').onclick();assert.equal(f.record().catalog.maps.at(-1).scenes[1].actors[0].bubble.scale,1.2);assert.deepEqual(f.record().catalog.maps.at(-1).scenes[0],before);
});
