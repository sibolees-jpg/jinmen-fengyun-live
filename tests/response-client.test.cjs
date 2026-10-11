const {test}=require('node:test');const assert=require('node:assert/strict');
const {ResponseClient}=require('../response-client.js');
const fallback=()=>({topic:0,nextCursor:1,messages:[{actor:0,text:'本地预备回应'}]});
test('uses model responses and carries bounded conversation context',async()=>{
 let body;const client=new ResponseClient({fallback,fetchImpl:async(_url,opts)=>{body=JSON.parse(opts.body);return new Response(JSON.stringify({provider:'deepseek',messages:[{actor:2,text:'先试一试。'}]}));}});
 const round=await client.request('如何判断？',{topic:1,cursor:0});assert.equal(round.messages[0].topic,1);assert.equal(round.messages[0].actor,2);assert.equal(client.busy,false);
 await client.request('那具体怎么试？',{topic:1,cursor:1});assert.equal(body.history[0].content,'如何判断？');assert.match(body.history[1].content,/先试一试/);
 assert.deepEqual(JSON.parse(body.history[1].content),{messages:[{actor:2,text:'先试一试。',replyTo:null}]});
});
test('network failure returns local content with an explicit fallback state',async()=>{
 const client=new ResponseClient({fallback,fetchImpl:async()=>{throw new Error('network');}});
 const round=await client.request('hello',{topic:0,cursor:0});assert.equal(round.messages[0].text,'本地预备回应');assert.equal(client.state.mode,'fallback');assert.equal(client.busy,false);
});
test('clear cancels an old response and prevents it reappearing',async()=>{
 let resolve;const client=new ResponseClient({fallback,fetchImpl:()=>new Promise(r=>resolve=r)});
 const pending=client.request('old',{topic:0,cursor:0});client.cancel();
 resolve(new Response(JSON.stringify({messages:[{actor:1,text:'迟到的回应'}]})));
 assert.equal(await pending,null);assert.equal(client.history.length,0);assert.equal(client.busy,false);
});
test('a second request cannot create parallel paid calls',async()=>{
 let resolve,calls=0;const client=new ResponseClient({fallback,fetchImpl:()=>{calls++;return new Promise(r=>resolve=r);}});
 const pending=client.request('first',{topic:0,cursor:0});assert.equal(await client.request('second',{topic:0,cursor:0}),null);assert.equal(calls,1);
 resolve(new Response(JSON.stringify({messages:[{actor:0,text:'回应'}]})));await pending;
});
test('calls fetch without binding it to the client object, as browsers require',async()=>{
 let receiver;
 const fetchImpl=function(){'use strict';receiver=this;if(this!==undefined)throw new TypeError('Illegal invocation');return Promise.resolve(new Response(JSON.stringify({messages:[{actor:3,text:'先试一步。'}]})));};
 const client=new ResponseClient({fallback,fetchImpl});
 const round=await client.request('试一下',{topic:0,cursor:0});
 assert.equal(receiver,undefined);assert.equal(round.messages[0].text,'先试一步。');assert.equal(client.state.mode,'online');
});
test('backend disconnection reports a connection error instead of a generic content reply',async()=>{
 const client=new ResponseClient({fallback:()=>({matched:false,topic:0,messages:[{actor:0,text:'没有准备好的回答'}]}),fetchImpl:async()=>{throw new TypeError('Failed to fetch');}});
 const round=await client.request('这是什么？',{topic:0,cursor:3});
 assert.equal(client.state.reason,'backend_unavailable');assert.equal(round.failed,true);
 assert.equal(round.messages[0].source,'连接提示');assert.match(round.messages[0].text,/本地服务/);
 assert.ok(!round.messages[0].text.includes('准备好的回答'));
});
test('provider failure preserves the reason without exposing upstream text',async()=>{
 const client=new ResponseClient({fallback:()=>({matched:false}),fetchImpl:async()=>new Response(JSON.stringify({error:{code:'balance',message:'private upstream details'}}),{status:502})});
 const round=await client.request('你好',{topic:0,cursor:0});assert.match(round.messages[0].text,/余额/);assert.ok(!round.messages[0].text.includes('private'));
});
test('persistent empty model output is reported accurately and leaves the round retryable',async()=>{
 const client=new ResponseClient({fallback:()=>({matched:false}),fetchImpl:async()=>new Response(JSON.stringify({error:{code:'empty_response'}}),{status:502})});
 const round=await client.request('你好',{topic:0,cursor:0});
 assert.equal(round.failed,true);assert.match(round.messages[0].text,/空/);
 assert.equal(client.state.reason,'empty_response');assert.equal(client.history.length,0);
});
test('local fallback keeps ordinary speech to one short response',async()=>{
 const client=new ResponseClient({fallback:()=>({matched:true,topic:0,nextCursor:2,messages:[{actor:0,text:'先去观察。'},{actor:2,text:'还要验证。'}]}),fetchImpl:async()=>{throw new Error('offline');}});
 const round=await client.request('说说观察。',{topic:0,cursor:0});assert.equal(round.messages.length,1);assert.equal(round.messages[0].actor,0);
});
test('server silence does not become a connection bubble or a local fallback',async()=>{
 let fallbacks=0;const client=new ResponseClient({fallback:()=>{fallbacks++;return fallback();},fetchImpl:async()=>new Response(JSON.stringify({suppressed:true,messages:[]}))});
 assert.equal(await client.request('静默句',{topic:0,cursor:0}),null);assert.equal(fallbacks,0);assert.equal(client.state.mode,'silent');assert.equal(client.history.length,0);
});
test('improv failures stay off stage and cannot borrow the local fallback actor',async()=>{
 let fallbacks=0;const client=new ResponseClient({fallback:()=>{fallbacks++;return fallback();},fetchImpl:async()=>{throw new Error('offline');}});
 assert.equal(await client.request('稿外',{topic:0,cursor:0,improv:true,improvActors:[3]}),null);assert.equal(fallbacks,0);assert.equal(client.state.mode,'error');
});
test('improv supports intentional silence and validates the supplied cast',async()=>{
 for(const messages of [[],[{actor:0,text:'主角不得即兴。'}]] ){
  const client=new ResponseClient({fallback,fetchImpl:async()=>new Response(JSON.stringify({messages}))});
  assert.equal(await client.request('稿外',{topic:0,cursor:0,improv:true,improvActors:[3]}),null);assert.equal(client.history.length,0);
 }
});
