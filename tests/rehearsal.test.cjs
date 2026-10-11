const {test}=require('node:test');const assert=require('node:assert/strict');const Script=require('../speech-script.js');
const fixture=()=>({kind:'rehearsal',id:'fixture',title:'合成测试',text:'先观察花朵。\n再提出问题。',blocks:[{title:'观察',summary:'仔细观察',source:'先观察花朵。',cues:['观察花朵'],replies:[{actor:0,text:'先看清花瓣。',replyTo:null}]},{title:'追问',summary:'讨论方法',source:'再提出问题。',cues:['提出问题'],replies:[{actor:6,text:'怎样验证？',replyTo:null},{actor:4,text:'多比较几次。',replyTo:0}],discussion:true}]});
test('semantic blocks preserve all source text and reject missing paragraphs',()=>{
 const pack=Script.create(fixture());assert.equal(Script.topics(pack,[])[1].tag,'追问');assert.equal(pack.kind,'rehearsal');
 assert.equal(pack.version,3);assert.equal(pack.blocks[0].sentences.map(s=>s.text).join(''),pack.blocks[0].source);
 assert.equal(pack.blocks[0].sentences[0].mode,'reply');assert.equal(pack.blocks[1].sentences[0].mode,'discussion');
 const bad=fixture();bad.blocks.pop();assert.throws(()=>Script.create(bad));
});
test('sentence cue edits preserve source and validate bounded reply metadata',()=>{
 const pack=Script.create(fixture()),cue=pack.blocks[0].sentences[0];
 cue.trigger='花朵';cue.delayMs=250;cue.holdMs=1400;cue.replies[0].action='gesture';
 const edited=Script.create(pack);assert.equal(edited.blocks[0].sentences[0].trigger,'花朵');assert.equal(edited.blocks[0].sentences[0].replies[0].action,'gesture');
 const rewritten=structuredClone(pack);rewritten.blocks[0].sentences[0].text='改写。';assert.throws(()=>Script.create(rewritten),/完整保留/);
 const tooMany=structuredClone(pack);tooMany.blocks[0].sentences[0].replies=Array(9).fill({actor:0,text:'回应',replyTo:null});assert.throws(()=>Script.create(tooMany),/回应/);
 const multiReply=structuredClone(pack);multiReply.blocks[0].sentences[0].replies.push({actor:1,text:'第二条',replyTo:0});assert.throws(()=>Script.create(multiReply),/简短回应/);
});
test('plain speeches automatically gain editable silent paragraph blocks',()=>{
 const script=Script.create({title:'普通稿',text:'第一段。还有一句。\n第二段。'});
 assert.equal(script.blocks.length,2);assert.equal(script.blocks[0].sentences.length,2);assert.ok(script.blocks.flatMap(b=>b.sentences).every(s=>s.mode==='silent'));
 assert.equal(script.blocks.map(b=>b.source).join('\n'),script.text);
 const spaced=Script.create({title:'空行',text:'甲。\n  乙。\n \n丙。'});assert.deepEqual(spaced.blocks.map(b=>b.source),['甲。','乙。','丙。']);
});
test('prepared replies preserve an optional bounded speech duration',()=>{
 const input=fixture();input.blocks[0].replies[0].durationMs=6500;
 const pack=Script.create(input),message=Script.prepared(pack,'观察花朵',new Set()).messages[0];assert.equal(message.durationMs,6500);
 input.blocks[0].replies[0].durationMs=1000;assert.throws(()=>Script.create(input),/时长/);
});
test('per-line bubble presentation survives script save and prepared playback',()=>{
 const input=fixture();input.blocks[0].replies[0].presentation='upper';input.blocks[1].replies[1].presentation='front';
 const pack=Script.create(Script.create(input));
 assert.equal(Script.prepared(pack,'观察花朵',new Set()).messages[0].presentation,'upper');
 assert.equal(Script.prepared(pack,'提出问题',new Set()).messages[1].presentation,'front');
});
test('prepared cues trigger only once and keep the block discussion limits',()=>{
 const pack=Script.create(fixture()),used=new Set();
 const first=Script.prepared(pack,'请先观察花朵！',used);assert.equal(first.index,0);assert.equal(first.messages.length,1);
 assert.equal(first.sentenceIndex,0);assert.equal(first.cueId,pack.blocks[0].sentences[0].id);
 assert.equal(Script.prepared(pack,'再看看观察花朵这件事。',used).messages.length,0);
 const second=Script.prepared(pack,'再提出问题。',used);assert.equal(second.messages.length,2);assert.equal(second.messages[1].replyTo,0);
 assert.equal(Script.prepared(pack,'无关的临时提问。',used),null);
});
test('prepared triggers separate sentence cues once without duplicating a discussion',()=>{
 const pack=Script.create({kind:'rehearsal',id:'sentences',title:'逐句',text:'第一句。第二句。',blocks:[{title:'主题',source:'第一句。第二句。',sentences:[
  {id:'a',text:'第一句。',trigger:'第一句',mode:'reply',replies:[{actor:0,text:'甲',replyTo:null,action:'left'}],delayMs:100,holdMs:500},
  {id:'b',text:'第二句。',trigger:'第二句',mode:'discussion',replies:[{actor:1,text:'乙',replyTo:null,action:'seated'}],delayMs:200,holdMs:700}
 ]}]});
 const used=new Set(),a=Script.prepared(pack,'第一句',used),b=Script.prepared(pack,'第二句',used);
 assert.deepEqual([a.cueId,a.delayMs,a.holdMs,a.messages[0].action],['a',100,500,'left']);assert.equal(b.messages.length,1);assert.equal(Script.prepared(pack,'第二句',used).messages.length,0);
});
test('same sentence id in different blocks remains independently triggerable',()=>{
 const pack=Script.create({kind:'rehearsal',id:'duplicate-ids',title:'两幕',text:'甲句。乙句。',blocks:[
  {title:'甲',source:'甲句。',sentences:[{id:'shared',text:'甲句。',trigger:'甲句',mode:'reply',replies:[{actor:0,text:'甲答',replyTo:null}],delayMs:0,holdMs:0}]},
  {title:'乙',source:'乙句。',sentences:[{id:'shared',text:'乙句。',trigger:'乙句',mode:'reply',replies:[{actor:1,text:'乙答',replyTo:null}],delayMs:0,holdMs:0}]}
 ]}),used=new Set();assert.equal(Script.prepared(pack,'甲句',used).messages.length,1);assert.equal(Script.prepared(pack,'乙句',used).messages.length,1);
});
const {RehearsalPlayer}=require('../rehearsal.js');
test('full rehearsal waits for discussion to finish, respects pause, and stops without replay',()=>{
 const player=new RehearsalPlayer();player.start(Script.create(fixture()));
 assert.equal(player.tick(1000,{paused:true}),null);
 let event=player.tick(10000);assert.equal(event.type,'discussion');assert.equal(event.messages.length,1);
 assert.equal(player.tick(10000,{busy:true}),null);
 assert.deepEqual(player.tick(1),{type:'topic',index:1});
 event=player.tick(10000);assert.equal(event.type,'discussion');assert.equal(event.messages.length,2);
 assert.deepEqual(player.tick(1),{type:'done'});assert.equal(player.active,false);
 player.start(Script.create(fixture()));player.stop();assert.equal(player.tick(100000),null);assert.equal(player.script,null);
});
test('rehearsal packages cannot leave a persistent browser copy',()=>{
 const storage={setItem(){throw new Error('unexpected write');}};
 assert.throws(()=>Script.save(storage,fixture()),/浏览器存储/);
});
test('browser sync calls fetch without an object receiver and clears the loaded package',async()=>{
 const {RehearsalSync}=require('../rehearsal.js'),changes=[],pack=Script.create(fixture());
 const sync=new RehearsalSync(p=>changes.push(p),{fetchImpl:async function(url,options){
  'use strict';assert.equal(this,undefined,'browser fetch must not receive the sync instance');
  return {ok:true,json:async()=>options?.method==='DELETE'?{cleared:true}:url.endsWith('/status')?{id:pack.id}:pack};
 }});
 await sync.refresh();assert.equal(changes[0]?.id,pack.id);
 await sync.clear();assert.equal(changes.at(-1),null);
});
test('browser sync saves an edited test package with PUT and returns the new revision',async()=>{
 const {RehearsalSync}=require('../rehearsal.js'),pack=Script.create(fixture()),calls=[];
 const sync=new RehearsalSync(()=>{}, {fetchImpl:async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>({...pack,revision:4})};}});
 const saved=await sync.save(pack);assert.equal(saved.revision,4);assert.equal(calls[0][1].method,'PUT');assert.match(calls[0][1].headers['Content-Type'],/json/);
});
test('browser sync reloads when revision changes under the same id',async()=>{
 const {RehearsalSync}=require('../rehearsal.js'),changes=[],pack=Script.create(fixture());let revision=1;
 const sync=new RehearsalSync(p=>changes.push(p),{fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/status')?{id:pack.id,revision}:{...pack,revision}})});
 await sync.refresh();revision=2;await sync.refresh();assert.deepEqual(changes.map(p=>p.revision),[1,2]);
});
test('a delayed save cannot restore state after clear supersedes it',async()=>{
 const {RehearsalSync}=require('../rehearsal.js'),pack=Script.create(fixture()),changes=[];let finishSave;
 const sync=new RehearsalSync(p=>changes.push(p),{fetchImpl:async(_url,options)=>{
  if(options?.method==='PUT')return await new Promise(resolve=>{finishSave=()=>resolve({ok:true,json:async()=>({...pack,revision:9})});});
  if(options?.method==='DELETE')return {ok:true,json:async()=>({cleared:true})};throw new Error('unexpected');
 }});
 const saving=sync.save(pack);while(!finishSave)await Promise.resolve();await sync.clear();finishSave();await assert.rejects(saving,/失效/);assert.deepEqual(changes,[null]);
});
test('both rehearsal modes reveal 220 characters in one minute and respect sentence hold',()=>{
 const script={blocks:[{sentences:[{id:'timed',text:'字'.repeat(240),mode:'silent',replies:[],holdMs:500,delayMs:0}]}]};
 for(const realtime of [true,false]){const p=new RehearsalPlayer();p.start(script,0,{realtime});let event=p.tick(60000);assert.equal(p.read,220);assert.equal(event.type,'caption');p.tick(240*60000/220-60000+499);assert.equal(p.active,true);event=p.tick(2);assert.equal(event.type,'done');}
});
