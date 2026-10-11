import {runtimePath} from './runtime-paths.mjs';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const WORKER=runtimePath('speech-worker');
const run=promisify(execFile);
const fail=message=>Object.assign(new Error(message),{code:'speech'});
export class SpeechService{
 constructor({spawnImpl=spawn}={}){this.spawnImpl=spawnImpl;this.session=null;this.check=null;}
 get busy(){return Boolean(this.session&&!this.session.ended);}
 async status(){
  if(!this.check)this.check=run(WORKER,['--check'],{timeout:8000,maxBuffer:8192}).then(({stdout})=>{
   const record=JSON.parse(stdout.trim());return {available:record.available===true,provider:'macOS 本地中文识别',message:record.available?'中文模型已就绪':'本机中文语音模型尚未就绪'};
  }).catch(()=>{this.check=null;return {available:false,provider:'macOS 本地中文识别',message:'本地语音组件未就绪，请运行“准备语音.command”'};});
  return {...await this.check,busy:this.busy};
 }
 async start(sampleRate){
  if(this.busy)throw fail('已有麦克风正在使用，请先停止收音。');
  if(![16000,24000,44100,48000].includes(sampleRate))throw fail('不支持此麦克风采样率。');
  const s={id:randomUUID(),worker:null,ended:false,stopping:false,seq:0,events:[],listeners:new Set(),lastAudio:Date.now(),buffer:''};this.session=s;
  return new Promise((resolve,reject)=>{
   let ready=false;
   const emit=event=>{const record={...event,seq:++s.seq};s.events.push(record);if(s.events.length>128)s.events.shift();for(const listener of s.listeners)listener(record);};
   const finish=(error)=>{
    if(s.ended)return;s.ended=true;clearTimeout(s.startTimer);clearTimeout(s.stopTimer);clearInterval(s.watchdog);
    if(error)emit({type:'error',message:error});else emit({type:'stopped'});
    if(!ready)reject(fail(error||'语音识别未能启动。'));
   };
   s.finish=finish;s.emit=emit;
   s.worker=this.spawnImpl(WORKER,[String(sampleRate)],{stdio:['pipe','pipe','pipe']});
   s.worker.on('error',()=>finish('本地语音组件无法启动，请运行“准备语音.command”。'));
   s.worker.stdin.on('error',()=>finish('音频通道已中断，请重新开始收音。'));
   s.worker.on('exit',code=>finish(code===0?null:'本地语音识别已中断，请重新开始。'));
   s.worker.stderr.on('data',()=>{});
   s.worker.stdout.on('data',chunk=>{
    s.buffer+=chunk.toString();if(s.buffer.length>65536){finish('语音识别输出异常。');s.worker.kill();return;}
    let end;while((end=s.buffer.indexOf('\n'))>=0){
     const line=s.buffer.slice(0,end);s.buffer=s.buffer.slice(end+1);let event;try{event=JSON.parse(line);}catch{continue;}
     if(event.type==='ready'&&!ready){ready=true;clearTimeout(s.startTimer);resolve({id:s.id,sampleRate});}
     else if(event.type==='transcript'&&typeof event.text==='string'&&event.text.length<=4000&&typeof event.final==='boolean')emit({type:'transcript',text:event.text,final:event.final});
     else if(event.type==='error'){finish('本地语音识别中断，请停止后重新开始。');s.worker.kill();}
    }
   });
   s.startTimer=setTimeout(()=>{finish('本地语音模型启动超时。');s.worker.kill();},20000);s.startTimer.unref?.();
   s.watchdog=setInterval(()=>{if(Date.now()-s.lastAudio>15000){finish('麦克风连接已断开，收音已停止。');s.worker.kill();}},2000);s.watchdog.unref?.();
  });
 }
 get(id){const s=this.session;if(!s||s.id!==id)throw fail('语音会话已失效。');return s;}
 audio(id,buffer){
  const s=this.get(id);if(s.ended||s.stopping)throw fail('语音会话已停止。');
  if(!buffer.length||buffer.length%4||buffer.length>65536)throw fail('音频数据格式不正确。');
  if(s.worker.stdin.writableLength>512000)throw fail('本机识别速度跟不上收音，请停止后重试。');
  s.lastAudio=Date.now();s.worker.stdin.write(buffer);
 }
 subscribe(id,listener){const s=this.get(id);for(const e of s.events)listener(e);s.listeners.add(listener);return()=>s.listeners.delete(listener);}
 stop(id){const s=this.get(id);if(s.ended||s.stopping)return;s.stopping=true;s.worker.stdin.end();s.stopTimer=setTimeout(()=>{s.finish(null);s.worker.kill();},6000);s.stopTimer.unref?.();}
 close(){const s=this.session;if(s&&!s.ended){s.finish(null);s.worker.kill();}}
}

export async function routeSpeech(service,req,res,url,prefix='/api/speech/'){
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const route=url.pathname.slice(prefix.length),id=url.searchParams.get('id');
 try{
  if(route==='status'&&req.method==='GET')return json(200,await service.status());
  if(route==='events'&&req.method==='GET'){
   service.get(id);res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(': connected\n\n');
   const unsubscribe=service.subscribe(id,event=>{if(!res.destroyed){res.write(`data: ${JSON.stringify(event)}\n\n`);if(['stopped','error'].includes(event.type))res.end();}});
   const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': heartbeat\n\n');},5000);heartbeat.unref?.();
   res.on('close',()=>{clearInterval(heartbeat);unsubscribe();try{service.stop(id);}catch{}});return;
  }
  if(req.method!=='POST')return json(405,{error:{message:'不支持此语音操作。'}});
  if(route==='discard'){if(id)service.get(id);service.close();return json(200,{discarded:true});}
  if(route==='stop'){service.stop(id);return json(200,{stopping:true});}
  if(!['start','audio'].includes(route))return json(404,{error:{message:'未找到语音接口。'}});
  const expected=route==='audio'?'application/octet-stream':'application/json';
  if(!req.headers['content-type']?.startsWith(expected))throw fail('语音请求格式不正确。');
  let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>(route==='audio'?65536:1024))throw fail('音频请求过大。');chunks.push(chunk);}
  const data=Buffer.concat(chunks);
  if(route==='audio'){service.audio(id,data);return json(200,{accepted:true});}
  let payload;try{payload=JSON.parse(data);}catch{throw fail('语音请求格式不正确。');}
  const session=await service.start(payload?.sampleRate);if(res.destroyed){service.stop(session.id);return;}json(200,session);
 }catch(error){if(!res.headersSent)json(400,{error:{message:error.code==='speech'?error.message:'语音连接失败，请重新开始。'}});else res.end();}
}
