import {test} from 'node:test';import assert from 'node:assert/strict';import {generateReply} from '../backend/deepseek.mjs';import {createAppServer} from '../server.mjs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),catalog=require('../show/scenes.json').catalog,script=require('../show/script.json').script;
const config={apiKey:'synthetic-key',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',improvActors:[0],liveDialogue:true};
const completion=messages=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({messages})}}]}));
test('T2 uses its own responding prompt and retries an empty array once within the same request budget',async()=>{
 let calls=0,prompt;const r=await generateReply(config,{text:'你好，今天有什么想聊的吗？'},{fetchImpl:async(_u,o)=>{calls++;prompt=JSON.parse(o.body).messages[0].content;return completion(calls===1?[]:[{actor:0,text:'今日相聚，不妨先聊聊你眼中最有趣的作品。',replyTo:null}]);}});
 assert.equal(calls,2);assert.equal(r.messages.length,1);assert.match(prompt,/T2 临场问答/);assert.doesNotMatch(prompt,/可以不回应/);assert.match(prompt,/梁启超/);
});
test('persistent empty T2 output raises an explicit error; legacy supporting mode may remain quiet',async()=>{
 let calls=0;await assert.rejects(generateReply(config,{text:'你好'},{fetchImpl:async()=>{calls++;return completion([]);}}),e=>e.code==='empty_response');assert.equal(calls,2);
 const legacy=await generateReply({...config,liveDialogue:false},{text:'你好'},{fetchImpl:async()=>completion([])});assert.equal(legacy.messages.length,0);
});
test('server reports thinking, empty failure and success for T2 instead of waiting for first call',async t=>{
 let resolve;const server=createAppServer({getConfig:()=>config,scenes:{get:()=>({catalog})},scripts:{get:()=>({script})},rehearsal:{get:()=>null},generate:c=>{assert.equal(c.liveDialogue,true);return new Promise(r=>resolve=r);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port,post=(route,value)=>fetch(base+route,{method:route==='/api/improv'?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}),status=async()=>(await(await fetch(base+'/api/status')).json()).lastCall;
 await post('/api/improv',{enabled:true});const pending=post('/api/respond',{text:'你好',liveSceneId:'sc-q925-t2',improv:true,improvActors:[0]});while(!resolve)await new Promise(r=>setImmediate(r));assert.equal((await status()).state,'thinking');resolve({messages:[]});assert.equal((await pending).status,502);assert.equal((await status()).state,'error');assert.match((await status()).message,/未返回/);
 resolve=null;const next=post('/api/respond',{text:'谈谈校园',liveSceneId:'sc-q925-t2',improv:true,improvActors:[0]});while(!resolve)await new Promise(r=>setImmediate(r));resolve({messages:[{actor:0,text:'我们一起看看校园里那些值得记住的细节。'}],latencyMs:500});assert.equal((await next).status,200);assert.equal((await status()).state,'success');
});
