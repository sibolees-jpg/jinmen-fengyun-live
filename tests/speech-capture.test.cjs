const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function fixture({mediaPromise,getMedia,failWorklet=false}={}){
 const records=[],states=[],transcripts=[],levels=[];let stopped=0,closed=0,events,node;
 const media={getTracks:()=>[{stop:()=>stopped++}]};
 class Context{constructor(){this.sampleRate=48000;this.audioWorklet={addModule:async()=>{if(failWorklet)throw new Error('worklet failed');}};this.destination={};}async resume(){}async close(){closed++;}createMediaStreamSource(){return {connect(){},disconnect(){}};}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}}
 class Worklet{constructor(){node=this;this.port={postMessage:()=>{this.port.onmessage({data:{audio:new ArrayBuffer(8)}});this.port.onmessage({data:{flushed:true}});}};}connect(){}disconnect(){}}
 class Events{constructor(){events=this;}close(){this.closed=true;}}
 const scope={AbortSignal,setTimeout,clearTimeout,AudioContext:Context,AudioWorkletNode:Worklet,EventSource:Events,navigator:{mediaDevices:{getUserMedia:()=>getMedia?getMedia():mediaPromise||Promise.resolve(media)},sendBeacon(){}},fetch:async(url,opts)=>{records.push(url);return new Response(JSON.stringify(url.includes('/start')?{id:'test-session',sampleRate:48000}:{accepted:true}));}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../speech-capture.js'),'utf8'),scope);
 const capture=new scope.SpeechCapture({onState:s=>states.push(s),onTranscript:t=>transcripts.push(t),onLevel:e=>levels.push(e)});
 return {capture,records,states,transcripts,levels,media,events:()=>events,node:()=>node,stopped:()=>stopped,closed:()=>closed};
}
test('stop flushes remaining audio before ending the session and releases microphone',async()=>{
 const f=fixture();await f.capture.start();f.events().onmessage({data:JSON.stringify({type:'transcript',seq:1,text:'你好。',final:true})});assert.equal(f.transcripts[0].session,'test-session');
 await f.capture.stop();assert.equal(f.stopped(),1);assert.equal(f.closed(),1);
 assert.ok(f.records.findIndex(x=>x.includes('/audio'))<f.records.findIndex(x=>x.includes('/stop')));
 f.events().onmessage({data:'{"type":"stopped"}'});assert.equal(f.capture.stopping,false);
});
test('failure during audio setup releases an already granted microphone',async()=>{
 const f=fixture({failWorklet:true});await f.capture.start();assert.equal(f.capture.active,false);assert.equal(f.stopped(),1);assert.equal(f.closed(),1);assert.equal(f.states.at(-1).mode,'error');
});
test('cancelling while permission is pending never leaves the later stream recording',async()=>{
 let grant;const f=fixture({mediaPromise:new Promise(r=>grant=r)});const starting=f.capture.start();await f.capture.stop();grant(f.media);await starting;assert.equal(f.stopped(),1);assert.equal(f.records.length,0);assert.equal(f.capture.active,false);
});

test('microphone level measurement is independent of API and does not upload monitoring audio',async()=>{const f=fixture();await f.capture.start('',{monitorOnly:true});assert.equal(f.states.at(-1).mode,'monitoring');f.node().port.onmessage({data:{audio:new ArrayBuffer(16),rms:.25,peak:.5}});assert.equal(f.levels.at(-1).rms,.25);assert.equal(f.records.length,0);await f.capture.stop();assert.equal(f.stopped(),1);assert.equal(f.levels.at(-1).active,false);assert.equal(f.records.length,0);});

test('cancelled device permission cannot change a fresh monitoring session',async()=>{
 const grants=[];const f=fixture({getMedia:()=>new Promise(resolve=>grants.push(resolve))});
 const oldStart=f.capture.start('',{monitorOnly:true});await f.capture.stop();assert.equal(f.capture.starting,false);
 const freshStart=f.capture.start('',{monitorOnly:true});grants[0](f.media);await oldStart;
 assert.equal(f.capture.starting,true);assert.equal(f.stopped(),1);assert.equal(f.capture.active,false);
 grants[1](f.media);await freshStart;assert.equal(f.capture.active,true);assert.equal(f.states.at(-1).mode,'monitoring');assert.equal(f.records.length,0);
 await f.capture.stop();assert.equal(f.stopped(),2);
});
