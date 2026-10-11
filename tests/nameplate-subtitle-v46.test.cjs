const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const L=require('../stage-layout.js'),{stage}=require('./helpers/stage-fixture.cjs');
const box=(id,left,top)=>({id,left,top,width:24,height:60,side:'right',ownerX:left-2,ownerY:top+60});
const subtitle={left:200,top:650,width:600,height:40};
test('only covered nameplates lift above the actual subtitle, preserving owner, size and horizontal placement',()=>{
 const original=[box(0,300,610),box(1,80,610),box(2,600,570)],before=structuredClone(original);
 const result=L.avoidNameplateSubtitle(original,subtitle);
 assert.equal(result[0].top,582);assert.deepEqual({...result[0],top:610},original[0]);
 assert.strictEqual(result[1],original[1]);assert.strictEqual(result[2],original[2]);assert.deepEqual(original,before);
 assert.strictEqual(L.avoidNameplateSubtitle(original,null),original);
 assert.strictEqual(L.avoidNameplateSubtitle(original,{left:900,top:650,width:100,height:40}),original);
});
test('lifting a covered seal leaves unaffected labels still and avoids landing on them',()=>{
 const original=[box(0,300,620),box(1,300,555),box(2,330,620)];
 const result=L.avoidNameplateSubtitle(original,subtitle,{bounds:{top:0}});
 assert.strictEqual(result[1],original[1]);assert.ok(result[0].top+result[0].height<=result[1].top-8);
 assert.equal(result[2].top,582);assert.ok(result.every(b=>b.top>=2));
});
test('subtitle rectangle handles scaled and offset 16:9 previews and ignores empty or hidden captions',()=>{
 const caption={textContent:'这是字幕。',getBoundingClientRect:()=>({left:140,top:375,width:300,height:20})},host={getBoundingClientRect:()=>({left:40,top:50,width:640,height:360})};
 assert.deepEqual(L.audienceSubtitleBounds(caption,host,1280,720),{left:200,top:650,width:600,height:40});
 caption.textContent='';assert.equal(L.audienceSubtitleBounds(caption,host,1280,720),null);
 caption.textContent='字幕';caption.hidden=true;assert.equal(L.audienceSubtitleBounds(caption,host,1280,720),null);
});
test('stage rendering tracks changed subtitle height and restores names without changing actor placement',()=>{
 const f=stage({width:1280,height:720}),caption=f.elements.get('live-caption'),host=f.elements.get('stage');
 host.getBoundingClientRect=()=>({left:40,top:50,width:640,height:360});
 let top=375;caption.getBoundingClientRect=()=>({left:140,top,width:300,height:20});
 vm.runInContext("placeNameplates=()=>[{id:0,left:300,top:610,width:24,height:60,side:'right'},{id:1,left:80,top:610,width:24,height:60,side:'left'}]",f.context);
 f.tick();const before=vm.runInContext('actorNodes.map(n=>n.style.transform)',f.context);
 caption.textContent='这是原稿字幕。';f.tick();
 assert.equal(vm.runInContext('labelNodes[0].style.top',f.context),'582px');
 assert.equal(vm.runInContext('labelNodes[1].style.top',f.context),'610px');
 top=365;f.tick();assert.equal(vm.runInContext('labelNodes[0].style.top',f.context),'562px');
 assert.deepEqual(vm.runInContext('actorNodes.map(n=>n.style.transform)',f.context),before);
 caption.textContent='';f.tick();assert.equal(vm.runInContext('labelNodes[0].style.top',f.context),'610px');
});
