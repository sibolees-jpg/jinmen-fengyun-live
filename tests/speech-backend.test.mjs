import {test} from 'node:test';import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';import {EventEmitter} from 'node:events';
import {SpeechService} from '../backend/speech.mjs';
function fixture(){let worker;const speech=new SpeechService({spawnImpl:()=>{worker=new EventEmitter();worker.stdin=new PassThrough();worker.stdout=new PassThrough();worker.stderr=new PassThrough();worker.kill=()=>worker.emit('exit',0);queueMicrotask(()=>worker.stdout.write('{"type":"ready"}\n'));return worker;}});return {speech,worker:()=>worker};}
test('one local speech session validates access and PCM before forwarding it',async t=>{
 const f=fixture();t.after(()=>f.speech.close());const session=await f.speech.start(16000);
 assert.throws(()=>f.speech.audio('wrong',Buffer.alloc(16)),/会话/);
 assert.throws(()=>f.speech.audio(session.id,Buffer.alloc(3)),/音频/);
 await assert.rejects(f.speech.start(16000),/正在/);
 f.speech.audio(session.id,Buffer.alloc(64));assert.equal(f.worker().stdin.read().length,64);
 f.speech.stop(session.id);assert.equal(f.worker().stdin.writableEnded,true);
});
test('worker failure ends the session and reports a safe actionable error',async t=>{
 const f=fixture();t.after(()=>f.speech.close());const session=await f.speech.start(16000);const events=[];f.speech.subscribe(session.id,e=>events.push(e));
 f.worker().emit('exit',1);assert.ok(events.some(e=>e.type==='error'));assert.equal(f.speech.busy,false);
});
test('final and interim records preserve order and malformed output never escapes',async t=>{
 const f=fixture();t.after(()=>f.speech.close());const session=await f.speech.start(16000);const events=[];f.speech.subscribe(session.id,e=>events.push(e));
 f.worker().stdout.write('bad output\n{"type":"transcript","text":"你好","final":false}\n{"type":"transcript","text":"你好。","final":true}\n');
 const chunks=events.filter(e=>e.type==='transcript');assert.equal(chunks.length,2);assert.equal(chunks[1].final,true);assert.ok(chunks[1].seq>chunks[0].seq);
});
test('macOS fallback HTTP routes are independent from Doubao credentials and reject simultaneous capture',async t=>{
 const {createAppServer}=await import('../server.mjs'),native={busy:false,async status(){return {available:true,provider:'macOS'};},async start(){this.busy=true;return {id:'local-test',sampleRate:16000};},stop(id){assert.equal(id,'local-test');this.busy=false;},close(){}},cloud={busy:false,status:async()=>({available:false}),close(){}};
 const server=createAppServer({speech:cloud,nativeSpeech:native,getConfig:()=>({})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await (await fetch(base+'/api/macos-speech/status')).json()).available,true);
 const start=()=>fetch(base+'/api/macos-speech/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sampleRate:16000})});assert.equal((await (await start()).json()).id,'local-test');
 assert.equal((await fetch(base+'/api/speech/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"sampleRate":16000}'})).status,409);
 await fetch(base+'/api/macos-speech/stop?id=local-test',{method:'POST'});assert.equal(native.busy,false);cloud.busy=true;assert.equal((await start()).status,409);
});
