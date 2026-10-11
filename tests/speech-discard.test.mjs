import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {EventEmitter} from 'node:events';
import {routeSpeech} from '../backend/speech.mjs';import {DoubaoSpeechService} from '../backend/doubao-speech.mjs';import {packet,decode} from '../backend/doubao-protocol.mjs';
test('discard endpoint immediately terminates old recognition, never sends a final flush, and permits a fresh session',async()=>{
 const sockets=[],service=new DoubaoSpeechService({getConfig:()=>({apiKey:'synthetic',resourceId:'volc.seedasr.sauc.duration'}),connect(){const s=new EventEmitter();s.sent=[];s.send=x=>s.sent.push(x);s.terminate=()=>s.terminated=true;sockets.push(s);queueMicrotask(()=>s.emit('open'));return s;}}),server=http.createServer((req,res)=>routeSpeech(service,req,res,new URL(req.url,'http://localhost')));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const {id}=await service.start(16000),events=[];service.subscribe(id,x=>events.push(x));service.audio(id,Buffer.alloc(400));
 const url='http://127.0.0.1:'+server.address().port+'/api/speech/discard?id='+id,res=await fetch(url,{method:'POST'});assert.equal(res.status,200);assert.equal(service.busy,false);assert.equal(sockets[0].terminated,true);assert.ok(!sockets[0].sent.some(x=>decode(x).last));
 sockets[0].emit('message',packet(9,{result:{utterances:[{text:'旧场',start_time:0,definite:true}]}},{json:true}));assert.equal(events.some(e=>e.type==='transcript'),false);const fresh=await service.start(16000);assert.notEqual(fresh.id,id);assert.equal(service.busy,true);
 }finally{service.close();await new Promise(r=>server.close(r));}
});
