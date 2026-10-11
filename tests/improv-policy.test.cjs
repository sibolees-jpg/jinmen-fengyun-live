const {test}=require('node:test');
const assert=require('node:assert/strict');
const {improvActors,create}=require('../speech-script.js');
const {normalizeImprov}=require('../dialogue.js');
const fs=require('node:fs');const path=require('node:path');
test('current section reserves its scripted actors without changing content',()=>{
 const script=create({text:'第一段。\n第二段。',blocks:[{title:'一',source:'第一段。',replies:[{actor:1,text:'固定一。'}]},{title:'二',source:'第二段。',replies:[{actor:5,text:'固定二。'}]}]});
 const before=JSON.stringify(script);assert.deepEqual(improvActors(script,0),[0,2,3,4,5,6,7,8]);assert.equal(JSON.stringify(script),before);assert.deepEqual(improvActors(script,1,[1]),[0,2,3,4,6,7,8]);
});
test('existing script has supporting actors outside the current main roles',()=>{
 const script=JSON.parse(fs.readFileSync(path.join(__dirname,'../speeches/2026-120周年校庆/邱志杰120周年校庆讲话-测试接话-v1.json'),'utf8'));
 assert.deepEqual(improvActors(script,0),[1,2,3,4,5,6,7,8]);
});
test('supporting replies allow silence but never remap reserved roles or long content',()=>{
 assert.deepEqual(normalizeImprov([],[]),[]);
 assert.throws(()=>normalizeImprov([{actor:0,text:'主角'}],[1]));
 assert.throws(()=>normalizeImprov([{actor:1,text:'字'.repeat(41)}],[1]));
 assert.throws(()=>normalizeImprov([{actor:1,text:'第一句'},{actor:1,text:'再一句',replyTo:0}],[1]));
 const replies=normalizeImprov([{actor:1,text:'邱老师说得有趣。'},{actor:2,text:'我们接着听。',replyTo:0}],[1,2]);
 assert.equal(replies.length,2);assert.ok(replies.every(m=>m.improv&&m.presentation==='background'));assert.equal(replies[1].replyTo,0);
});
