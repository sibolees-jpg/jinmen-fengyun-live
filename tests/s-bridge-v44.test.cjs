const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const pack=require('../integration/scene-block/scenes.json'),s=pack.scenes.S1;
const previous=JSON.parse(cp.execFileSync('git',['show','official-20260926:integration/scene-block/scenes.json']));
test('S1 alone is split; actors, camera, placement and all other scenes retain their accepted values',()=>{
 for(const [code,scene] of Object.entries(pack.scenes))if(code!=='S1')assert.deepEqual(scene,previous.scenes[code]);
 for(const key of ['actors','plane','objectCamera','backgroundAspect'])assert.deepEqual(s[key],previous.scenes.S1[key]);
 assert.notEqual(s.background,previous.scenes.S1.background);assert.equal(s.objects.length,2);
 const [back,front]=s.objects;assert.equal(back.renderOrder,'rear');assert.equal(front.renderOrder,'front');assert.equal(front.id,previous.scenes.S1.objects[0].id);
 for(const o of s.objects){for(const k of ['x','y','width','height'])assert.equal(o[k],previous.scenes.S1.objects[0][k]);assert.ok(o.clip.length>=3);assert.ok(o.clip.flat().every(n=>Number.isFinite(n)&&n>=0&&n<=100));assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',o.image)));}
 assert.notEqual(back.image,s.background);assert.notEqual(front.image,s.background);
});
test('rear rail is behind people and front rail ahead regardless of perspective feet; masks are passed intact',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../integration/scene-block/plane-renderer.js'),'utf8'),ctx);ctx.BoatMotion={animatedObject:()=>false};ctx.SceneObjects={geometry:o=>({x:0,y:0,width:1600,height:900,foot:900,object:o})};ctx.isTextSpeaking=()=>false;ctx.speechMouthOpen=()=>false;
 const v=Object.create(ctx.PlaneView.prototype);Object.assign(v,{scene:s,projection:{w:1600,h:900,cell:10,actor:a=>[100,500,1]},sim:{actors:[{id:'stage_0',settings:{size:1},breath:0}],time:0},native:new Map([['stage_0',{slot:s.actors[0]}]]),water:{quads:()=>[]},boats:{quads:()=>[]},traffic:{quads:()=>[]},hostTime:0,speakerState:()=>null,nativeGeometry:()=>({x:10,y:20,width:30,height:40})});
 const q=v.drawables();assert.equal(q.length,3);assert.deepEqual(q[0].clip,s.objects[0].clip);assert.deepEqual(q[1].clip,s.objects[1].clip);
 assert.ok(q[0].order<q[2].foot);assert.ok(q[2].foot<q[1].order);assert.equal(q[2].x,10);assert.equal(q[2].width,30);
});
test('ordinary scenery retains existing depth and unmasked behavior',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../integration/scene-block/plane-renderer.js'),'utf8'),ctx);ctx.BoatMotion={animatedObject:()=>false};ctx.SceneObjects={geometry:o=>({foot:700,object:o})};
 const v=Object.create(ctx.PlaneView.prototype);Object.assign(v,{scene:previous.scenes.S1,projection:{w:1600,h:900},sim:{actors:[]},native:new Map(),water:{quads:()=>[]},boats:{quads:()=>[]},traffic:{quads:()=>[]},hostTime:0});const q=v.drawables()[0];assert.equal(q.order,undefined);assert.equal(q.foot,700);assert.equal(q.clip.length,0);
});
