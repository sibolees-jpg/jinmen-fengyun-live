(function(root){
'use strict';
const normalizeDialogue=typeof module!=='undefined'?require('./dialogue.js').normalizeDialogue:root.normalizeDialogue;
const normalizeImprov=typeof module!=='undefined'?require('./dialogue.js').normalizeImprov:root.normalizeImprov;
const failureMessages={backend_unavailable:'本地服务未连接，请启动“启动预览”后重试。',auth:'模型密钥验证失败，请在导演页检查配置。',balance:'模型账户余额不足，暂时无法回答。',rate_limit:'模型正在忙，请稍后重试。',timeout:'这次回应超时了，请稍后重试。',unavailable:'暂时连接不上模型，请稍后重试。',invalid_response:'这次回答格式异常，请稍后重试。',empty_response:'模型连续返回空回答，已重试一次。请按回车再试。',not_configured:'模型还未配置，请在导演页检查连接。'};

class ResponseClient{
 constructor({fallback,fetchImpl=fetch,names=(typeof module!=='undefined'?require('./data.js'):root.SHOW_DATA).teachers.map(t=>t.name)}){this.fallback=fallback;this.fetchImpl=fetchImpl;this.names=names;this.history=[];this.busy=false;this.generation=0;this.controller=null;this.state={mode:'ready',message:''};}
 cancel(){this.generation++;this.controller?.abort();this.controller=null;this.busy=false;this.history=[];this.state={mode:'ready',message:''};}
 remember(text,messages){this.history.push({role:'user',content:text},{role:'assistant',content:JSON.stringify({messages:messages.map(({actor,text,replyTo})=>({actor,text,replyTo}))})});this.history=this.history.slice(-8);}
 async request(text,{topic,cursor,speech,rehearsalId,improv=false,improvActors,liveSceneId}){
  if(this.busy)return null;
  const generation=++this.generation;this.busy=true;this.state={mode:'thinking',message:'正在准备回应'};this.controller=new AbortController();
  let backendReached=false;
  const controller=this.controller,timer=setTimeout(()=>controller.abort(),8500);
  try{
   const send=this.fetchImpl;
   const response=await send('/api/respond',{method:'POST',headers:{'Content-Type':'application/json'},signal:this.controller.signal,body:JSON.stringify({text,history:this.history,speech,rehearsalId,topic,improv,improvActors,liveSceneId})});
   const payload=await response.json();backendReached=true;if(generation!==this.generation)return null;
   if(!response.ok){const error=new Error('provider');error.reason=payload.error?.code;throw error;}
   if(payload.suppressed===true){this.state={mode:'silent',message:({live_scene_only:'AI 即兴接话仅用于最后的 T2 场景',no_supporting_actors:'无可用配角，本轮保持安静',invalid_improv:'即兴不符合角色规则，已跳过',optional_silence:'配角本轮保持安静'})[payload.reason]||'按剧本保持安静'};return null;}
   let validated;try{validated=improv?normalizeImprov(payload.messages,improvActors||[]):normalizeDialogue(payload.messages);}catch{const error=new Error('invalid');error.reason='invalid_response';throw error;}
   if(!validated.length){this.state={mode:'silent',message:'配角本轮保持安静'};return null;}
   const messages=validated.map(m=>({...m,topic,source:'模型即兴'}));
   if(!improv)this.remember(text,messages);
   this.state={mode:'online',message:'DeepSeek 已回应',latencyMs:payload.latencyMs};
   return {topic,messages,improv,input:text,nextCursor:(cursor+messages.length)%this.names.length};
  }catch(error){
   if(generation!==this.generation)return null;
   const reason=error.reason||(controller.signal.aborted?'timeout':backendReached?'unavailable':'backend_unavailable');
   const message=failureMessages[reason]||failureMessages.unavailable;
   if(improv){this.state={mode:'error',message,reason};return null;}
   const local=this.fallback(text,{topic,cursor});
   if(local?.messages?.length&&local.matched!==false){
    this.state={mode:'fallback',message,reason};return {...local,messages:local.messages.slice(0,1)};
   }
   this.state={mode:'error',message,reason};
   return {topic,nextCursor:(cursor+1)%this.names.length,failed:true,messages:[{actor:cursor%this.names.length,topic,text:message,source:'连接提示'}]};
  }finally{clearTimeout(timer);if(generation===this.generation){this.busy=false;this.controller=null;}}
 }
}
if(typeof module!=='undefined')module.exports={ResponseClient};else root.ResponseClient=ResponseClient;
})(globalThis);
