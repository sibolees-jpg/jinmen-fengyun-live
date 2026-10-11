const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PARTICIPANTS,KEY,defaultPlan,normalize,Player}=require('../finale.js');

test('joint release has nine stable participants and an isolated editable draft',()=>{
 const first=defaultPlan(),second=defaultPlan();
 assert.equal(KEY,'jinmen-finale-v1');
 assert.deepEqual(PARTICIPANTS.map(p=>p.name),['梁启超','李鸿章','严复','李叔同','蔡元培','柏拉图','达芬奇','伽利略','愚公']);
 assert.deepEqual([...new Set(first.lines.map(l=>l.actor))].sort((a,b)=>a-b),Array.from({length:9},(_,i)=>i));
 assert.equal(first.lines[0].actor,0);assert.equal(first.draft,true);
 first.lines[0].text='本地修改';assert.notEqual(second.lines[0].text,first.lines[0].text);
});
test('normalization rejects incomplete, duplicate, malformed, or unsafe plans',()=>{
 for(const value of [undefined,null,{},[],{...defaultPlan(),entrance:'unknown'},{...defaultPlan(),version:2}])assert.throws(()=>normalize(value));
 const duplicate=defaultPlan();duplicate.lines[1].actor=9;assert.throws(()=>normalize(duplicate));
 const short=defaultPlan();short.lines.pop();assert.throws(()=>normalize(short));
 const duplicateId=defaultPlan();duplicateId.lines[1].id=duplicateId.lines[0].id;assert.throws(()=>normalize(duplicateId));
 for(const durationMs of [NaN,Infinity,-1,2999,30001,'5000']){const plan=defaultPlan();plan.lines[0].durationMs=durationMs;assert.throws(()=>normalize(plan));}
 for(const anchor of [{x:0,y:.96,scale:1},{x:.13,y:.8,scale:1},{x:.13,y:.96,scale:2}])assert.throws(()=>normalize({...defaultPlan(),anchor}));
 assert.throws(()=>normalize({...defaultPlan(),title:'字'.repeat(101)}));
 const long=defaultPlan();long.lines[0].text='字'.repeat(161);assert.throws(()=>normalize(long));
});
test('empty editable lines remain valid drafts but cannot start a release',()=>{
 const plan=defaultPlan();plan.lines[4].text='   ';const player=new Player(plan);
 assert.equal(player.hasReady,false);assert.equal(player.plan.lines[4].text,'');
 assert.throws(()=>player.start(),/倡议内容/);assert.equal(player.state,'idle');
});
test('an idle reveal is static until the operator starts the release',()=>{
 const player=new Player(defaultPlan());player.update(90000);
 assert.equal(player.state,'idle');assert.equal(player.active,false);assert.equal(player.speaking,null);assert.equal(player.movementProgress,0);
 player.next();player.pause();player.update(3000);assert.equal(player.state,'idle');assert.equal(player.paused,false);
 player.start();assert.equal(player.state,'entering');assert.equal(player.active,true);
 player.update(1100);assert.equal(player.movementProgress,.5);assert.equal(player.speaking,null);
 player.update(1100);assert.equal(player.state,'speaking');assert.equal(player.speaking.actor,0);assert.equal(player.elapsed,0);
});
test('nine lines play exactly once with an entrance and a gap, ending visibly',()=>{
 const plan=defaultPlan();plan.lines.forEach(l=>l.durationMs=3000);const player=new Player(plan),spoken=[];
 player.start();player.update(2200);
 for(let i=0;i<9;i++){
  assert.equal(player.index,i);spoken.push(player.speaking.actor);player.update(3000);
  if(i<8){assert.equal(player.state,'gap');assert.equal(player.speaking,null);player.update(899);assert.equal(player.state,'gap');player.update(1);}
 }
 assert.deepEqual(spoken,plan.lines.map(l=>l.actor));assert.equal(player.state,'ended');assert.equal(player.active,true);assert.equal(player.speaking,null);
 player.update(10000);assert.equal(player.state,'ended');
 player.reset();assert.equal(player.state,'idle');assert.equal(player.active,false);assert.equal(player.index,-1);assert.equal(player.elapsed,0);
});
test('pause freezes every phase while a manual next moves predictably',()=>{
 const player=new Player(defaultPlan());player.start();player.update(800);player.pause();player.update(9000);
 assert.equal(player.elapsed,800);assert.equal(player.state,'entering');
 player.next();assert.equal(player.state,'speaking');assert.equal(player.index,0);assert.equal(player.paused,true);
 player.update(30000);assert.equal(player.index,0);player.pause();player.update(1000);assert.equal(player.elapsed,1000);
 player.next();assert.equal(player.index,1);assert.equal(player.elapsed,0);
 player.update(player.speaking.durationMs);assert.equal(player.state,'gap');player.next();assert.equal(player.index,2);
 while(player.state!=='ended')player.next();assert.equal(player.index,8);player.next();assert.equal(player.index,8);
 player.start();assert.equal(player.state,'entering');assert.equal(player.index,-1);assert.equal(player.paused,false);
});
test('elapsed overflow advances across phases and a changed plan requires a fresh start',()=>{
 const plan=defaultPlan();plan.lines.forEach(l=>l.durationMs=3000);const player=new Player(plan);player.start();
 player.update(2200+3000+900+500);assert.equal(player.index,1);assert.equal(player.elapsed,500);
 player.update(1000000);assert.equal(player.state,'ended');
 const replacement=defaultPlan();replacement.entrance='walk-in';player.setPlan(replacement);assert.equal(player.state,'idle');assert.equal(player.plan.entrance,'walk-in');
 replacement.lines[0].text='外部修改';assert.notEqual(player.plan.lines[0].text,'外部修改');
 assert.throws(()=>player.update(-1));assert.throws(()=>player.update(NaN));
});
test('all nine finale feet stay on the street and walk-in begins outside the scene',()=>{
 const {positions}=require('../finale-stage.js'),plan=defaultPlan();
 for(const progress of [0,.25,.5,.75,1]){
  const people=positions(plan,null,progress);assert.equal(people.length,9);assert.equal(new Set(people.map(p=>p.id)).size,9);
  assert.ok(people.every(p=>p.y>=.9&&p.y<=.98));
 }
 plan.entrance='walk-in';assert.ok(positions(plan,null,0).every(p=>p.id<9));
 assert.ok(positions(plan,null,1).every(p=>p.id<9));
});

test('legacy ten-person save migrates to nine while preserving the other lines and order',()=>{const p=defaultPlan();p.lines.splice(3,0,{id:'legacy-removed',actor:9,text:'旧稿',durationMs:8000});const n=normalize(p);assert.deepEqual(n.lines,defaultPlan().lines);assert.ok(n.lines.every(l=>l.actor<9));});
