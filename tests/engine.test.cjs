const {test}=require('node:test');
const assert=require('node:assert/strict');
const {StageEngine}=require('../engine.js');
const message=(id,text='测试发言内容')=>({actor:id,text,topic:0});
test('three different actors can speak concurrently while a fourth waits',()=>{
 const e=new StageEngine(7,3); [0,1,2,3].forEach(i=>e.enqueue(message(i))); e.step(0);
 assert.equal(e.actors.filter(a=>a.phase!=='idle').length,3); assert.equal(e.queue.length,1);
 e.step(2000); assert.equal(e.actors.filter(a=>a.phase==='speaking').length,3);
});
test('pause preserves movement and speech time',()=>{
 const e=new StageEngine(); e.enqueue(message(0)); e.step(900); e.paused=true;
 const before=JSON.stringify(e.actors); e.step(9999); assert.equal(JSON.stringify(e.actors),before);
});
test('same actor never overlaps itself and queued message eventually plays',()=>{
 const e=new StageEngine(); e.enqueue(message(0,'第一条')); e.enqueue(message(0,'第二条')); e.step(2000);
 assert.equal(e.actors[0].message.text,'第一条'); e.step(6000); e.step(2000);
 assert.equal(e.actors[0].message.text,'第二条');
});
test('topic change discards old queued text and returns active actors',()=>{
 const e=new StageEngine(); e.enqueue(message(0)); e.enqueue(message(0,'过时的内容')); e.step(2000); e.setTopic(1);
 assert.equal(e.queue.length,0); assert.equal(e.actors[0].phase,'leaving');
 e.step(2000); assert.equal(e.actors[0].phase,'idle');
 assert.equal(e.enqueue(message(1)),false);
});
test('clear stops all activity and empties queue',()=>{
 const e=new StageEngine(); e.enqueue(message(0)); e.step(1000); e.clear();
 assert.equal(e.queue.length,0); assert.ok(e.actors.every(a=>a.phase==='idle'));
});
test('invalid or oversized inputs cannot make the stage unusable',()=>{
 const e=new StageEngine(); assert.equal(e.enqueue(message(99)),false); assert.equal(e.enqueue(message(0,'')),false);
 assert.equal(e.enqueue(message(0,'字'.repeat(500))),true); e.step(0); assert.equal(e.actors[0].message.text.length,80);
});
test('discussion shows the first bubble promptly and lets characters answer each other in place',()=>{
 const e=new StageEngine(4,3);e.enqueueDiscussion([{actor:0,text:'我觉得美先让人快乐。',replyTo:null},{actor:2,text:'东坡，快乐能说明它有价值吗？',replyTo:0},{actor:0,text:'伽利略，也别把生活只过成测量。',replyTo:1}]);
 e.step(550);assert.equal(e.actors[0].phase,'speaking');assert.equal(e.actors[2].phase,'idle');
 let sawSecond=false,sawReturn=false;for(let i=0;i<100;i++){e.step(100);if(e.actors[2].phase==='speaking')sawSecond=true;if(e.actors[0].message?.text.includes('伽利略')){sawReturn=true;assert.equal(e.actors[0].phase==='speaking'||e.actors[0].phase==='listening'||e.actors[0].phase==='leaving',true);}}
 assert.equal(sawSecond,true);assert.equal(sawReturn,true);e.step(20000);assert.ok(e.actors.every(a=>a.phase==='idle'||a.phase==='leaving'));e.step(1000);assert.ok(e.actors.every(a=>a.phase==='idle'));
});
test('a queued reply never appears before its referenced statement is visible',()=>{
 const e=new StageEngine(4,3);e.enqueueDiscussion([{actor:3,text:'先做起来。',replyTo:null},{actor:1,text:'愚公，先决定往哪儿做。',replyTo:0}]);e.step(0);assert.equal(e.actors[1].phase,'idle');e.step(500);assert.equal(e.actors[1].phase,'idle');
});
test('planned replies face each other and honor the edited speaking duration',()=>{
 const e=new StageEngine(3,3);e.enqueueDiscussion([{actor:0,text:'第一句。',replyTo:null,durationMs:6000},{actor:2,text:'接上一句。',replyTo:0}]);
 e.step(500);assert.equal(e.actors[0].message.lookAt,2);assert.equal(e.duration(e.actors[0]),6000);
 for(let i=0;i<50;i++)e.step(100);assert.equal(e.actors[2].phase,'idle');
 for(let i=0;i<16;i++)e.step(100);assert.equal(e.actors[2].message.lookAt,0);assert.equal(e.actors[2].phase,'speaking');
});
test('dialogue finishes without deadlock at one or two front-row places',()=>{
 for(const capacity of [1,2]){const e=new StageEngine(4,capacity);e.enqueueDiscussion([{actor:0,text:'第一句。',replyTo:null},{actor:1,text:'第二句。',replyTo:0},{actor:2,text:'第三句。',replyTo:1},{actor:0,text:'我再接一句。',replyTo:2}]);let heard=new Set();for(let i=0;i<500;i++){e.step(100);for(const a of e.actors)if(a.phase==='speaking')heard.add(a.message.text);}assert.equal(heard.size,4);assert.equal(e.queue.length,0);assert.ok(e.actors.every(a=>a.phase==='idle'));}
});
