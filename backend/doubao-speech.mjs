import WebSocket from 'ws';
import {randomUUID,createHash} from 'node:crypto';
import {packet,decode,PCM16Resampler,TranscriptAssembler} from './doubao-protocol.mjs';
import {loadSpeechConfig,speechConfigStatus} from './doubao-config.mjs';
import Calibration from '../speech-calibration.js';
const fail=message=>Object.assign(new Error(message),{code:'speech'});
const ENDPOINT='wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';
export class DoubaoSpeechService{
 constructor({getConfig=loadSpeechConfig,getScript=()=>null,getSceneScript=()=>[],connect=(url,options)=>new WebSocket(url,options)}={}){this.getConfig=getConfig;this.getScript=getScript;this.getSceneScript=getSceneScript;this.connect=connect;this.session=null;}
 get busy(){return Boolean(this.session&&!this.session.ended);}
 calibration(){const script=this.getScript(),shots=this.getSceneScript(),reference=shots.length?{...script,text:(script?.text||'')+'\n'+shots.map(r=>r.text).join('\n')}:script,profile=Calibration.build(reference);if(shots.length){const ends=shots.map(r=>Calibration.clean(r.text).slice(-10));profile.hotwords=[...new Set([...profile.hotwords.slice(0,24),...ends,...profile.hotwords.slice(24)])].slice(0,100);}const version=createHash('sha256').update(JSON.stringify({text:reference?.text||'',hotwords:profile.hotwords})).digest('hex').slice(0,12);return {...profile,version,scriptSignature:Calibration.signature(script)};}
 async status(){const config=speechConfigStatus(this.getConfig()),p=this.calibration(),s=this.session;return {...config,available:config.configured,provider:'豆包语音 API',busy:this.busy,metrics:s?.metrics||null,transport:'双向流式',message:config.configured?'语音凭据已保存，点击麦克风连接。':'请在语音设置填写火山引擎凭据。',calibration:{version:p.version,characters:p.characters,hotwords:p.hotwords.length,state:s&&!s.ended&&s.calibrationAccepted&&s.profile.version===p.version?'accepted':'prepared'}};}
 async start(sampleRate){
  if(this.busy)throw fail('已有收音会话，请先停止。');if(!speechConfigStatus(this.getConfig()).configured)throw fail('请先在语音设置填写豆包 API 凭据。');
  let resampler;try{resampler=new PCM16Resampler(sampleRate);}catch{throw fail('不支持此麦克风采样率。');}
  const s={id:randomUUID(),sampleRate,resampler,seq:0,events:[],listeners:new Set(),ended:false,stopping:false,buffer:Buffer.alloc(0),lastAudio:Date.now(),profile:this.calibration(),generation:0};this.session=s;
  s.emit=event=>{const e={...event,seq:++s.seq};s.events.push(e);if(s.events.length>256)s.events.shift();for(const listener of s.listeners)listener(e);};
  s.finish=message=>{if(s.ended)return;s.ended=true;s.openReject?.(fail(message||'语音连接已取消。'));s.openReject=null;clearTimeout(s.stopTimer);clearInterval(s.watchdog);s.socket?.terminate();s.emit(message?{type:'error',message}:{type:'stopped'});};
  s.watchdog=setInterval(()=>{if(Date.now()-s.lastAudio>15000)s.finish('麦克风数据中断，已停止收音。');},2000);s.watchdog.unref?.();
  try{await this.open(s);return {id:s.id,sampleRate,calibrationVersion:s.profile.version};}catch(error){s.finish(error.message);throw error;}
 }
 open(s){
  const generation=++s.generation,config=this.getConfig(),headers={'X-Api-Resource-Id':config.resourceId,'X-Api-Connect-Id':randomUUID()};
  if(config.apiKey)headers['X-Api-Key']=config.apiKey;else Object.assign(headers,{'X-Api-App-Key':config.appId,'X-Api-Access-Key':config.accessToken});
  s.socket?.terminate();s.connected=false;s.calibrationAccepted=false;s.assembler=new TranscriptAssembler();s.packetSeq=0;s.sentAudioBytes=0;s.profile=this.calibration();
  return new Promise((resolve,reject)=>{
   s.openReject=reject;let opened=false;const ws=this.connect(ENDPOINT,{headers,handshakeTimeout:12000,maxPayload:1024*1024});s.socket=ws;
   const current=()=>!s.ended&&s.generation===generation;
   const failed=message=>{if(!current())return;const error=fail(message);if(!opened)reject(error);s.finish(message);};
   ws.on('open',()=>{if(!current())return;opened=true;s.connected=true;
    ws.send(packet(1,{user:{uid:'anniversary-director'},audio:{format:'pcm',codec:'raw',rate:16000,bits:16,channel:1},request:{model_name:'bigmodel',enable_itn:true,enable_punc:true,enable_ddc:false,enable_nonstream:false,show_utterances:true,result_type:'full',end_window_size:800,corpus:{context:JSON.stringify({hotwords:s.profile.hotwords.map(word=>({word}))})}}},{json:true,sequence:++s.packetSeq}));
    this.flush(s,s.stopping);s.openReject=null;resolve();
   });
   ws.on('message',data=>{if(!current())return;try{
    const response=decode(data);if(response.type===15||response.data?.code&&![0,1000,20000000].includes(response.data.code)){failed(`豆包识别拒绝请求（${response.code||response.data.code}），请检查语音资源与凭据。`);return;}
    if(response.type!==9)return;if(!s.calibrationAccepted){s.calibrationAccepted=true;s.emit({type:'calibration',version:s.profile.version,hotwords:s.profile.hotwords.length});}
    const ends=(response.data?.result?.utterances||[]).map(u=>u.end_time).filter(Number.isFinite),lag=ends.length?Math.max(0,Math.round(s.sentAudioBytes/32-Math.max(...ends))):null;s.metrics={audioSentMs:Math.round(s.sentAudioBytes/32),recognitionLagMs:lag,receivedAt:Date.now(),transportBufferedBytes:s.socket?.bufferedAmount||0};
    for(const event of s.assembler.accept(response.data,response.last))s.emit({type:'transcript',...event,...s.metrics,source:'doubao-api',scriptSignature:s.profile.scriptSignature});
    if(response.last){if(s.stopping)s.finish(null);else this.renew(s);}
   }catch{failed('豆包语音返回格式异常，收音已停止。');}});
   ws.on('unexpected-response',(_req,res)=>{res.resume();failed(`豆包连接失败（HTTP ${res.statusCode}），请检查凭据、权限和资源版本。`);});
   ws.on('error',()=>failed('豆包语音连接失败，请检查网络及语音凭据。'));
   ws.on('close',()=>{if(current())failed('豆包语音连接已断开，请重新开启；可用补播按钮接话。');});
  });
 }
 renew(s){
  const now=Date.now();s.renewals=(s.renewals||[]).filter(at=>now-at<10000);s.renewals.push(now);
  if(s.renewals.length>3){s.finish('语音服务连续结束会话，收音已停止。请检查语音资源。');return;}
  s.emit({type:'reconnecting'});
  this.open(s).then(()=>{if(!s.ended)s.emit({type:'recalibrated',version:s.profile.version});}).catch(error=>s.finish(error.message||'语音续接失败，收音已停止。'));
 }
 get(id){if(!this.session||this.session.id!==id)throw fail('语音会话已失效。');return this.session;}
 audio(id,buffer){const s=this.get(id);if(s.ended||s.stopping)throw fail('语音会话已停止。');if(!buffer.length||buffer.length%4||buffer.length>65536)throw fail('音频数据格式不正确。');s.lastAudio=Date.now();s.buffer=Buffer.concat([s.buffer,s.resampler.push(buffer)]);if(s.buffer.length>320000||s.socket?.bufferedAmount>320000){s.finish('语音网络积压，已停止收音。请使用补播并检查网络。');throw fail('语音网络积压。');}this.flush(s);}
 flush(s,last=false){if(!s.connected||s.ended)return;while(s.buffer.length>=3200){s.socket.send(packet(2,s.buffer.subarray(0,3200),{sequence:++s.packetSeq}));s.sentAudioBytes+=3200;s.buffer=s.buffer.subarray(3200);}if(last){s.sentAudioBytes+=s.buffer.length;s.socket.send(packet(2,s.buffer,{last:true,sequence:++s.packetSeq}));s.buffer=Buffer.alloc(0);}}
 subscribe(id,listener){const s=this.get(id);for(const event of s.events)listener(event);s.listeners.add(listener);return()=>s.listeners.delete(listener);}
 stop(id){const s=this.get(id);if(s.ended||s.stopping)return;s.stopping=true;this.flush(s,true);s.stopTimer=setTimeout(()=>s.finish('豆包未确认最后一句，请核对字幕并按需补播。'),8000);s.stopTimer.unref?.();}
 recalibrate(){const s=this.session;if(s&&!s.ended&&!s.stopping&&s.profile.version!==this.calibration().version){s.emit({type:'calibrating'});s.buffer=Buffer.alloc(0);s.resampler=new PCM16Resampler(s.sampleRate);this.open(s).then(()=>s.emit({type:'recalibrated',version:s.profile.version})).catch(()=>{});}}
 close(){this.session?.finish?.(null);}
}
