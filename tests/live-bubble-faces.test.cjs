const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const D=require('../dialogue-overlay.js'),L=require('../stage-layout.js');
const catalog=require('../show/scenes.json').catalog;
const {stage}=require('./helpers/stage-fixture.cjs');
const overlap=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;

test('live placement moves a pinned bubble off a neighbouring face, keeping its tail on the speaker',()=>{
 const rect={left:0,top:0,width:1280,height:720},faces=[{actorId:0,left:590,top:290,width:100,height:90},{actorId:1,left:360,top:180,width:110,height:100}];
 const item=D.decorate({id:0,x:640,y:300,text:'把气泡放在旁边，大家的表情才能看清楚。',message:{}},D.normalize({manual:true,x:29,y:25,tailMode:'point',tailX:30,tailY:30}),rect);
 const before=JSON.stringify(item.config),fitted=D.fitFree([item],rect,{avoidFaces:true,obstacles:faces});
 assert.equal(fitted.boxes.length,1);
 const box=fitted.boxes[0];
 assert.ok(faces.every(face=>!overlap(box,face)),'no face under the caption');
 assert.ok(box.left+box.width<=faces[0].left||box.left>=faces[0].left+faces[0].width,'prefer the side of the speaker');
 assert.equal(box.left+box.tail.handleTip.x,640);
 assert.ok(Math.abs(box.top+box.tail.handleTip.y-300)<10);
 assert.equal(JSON.stringify(item.config),before,'keep saved manual settings');
});

test('long tails cannot cross another face even when the bubble body is clear',()=>{
 const item={id:0,x:640,y:350,width:130,height:200,config:{tailMode:'actor'},preferred:{left:80,top:130}};
 const faces=[{actorId:0,left:600,top:340,width:90,height:90},{actorId:1,left:340,top:230,width:100,height:110}];
 const boxes=L.placeBubbles([item],1280,720,{obstacles:faces,stable:true,preferSides:true});
 assert.equal(boxes.length,1);
 // This directly checks the old left-to-right tail path through the neighbour.
 assert.ok(boxes[0].left>faces[1].left+faces[1].width||boxes[0].top+boxes[0].height<faces[1].top);
});

test('live face protection accounts for transparent padding and a flipped portrait',()=>{
 const figure={id:1,x:500,foot:600,width:200,height:400};
 const a=L.faceBounds(figure,{contentBounds:[.1,.2,.5,.95]});
 const b=L.faceBounds(figure,{contentBounds:[.1,.2,.5,.95],facing:'left'});
 assert.ok(a.top>200,'ignore transparent top');
 assert.ok(a.left+a.width/2<500);
 assert.ok(b.left+b.width/2>500);
});

test('both live replies remain visible and avoid all faces across the saved scenes and preview sizes',async()=>{
 for(const [width,height] of [[1280,720],[1920,1080]]){
  const f=stage({sceneCatalog:catalog,realtime:true,width,height});await new Promise(r=>setImmediate(r));f.command('live-begin',{session:'faces'});
  for(const scene of catalog.maps.flatMap(m=>m.scenes).filter(s=>s.id!=='s0-warmup')){
   const cast=scene.actors.filter(a=>a.present&&!a.visualHidden&&a.id!==7).slice(0,2);if(!cast.length)continue;
   f.command('live-present',{session:'faces',id:scene.id,sceneId:scene.id,messages:cast.map(a=>({actor:a.id,text:'这里不只有眼前的风景，也有彼此不同的经历。我们可以从这些细节出发，继续讨论文化与生活。'}))});
   await new Promise(r=>setImmediate(r));for(let i=0;i<30;i++)f.tick(100);
   const boxes=vm.runInContext('bubbleLayout',f.context),faces=vm.runInContext('liveFaceObstacles',f.context);
   assert.equal(boxes.length,cast.length,scene.id+' both replies visible');
   for(const box of boxes){assert.ok(box.left>=0&&box.top>=0&&box.left+box.width<=width&&box.top+box.height<=height,scene.id+' on screen');assert.ok(faces.every(face=>!overlap(box,face)),scene.id+' no face overlap');}
   if(boxes.length===2)assert.ok(!overlap(boxes[0],boxes[1]),scene.id+' no bubble overlap');
   assert.equal(f.posted.at(-1).realtime.error,'');
  }
 }
});

test('the crowded eight-person scene can show every pair at the 80-character reply limit',async()=>{
 const f=stage({sceneCatalog:catalog,realtime:true,width:900,height:650}),cast=[0,1,2,3,4,5,6,8];
 await new Promise(r=>setImmediate(r));f.command('live-begin',{session:'crowded'});
 for(let i=0;i<cast.length;i++)for(const actor of cast.slice(i+1)){
  const pair=[cast[i],actor];
  f.command('live-present',{session:'crowded',id:pair.join('-'),sceneId:'sc-q925-t2',messages:pair.map(actor=>({actor,text:'先从眼前的细节出发，听听彼此不同的经验，再讨论共同关心的问题。'.repeat(3).slice(0,80)}))});
  await new Promise(r=>setImmediate(r));for(let step=0;step<24;step++)f.tick(100);
  const boxes=vm.runInContext('bubbleLayout',f.context),faces=vm.runInContext('liveFaceObstacles',f.context);
  assert.equal(boxes.length,2,pair+' both full replies fit');
  assert.ok(boxes.every(b=>faces.every(face=>!overlap(b,face))),pair+' faces stay clear');
  assert.ok(!overlap(boxes[0],boxes[1]));
 }
});
