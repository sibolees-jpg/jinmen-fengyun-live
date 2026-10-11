const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planRound}=require('../content.js');
const topics=Array.from({length:4},(_,topic)=>({lines:Array.from({length:7},(_,actor)=>`主题${topic}角色${actor}的备用观点`)}));
test('speech about creativity chooses that topic rather than echoing input',()=>{const r=planRound('AI会改变艺术创作与创造力吗？',topics,0);assert.equal(r.topic,2);assert.equal(r.messages.length,3);assert.equal(r.messages[0].text,'主题2角色0的备用观点');});
test('unmatched input gets a local acknowledgement instead of disappearing',()=>{
 const r=planRound('我认为无聊的课就该睡觉',topics,3,2);
 assert.equal(r.matched,false);assert.equal(r.messages.length,1);
 assert.equal(r.topic,2);assert.equal(r.messages[0].actor,3);
 assert.equal(r.messages[0].source,'本地兜底提示');
 assert.ok(r.messages[0].text.length>0);assert.equal(r.nextCursor,4);
});
test('blank input never starts a round',()=>{assert.equal(planRound('  ',topics,0).messages.length,0);});
test('each triggered round uses distinct teachers and rotates participants',()=>{const r=planRound('艺术教育如何改变课堂',topics,6);assert.equal(r.topic,1);assert.deepEqual(r.messages.map(x=>x.actor),[6,0,1]);assert.equal(r.nextCursor,2);});
test('Jinmen themes distinguish city history, education, experiments and human labor',()=>{for(const [text,topic] of [['天津的洋务与现代化',0],['美育与大学精神',1],['望远镜如何验证月面观察',2],['人工智能时代为什么还要移山',3]])assert.equal(planRound(text,topics,0).topic,topic);});
test('four-character cast rotates without referencing a removed teacher',()=>{
 const four=topics.map(t=>({lines:t.lines.slice(0,4)}));
 const r=planRound('艺术教育',four,3);
 assert.deepEqual(r.messages.map(x=>x.actor),[3,0,1]);
 assert.equal(r.nextCursor,2);assert.ok(r.messages.every(x=>typeof x.text==='string'));
});
