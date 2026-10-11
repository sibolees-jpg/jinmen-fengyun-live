import {DiscussionMemory,MemoryRecorder} from './backend/discussion-memory.mjs';
import {once} from 'node:events';
import {liveScenes,chooseLiveScene} from './backend/live-scenes.mjs';
import {sourceCatalog,knowledgeStatus,getProfiles} from './backend/character-knowledge.mjs';
import {initializeRuntime,runtimeDir} from './backend/runtime-paths.mjs';
import {createHash} from 'node:crypto';
import http from 'node:http';
import {attachStageChannel} from './backend/stage-channel.mjs';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {loadConfig,publicStatus,generateReply,saveConfig,verifyModel} from './backend/deepseek.mjs';
import {routeSpeech,SpeechService} from './backend/speech.mjs';
import {DoubaoSpeechService} from './backend/doubao-speech.mjs';
import {saveSpeechConfig} from './backend/doubao-config.mjs';
import {RehearsalStore} from './backend/rehearsal.mjs';
import {ScriptStore} from './backend/script-store.mjs';
import {SceneStore,routeScenes} from './backend/scene-store.mjs';
import CuePlan from './cue-plan.js';
import Dialogue from './dialogue.js';
import SceneScript from './scene-script.js';
import {analyzeAsset} from './backend/asset-analysis.mjs';
initializeRuntime();
const ROOT=fileURLToPath(new URL('.',import.meta.url));
const KNOWLEDGE_ACTORS=new Set(getProfiles().map(p=>p.actorId));
const PUBLIC=new Set(['memory-client.js','realtime-config.js','live-stage.js','live-session.js','auto-discussion.js','live-director.js','live-director.css','actor-cutout.js','opening-cast.js','frontend-trial.js','scene-block.js','integration/dialogue-overlay.bundle.js','integration/dialogue-overlay-demo.html','integration/dialogue-overlay-demo.js','dialogue-overlay.js','bubble-editor.js','actor-pet-motion.js','actor-animation.js','actor-animation-player.js','actor-animation-director.js','cue-plan.js','cue-tracker.js','scene-script.js','caption-layout.js','shot-follow.js','scene-catalog.js','scene-director.js','scene-playback.js','scene-director.css','ui-patch.js','stage-channel.js','scene-plan.js','dictation-input.js','dictation-director.js','cue-ledger.js','index.html','director.html','stage.css','stage.js','stage-layout.js','ink-assets.js','ink-portrait.js','director.css','director.js','data.js','avatars.js','engine.js','content.js','input-scheduler.js','response-client.js','speech-sentences.js','speech-capture.js','audio-worklet.js','dialogue.js','round-pipeline.js','speech-script.js','script-sync.js','script-follow.js','rehearsal.js','rehearsal-director.js','motion.js','motion-assets.js','motion-director.js','finale.js','finale-stage.js','finale-stage.css','finale-director.js','finale-director.css']);
const TYPES={'.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function reject(res,status,message){json(res,status,{error:{code:'request',message}});}
export function createAppServer({getConfig=loadConfig,setConfig=saveConfig,verify=verifyModel,generate=generateReply,speech,nativeSpeech=new SpeechService(),rehearsal=new RehearsalStore(),scripts=new ScriptStore(),scenes=new SceneStore(),now=Date.now,realtimeOnly=process.env.REALTIME_ONLY==='1',memory}={}){
 speech??=new DoubaoSpeechService({getScript:()=>realtimeOnly?{text:getProfiles().map(p=>p.name).join('、')}:scripts.get().script,getSceneScript:()=>realtimeOnly?[]:SceneScript.bind(scenes.get().catalog,scripts.get().script).rows});
 const memoryStore=()=>memory??=new DiscussionMemory(path.join(runtimeDir,'discussion-memory.sqlite'));
 const recorder=realtimeOnly?new MemoryRecorder(memoryStore,{now}):null;
 const memoryTimer=realtimeOnly?setInterval(()=>recorder.flush(),1000):null;memoryTimer?.unref();
 let busy=false,activeController=null,improvEnabled=false,lastDiscussionAt=-Infinity,lastCall={state:'ready',message:'等待首次调用'};
 const liveScene=id=>scenes.get().catalog.maps.flatMap(m=>m.scenes).find(s=>s.id===id&&s.liveDialogue===true);
 const liveActors=id=>(liveScene(id)?.actors||[]).filter(a=>a.present).map(a=>a.id);
 const suppressed=(res,reason='script_only')=>json(res,200,{suppressed:true,messages:[],reason});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  const host=req.headers.host||'';
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))return reject(res,403,'只接受本机访问');
  const origin=req.headers.origin;
  if((origin&&origin!==`http://${host}`)||req.headers['sec-fetch-site']==='cross-site')return reject(res,403,'请求来源不符');
  try{
   const url=new URL(req.url,`http://${host}`),route=decodeURIComponent(url.pathname);
   if(realtimeOnly&&(route.startsWith('/api/script')||route.startsWith('/api/rehearsal')))return reject(res,410,'实时版已移除固定剧本与排练入口');
   if(route.startsWith('/api/memory/')){
    if(!realtimeOnly)return reject(res,404,'此版本未启用记忆');
    try{
     if(route==='/api/memory/status'&&req.method==='GET')return json(res,200,recorder.status());
     if(route==='/api/memory/events'&&req.method==='POST'){
      if(!req.headers['content-type']?.startsWith('application/json'))return reject(res,415,'需要 JSON 内容');
      let body='';for await(const chunk of req){body+=chunk;if(body.length>12000)return reject(res,413,'记忆内容过长');}
      let value;try{value=JSON.parse(body);if(value.kind!=='audience')throw Error();}catch{return reject(res,400,'只接受现场发言记录');}
      memoryStore().add(value);return json(res,200,{saved:true,id:value.id});
     }
     const options=Object.fromEntries(url.searchParams);
     if(route==='/api/memory/events'&&req.method==='GET')return json(res,200,memoryStore().list(options));
     if(route==='/api/memory/export'&&req.method==='GET'){
      memoryStore().filter(options);
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="jinmen-discussion-memory.json"','Cache-Control':'no-store'});
      res.write('{"schema":1,"timezone":"Asia/Shanghai","entries":[');let first=true,index=0;
      const exporting=new AbortController();res.once('close',()=>exporting.abort());
      for(const row of memoryStore().export(options)){if(res.destroyed)break;if(!res.write((first?'':',')+JSON.stringify(row)))await once(res,'drain',{signal:exporting.signal});first=false;if(++index%100===0)await new Promise(r=>setImmediate(r));}
      return res.end(']}');
     }
     return reject(res,405,'不支持该记忆操作');
    }catch{if(res.headersSent){res.destroy();return;}return reject(res,400,'记忆读取或保存失败，请检查输入与本机磁盘；记录未确认保存。');}
   }
   if(route==='/api/live/catalog'&&req.method==='GET')return json(res,200,{mode:realtimeOnly?'realtime':'performance',revision:scenes.get().revision,actors:getProfiles().map(({actorId,name,role,lens})=>({id:actorId,name,role,lens})),scenes:liveScenes(scenes.get().catalog)});
   if(route==='/api/scene-analysis'&&req.method==='POST'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return reject(res,413,'分析请求过长');}
    const value=JSON.parse(body);return json(res,200,await analyzeAsset(scenes,value.url,value.role));
   }
   if(route==='/api/scenes'||route.startsWith('/api/scenes/')||route==='/api/scene-assets'||route.startsWith('/api/scene-assets/')){await routeScenes(scenes,req,res,url);if(['POST','PUT'].includes(req.method)&&res.statusCode===200)speech.recalibrate?.();return;}
   if(route==='/api/speech/config'&&req.method==='PUT'){
    if(!req.headers['content-type']?.startsWith('application/json'))return reject(res,415,'需要 JSON 内容');
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return reject(res,413,'配置过长');}
    try{if(speech.busy)return reject(res,409,'请先停止收音，再保存凭据。');return json(res,200,saveSpeechConfig(JSON.parse(body)));}catch(error){return reject(res,400,error.message||'语音凭据未保存。');}
   }
   if(route.startsWith('/api/macos-speech/')){if(route.endsWith('/start')&&speech.busy)return reject(res,409,'请先停止豆包 API 收音。');return await routeSpeech(nativeSpeech,req,res,url,'/api/macos-speech/');}
   if(route.startsWith('/api/speech/')){if(route.endsWith('/start')&&nativeSpeech.busy)return reject(res,409,'请先停止 macOS 收音。');return await routeSpeech(speech,req,res,url);}
   if(route==='/api/improv'&&req.method==='PUT'){
    if(!req.headers['content-type']?.startsWith('application/json'))return reject(res,415,'需要 JSON 内容');
    let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)return reject(res,413,'设置内容过长');}
    let value;try{value=JSON.parse(body);}catch{return reject(res,400,'设置格式不正确');}
    if(typeof value.enabled!=='boolean')return reject(res,400,'请指定即兴开关');
    improvEnabled=value.enabled;if(!improvEnabled)activeController?.abort();
    return json(res,200,{improvEnabled});
   }
   if(route==='/api/script/backups'&&req.method==='GET')return json(res,200,{backups:scripts.backups()});
   if(route==='/api/script'&&req.method==='GET')return json(res,200,scripts.get());
   if((route==='/api/script'||route==='/api/script/restore')&&req.method==='PUT'){
    if(!req.headers['content-type']?.startsWith('application/json'))return reject(res,415,'需要 JSON 内容');
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1048576)return reject(res,413,'剧本不能超过 1 MB');chunks.push(chunk);}
    let payload;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reject(res,400,'剧本格式不正确');}
    try{if(route==='/api/script/restore'){const restored=scripts.restore(payload?.name,payload?.revision,script=>{if(script?.replyPolicy===CuePlan.policy)CuePlan.assert(script,scenes.get().catalog);});activeController?.abort();speech.recalibrate?.();return json(res,200,restored);}if(payload?.script?.replyPolicy===CuePlan.policy)CuePlan.assert(payload.script,scenes.get().catalog);const saved=scripts.save(payload?.script,payload?.revision);activeController?.abort();speech.recalibrate?.();return json(res,200,saved);}catch(error){return reject(res,error.code==='CONFLICT'?409:400,error.message||'剧本无法保存');}
   }
   if(route==='/api/rehearsal/status'&&req.method==='GET'){const pack=rehearsal.get();return json(res,200,{id:pack?.id||null,revision:pack?.revision??null,...(rehearsal.hasInactive?.()?{inactive:true}:{})});}
   if(route==='/api/rehearsal'&&req.method==='GET')return json(res,200,rehearsal.get());
   if(route==='/api/rehearsal'&&req.method==='PUT'){
    if(!req.headers['content-type']?.startsWith('application/json'))return reject(res,415,'需要 JSON 内容');
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>262144)return reject(res,413,'编排内容过长');chunks.push(chunk);}
    let payload;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reject(res,400,'编排格式不正确');}
    try{const importing=payload?.import===true,script=importing?payload.script:payload;return json(res,200,rehearsal.save(script,{allowCreate:importing}));}catch(error){return reject(res,error.code==='CONFLICT'?409:400,error.message||'编排无法保存');}
   }
   if(route==='/api/rehearsal'&&req.method==='DELETE'){
    rehearsal.clear();activeController?.abort();speech.close();speech.session=null;lastCall={state:'ready',message:'测试内容已清除'};
    return json(res,200,{cleared:true});
   }
   if(route==='/api/model-config'&&req.method==='PUT'){
    if(!req.headers['content-type']?.startsWith('application/json'))return reject(res,415,'需要 JSON 内容');
    let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return reject(res,413,'配置过长');}
    try{return json(res,200,setConfig(JSON.parse(body)));}catch{return reject(res,400,'密钥格式不正确，配置未保存。');}
   }
   if(route==='/api/model-check'&&req.method==='POST'){
    try{return json(res,200,await verify(getConfig()));}catch(error){return json(res,502,{error:{code:error.code||'unavailable',message:error.message||'连接失败'}});}
   }
   if(route==='/api/knowledge'&&req.method==='GET')return json(res,200,{enabled:getConfig().knowledgeEnabled===true,...knowledgeStatus(),sources:sourceCatalog()});
   if(route==='/api/status'&&req.method==='GET')return json(res,200,{app:'gongcishi-stage',version:13,build:'923-v18',instance:createHash('sha256').update(ROOT+runtimeDir).digest('hex').slice(0,16),...publicStatus({...getConfig(),testDiscussion:Boolean(rehearsal.get())}),improvEnabled,improvActors:[],improvScope:realtimeOnly?'all_scenes':'live_scene_only',mode:realtimeOnly?'realtime':'performance',busy,lastCall});
   if(route==='/api/respond'&&req.method==='POST'){
    if(!req.headers['content-type']?.startsWith('application/json'))return reject(res,415,'需要 JSON 内容');
    let size=0,chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>32768)return reject(res,413,'输入过长');chunks.push(chunk);}
    let payload;try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reject(res,400,'输入格式不正确');}
    if(!payload||typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>2000||(payload.history!==undefined&&!Array.isArray(payload.history)))return reject(res,400,'请输入 1 至 2000 字');
    // No scene ID means a legacy/general input: never send it to the model.
    if(!realtimeOnly&&payload.liveSceneId===undefined)return suppressed(res,'live_scene_only');
    if(!realtimeOnly&&(typeof payload.liveSceneId!=='string'||!liveScene(payload.liveSceneId)))return reject(res,400,'临场接话场景无效，请重新切入 T2');
    if(!improvEnabled||payload.improv!==true)return suppressed(res);
    const config=getConfig();
    const choices=realtimeOnly?liveScenes(scenes.get().catalog):[];
    if(realtimeOnly&&payload.lockedSceneId&&!choices.some(s=>s.id===payload.lockedSceneId))return reject(res,400,'所选场景不存在');
    const candidates=realtimeOnly?[...new Set(choices.filter(s=>!payload.lockedSceneId||s.id===payload.lockedSceneId).flatMap(s=>s.actors))]:liveActors(payload.liveSceneId);
    if(realtimeOnly&&payload.selectedActors!==undefined&&(!Array.isArray(payload.selectedActors)||payload.selectedActors.length>2||new Set(payload.selectedActors).size!==payload.selectedActors.length||payload.selectedActors.some(id=>!candidates.includes(id))))return reject(res,400,'请选择当前场景可用的 1～2 位角色');
    if(realtimeOnly&&payload.selectedActors?.length&&!choices.some(s=>(!payload.lockedSceneId||s.id===payload.lockedSceneId)&&payload.selectedActors.every(id=>s.actors.includes(id))))return reject(res,400,'所选人物没有共同场景');
    const allowedActors=candidates.filter(id=>(config.knowledgeEnabled!==true||KNOWLEDGE_ACTORS.has(id))&&(!Array.isArray(payload.improvActors)||payload.improvActors.includes(id)));
    if(!allowedActors.length)return suppressed(res,'no_supporting_actors');
    if(busy)return json(res,429,{error:{code:'rate_limit',message:'上一轮正在准备回应'}});
    busy=true;const controller=new AbortController();activeController=controller;res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    try{
     const allowDiscussion=improvEnabled&&payload.improv===true&&(realtimeOnly?payload.maxSpeakers!==1:now()-lastDiscussionAt>=45000);
     lastCall={state:'thinking',message:realtimeOnly?'已收到现场发言，正在选角与接话':'已收到 T2 发言，正在请求 DeepSeek',at:new Date().toISOString()};
     const verifiedHistory=realtimeOnly?memoryStore().historyFor(payload.memorySession,(payload.history||[]).filter(m=>m?.role==='assistant').map(m=>m.memoryRoundId)):(payload.history||[]);
     const liveText=realtimeOnly&&payload.continuation===true?verifiedHistory.filter(m=>m.role==='user').at(-1)?.content:payload.text.trim();
     if(realtimeOnly&&payload.continuation===true&&!liveText)return reject(res,409,'上一轮尚未确认保存，请重新发起现场话题');
     const result=await generate({...config,...(realtimeOnly?{knowledgeEnabled:true}:{}),testDiscussion:false,testPoints:[],allowDiscussion,liveDialogue:true,improvActors:allowedActors,...(realtimeOnly?{selectedActors:payload.selectedActors,preferPair:payload.maxSpeakers!==1,parallelDiscussion:true,recall:(actor,text,options)=>{try{return memoryStore().recall(actor,text,options);}catch{return [];}},continuation:payload.continuation===true,sceneCasts:choices.filter(s=>!payload.lockedSceneId||s.id===payload.lockedSceneId).map(s=>s.actors)}:{})},{text:liveText,history:verifiedHistory,speech:undefined},{signal:controller.signal});
     if(controller.signal.aborted||!improvEnabled){lastCall={state:'cancelled',message:'已取消旧的 T2 回复',at:new Date().toISOString()};if(!res.destroyed)suppressed(res);return;}
     // Enforce the one-round limit and cooldown even if the model over-generates.
     {
      const fresh=realtimeOnly?liveScenes(scenes.get().catalog):[];
      const current=(realtimeOnly?[...new Set(fresh.filter(s=>!payload.lockedSceneId||s.id===payload.lockedSceneId).flatMap(s=>s.actors))]:liveActors(payload.liveSceneId)).filter(id=>allowedActors.includes(id));
      try{result.messages=Dialogue.normalizeImprov(result.messages,current,allowDiscussion?2:1);}catch{lastCall={state:'error',message:'DeepSeek 返回的角色或台词格式无效',at:new Date().toISOString()};return suppressed(res,'invalid_improv');}
      if(!result.messages.length){lastCall={state:'error',message:'DeepSeek 未返回人物接话，请重试',at:new Date().toISOString()};return json(res,502,{error:{code:'empty_response',message:lastCall.message}});}
      if(realtimeOnly){const selected=chooseLiveScene(fresh,result.messages.map(m=>m.actor),{lockedSceneId:payload.lockedSceneId,currentSceneId:payload.currentSceneId,text:payload.text,recentScenes:Array.isArray(payload.recentScenes)?payload.recentScenes.filter(id=>typeof id==='string').slice(-4):[]});result.sceneId=selected.id;result.sceneName=selected.name;}
      result.discussionMode='improv';
     }
     if(result.messages.length>1)lastDiscussionAt=now();
     lastCall={state:'success',message:'DeepSeek 已成功回应',latencyMs:result.latencyMs,at:new Date().toISOString()};
     if(!res.destroyed)json(res,200,result);
    }catch(error){
     if(controller.signal.aborted){lastCall={state:'cancelled',message:'已取消旧的 T2 回复',at:new Date().toISOString()};if(!res.destroyed)suppressed(res);return;}
     const safeCodes=new Set(['auth','balance','rate_limit','timeout','unavailable','invalid_response','empty_response','not_configured']);
     const code=safeCodes.has(error.code)?error.code:'unavailable',message=safeCodes.has(error.code)?error.message:'连接暂时不可用';
     if(!controller.signal.aborted)lastCall={state:'error',message,at:new Date().toISOString()};
     if(!res.destroyed)json(res,502,{error:{code,message}});
    }finally{busy=false;if(activeController===controller)activeController=null;}
    return;
   }
   if(!['GET','HEAD'].includes(req.method))return reject(res,405,'不支持该操作');
   const file=route==='/'?'index.html':route.slice(1);
   if(!PUBLIC.has(file)&&!/^integration\/colleague-bubbles\/(?:[a-z-]+\.(?:js|css|json))$/.test(file)&&!/^integration\/scene-block\/(?:[a-z-]+\.(?:js|css|json)|frame\.html|assets\/(?:scene-assets|actor-animation-library)\/[a-f0-9]{64}\.(?:png|jpg|webp))$/.test(file)&&!/^assets\/actor-animation-library\/(?:library\.json|[a-f0-9]{64}\.png)$/.test(file)&&file!=='speech-calibration.js'&&file!=='speech-director.js'&&!/^assets\/(characters|backgrounds|ui)\/[\w-]+\.(png|webp|jpg|svg)$/.test(file)&&!/^assets\/motion\/[\w-]+\/atlas\.png$/.test(file))return reject(res,404,'未找到文件');
   if(file==='integration/scene-block/frame.html')res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
   const filename=await realpath(path.join(ROOT,file));
   if(!filename.startsWith(ROOT))return reject(res,404,'未找到文件');
   const data=await readFile(filename);res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream','Cache-Control':file.startsWith('assets/')?'public, max-age=3600':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch{if(!res.headersSent)reject(res,404,'未找到文件');else res.end();}
 });
 attachStageChannel(server,{observe:(direction,id,value)=>recorder?.observe(direction,id,value)});server.on('close',()=>{if(memoryTimer)clearInterval(memoryTimer);recorder?.flush();memory?.close();speech.close();nativeSpeech.close();});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||8879;
 const server=createAppServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'8879 端口已被占用，请关闭旧预览服务再启动。':'本地服务启动失败。');process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log(`讨论舞台：http://127.0.0.1:${port}/\n导演控制：http://127.0.0.1:${port}/director.html`));
}
