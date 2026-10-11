const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),A=require('../actor-animation.js'),C=require('../scene-catalog.js');
const ref=n=>'/api/scene-assets/'+String(n).padStart(64,'0')+'.png';
const pack=()=>A.normalize({version:1,width:1400,height:2000,anchor:[.5,.95],bounds:[.2,.1,.8,.96],base:ref(1),clips:{idle:[ref(1)],talk:[ref(2)],breath:[ref(3)]}});
test('renderer falls back while decoding, uses authored speaking frames and stops after destruction',()=>{
 const classes=new Set(),draws=[],pending=[],container={append(){},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}};
 const context={clearRect(){},save(){},restore(){},translate(){},scale(){},drawImage:img=>draws.push(img)};
 const scope={ActorAnimation:A,document:{createElement:()=>({setAttribute(){},getContext:()=>context,remove(){}})}};scope.globalThis=scope;vm.runInNewContext(fs.readFileSync(require.resolve('../actor-animation-player.js'),'utf8'),scope);
 const actor={id:0,poses:{idle:ref(1)},animation:pack(),facing:'right'},player=new scope.ActorAnimationPlayer(container,actor,{imageFactory:()=>{const im={naturalWidth:1400,naturalHeight:2000};pending.push(im);return im;}});
 player.drawState({phase:'idle'},100);assert.equal(classes.has('has-actor-sequence'),false);pending.forEach(im=>im.onload());player.drawState({phase:'idle'},100);assert.ok(classes.has('has-actor-sequence'));
 player.drawState({phase:'speaking'},100);assert.equal(pending.at(-1).src,ref(2));pending.at(-1).onload();player.drawState({phase:'speaking'},100);const before=draws.length;player.destroy();player.drawState({phase:'speaking'},100);assert.equal(draws.length,before);assert.equal(classes.has('has-actor-sequence'),false);
});
test('applying an animation clears the old mask and stale posture slots without moving its feet or touching other actors',()=>{
 const scope={ActorAnimation:A};scope.globalThis=scope;vm.runInNewContext(fs.readFileSync(require.resolve('../actor-animation-director.js'),'utf8'),scope);
 const scene=C.normalize(C.seed()).maps[1].scenes[0],actor=scene.actors[1],other=JSON.stringify(scene.actors[0]);Object.assign(actor,{aspect:2/3,contentBounds:[.1,.05,.9,.95],personMask:ref(9),bodyClip:[[1,1],[90,1],[50,90]]});const anchor=C.actorAnchor(actor,scene.backgroundAspect),p=pack();scope.ActorAnimationImport.apply(actor,scene,{name:'新站姿',idle:p.base,width:p.width,height:p.height,bounds:p.bounds,animation:p},C);const after=C.actorAnchor(actor,scene.backgroundAspect);
 for(const k of ['x','y','height'])assert.ok(Math.abs(anchor[k]-after[k])<1e-8,k);assert.ok(Array.isArray(actor.bodyClip));assert.equal(actor.bodyClip.length,0);assert.equal(actor.personMask,'');assert.equal(actor.motion.stationary,true);assert.equal(JSON.stringify(scene.actors[0]),other);
});
test('optional animation frames never gate a scene cut, while the static base remains required',async()=>{
 const scope={SceneCatalog:C};scope.globalThis=scope;vm.runInNewContext(fs.readFileSync(require.resolve('../scene-playback.js'),'utf8'),scope);
 const catalog=C.normalize(C.seed()),scene=catalog.maps[0].scenes[0],actor=scene.actors[0],p=pack();actor.poses.idle=p.base;actor.animation=p;actor.present=true;
 const loaded=[],commits=[],record={revision:0,catalog};
 const player=new scope.ScenePlayback({load:async()=>record,preload:async src=>{loaded.push(src);if(src===ref(2)||src===ref(3))throw Error('optional frame unavailable');},commit:s=>commits.push(s.id),busy:()=>false});
 await player.prepare(record);assert.equal(player.cut(scene.id),true);await player.take(scene.id,0);
 assert.equal(commits.length,2);assert.ok(loaded.includes(p.base));assert.ok(!loaded.includes(ref(2)));assert.ok(!loaded.includes(ref(3)));assert.ok(C.assets(scene).includes(ref(3)));
 player.preload=async src=>{if(src===p.base)throw Error('base unavailable');};await player.prepare(record);assert.equal(player.cut(scene.id),false);assert.equal(commits.length,2);
});
test('fixed-position defaults override legacy side entrances, with explicit movement still available',()=>{
 const {stage}=require('./helpers/stage-fixture.cjs'),f=stage();
 assert.equal(vm.runInContext("activeScenery={actors:[{entry:'left'}]};sceneActorX(0,500,{left:0,width:1200},0)",f.context),500);
 assert.equal(vm.runInContext("activeScenery.actors[0].motion={stationary:false};sceneActorX(0,500,{left:0,width:1200},0)",f.context),-160);
});
test('folder import rejects mixed pose folders before any image upload',async()=>{
 const scope={ActorAnimation:A};scope.globalThis=scope;vm.runInNewContext(fs.readFileSync(require.resolve('../actor-animation-director.js'),'utf8'),scope);
 let uploads=0;await assert.rejects(()=>scope.ActorAnimationImport.importFolder([{name:'李鸿章_向右站立_睁眼闭嘴.png'},{name:'李鸿章_向右站立_睁眼闭嘴.png'}],'李鸿章',()=>{uploads++;}),/一套姿势/);assert.equal(uploads,0);
});
