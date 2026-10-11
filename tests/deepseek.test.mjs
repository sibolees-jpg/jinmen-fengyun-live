import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReplies,generateReply,publicStatus} from '../backend/deepseek.mjs';
const config={apiKey:'test-private-key',baseUrl:'https://api.deepseek.com',model:'deepseek-flash'};
test('enabled improv can add one linked remark about the recent speech, then stops',async()=>{
 let sent;
 const result=await generateReply({...config,allowDiscussion:true},{text:'工具越来越聪明，我们还要学什么？',history:[{role:'user',content:'刚才我们说到人工智能与劳动。'}]},{fetchImpl:async(_url,options)=>{
  sent=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({messages:[{actor:8,text:'工具替我搬土，可不能替我决定移哪座山。',replyTo:null},{actor:6,text:'那我来试试，把这份理想画成能验证的方案。',replyTo:0},{actor:8,text:'继续聊。',replyTo:1}]})}}]}));
 }});
 assert.equal(result.messages.length,2);assert.equal(result.messages[1].replyTo,0);assert.equal(result.discussionMode,'improv');
 assert.match(sent.messages[0].content,/刚才/);assert.match(sent.messages[0].content,/最多两条/);
 assert.ok(sent.messages.some(m=>m.content==='刚才我们说到人工智能与劳动。'));
});
test('rejects invalid, empty or duplicate character replies',()=>{
 assert.throws(()=>normalizeReplies({messages:[]}));
 assert.throws(()=>normalizeReplies({messages:[{actor:99,text:'不合法'}]}));
 assert.throws(()=>normalizeReplies({messages:[{actor:0,text:'a'},{actor:0,text:'b'}]}));
 assert.throws(()=>normalizeReplies({messages:[{actor:0,text:' '}]}));
 const r=normalizeReplies({messages:[{actor:3,text:'  从今天开始。  '}]});
 assert.deepEqual(r,[{actor:3,text:'从今天开始。',replyTo:null,source:'DeepSeek'}]);
});
test('rejects oversized speech instead of clipping it into an incomplete sentence',()=>{
 assert.throws(()=>normalizeReplies({messages:[{actor:1,text:'字'.repeat(81)}]}));
});
test('generates one JSON round with private authorization and limited context',async()=>{
 let request;
 const result=await generateReply(config,{text:'无聊的课就该睡觉吗？',history:[]},{fetchImpl:async(url,options)=>{
  request={url,...options};return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({messages:[{actor:2,text:'先看看，究竟是什么让这堂课无聊。'}]})}}]}),{status:200});
 }});
 assert.equal(request.url,'https://api.deepseek.com/chat/completions');
 assert.equal(request.headers.Authorization,'Bearer test-private-key');
 const body=JSON.parse(request.body);assert.equal(body.thinking.type,'disabled');
 assert.equal(body.response_format.type,'json_object');assert.match(body.messages.at(-1).content,/无聊的课/);
 assert.equal(result.messages[0].actor,2);assert.equal(result.provider,'deepseek');
 assert.ok(!JSON.stringify(result).includes(config.apiKey));
 assert.ok(!JSON.stringify(publicStatus(config)).includes(config.apiKey));
});
test('provider errors do not expose credentials or raw upstream data',async()=>{
 await assert.rejects(generateReply(config,{text:'你好'},{fetchImpl:async()=>new Response('test-private-key',{status:401})}),e=>e.code==='auth'&&!e.message.includes(config.apiKey));
});
test('truncated model output is rejected',async()=>{
 await assert.rejects(generateReply(config,{text:'你好'},{fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]}))}),e=>e.code==='invalid_response');
});
test('recovers once from a successful completion containing only whitespace',async()=>{
 let calls=0;
 const result=await generateReply(config,{text:'没读过莎士比亚的都该死'},{fetchImpl:async()=>{
  calls++;
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:calls===1?'   \n  ':JSON.stringify({messages:[{actor:1,text:'没读过只是还没遇见，不是罪。'}]})}}]}));
 }});
 assert.equal(calls,2);assert.equal(result.messages[0].text,'没读过只是还没遇见，不是罪。');
});
test('persistent empty output stops after one retry and has a distinct error',async()=>{
 let calls=0;
 await assert.rejects(generateReply(config,{text:'你好'},{fetchImpl:async()=>{
  calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:''}}]}));
 }}),e=>e.code==='empty_response');
 assert.equal(calls,2);
});
test('does not retry filtered responses as though they were empty completions',async()=>{
 let calls=0;
 await assert.rejects(generateReply(config,{text:'测试'},{fetchImpl:async()=>{
  calls++;return new Response(JSON.stringify({choices:[{finish_reason:'content_filter',message:{content:''}}]}));
 }}),e=>e.code==='invalid_response');
 assert.equal(calls,1);
});
test('accepts a linked A-B-A dialogue and preserves the reply target',()=>{
 const result=normalizeReplies({messages:[{actor:0,text:'先快乐。',replyTo:null},{actor:2,text:'快乐也可以观察。',replyTo:0},{actor:0,text:'也要留一点无用的趣味。',replyTo:1}]});
 assert.equal(result.length,3);assert.equal(result[2].actor,0);assert.equal(result[2].replyTo,1);
});
test('rejects dialogue links to later lines or to the same speaker',()=>{
 assert.throws(()=>normalizeReplies({messages:[{actor:0,text:'开头',replyTo:1},{actor:2,text:'接话',replyTo:0}]}));
 assert.throws(()=>normalizeReplies({messages:[{actor:0,text:'开头',replyTo:null},{actor:0,text:'又是自己',replyTo:0}]}));
});
test('ordinary input never expands into a group discussion even if the model returns extra lines',async()=>{
 const result=await generateReply(config,{text:'艺术课只要让学生开心就够了。'},{fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({messages:[{actor:0,text:'先让学生愿意观察，也是一种开始。',replyTo:null},{actor:2,text:'东坡，观察也得有方法。',replyTo:0},{actor:0,text:'那就从一片叶子开始。',replyTo:1}]})}}]}))});
 assert.equal(result.messages.length,1);assert.equal(result.messages[0].actor,0);assert.equal(result.messages[0].replyTo,null);
});
test('only the two named demo phrases enable a short exchange when test mode is on',async()=>{
 const reply={messages:[{actor:1,text:'困意可以理解，先看看课里缺了什么。',replyTo:null},{actor:2,text:'先找一个能验证的问题。',replyTo:0},{actor:1,text:'那就从学生最想问的一句开始。',replyTo:1}]};
 const fetchImpl=async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]}));
 for(const text of ['无聊的课就该睡觉','没读过莎士比亚就该去死','无聊的课，就该睡觉！']){
  const round=await generateReply({...config,testDiscussion:true,testPoints:['无聊的课就该睡觉','没读过莎士比亚就该去死']},{text},{fetchImpl});assert.equal(round.messages.length,3);assert.equal(round.discussionMode,'test');
 }
 const ordinary=await generateReply({...config,testDiscussion:true,testPoints:['无聊的课就该睡觉','没读过莎士比亚就该去死']},{text:'艺术课只要让学生开心就够了。'},{fetchImpl});assert.equal(ordinary.messages.length,1);assert.equal(ordinary.discussionMode,'brief');
 const disabled=await generateReply({...config,testDiscussion:false},{text:'无聊的课就该睡觉'},{fetchImpl});assert.equal(disabled.messages.length,1);
});

test('speech reference provides background without replacing the live sentence or triggering test discussions',async()=>{
 let sent;
 const result=await generateReply({...config,testDiscussion:true,testPoints:['无聊的课就该睡觉','没读过莎士比亚就该去死']},{text:'今天我们从一个问题开始。',speech:{title:'开学典礼',section:2,total:3,text:'无聊的课就该睡觉。欢迎新同学。'},history:[]},{fetchImpl:async(_url,options)=>{
  sent=JSON.parse(options.body);
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({messages:[{actor:0,text:'把好奇心带进新的课堂。',replyTo:null}]})}}]}));
 }});
 assert.ok(sent.messages.some(m=>m.role==='user'&&m.content.includes('欢迎新同学。')));
 assert.equal(sent.messages.at(-1).content,'今天我们从一个问题开始。');
 assert.equal(result.discussionMode,'brief');
});
test('supporting mode overrides old test prompts, permits silence and rejects main actors',async()=>{
 let sent;const invoke=messages=>generateReply({...config,testDiscussion:true,testPoints:['稿外'],allowDiscussion:true,improvActors:[3,4]},{text:'稿外内容'},{fetchImpl:async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({messages})}}]}));}});
 const silence=await invoke([]);assert.deepEqual(silence.messages,[]);assert.equal(silence.discussionMode,'improv');assert.match(sent.messages[0].content,/允许的角色只有：3 李叔同；4 蔡元培/);assert.match(sent.messages[0].content,/不改写或续写固定接话稿/);assert.doesNotMatch(sent.messages[0].content,/允许A-B-A/);
 await assert.rejects(invoke([{actor:0,text:'主角来插话。'}]),e=>e.code==='invalid_response');
 const reply=await invoke([{actor:3,text:'邱老师说得有趣。'},{actor:4,text:'我们继续听。',replyTo:0}]);assert.equal(reply.messages.length,2);assert.ok(reply.messages.every(m=>m.improv));
});

test('DeepSeek key is saved privately, status is masked and model check does not generate dialogue',async()=>{
 const {saveConfig,loadConfig,verifyModel}=await import('../backend/deepseek.mjs'),fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jinmen-deepseek-')),file=path.join(dir,'config.json');
 try{
  const status=saveConfig({apiKey:'sk-synthetic-test-only'},file);
  assert.equal(status.provider,'deepseek');assert.equal(status.configured,true);assert.equal(JSON.stringify(status).includes('sk-synthetic'),false);assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.throws(()=>saveConfig({apiKey:'bad'},file));assert.equal(JSON.parse(fs.readFileSync(file)).apiKey,'sk-synthetic-test-only');
  let request;const c={...loadConfig(file),apiKey:'sk-synthetic-test-only'};
  const result=await verifyModel(c,{fetchImpl:async(url,options)=>{request={url,options};return new Response(JSON.stringify({data:[{id:c.model}]}));}});
  assert.equal(request.url,'https://api.deepseek.com/models');assert.equal(request.options.body,undefined);assert.equal(result.verified,true);assert.equal(result.thinking,'disabled');
  await assert.rejects(verifyModel(c,{fetchImpl:async()=>new Response('secret upstream',{status:401})}),e=>e.code==='auth'&&!e.message.includes('secret'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('DeepSeek exact cast names and numeric strings normalize without admitting forbidden actors',async()=>{
 const invoke=actor=>generateReply({...config,improvActors:[1]},{text:'小猫来听课。'},{fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({messages:[{actor,text:'给它留一个旁听的位置。',replyTo:null}]})}}]}))});
 for(const actor of ['李鸿章','1',1])assert.equal((await invoke(actor)).messages[0].actor,1);
 for(const actor of ['梁启超','一个不存在的人','0','1 李鸿章'])await assert.rejects(invoke(actor),e=>e.code==='invalid_response');
});
