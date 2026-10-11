import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createAppServer} from '../server.mjs';
const require=createRequire(import.meta.url),baseCatalog=require('../show/scenes.json').catalog;
const config={apiKey:'never-public-test-key',model:'deepseek-flash',baseUrl:'https://api.deepseek.com'};
async function fixture(t,options={}){let calls=0;const catalog=structuredClone(baseCatalog),server=createAppServer({scenes:{get:()=>({catalog})},scripts:{get:()=>({script:null})},rehearsal:{get:()=>null},getConfig:()=>config,generate:async()=>{calls++;return {provider:'deepseek',messages:[{actor:3,text:'先做起来。'}]};},...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url=`http://127.0.0.1:${server.address().port}`,post=(path,body,method='POST')=>fetch(url+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {url,catalog,calls:()=>calls,toggle:enabled=>post('/api/improv',{enabled},'PUT'),send:body=>post('/api/respond',{text:'校园里的小猫也来听课。',improv:true,liveSceneId:'sc-q925-t2',...body})};}
test('serves the stage but never backend or private config files',async t=>{
 const {url}=await fixture(t);assert.equal((await fetch(url)).status,200);
 for(const file of ['finale.js','finale-stage.js','finale-stage.css','finale-director.js','finale-director.css'])assert.equal((await fetch(url+'/'+file)).status,200,file+' must be served');
 const atlas=await fetch(url+'/assets/motion/lin-qiaozhi/atlas.png');assert.equal(atlas.status,200);assert.equal(atlas.headers.get('content-type'),'image/png');
 assert.equal((await fetch(url+'/assets/motion/lin-qiaozhi/prompt.txt')).status,404);
 for(const path of ['/server.mjs','/backend/deepseek.mjs','/.env','/../.anniversary-discussion-private/config.json','/assets/characters/../../server.mjs'])assert.equal((await fetch(url+path)).status,404);
 const status=await (await fetch(url+'/api/status')).text();assert.ok(!status.includes(config.apiKey));
});
test('invalid input and cross-origin requests are rejected before any model call',async t=>{
 const f=await fixture(t);await f.toggle(true);const request={method:'POST',headers:{'Content-Type':'application/json',Origin:'https://outside.example'},body:JSON.stringify({text:'hello',improv:true,liveSceneId:'sc-q925-t2'})};assert.equal((await fetch(f.url+'/api/respond',request)).status,403);assert.equal((await f.send({text:' '})).status,400);assert.equal(f.calls(),0);assert.equal((await(await f.send()).json()).messages[0].actor,3);assert.equal(f.calls(),1);
});
test('only T2 can call the model: legacy, ordinary-scene, disabled, test and non-improv requests stay silent',async t=>{
 const f=await fixture(t);assert.equal((await(await f.send()).json()).suppressed,true);await f.toggle(true);
 for(const body of [{liveSceneId:undefined},{liveSceneId:undefined,improv:false},{liveSceneId:undefined,rehearsalId:'old-test'}, {improv:false}])assert.equal((await(await f.send(body)).json()).suppressed,true);
 for(const scene of f.catalog.maps.flatMap(m=>m.scenes).filter(s=>!s.liveDialogue))assert.equal((await f.send({liveSceneId:scene.id})).status,400,scene.id);
 assert.equal(f.calls(),0);const status=await(await fetch(f.url+'/api/status')).json();assert.equal(status.improvScope,'live_scene_only');assert.deepEqual(status.improvActors,[]);
});
test('T2 keeps the linked two-person cooldown and switch-off never generates a fallback',async t=>{
 let now=1000;const permissions=[];const f=await fixture(t,{now:()=>now,generate:async c=>{permissions.push(c.allowDiscussion);return {messages:[{actor:0,text:'先试试看。'},{actor:1,text:'我补充一种做法。',replyTo:0}]};}});await f.toggle(true);
 assert.equal((await(await f.send()).json()).messages.length,2);now+=1000;assert.equal((await(await f.send()).json()).messages.length,1);now+=45000;assert.equal((await(await f.send()).json()).messages.length,2);await f.toggle(false);assert.equal((await(await f.send()).json()).suppressed,true);assert.deepEqual(permissions,[true,false,true]);
});
test('closing T2 improv drops an in-flight result even when the model ignores cancellation',async t=>{
 let release,started;const begun=new Promise(r=>started=r),f=await fixture(t,{generate:async()=>{started();return new Promise(r=>release=r);}});await f.toggle(true);const pending=f.send();await begun;await f.toggle(false);release({messages:[{actor:0,text:'迟到的内容'}]});assert.equal((await(await pending).json()).suppressed,true);
});
test('server candidates come from T2 present actors, never from arbitrary client lists or test mode',async t=>{
 let received;const f=await fixture(t,{generate:async c=>{received=c;return {discussionMode:'test',messages:[{actor:0,text:'未出场的角色。'}]};}});const scene=f.catalog.maps.at(-1).scenes.at(-1);scene.actors[0].present=false;await f.toggle(true);
 const result=await(await f.send({improvActors:[0,2,3]})).json();assert.deepEqual(received.improvActors,[2,3]);assert.equal(received.testDiscussion,false);assert.equal(result.reason,'invalid_improv');
});
test('an empty T2 cast stays silent but an empty model reply is an explicit error',async t=>{
 const f=await fixture(t);await f.toggle(true);f.catalog.maps.at(-1).scenes.at(-1).actors.forEach(a=>a.present=false);assert.equal((await(await f.send()).json()).reason,'no_supporting_actors');assert.equal(f.calls(),0);
 const silent=await fixture(t,{generate:async()=>({messages:[]})});await silent.toggle(true);const response=await silent.send();assert.equal(response.status,502);assert.equal((await response.json()).error.code,'empty_response');
});
test('T2 actor presence is checked again after generation',async t=>{
 let release,started;const begun=new Promise(r=>started=r),f=await fixture(t,{generate:async()=>{started();return new Promise(r=>release=r);}});await f.toggle(true);const pending=f.send();await begun;f.catalog.maps.at(-1).scenes.at(-1).actors[3].present=false;release({messages:[{actor:3,text:'不再出场的角色。'}]});assert.equal((await(await pending).json()).reason,'invalid_improv');
});
test('model configuration endpoint masks secrets and respects local origin restrictions',async t=>{let saved;const f=await fixture(t,{setConfig:value=>{saved=value;return {configured:true,provider:'openai',model:'gpt-6-astra'};},verify:async()=>({verified:true,model:'gpt-6-astra'})});const request={method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:'sk-synthetic-test-only'})};const response=await fetch(f.url+'/api/model-config',request);assert.equal(response.status,200);assert.equal(saved.apiKey,'sk-synthetic-test-only');assert.equal((await response.text()).includes(saved.apiKey),false);assert.equal((await fetch(f.url+'/api/model-config',{...request,headers:{...request.headers,Origin:'https://outside.example'}})).status,403);assert.equal((await(await fetch(f.url+'/api/model-check',{method:'POST'})).json()).verified,true);});
