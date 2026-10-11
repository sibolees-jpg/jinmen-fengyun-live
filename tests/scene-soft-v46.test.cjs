const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom'),Playback=require('../scene-playback.js'),C=require('../scene-catalog.js');
const catalog=require('../scripts/static-cast-catalog.cjs').staticCastCatalog(require('../show/scenes.json').catalog);
test('whole-scene dissolve snapshots visual layers together, excludes replies/controls and cleans rapid cuts',async()=>{
 const {document}=parseHTML('<main><div class="scenery"><div class="print-background"></div></div><div id="actors"><div class="actor"><img src="/person.png"></div></div><div id="labels"><b class="nameplate">名字</b></div><div id="bubbles">旧接话</div><div id="live-caption">字幕</div><button>按钮</button></main>');
 const host=document.querySelector('main'),d=new Playback.Dissolve(host,{reduced:()=>false});assert.equal(d.capture(),true);assert.ok(d.overlay.querySelector('.actor'));assert.ok(d.overlay.querySelector('.print-background'));assert.ok(d.overlay.querySelector('.nameplate'));assert.equal(d.overlay.querySelector('[id]'),null);assert.ok(!d.overlay.textContent.includes('旧接话'));let resolve,cancelled=0;
 d.overlay.animate=(_frames,options)=>{assert.equal(options.duration,550);return {finished:new Promise(r=>resolve=r),cancel:()=>cancelled++};};d.reveal();const old=d.overlay;d.capture();assert.equal(cancelled,1);assert.equal(host.querySelectorAll('.scene-dissolve').length,1);resolve();await Promise.resolve();assert.notEqual(d.overlay,old);d.clear();assert.equal(host.querySelectorAll('.scene-dissolve').length,0);
 const reduced=new Playback.Dissolve(host,{reduced:()=>true});assert.equal(reduced.capture(),false);
});
test('static actors have no separate entry delay while saved scene settings stay editable',()=>{const scene=C.locate(catalog,'sc-q925-a2').scene;scene.actors[0].entry='fade';const view=C.visualScene(scene);assert.equal(view.actors[0].entry,'cut');assert.equal(scene.actors[0].entry,'fade');});
test('adjacent scenes reuse identical decoded character art but retain their independent actor configuration',()=>{
 const vm=require('node:vm'),{stage}=require('./helpers/stage-fixture.cjs'),f=stage(),scene=structuredClone(C.locate(catalog,'sc-q925-a2').scene);
 scene.actors.forEach(a=>{a.animation=null;a.motion={enabled:true,stationary:true};});
 let created=0,destroyed=0;const players=[];
 f.context.ActorPetPlayer=class{constructor(_art,actor){created++;this.actor=actor;players.push(this);}destroy(){destroyed++;}drawState(){}};
 f.context.firstScene=scene;vm.runInContext('applyScenery(firstScene)',f.context);const initial=created;assert.ok(initial>0);
 const next=structuredClone(scene);next.id='sc-test-next';next.actors[0].x+=7;next.actors[0].scale*=1.2;
 f.context.nextScene=next;vm.runInContext('applyScenery(nextScene)',f.context);
 assert.equal(created,initial);assert.equal(destroyed,0);assert.equal(players.find(p=>p.actor.id===0).actor.x,next.actors[0].x);
 assert.equal(players.find(p=>p.actor.id===0).actor.scale,next.actors[0].scale);
 next.actors[0].facing=next.actors[0].facing==='left'?'right':'left';vm.runInContext('applyScenery(nextScene)',f.context);
 assert.equal(created,initial+1);assert.equal(destroyed,1);
});
