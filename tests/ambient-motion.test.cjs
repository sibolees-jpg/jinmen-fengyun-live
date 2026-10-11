const {test}=require('node:test'),assert=require('node:assert/strict');
const {AmbientMotion}=require('../motion.js');
const {InkBlocking}=require('../stage-layout.js');
test('automatic idle actions vary, remain stable at a frozen time, and yield to walking',()=>{
 const low=new AmbientMotion(2,{random:()=>0}),high=new AmbientMotion(2,{random:()=>.9});const a={id:0,phase:'idle',message:null};
 const l=low.pose(a,12000),h=high.pose(a,12000);assert.ok(l&&h);assert.notEqual(l.frame,h.frame);assert.deepEqual(low.pose(a,12000),l);assert.equal(low.pose({...a,phase:'entering'},12100),null);
});
test('random walking is bounded and does not always choose the same first person',()=>{
 const order=[8,0,1,2,3,4,5,6,7],actors=order.map((_,id)=>({id,phase:'idle',message:null}));
 const low=new InkBlocking(order,{random:()=>0}),high=new InkBlocking(order,{random:()=>.9});low.update(20000,actors);high.update(20000,actors);assert.ok(low.trip&&high.trip);assert.notEqual(low.trip.id,high.trip.id);
 for(let time=20100;time<40000;time+=100){low.update(time,actors);assert.ok(actors.every(a=>{const p=low.position(a,0);return p.x>.05&&p.x<.95&&p.y>=.84&&p.y<.98;}));}assert.ok(actors.every(a=>a.phase==='idle'));
});
