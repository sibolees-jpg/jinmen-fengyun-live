const {test}=require('node:test'),assert=require('node:assert/strict');
const {stage}=require('./helpers/stage-fixture.cjs'),catalog=require('../show/scenes.json').catalog,script=require('../show/script.json').script;
const flush=()=>new Promise(r=>setImmediate(r));
async function live(){const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await flush();s.command('scene-take',{sceneId:'sc-q925-t2',revision:0});s.command('script-improv',{enabled:true});s.command('voice-state',{active:true,session:'t2'});s.tick(100);return s;}
const status=s=>{s.command('hello');return s.posted.at(-1);};
const heard=(s,seq,text,final=true)=>s.command('voice-transcript',{session:'t2',seq,text,final,epoch:status(s).controlEpoch,source:'doubao-api'});
const noise=s=>s.command('voice-activity',{session:'t2',epoch:status(s).controlEpoch});
test('T2 confirmed speech survives raw microphone activity before the next scheduler tick',async()=>{
 const s=await live();heard(s,1,'请谈谈艺术教育的意义。');noise(s);s.tick(100);assert.equal(s.calls.length,1);assert.equal(s.calls[0].body.liveSceneId,'sc-q925-t2');s.command('clear');
});
test('T2 keeps an in-flight answer and displays it despite fresh interim text or repeated setting sync',async()=>{
 const s=await live();heard(s,1,'大家好。');s.tick(100);assert.equal(s.calls.length,1);noise(s);heard(s,2,'我们接着聊',false);s.command('improv-style',{value:'dialogue'});
 await s.answer([{actor:0,text:'今日相聚，愿大家带着好奇一起看看艺术。'}]);s.tick(800);assert.ok(status(s).actors.some(a=>a.captionVisible));assert.equal(status(s).liveReply.requests,1);s.command('clear');
});
test('T2 keeps only the newest waiting final while a response is shown, never consumes it as a busy skip',async()=>{
 const s=await live();heard(s,1,'第一段现场问题。');s.tick(100);await s.answer([{actor:0,text:'先来谈谈眼前的作品。'}]);s.tick(1000);
 heard(s,2,'第二段问题。');s.tick(100);heard(s,3,'更新后的第三段问题。');s.tick(100);assert.equal(s.calls.length,1);assert.equal(status(s).liveReply.queued,1);
 for(let i=0;i<100&&s.calls.length<2;i++)s.tick(100);assert.equal(s.calls.length,2);assert.equal(s.calls[1].body.text,'更新后的第三段问题。');s.command('clear');
});
test('T2 closing switch or leaving scene still invalidates pending answers',async()=>{
 for(const action of ['off','leave']){const s=await live();heard(s,1,'这个问题还在等待回答。');s.tick(100);if(action==='off')s.command('script-improv',{enabled:false});else s.command('scene-take',{sceneId:'sc-q925-t1',revision:0});await s.answer([{actor:0,text:'不能出现在关闭后的回应。'}]);s.tick(1500);assert.ok(status(s).actors.every(a=>!a.captionVisible));s.command('clear');}
});
test('T2 can submit manually confirmed interim speech after stopping the microphone',async()=>{
 const s=await live();heard(s,1,'想请教一下艺术教育',false);s.command('voice-state',{active:false,session:'t2'});s.command('voice-confirm');s.tick(100);assert.equal(s.calls.length,1);assert.equal(s.calls[0].body.text,'想请教一下艺术教育');s.command('clear');
});
