const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const {parseHTML}=require('linkedom');
test('a cached audience page without the new cue guard cannot start protected microphone reception',async()=>{
 const f=await director({configured:true,manuscript:require('../speeches/2026-120周年校庆/津门风云-9.23-v19.json')});delete f.status.cueGuardVersion;f.update();
 assert.equal(f.document.getElementById('speech-toggle').disabled,true);assert.equal(f.document.getElementById('rehearsal-start').disabled,true);
 f.status.cueGuardVersion=2;f.update();assert.equal(f.document.getElementById('speech-toggle').disabled,false);
});
test('future manuscript edits require reviewed one-to-one coverage before replacement',async()=>{
 const f=await director({manuscript:require('../speeches/2026-120周年校庆/津门风云-9.23-v19.json')}),d=f.document;
 d.getElementById('script-dialog').showModal=()=>{};d.getElementById('script-edit').onclick();
 assert.equal(d.getElementById('script-apply').disabled,true);d.getElementById('script-check').onclick();
 assert.equal(d.getElementById('script-apply').disabled,false);assert.equal(d.getElementById('script-check-preview').children.length,133);
 assert.match(d.getElementById('script-check-result').textContent,/133 句全部有接话/);
 d.getElementById('script-text').value='只有一段的新稿';d.getElementById('script-text').oninput();d.getElementById('script-check').onclick();
 assert.equal(d.getElementById('script-apply').disabled,true);assert.match(d.getElementById('script-error').textContent,/8 个场次/);
});
async function director({configured=false,source='api',manuscript,nativeAvailable=true}={}){
 const {document,window}=parseHTML(fs.readFileSync(path.join(__dirname,'../director.html'),'utf8')),script=manuscript||JSON.parse(fs.readFileSync(path.join(__dirname,'../speeches/2026-120周年校庆/津门风云-蓝字完整编排-v2.json'),'utf8')),channels=[],sent=[],timers=[];let events,worklet,stops=0,starts=0,apiSessions=0;const requests=[];
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value||this.options[0]?.value||'';},set(value){for(const o of this.options){if(o.value===String(value))o.setAttribute('selected','');else o.removeAttribute('selected');}}});
 window.HTMLElement.prototype.scrollIntoView=function(){};
 function Option(text,value){const opt=document.createElement('option');opt.textContent=text;opt.value=value;return opt;}
 class Context{constructor(){this.sampleRate=48000;this.audioWorklet={addModule:async()=>{}};this.destination={};}async resume(){}async close(){}createMediaStreamSource(){return {connect(){},disconnect(){}};}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}}
 class Worklet{constructor(){worklet=this;this.port={postMessage:()=>this.port.onmessage({data:{flushed:true}})};}connect(){}disconnect(){}}
 let finaleOptions;
 const context={setupFinaleDirector(options){finaleOptions=options;},document,Event:window.Event,Option,AudioContext:Context,AudioWorkletNode:Worklet,EventSource:class{constructor(){events=this;}close(){}},Date,Blob,URL,AbortSignal,AbortController,structuredClone,crypto:globalThis.crypto,performance:{now:()=>0},navigator:{mediaDevices:{enumerateDevices:async()=>[],getUserMedia:async()=>{starts++;return {getTracks:()=>[{stop(){stops++;}}]};}},sendBeacon(){}},setInterval(fn){timers.push(fn);},setTimeout(){return 1;},clearTimeout(){},addEventListener(){},localStorage:{getItem(){return null;},setItem(){}},BroadcastChannel:class{constructor(){channels.push(this);}postMessage(m){sent.push(m);}},fetch:async(url,options)=>{
  requests.push(url);
  if(url==='/api/macos-speech/status')return {ok:true,json:async()=>({available:nativeAvailable,provider:'macOS 本机识别'})};
  if(url==='/api/macos-speech/start')return {ok:true,json:async()=>({id:'macos-recording'})};
  if(url.includes('/api/macos-speech/stop'))return {ok:true,json:async()=>({stopping:true})};
  if(url==='/api/speech/status')return {ok:true,json:async()=>({configured,available:configured,provider:'豆包语音 API',message:configured?'已配置':'请填写凭据',calibration:{hotwords:100,state:'prepared'}})};
  if(url==='/api/script')return {ok:true,json:async()=>({revision:2,script})};
  if(url==='/api/status')return {ok:true,json:async()=>({configured:false,improvEnabled:false,model:'gpt-6-astra'})};
  if(url==='/api/rehearsal/status')return {ok:true,json:async()=>({id:null})};
  if(url==='/api/speech/start'){const id=++apiSessions===1?'test-recording':'test-recording-'+apiSessions;return {ok:true,json:async()=>({id})};}
  if(url.includes('/api/speech/discard'))return {ok:true,json:async()=>({discarded:true})};
  if(url.includes('/api/speech/stop'))return {ok:true,json:async()=>({stopping:true})};
  throw new Error('Unexpected route '+url);
 }};context.window=context;context.globalThis=context;vm.createContext(context);
 for(const filename of ['ui-patch.js','dictation-input.js','data.js','dialogue.js','rehearsal.js','rehearsal-director.js','scene-plan.js','cue-ledger.js','speech-calibration.js','cue-plan.js','cue-tracker.js','speech-script.js','script-sync.js','script-follow.js','speech-capture.js','speech-director.js','director.js','motion-director.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),context,{filename});
 await new Promise(r=>setImmediate(r));
 const status={type:'status',stageVersion:13,playbackVersion:30,cueGuardVersion:2,sentenceAdvanceVersion:2,scriptSignature:'director-test',controlEpoch:1,inputSession:'',inputSeq:0,inputFinalSeq:0,topic:0,paused:false,speed:1,capacity:3,cues:[],actors:Array.from({length:9},(_,id)=>({id,phase:'idle'})),follow:{active:false},rehearsal:{active:false},trace:[]};
 const update=()=>channels[0].onmessage({data:status});
 if(source==='local'){document.getElementById('input-mode').value='local';document.getElementById('input-mode').onchange();}
 return {document,sent,requests,update,status,timers,context,script,finaleOptions:()=>finaleOptions,events:()=>events,worklet:()=>worklet,starts:()=>starts,stops:()=>stops};
}

test('latest Q director shows all three silent opening sentences and follows a selected sequence before speech starts',async()=>{
 const manuscript=require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json'),d=await director({configured:true,manuscript});
 d.status.cueGuardVersion=4;d.status.sequenceScriptVersion=2;d.status.scriptSignature=d.context.SpeechCalibration.signature(manuscript);d.update();
 assert.match(d.document.getElementById('script-info').textContent,/113/);
 const opening=[...d.document.querySelectorAll('#rehearsal-lines .sentence-cue')];assert.equal(opening.length,3);assert.ok(opening.every(n=>n.textContent.includes('开场介绍')));
 d.status.topic=1;d.status.presentation={index:0,sentenceIndex:-1};d.update();
 assert.equal(d.document.querySelector('.lyric-line.is-current .lyric-text').textContent,manuscript.blocks[1].sentences[0].text);
 assert.match(d.document.querySelector('.lyric-line.is-current').textContent,new RegExp(manuscript.blocks[1].sentences[0].trigger));
 assert.equal(d.document.getElementById('rehearsal-start').disabled,false);
 delete d.status.sequenceScriptVersion;d.update();assert.equal(d.document.getElementById('speech-toggle').disabled,true);
});

test('director boots all 22 sections with continuous API mode default and a truthful unconfigured state',async()=>{const d=await director();d.update();assert.equal(d.document.querySelectorAll('#topic-tabs button').length,22);assert.equal(d.document.querySelectorAll('#rehearsal-lines .sentence-cue').length,2);assert.equal(d.document.getElementById('speech-toggle').disabled,true);assert.equal(d.document.getElementById('input-mode').value,'api');assert.equal(d.document.getElementById('api-input-panel').hidden,false);assert.ok(d.document.getElementById('dictation-text'));assert.equal(d.starts(),0);});
test('API mode still requires credentials',async()=>{const d=await director({source:'api'});d.update();assert.equal(d.document.getElementById('speech-toggle').disabled,true);assert.match(d.document.getElementById('speech-status').textContent,/凭据/);});
test('one circular API button starts real capture control and stops without input focus',async()=>{const d=await director({configured:true,source:'api'});assert.equal(d.document.getElementById('speech-toggle').disabled,true);d.update();const button=d.document.getElementById('speech-toggle');assert.equal(button.disabled,false);button.click();await new Promise(r=>setImmediate(r));assert.equal(d.starts(),1);assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(d.document.getElementById('speech-icon').getAttribute('src'),'assets/ui/mic-on.png');button.click();await new Promise(r=>setImmediate(r));assert.equal(d.stops(),1);d.events().onmessage({data:'{"type":"stopped"}'});assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(d.document.getElementById('speech-icon').getAttribute('src'),'assets/ui/mic-off.png');});
test('unchanged status does not replace microphone image or live text nodes 100 times',async()=>{const d=await director();d.update();const img=d.document.getElementById('speech-icon'),node=d.document.getElementById('speech-status').firstChild,progress=d.document.getElementById('section-progress').firstChild;let writes=0;const attr=img.setAttribute.bind(img);img.setAttribute=(k,v)=>{if(k==='src')writes++;attr(k,v);};for(let i=0;i<100;i++)d.update();assert.equal(writes,0);assert.equal(d.document.getElementById('speech-status').firstChild,node);assert.equal(d.document.getElementById('section-progress').firstChild,progress);});
test('local text sends interim and final, waits for screen acknowledgement before stop, and never opens microphone',async()=>{const d=await director({source:'local'});d.update();const field=d.document.getElementById('dictation-text'),button=d.document.getElementById('speech-toggle');button.click();assert.equal(field.readOnly,false);field.value='百年老人，何来少年心气';field.dispatchEvent(new d.context.Event('input'));button.click();const final=d.sent.filter(m=>m.action==='voice-transcript'&&m.final).at(-1);assert.ok(final);assert.equal(final.source,'doubao-input');assert.equal(final.text,'百年老人，何来少年心气');assert.equal(button.disabled,true);d.status.inputSession=final.session;d.status.inputFinalSeq=final.seq;d.update();for(const fn of d.timers)fn();assert.equal(field.readOnly,true);assert.equal(d.starts(),0);assert.equal(button.getAttribute('aria-pressed'),'false');});
test('local reception waits for the screen script to finish loading',async()=>{const d=await director({source:'local'});d.status.scriptReady=false;d.update();assert.equal(d.document.getElementById('speech-toggle').disabled,true);d.status.scriptReady=true;d.update();assert.equal(d.document.getElementById('speech-toggle').disabled,false);});
test('stopping during IME composition sends the final composed sentence before disabling input',async()=>{const d=await director({source:'local'});d.update();const field=d.document.getElementById('dictation-text'),button=d.document.getElementById('speech-toggle');button.click();field.dispatchEvent(new d.context.Event('compositionstart'));field.value='百年老人，何来少年心气';field.dispatchEvent(new d.context.Event('input'));button.click();assert.equal(d.sent.filter(m=>m.action==='voice-transcript'&&m.final).length,0);field.dispatchEvent(new d.context.Event('compositionend'));const final=d.sent.filter(m=>m.action==='voice-transcript'&&m.final).at(-1);assert.ok(final);assert.equal(final.text,field.value||'百年老人，何来少年心气');d.status.inputSession=final.session;d.status.inputFinalSeq=final.seq;d.update();for(const fn of d.timers)fn();assert.equal(field.readOnly,true);});
test('opening an existing named stage only focuses it and never replaces its current document',async()=>{const d=await director();d.update();let replaces=0,focuses=0;d.context.open=()=>({closed:false,location:{href:'http://127.0.0.1:8879/index.html',replace(){replaces++;}},focus(){focuses++;}});d.document.getElementById('open-stage').click();d.document.getElementById('open-stage').click();assert.equal(replaces,0);assert.equal(focuses,2);});

test('streaming partial is forwarded without a final sentence and rehearsal cannot switch capture off',async()=>{
 const d=await director({configured:true});d.update();d.document.getElementById('speech-toggle').click();await new Promise(r=>setImmediate(r));
 d.events().onmessage({data:JSON.stringify({type:'transcript',seq:1,text:'百廿老人何来',final:false})});
 assert.ok(d.sent.some(m=>m.type==='command'&&m.action==='voice-transcript'&&m.final===false&&m.text==='百廿老人何来'));
 d.document.getElementById('rehearsal-start').click();assert.equal(d.sent.some(m=>m.action==='rehearsal-start'),false);assert.equal(d.stops(),0);
 d.document.getElementById('clear').click();assert.equal(d.stops(),0);assert.equal(d.document.getElementById('speech-toggle').getAttribute('aria-pressed'),'true');
});
test('director follows partial and rehearsal progress, keeps past lines and folds past parts, and preserves current DOM',async()=>{
 const d=await director();d.update();
 d.status.presentation={active:true,source:'speech',index:0,sentenceIndex:0};d.update();
 assert.equal(d.document.querySelector('.sentence-cue.is-current').dataset.sentenceIndex,'0');
 d.status.presentation.sentenceIndex=1;d.update();
 assert.equal(d.document.querySelectorAll('.sentence-cue')[0].hidden,false);assert.equal(d.document.querySelector('.sentence-cue.is-current').dataset.sentenceIndex,'1');
 const current=d.document.querySelector('.sentence-cue.is-current');for(let i=0;i<100;i++)d.update();assert.equal(d.document.querySelector('.sentence-cue.is-current'),current);
 d.status.presentation={active:true,source:'rehearsal',index:1,sentenceIndex:0};d.update();
 assert.match(d.document.getElementById('rehearsal-heading').textContent,/^02/);assert.equal(d.document.querySelector('#topic-tabs button').hidden,true);
 assert.equal(d.document.querySelector('.sentence-cue.is-current').dataset.sentenceIndex,'0');assert.match(d.document.getElementById('completed-sections').textContent,/1/);
});
test('unsaved script edits survive automatic section changes',async()=>{
 const d=await director();d.update();const title=d.document.getElementById('rehearsal-title');title.value='未保存标题';title.oninput();
 d.status.presentation={active:true,source:'rehearsal',index:1,sentenceIndex:0};d.update();
 d.status.presentation={active:true,source:'rehearsal',index:0,sentenceIndex:0};d.update();assert.equal(title.value,'未保存标题');assert.equal(d.document.getElementById('rehearsal-save').disabled,false);
});

test('starting the finale requires the microphone stop button instead of stopping it implicitly',async()=>{const d=await director({configured:true});d.update();d.document.getElementById('speech-toggle').click();await new Promise(r=>setImmediate(r));assert.throws(()=>d.finaleOptions().stopCapture(),/点击麦克风停止接收/);assert.equal(d.stops(),0);});

test('recognizer payload cannot replace the command envelope or target screen',async()=>{
 const d=await director();d.status.stageId='current-screen';d.update();
 d.context.send('voice-transcript',{type:'transcript',action:'clear',stageId:'other-screen',text:'正在讲话',seq:4,final:false,session:'live',epoch:1});
 assert.deepEqual(JSON.parse(JSON.stringify(d.sent.at(-1))),{type:'command',action:'voice-transcript',stageId:'current-screen',text:'正在讲话',seq:4,final:false,session:'live',epoch:1});
});

test('sentence rescue reconnects active capture exactly once and ignores delayed old ASR without flushing it',async()=>{
 const d=await director({configured:true});d.update();d.document.getElementById('speech-toggle').click();await new Promise(r=>setImmediate(r));
 const old=d.events();assert.equal(d.starts(),1);
 Object.assign(d.status,{controlEpoch:2,inputSession:'',voiceReset:{kind:'sentence',token:'sentence-rescue-2',epoch:2,pending:true}});d.update();await new Promise(r=>setImmediate(r));
 assert.equal(d.starts(),2);assert.ok(d.requests.includes('/api/speech/discard?id=test-recording'));assert.ok(!d.requests.some(r=>r.startsWith('/api/speech/stop')));
 assert.ok(d.sent.some(m=>m.action==='voice-state'&&m.session==='test-recording-2'&&m.resetToken==='sentence-rescue-2'));
 const count=d.sent.filter(m=>m.action==='voice-transcript').length;
 old.onmessage({data:JSON.stringify({type:'transcript',seq:999,text:'已经过时的旧句子',final:true})});assert.equal(d.sent.filter(m=>m.action==='voice-transcript').length,count);
 d.events().onmessage({data:JSON.stringify({type:'transcript',seq:1,text:'重新收音的新句子',final:false})});
 assert.equal(d.sent.at(-1).session,'test-recording-2');assert.equal(d.sent.at(-1).epoch,2);
 d.update();await new Promise(r=>setImmediate(r));assert.equal(d.starts(),2,'repeat status must not restart again');
});
test('sentence rescue never turns on an idle microphone and old stages cannot offer the new insurance',async()=>{
 const d=await director({configured:true});d.status.presentation={index:0,sentenceIndex:0};
 Object.assign(d.status,{controlEpoch:2,voiceReset:{kind:'sentence',token:'offline-rescue',epoch:2,pending:false}});d.update();await new Promise(r=>setImmediate(r));assert.equal(d.starts(),0);
 d.status.sentenceAdvanceVersion=1;d.update();assert.equal(d.document.getElementById('force-next').disabled,true);assert.match(d.document.getElementById('safety-hint').textContent,/刷新大屏/);
});

test('Doubao SSE partial and final traverse the real relay and render on the stage',async t=>{
 const http=require('node:http'),{once}=require('node:events'),{WebSocket}=require('ws');
 const {attachStageChannel}=await import('../backend/stage-channel.mjs');
 const {stage}=require('./helpers/stage-fixture.cjs');
 const server=http.createServer(),relay=attachStageChannel(server),peers=[];
 t.after(async()=>{for(const peer of peers)peer.terminate();relay.close();await new Promise(r=>server.close(r));});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;
 async function until(predicate,label){const end=Date.now()+2000;while(!predicate()){assert.ok(Date.now()<end,label);await new Promise(r=>setTimeout(r,10));}}
 async function peer(role){
  const socket=new WebSocket(`ws://127.0.0.1:${port}/api/stage-channel?role=${role}`,{origin:`http://127.0.0.1:${port}`});
  socket.messages=[];socket.on('message',raw=>socket.messages.push(JSON.parse(raw)));peers.push(socket);
  await once(socket,'open');await until(()=>socket.messages.some(m=>m.type==='channel-state'),'channel connected');return socket;
 }
 const C=require('../scene-catalog.js'),timeline=require('../speeches/2026-120周年校庆/镜头本场景序列-v12.json'),catalog=C.seed();catalog.timeline=timeline;for(const map of catalog.maps)for(const scene of map.scenes){scene.background=C.STOCK;scene.fallbackStanding=true;}
 const screen=await peer('stage'),sender=await peer('director'),d=await director({configured:true}),s=stage({sceneCatalog:catalog,width:239});await new Promise(r=>setImmediate(r));
 s.command('speech-script',{script:require('../speeches/2026-120周年校庆/津门风云-9.22-v12.json')});
 Object.assign(d.status,s.posted.at(-1),{scriptReady:true,stageId:screen.messages.find(m=>m.type==='channel-state').stageId});d.update();
 // Exercise the real prepared scene catalog through the same speech/relay path.
 screen.on('message',raw=>{const message=JSON.parse(raw);if(message.type==='command'){s.command(message.action,message);s.tick(10);screen.send(JSON.stringify({...s.posted.at(-1),scriptReady:true}));}});
 let sent= d.sent.length;
 function forward(){for(const message of d.sent.slice(sent))sender.send(JSON.stringify(message));sent=d.sent.length;}
 d.document.getElementById('speech-toggle').click();await new Promise(r=>setImmediate(r));forward();
 await until(()=>s.posted.at(-1).inputSession==='test-recording','recording session reaches stage');
 const transcript='百廿老人，何来少年心气？';
 for(const [seq,final] of [[1,false],[2,true]]){
  d.events().onmessage({data:JSON.stringify({type:'transcript',seq,text:transcript,final,scriptSignature:d.status.scriptSignature})});forward();
  await until(()=>sender.messages.some(m=>m.type==='status'&&m.inputSeq===seq),`stage acknowledges ${final?'final':'partial'} transcript`);
  assert.equal(s.elements.get('live-caption').textContent,transcript);
  const status=sender.messages.filter(m=>m.type==='status'&&m.inputSeq===seq).at(-1);
  Object.assign(d.status,status);d.update();
  assert.equal(s.posted.at(-1).inputFinalSeq,final?2:0);
 }
 d.events().onmessage({data:JSON.stringify({type:'transcript',seq:3,text:'尊敬的各位领导',final:false,scriptSignature:d.status.scriptSignature})});forward();await until(()=>s.posted.at(-1).inputSeq===3,'greeting reaches scene follower');for(let i=0;i<3;i++)s.tick(1000);assert.equal(s.posted.at(-1).scenery.activeId,timeline[0].sceneId);
 let seq=3;for(const row of timeline){d.events().onmessage({data:JSON.stringify({type:'transcript',seq:++seq,text:row.text.slice(-100),final:true,scriptSignature:d.status.scriptSignature})});forward();await until(()=>s.posted.at(-1).inputSeq===seq,'shot ending reaches screen');assert.equal(s.posted.at(-1).scenery.activeId,timeline[Math.min(seq-3,timeline.length-1)].sceneId);}
 for(let i=0;i<100;i++)s.tick(1000);
 assert.ok(s.posted.at(-1).trace.some(event=>event.type==='cue-start'));
 assert.equal(s.calls.length,0);s.command('clear');
});

test('local device test works without API credentials and the meter follows real audio frames',async()=>{
 const d=await director();d.update();d.document.getElementById('microphone-test').click();await new Promise(r=>setImmediate(r));assert.equal(d.starts(),1);
 assert.equal(d.sent.some(m=>m.action==='voice-state'&&m.active),false);assert.equal(d.events(),undefined);
 d.worklet().port.onmessage({data:{audio:new ArrayBuffer(16),rms:.1,peak:.2}});assert.ok(Number(d.document.getElementById('input-level').getAttribute('aria-valuenow'))>50);assert.match(d.document.getElementById('input-level-label').textContent,/收到音频/);
 d.worklet().port.onmessage({data:{audio:new ArrayBuffer(16),rms:.8,peak:1}});assert.equal(d.document.getElementById('input-level').getAttribute('data-clipping'),'true');
 d.document.getElementById('microphone-test').click();await new Promise(r=>setImmediate(r));assert.equal(d.stops(),1);assert.equal(d.document.getElementById('input-level').getAttribute('aria-valuenow'),'0');assert.equal(d.sent.some(m=>m.action==='voice-state'),false);
});
test('lyric track preserves previous part tail and centers the next card without replacing its nodes',async()=>{
 const d=await director();d.status.presentation={active:true,source:'speech',index:0,sentenceIndex:1,phase:'speaking'};d.update();
 const previous=d.document.querySelector('.lyric-line[data-index="0"][data-sentence-index="1"]');
 d.status.presentation={active:true,source:'speech',index:1,sentenceIndex:0,phase:'next'};d.update();
 assert.equal(previous.isConnected,true);assert.equal(previous.getAttribute('aria-hidden'),'false');assert.equal(previous.classList.contains('is-past'),true);
 const current=d.document.querySelector('.lyric-line.is-current');assert.equal(current.dataset.index,'1');assert.equal(current.dataset.sentenceIndex,'0');assert.equal(d.document.getElementById('lyric-track').style.getPropertyValue('--lyric-index'),'2');assert.match(d.document.getElementById('follow-status').textContent,/即将进行/);assert.match(d.document.getElementById('section-progress').textContent,/等待景别绑定/);
 for(let i=0;i<20;i++)d.update();assert.equal(d.document.querySelector('.lyric-line.is-current'),current);
});

test('local device monitoring survives screen changes and does not block rehearsal',async()=>{
 const d=await director();d.update();d.document.getElementById('microphone-test').click();await new Promise(r=>setImmediate(r));
 d.status.stageId='replacement-screen';d.update();assert.equal(d.stops(),0);assert.equal(d.document.getElementById('microphone-test').textContent,'停止检测');
 d.document.getElementById('rehearsal-start').click();assert.ok(d.sent.some(m=>m.action==='rehearsal-start'));assert.equal(d.stops(),0);
 d.document.getElementById('microphone-test').click();await new Promise(r=>setImmediate(r));assert.equal(d.stops(),1);
});

test('old audience pages and unprepared scenes cannot start a misleading rehearsal',async()=>{const d=await director();d.status.stageVersion=10;d.update();assert.equal(d.document.getElementById('rehearsal-start').disabled,true);d.document.getElementById('rehearsal-start').click();assert.ok(!d.sent.some(m=>m.action==='rehearsal-start'));d.status.stageVersion=13;d.status.scenery={ready:false};d.update();assert.equal(d.document.getElementById('rehearsal-start').disabled,true);});

test('every speech position has one current row plus two following rows, including cross-section progress',async()=>{const manuscript=require('../speeches/2026-120周年校庆/津门风云-9.22-v12.json'),d=await director({manuscript}),all=manuscript.blocks.flatMap((b,index)=>b.sentences.map((s,sentenceIndex)=>({index,sentenceIndex,s})));for(let i=0;i<all.length;i++){const u=all[i];d.status.presentation={...u,active:true};d.update();const rows=[...d.document.querySelectorAll('.lyric-line')],current=d.document.querySelector('.lyric-line.is-current');assert.ok(current);assert.equal(current.querySelector('.lyric-text').textContent,u.s.text);assert.ok(rows.length<=4);if(i+2<all.length)assert.equal(rows.at(-1).querySelector('.lyric-text').textContent,all[i+2].s.text);const badge=current.querySelector('.lyric-replies');assert.equal(badge.hidden,u.s.mode==='silent'||!u.s.replies.length);}});
test('top insurance advances a manuscript sentence while the scene counter and scene control remain separate',async()=>{const d=await director();d.status.topic=6;d.status.presentation={index:0,sentenceIndex:0,phase:'speaking'};d.status.scenery={ready:true,shot:{index:1,ended:false},progress:{code:'S2-M2',current:1,total:4,mapName:'金刚公园',name:'中景',groups:[{key:'0:a'}]}};d.update();assert.match(d.document.getElementById('section-progress').textContent,/S2-M2_1\/4/);assert.equal(d.document.getElementById('force-next').textContent,'保险 · 下一句话');d.document.getElementById('force-next').click();assert.equal(d.sent.at(-1).action,'force-sentence');assert.equal(d.sent.at(-1).expectedIndex,0);assert.equal(d.sent.at(-1).expectedSentenceIndex,0);assert.equal(d.sent.at(-1).scriptSignature,'director-test');assert.ok(!d.sent.some(m=>m.action==='scene-next'));});
test('voice insurance switches to macOS without API credentials and forwards partial results through same pipeline',async()=>{const d=await director();d.update();const choice=d.document.getElementById('voice-backup');choice.value='macos';choice.onchange();await new Promise(r=>setImmediate(r));assert.equal(d.document.getElementById('speech-toggle').disabled,false);d.document.getElementById('speech-toggle').click();await new Promise(r=>setImmediate(r));assert.equal(choice.disabled,true);d.events().onmessage({data:JSON.stringify({type:'transcript',text:'新艺科之实验场',seq:1,final:false})});assert.equal(d.sent.at(-1).source,'macos');assert.equal(d.sent.at(-1).final,false);d.document.getElementById('speech-toggle').click();await new Promise(r=>setImmediate(r));d.events().onmessage({data:'{"type":"stopped"}'});assert.equal(choice.disabled,false);choice.value='local';choice.onchange();assert.equal(d.document.getElementById('local-input-panel').hidden,false);});

test('macOS system dictation text fallback remains usable when the native recognizer is missing',async()=>{const d=await director({nativeAvailable:false});d.update();const choice=d.document.getElementById('voice-backup');choice.value='macos';choice.onchange();await new Promise(r=>setImmediate(r));const button=d.document.getElementById('speech-toggle');assert.equal(button.disabled,false);assert.equal(d.document.getElementById('local-input-panel').hidden,false);assert.match(d.document.getElementById('local-input-help').textContent,/组件未就绪/);button.click();assert.equal(d.starts(),0);const field=d.document.getElementById('dictation-text');field.value='天地大美，其命维新。';field.dispatchEvent(new d.context.Event('input'));d.document.getElementById('dictation-confirm').click();const message=d.sent.filter(m=>m.action==='voice-transcript').at(-1);assert.equal(message.text,'天地大美，其命维新。');assert.equal(message.final,true);});

test('intentional opening silence is visible in the director and replacement review',async()=>{
 const f=await director({configured:true,manuscript:require('../speeches/2026-120周年校庆/津门风云-9.23-v20.json')});
 assert.match(f.document.getElementById('lyric-track').textContent,/开场白 · 不接话/);
 f.document.getElementById('script-dialog').showModal=()=>{};f.document.getElementById('script-edit').onclick();f.document.getElementById('script-check').onclick();
 assert.match(f.document.getElementById('script-check-result').textContent,/134 句：开场白不接话，其余 133 句全部有接话/);
});
test('keyword dialogue director shows filled triggers, continuation groups and editable staggering; cached v20 cannot enable mic',async()=>{
 const manuscript=require('../speeches/2026-120周年校庆/津门风云-9.23-v21.json'),f=await director({configured:true,manuscript}),d=f.document;
 assert.equal(d.getElementById('speech-toggle').disabled,true);f.status.cueGuardVersion=3;f.update();assert.equal(d.getElementById('speech-toggle').disabled,false);
 assert.match(d.getElementById('lyric-track').textContent,/触发：天津美院办学120年/);assert.match(d.getElementById('lyric-track').textContent,/延续本组/);
 const row=d.querySelector('#rehearsal-lines [data-sentence-index="1"]');assert.equal(row.querySelector('.cue-editor input[type="text"]').value,manuscript.blocks[0].sentences[1].trigger);assert.equal(row.querySelector('.reply-row input[step="0.1"]')?.disabled??false,false);
 d.getElementById('script-dialog').showModal=()=>{};d.getElementById('script-edit').onclick();d.getElementById('script-check').onclick();assert.equal(d.getElementById('script-check-preview').children.length,210);assert.match(d.getElementById('script-check-result').textContent,/210 个短句均有关键词，77 组原对话，141 条台词/);
});

test('T2 live director hides fixed lyrics and blocks manuscript rehearsal/rescue, then restores on leaving',async()=>{
 const manuscript=require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json'),f=await director({configured:true,manuscript}),d=f.document;
 Object.assign(f.status,{cueGuardVersion:4,sequenceScriptVersion:2,topic:23,scenery:{liveDialogue:true,ready:true,progress:{code:'T2',name:'T2 · 现场临场接话',liveDialogue:true,groups:[]}},presentation:{liveDialogue:true,sceneName:'T2 · 现场临场接话',index:23,sentenceIndex:-1},rehearsal:{liveDialogue:true,active:false}});f.update();
 assert.match(d.getElementById('section-progress').textContent,/T2/);assert.equal(d.getElementById('lyric-window').hidden,true);assert.equal(d.getElementById('open-reply-editor').disabled,true);assert.equal(d.getElementById('force-next').disabled,true);assert.equal(d.getElementById('rehearsal-start').disabled,true);assert.equal(d.getElementById('rehearsal-discuss').disabled,true);assert.match(d.getElementById('rehearsal-heading').textContent,/T2/);assert.match(d.getElementById('reply-pace').textContent,/临场/);
 f.status.scenery={ready:true};f.status.presentation={index:23,sentenceIndex:0};f.status.rehearsal={active:false};f.update();assert.equal(d.getElementById('lyric-window').hidden,false);assert.equal(d.getElementById('open-reply-editor').disabled,false);assert.equal(d.getElementById('rehearsal-discuss').disabled,false);assert.doesNotMatch(d.getElementById('rehearsal-heading').textContent,/T2/);
});

test('DeepSeek controls appear only in T2 and remain unavailable in every ordinary scene',async()=>{
 const manuscript=require('../speeches/2026-120周年校庆/津门风云-9.25-Q本.json'),f=await director({configured:true,manuscript}),d=f.document;Object.assign(f.status,{cueGuardVersion:4,sequenceScriptVersion:2,scenery:{liveDialogue:false}});f.update();assert.equal(d.getElementById('script-improv').closest('label').hidden,true);assert.equal(d.getElementById('script-improv').disabled,true);assert.equal(d.getElementById('improv-style').closest('label').hidden,true);assert.match(d.getElementById('improv-status').textContent,/仅用于 T2/);
 f.status.scenery.liveDialogue=true;f.status.improvActors=[0,1];f.update();assert.equal(d.getElementById('script-improv').closest('label').hidden,false);assert.equal(d.getElementById('script-improv').disabled,false);assert.match(d.getElementById('script-improv').closest('label').textContent,/现场接话与字幕/);assert.match(d.getElementById('improv-status').textContent,/现场接话与字幕/);assert.match(d.getElementById('improv-status').textContent,/麦克风未开启/);
 f.status.scenery.liveDialogue=false;f.update();assert.equal(d.getElementById('script-improv').closest('label').hidden,true);assert.equal(d.getElementById('script-improv').disabled,true);
});
