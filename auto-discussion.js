(function(root){
'use strict';
// One prepared round, one latest audience topic. A displayed round is never
// interrupted by a new question; unshown work is replaceable and generation-fenced.
class AutoDiscussion {
 constructor({request,present,onDraft=()=>{},onState=()=>{},onFatal=()=>{},now=Date.now}) {
  Object.assign(this,{request,present,onDraft,onState,onFatal,now});
  this.running=false;this.generation=0;this.history=[];this.recentScenes=[];
  this.topic='';this.topicVersion=0;this.presentedTopicVersion=null;this.pending=false;this.ready=null;this.busy=false;this.delivering=false;
  this.hearingUntil=0;this.retryAt=0;this.failures=0;this.round=0;
 }
 invalidate(){this.generation++;this.controller?.abort();this.controller=null;this.busy=false;this.ready=null;}
 start(){this.stop();this.running=true;this.history=[];this.recentScenes=[];this.round=0;this.failures=0;this.retryAt=0;this.onState('自动讨论已开启，等待第一个现场话题。');}
 stop(){this.running=false;this.invalidate();this.delivery=null;this.delivering=false;this.topic='';this.topicVersion=0;this.presentedTopicVersion=null;this.pending=false;this.hearingUntil=0;}
 hear(text){
  if(!this.running||!text?.trim())return;
  this.invalidate();this.topicVersion++;this.topic=text.trim().slice(-2000);this.pending=true;
  this.retryAt=0;this.failures=0;this.hearingUntil=0;
  this.onState('收到新的现场内容，优先准备这一轮回应。');
 }
 hearing(){if(this.running)this.hearingUntil=this.now()+450;}
 suspend(){this.invalidate();if(this.topic)this.pending=this.topicVersion!==this.presentedTopicVersion;}
 async tick({connected=true,idle=true,options={}}={}) {
  if(!this.running||!connected||this.delivering)return;
  if(this.ready){
   if(!idle||this.now()<this.hearingUntil)return;
   const value=this.ready;this.ready=null;const delivery={};this.delivery=delivery;this.delivering=true;
   try{
    const shown=await this.present(value);
    if(!this.running||this.delivery!==delivery)return;
    this.history.push({role:'user',content:value.continuation?'继续讨论现场话题：'+value.input:value.input},{role:'assistant',memoryRoundId:shown?.roundId,content:JSON.stringify({messages:value.messages.map(({actor,text})=>({actor,text}))})});
    this.history=this.history.slice(-16);this.presentedTopicVersion=value.topicVersion;
    this.recentScenes.push(shown?.sceneId||value.sceneId);this.recentScenes=this.recentScenes.slice(-4);
    this.round++;this.failures=0;
    // Prepare the next round while this one is readable on screen.
    this.retryAt=this.now()+150;
    this.onState('自动讨论中 · 已上屏 '+this.round+' 轮；继续收音、选角与切景。');
   }catch(e){if(this.running&&this.delivery===delivery){if(value.topicVersion===this.topicVersion)this.pending=!value.continuation;this.failed(e);}}
   finally{if(this.delivery===delivery){this.delivering=false;this.delivery=null;}}
   return;
  }
  if(this.busy||!this.topic||this.now()<this.retryAt||this.now()<this.hearingUntil)return;
  const continuation=!this.pending;this.pending=false;
  const token=this.generation,input=this.topic,topicVersion=this.topicVersion,controller=this.controller=new AbortController();this.busy=true;
  this.onState(continuation?'角色正在准备下一轮讨论，现场有新发言会优先接入。':'正在自动选角、查阅资料并匹配场景…');
  try{
   const value=await this.request({text:input,history:this.history,improv:true,...options,continuation,recentScenes:[...this.recentScenes]},controller.signal);
   if(!this.running||token!==this.generation)return;
   if(!value?.messages?.length)throw Error('本轮没有收到有效接话');
   this.ready={...value,input,continuation,topicVersion,createdAt:this.now()};this.onDraft(this.ready);
   this.onState('下一轮已准备好，当前气泡读完后自动接上。');
  }catch(e){if(this.running&&token===this.generation){this.pending=!continuation;this.failed(e);}}
  finally{if(token===this.generation){this.busy=false;this.controller=null;}}
 }
 failed(error){
  if(['auth','balance','not_configured'].includes(error?.code)){this.stop();this.onFatal(error.message);return;}
  this.retryAt=this.now()+Math.min(15000,2000*2**Math.min(this.failures++,3));
  this.onState((error?.message||'本轮连接失败')+'，保留当前画面，稍后自动重试。');
 }
}
if(typeof module!=='undefined')module.exports=AutoDiscussion;else root.AutoDiscussion=AutoDiscussion;
})(globalThis);
