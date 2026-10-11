(function(root){
'use strict';
// One active request and one latest input. Never replay an accumulated queue.
class LiveSession{
 constructor({request,onDraft=()=>{},onState=()=>{},now=Date.now}){Object.assign(this,{request,onDraft,onState,now});this.generation=0;this.history=[];this.pending=null;this.busy=false;this.enabled=false;}
 cancel(){this.generation++;this.controller?.abort();this.controller=null;this.busy=false;this.pending=null;}
 enable(value){this.enabled=value===true;if(!this.enabled)this.cancel();}
 offer(text,options={}){if(!this.enabled||!text.trim())return;this.pending={text:text.trim().slice(-2000),options,at:this.now()};}
 async drain({ready=true}={}){if(!ready||this.busy||!this.pending||!this.enabled)return;const input=this.pending;this.pending=null;if(this.now()-input.at>18000){this.onState('已丢弃过时发言，等待新的现场内容');return;}return this.run(input.text,input.options);}
 async run(text,options={}){
  if(!this.enabled)throw Error('请先开启实时接话与字幕');
  this.cancel();const token=this.generation,controller=this.controller=new AbortController();this.busy=true;this.onState('正在选择角色、查阅资料并准备接话…');
  try{const value=await this.request({text,history:this.history,...options},controller.signal);if(token!==this.generation||!this.enabled)return null;if(!value?.messages?.length)throw Error('本轮没有收到接话，请重试');const draft={...value,input:text,createdAt:this.now()};this.onDraft(draft);return draft;}
  catch(e){if(token===this.generation&&e.name!=='AbortError')this.onState(e.message||'请求失败，请重试');return null;}
  finally{if(token===this.generation){this.busy=false;this.controller=null;}}
 }
 remember(draft){this.history.push({role:'user',content:draft.input||'现场手动接话'},{role:'assistant',memoryRoundId:draft.memoryRoundId,content:JSON.stringify({messages:draft.messages.map(({actor,text})=>({actor,text}))})});this.history=this.history.slice(-12);}
}
if(typeof module!=='undefined')module.exports=LiveSession;else root.LiveSession=LiveSession;
})(globalThis);
