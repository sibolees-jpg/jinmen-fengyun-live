(function(root){
'use strict';
class SpeechCapture{
 constructor({onState,onTranscript,onActivity=()=>{},onCalibration=()=>{},onLevel=()=>{},onMetrics=()=>{}}){this.onState=onState;this.onTranscript=onTranscript;this.onActivity=onActivity;this.onCalibration=onCalibration;this.onLevel=onLevel;this.onMetrics=onMetrics;this.base='/api/speech/';this.provider='api';this.monitorOnly=false;this.active=false;this.starting=false;this.stopping=false;this.generation=0;this.queue=[];}
 setProvider(provider){if(this.active||this.starting||this.stopping)throw Error('请先停止接收再切换语音');this.provider=provider==='macos'?'macos':'api';this.base=this.provider==='macos'?'/api/macos-speech/':'/api/speech/';}
 state(mode,message){this.onState({mode,message});}
 async request(route,{body,headers={}}={}){
  const response=await fetch(this.base+route,{method:'POST',headers,body,signal:AbortSignal.timeout(22000)});const value=await response.json();if(!response.ok)throw new Error(value.error?.message||'语音连接失败');return value;
 }
 async start(deviceId,{monitorOnly=false}={}){
  if(this.active||this.starting||this.stopping)return;this.monitorOnly=monitorOnly;this.starting=true;const generation=++this.generation;this.state('starting','正在申请麦克风权限…');
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{deviceId:deviceId?{exact:deviceId}:undefined,channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(generation!==this.generation){media.getTracks().forEach(t=>t.stop());return;}this.media=media;
   this.context=new AudioContext();await this.context.resume();if(generation!==this.generation)return;
   if(!monitorOnly){
   this.state('starting',this.provider==='macos'?'正在连接 macOS 本机识别…':'正在连接豆包语音…');
   const session=await this.request('start',{headers:{'Content-Type':'application/json'},body:JSON.stringify({sampleRate:this.context.sampleRate})});
   if(generation!==this.generation){await this.request('stop?id='+encodeURIComponent(session.id));return;}
   this.id=session.id;this.queue=[];this.active=true;
   const events=this.events=new EventSource(this.base+'events?id='+encodeURIComponent(this.id));
   this.events.onmessage=({data})=>{
    let event;try{event=JSON.parse(data);}catch{return;}
    if(events!==this.events||generation!==this.generation&&!this.stopping)return;
    if(event.type==='transcript'){this.onMetrics({recognitionLagMs:event.recognitionLagMs,receivedAt:event.receivedAt,transportBufferedBytes:event.transportBufferedBytes});}if(event.type==='transcript')this.onTranscript({...event,session:session.id,uploadBacklogMs:this.inFlightAt?Date.now()-this.inFlightAt:this.queue.length?Date.now()-this.queue[0].at:0});
    if(['calibration','calibrating','recalibrated','reconnecting'].includes(event.type))this.onCalibration(event);
    if(event.type==='error')this.fail(event.message);
    if(event.type==='stopped'){this.active=false;this.release();this.events?.close();this.events=null;this.id=null;this.stopping=false;this.state('stopped','收音已停止');}
   };
   this.events.onerror=()=>{if(events===this.events&&!this.stopping)this.fail('语音连接中断，已停止收音。');};
   }else{this.active=true;this.queue=[];}
   await this.context.audioWorklet.addModule('audio-worklet.js?v=8');if(generation!==this.generation)return;
   this.node=new AudioWorkletNode(this.context,'speech-pcm');
   this.node.port.onmessage=({data})=>{if(generation!==this.generation&&!this.stopping)return;if(data.flushed){this.flushed?.();return;}if(data.audio&&this.active){this.onLevel({rms:data.rms||0,peak:data.peak??data.rms??0,active:true});if(this.monitorOnly)return;if(data.rms>.012)this.onActivity({session:this.id});this.queue.push({audio:data.audio,at:Date.now()});this.onMetrics({uploadBacklogMs:Date.now()-(this.inFlightAt||this.queue[0].at)});if(this.queue.length>40){this.fail('音频处理积压，已停止收音。');return;}this.drain();}};
   this.source=this.context.createMediaStreamSource(this.media);this.source.connect(this.node);
   this.mute=this.context.createGain();this.mute.gain.value=0;this.node.connect(this.mute);this.mute.connect(this.context.destination);
   for(const track of this.media.getTracks())track.onended=()=>{if(this.active)this.fail('麦克风已断开，收音已停止。');};
   this.state(monitorOnly?'monitoring':'listening',monitorOnly?'仅检测本机麦克风 · 未发送音频':'持续收音中 · 停顿后仍保持开启');
  }catch(error){if(generation!==this.generation)return;await this.fail(error.name==='NotAllowedError'?'麦克风权限未开启，请允许浏览器使用麦克风后再试。':error.name==='NotFoundError'?'没有找到麦克风，请连接输入设备。':error.message||'麦克风启动失败。');}
  finally{if(generation===this.generation)this.starting=false;}
 }
 drain(){
  if(this.draining)return this.draining;
  const id=this.id,generation=this.generation;
  const run=(async()=>{while(this.queue.length&&id===this.id&&(generation===this.generation||this.stopping)){const packets=[];let size=0;while(this.queue.length&&size+this.queue[0].audio.byteLength<=65536){const packet=this.queue.shift();packets.push(packet);size+=packet.audio.byteLength;}const audio=new Uint8Array(size);let at=0;for(const packet of packets){audio.set(new Uint8Array(packet.audio),at);at+=packet.audio.byteLength;}this.inFlightAt=packets[0]?.at||Date.now();this.onMetrics({uploadBacklogMs:Date.now()-this.inFlightAt});await this.request('audio?id='+encodeURIComponent(id),{headers:{'Content-Type':'application/octet-stream'},body:audio});if(id===this.id)this.inFlightAt=0;}})().catch(error=>{if(id===this.id&&(generation===this.generation||this.stopping)){this.queue=[];this.fail(error.message);}}).finally(()=>{if(this.draining===run){this.draining=null;this.inFlightAt=0;}});this.draining=run;return run;
 }
 async restartFresh(deviceId){
  const resume=(this.active||this.starting||this.stopping)&&!this.monitorOnly,id=this.id,generation=++this.generation;
  this.active=false;this.starting=resume;this.stopping=false;this.queue=[];this.draining=null;this.inFlightAt=0;this.events?.close();this.events=null;this.id=null;this.release();
  if(!resume)return;this.state('starting','现场保险 · 正在清空旧识别并重新接收…');
  try{await this.request('discard'+(id?'?id='+encodeURIComponent(id):''));if(generation!==this.generation)return;this.starting=false;this.onMetrics({uploadBacklogMs:0,recognitionLagMs:null,transportBufferedBytes:0});await this.start(deviceId);}
  catch(error){if(generation===this.generation)await this.fail(error.message);}
 }
 release(){this.onLevel({rms:0,peak:0,active:false});this.media?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.media=null;this.source?.disconnect();this.node?.disconnect();this.mute?.disconnect();this.context?.close().catch(()=>{});this.context=null;}
 async stop(){
  if(this.stopping||(!this.active&&!this.starting&&!this.id))return;this.stopping=true;this.starting=false;this.generation++;this.state('stopping','正在确认最后一句…');
  if(this.node&&this.active)await new Promise(resolve=>{const timer=setTimeout(resolve,500);this.flushed=()=>{clearTimeout(timer);resolve();};this.node.port.postMessage('flush');});
  this.active=false;this.release();if(this.monitorOnly){this.stopping=false;this.state('stopped','设备检测已停止');this.monitorOnly=false;return;}await this.drain();
  try{if(this.id)await this.request('stop?id='+encodeURIComponent(this.id));else{this.stopping=false;this.state('stopped','收音已停止');}}
  catch(error){await this.fail(error.message);}
 }
 async fail(message){
  this.generation++;this.starting=false;this.active=false;this.queue=[];this.release();this.events?.close();this.events=null;const id=this.id;this.id=null;this.stopping=false;
  if(id)this.request('stop?id='+encodeURIComponent(id)).catch(()=>{});this.state('error',message);
 }
 dispose(){this.generation++;this.active=false;this.stopping=false;this.queue=[];this.release();this.events?.close();if(this.id)navigator.sendBeacon(this.base+'stop?id='+encodeURIComponent(this.id),'');this.id=null;}
}
root.SpeechCapture=SpeechCapture;
})(globalThis);
