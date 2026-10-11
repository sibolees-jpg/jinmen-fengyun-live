const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('hard audio restart discards buffered audio and ignores late old SSE and old upload failure',async()=>{
 const requests=[],streams=[],nodes=[],transcripts=[],states=[];let serial=0,rejectOld;
 class Context{constructor(){this.sampleRate=48000;this.audioWorklet={addModule:async()=>{}};this.destination={};}async resume(){}async close(){}createMediaStreamSource(){return {connect(){},disconnect(){}};}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}}
 class Worklet{constructor(){this.port={postMessage(){}};nodes.push(this);}connect(){}disconnect(){}}
 class Events{constructor(){streams.push(this);}close(){this.closed=true;}}
 const scope={AbortSignal,setTimeout,clearTimeout,AudioContext:Context,AudioWorkletNode:Worklet,EventSource:Events,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},fetch:async(url)=>{requests.push(url);if(url.includes('audio?id=session-1'))return new Promise((_,reject)=>rejectOld=reject);return new Response(JSON.stringify(url.endsWith('/start')?{id:'session-'+(++serial)}:{accepted:true}));}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../speech-capture.js'),'utf8'),scope);
 const c=new scope.SpeechCapture({onState:s=>states.push(s),onTranscript:s=>transcripts.push(s)});await c.start();const old=streams[0];
 nodes[0].port.onmessage({data:{audio:new ArrayBuffer(16),rms:.2}});nodes[0].port.onmessage({data:{audio:new ArrayBuffer(16),rms:.2}});assert.equal(c.queue.length,1);
 await c.restartFresh();assert.equal(c.id,'session-2');assert.equal(c.queue.length,0);assert.ok(requests.includes('/api/speech/discard?id=session-1'));assert.ok(!requests.some(r=>r.includes('/stop')),'rescue cannot flush obsolete speech as a final');
 old.onmessage({data:JSON.stringify({type:'transcript',text:'旧语音',seq:999,final:true})});old.onmessage({data:JSON.stringify({type:'stopped'})});rejectOld(new Error('old upload failed'));await new Promise(r=>setImmediate(r));
 assert.equal(c.id,'session-2');assert.equal(c.active,true);assert.equal(transcripts.length,0);assert.notEqual(states.at(-1).mode,'error');
 streams[1].onmessage({data:JSON.stringify({type:'transcript',text:'新场当前句',seq:1,final:false})});assert.equal(transcripts.at(-1).session,'session-2');assert.equal(transcripts.length,1);await c.fail('test cleanup');
});
