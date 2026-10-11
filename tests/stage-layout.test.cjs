const {test}=require('node:test');
const assert=require('node:assert/strict');
const {InkBlocking,placeBubbles,sceneRect,presenterZone,presentationFor}=require('../stage-layout.js');
const actors=()=>Array.from({length:9},(_,id)=>({id,phase:'idle',message:null}));
test('scattered blocking places nine people at different depths within the pictured ground',()=>{
 const layout=new InkBlocking([8,0,1,2,3,4,5,6,7]),cast=actors();layout.update(0,cast);
 const homes=cast.map(a=>layout.position(a,0));assert.ok(new Set(homes.map(p=>p.y)).size>=4);assert.ok(homes.every(p=>p.x>.06&&p.x<.94&&p.y>=.92&&p.y<.98),'every foot must be below the storefronts, on the foreground street');assert.ok(homes[8].x<Math.min(...homes.slice(0,8).map(p=>p.x)));
});
test('a solo speaker takes a short local step rather than crossing the whole street',()=>{
 const layout=new InkBlocking([8,0,1,2,3,4,5,6,7]),cast=actors();layout.update(0,cast);const home=layout.position(cast[7],0);cast[7].phase='thinking';layout.update(1,cast);const front=layout.position(cast[7],1);assert.ok(Math.abs(front.x-home.x)<.06);assert.ok(front.y>home.y);assert.ok(front.scale>home.scale);
});
test('linked speakers meet and orient toward one another, without sharing the same floor point',()=>{
 const layout=new InkBlocking([8,0,1,2,3,4,5,6,7]),cast=actors();cast[0].phase='thinking';cast[0].message={lookAt:7};cast[7].phase='thinking';cast[7].message={lookAt:0};layout.update(100,cast);const left=layout.position(cast[0],1),right=layout.position(cast[7],1);assert.ok(left.x<right.x);assert.ok(right.x-left.x>=.13&&right.x-left.x<.24);assert.equal(layout.gaze(cast[0],cast),1);assert.equal(layout.gaze(cast[7],cast),-1);
});
test('ambient walks stay bounded, stop advancing with a frozen clock, and yield to dialogue',()=>{
 const layout=new InkBlocking([8,0,1,2,3,4,5,6,7]),cast=actors();layout.update(0,cast);layout.update(14500,cast);layout.update(16000,cast);const moving=cast.map(a=>layout.position(a,0));assert.equal(moving.filter(p=>p.walking).length,1);layout.update(16000,cast);assert.deepEqual(cast.map(a=>layout.position(a,0)),moving);
 const walker=moving.findIndex(p=>p.walking);cast[walker].phase='thinking';layout.update(16100,cast);assert.ok(!layout.position(cast[walker],0).walking);assert.ok(cast.map(a=>layout.position(a,0)).every(p=>p.x>.05&&p.x<.95));
});
test('three simultaneous paper captions remain inside the screen and do not overlap',()=>{
 const boxes=placeBubbles([{id:0,x:630,y:560,width:160,height:240},{id:1,x:720,y:580,width:160,height:240},{id:2,x:810,y:550,width:160,height:240}],1440,900);
 for(const a of boxes){assert.ok(a.left>=12&&a.top>=12&&a.left+a.width<=1428&&a.top+a.height<=820);for(const b of boxes)if(a.id!==b.id)assert.ok(a.left+a.width<=b.left||b.left+b.width<=a.left||a.top+a.height<=b.top||b.top+b.height<=a.top);}
});
test('a displaced filled tail points toward its own speaker without a leader line',()=>{
 const items=[{id:0,x:18,y:560,width:160,height:240},{id:1,x:690,y:560,width:160,height:240},{id:2,x:720,y:570,width:160,height:240}];
 for(const delta of [0,24,60]){
  const moving=items.map(a=>({...a,x:a.x+delta,y:a.y+delta/3})),boxes=placeBubbles(moving,1440,900);
  for(const box of boxes){const speaker=moving.find(a=>a.id===box.id);const tail=box.tail;assert.equal(tail.notch.length,3);assert.deepEqual(tail.points,[]);const v={x:tail.handleTip.x-tail.handleBase.x,y:tail.handleTip.y-tail.handleBase.y};assert.ok(v.x*(speaker.x-box.left-tail.handleBase.x)+v.y*(speaker.y-box.top-tail.handleBase.y)>0);assert.ok(Math.abs(Math.hypot(v.x,v.y)-12*1.15)<.01);}
 }
});
test('scene coordinates fit narrow viewports without cropping the street',()=>{
 for(const [w,h] of [[1440,900],[874,805],[390,844]]){const r=sceneRect(w,h);assert.ok(r.width<=w&&r.height<=h);assert.ok(r.left>=0&&r.top>=0);assert.ok(r.top+r.height<h-55);}
});
test('prepared direct replies stand out while generated and actor-to-actor remarks recede',()=>{
 assert.equal(presentationFor({source:'演练预备',replyTo:null}),'front');
 assert.equal(presentationFor({source:'演练预备',replyTo:0}),'background');
 assert.equal(presentationFor({source:'DeepSeek',replyTo:null}),'background');
 assert.equal(presentationFor({source:'演练预备',replyTo:0,presentation:'upper'}),'upper');
});
test('idle walks and every discussion path leave room for the presenter, not just their endpoints',()=>{
 const order=[8,0,1,2,3,4,5,6,7];
 const safe=p=>{assert.ok(p.x-.0475*p.scale>=.22||p.y<=.56,'a character enters the presenter area');assert.ok(p.y>=.92&&p.y<=.98,'a walk leaves the foreground street');};
 for(const random of [()=>0,()=>.5,()=>.9]){
  const layout=new InkBlocking(order,{random}),cast=actors();
  for(let t=0;t<180000;t+=200){layout.update(t,cast);cast.forEach(a=>safe(layout.position(a,0)));}
 }
 for(let i=0;i<9;i++)for(let j=0;j<9;j++)if(i!==j){
  const layout=new InkBlocking(order),cast=actors();cast[i].phase=cast[j].phase='speaking';cast[i].message={lookAt:j};cast[j].message={lookAt:i};layout.update(1,cast);
  for(let p=0;p<=1;p+=.05)for(const a of cast)safe(layout.position(a,p));
 }
});
test('bubbles and their tails avoid the presenter area on wide and narrow screens',()=>{
 const intersects=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
 for(const [w,h] of [[1440,900],[874,805],[390,844]]){
  const scene=sceneRect(w,h),reserved=presenterZone(w,h),items=[.35,.47,.6].map((x,id)=>({id,x:scene.left+x*scene.width,y:scene.top+.65*scene.height,width:Math.min(220,w*.35),height:Math.min(260,h*.28),presentation:id===0?'upper':'background'}));
  const boxes=placeBubbles(items,w,h,{reserved});assert.equal(boxes.length,items.length);
  for(const b of boxes){assert.ok(!intersects(b,reserved),'bubble overlaps presenter');assert.ok(!intersects({left:b.left+b.tail.left,top:b.top+b.tail.top,width:b.tail.width,height:b.tail.height},reserved),'tail overlaps presenter');}
 }
});
