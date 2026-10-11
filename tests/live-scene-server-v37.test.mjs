import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {createAppServer} from '../server.mjs';
const require=createRequire(import.meta.url),Script=require('../speech-script.js'),original=require('../show/scenes.json').catalog,script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json'));
async function fixture(t,generate){const catalog=structuredClone(original);let count=0;const server=createAppServer({scenes:{get:()=>({catalog})},scripts:{get:()=>({script})},rehearsal:{get:()=>null},getConfig:()=>({apiKey:'synthetic-test',model:'test'}),generate:async(...args)=>{count++;return generate(...args);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`,post=(path,body,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {catalog,count:()=>count,toggle:enabled=>post('/api/improv',{enabled},'PUT'),send:body=>post('/api/respond',{text:script.blocks[23].source,topic:23,speech:{sentence:6},improv:true,liveSceneId:'sc-q925-t2',...body})};}
test('only a saved live scene bypasses T1 choir reservations and fixed-text suppression',async t=>{
 let candidates,context;const f=await fixture(t,async(c,input)=>{candidates=c.improvActors;context=input.speech;return {messages:[{actor:0,text:'现场的问题，我们一起想一想。'}]};});
 assert.equal((await(await f.send()).json()).suppressed,true);assert.equal(f.count(),0);await f.toggle(true);
 assert.equal((await f.send({liveSceneId:'sc-q925-t1'})).status,400);assert.equal((await f.send({liveSceneId:'sc-missing'})).status,400);assert.equal(f.count(),0);
 assert.equal((await(await f.send({liveSceneId:undefined})).json()).suppressed,true);assert.equal(f.count(),0);
 const result=await(await f.send()).json();assert.equal(result.messages[0].actor,0);assert.equal(candidates.length,9);assert.equal(context,undefined);
});
test('T2 roles are limited to present actors and revalidated after model generation',async t=>{
 let release,started;const begun=new Promise(r=>started=r),f=await fixture(t,async c=>{assert.deepEqual(c.improvActors,[0]);started();return new Promise(r=>release=r);});await f.toggle(true);const t2=f.catalog.maps.at(-1).scenes.at(-1);t2.actors.forEach(a=>a.present=a.id===0);
 assert.equal((await(await f.send({improvActors:[1,8]})).json()).reason,'no_supporting_actors');assert.equal(f.count(),0);
 const pending=f.send({improvActors:[0,8]});await begun;t2.liveDialogue=false;release({messages:[{actor:0,text:'应作废的旧回复。'}]});assert.equal((await(await pending).json()).reason,'invalid_improv');
});
