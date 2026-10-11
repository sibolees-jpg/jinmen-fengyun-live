(function(root){
'use strict';
class LiveStage{
 constructor({take,getScene,clear,enqueue,caption,status}){Object.assign(this,{take,getScene,clear,enqueue,caption,status});this.session='';this.generation=0;this.lastId='';this.error='';this.loading=false;this.enabled=false;this.seen=new Set();}
 snapshot(){return {version:1,session:this.session,lastId:this.lastId,error:this.error,loading:this.loading,enabled:this.enabled};}
 cancel(){this.generation++;this.loading=false;this.take(null);}
 async command(m){
  if(m.action==='live-begin'&&typeof m.session==='string'&&m.session.length<100){if(m.session!==this.session){if(this.loading)this.cancel();else this.generation++;this.session=m.session;this.seen.clear();this.lastId='';this.error='';}this.status();return;}
  if(!this.session||m.session!==this.session)return;
  if(m.action==='live-mode'){this.enabled=m.enabled===true;if(!this.enabled){if(this.loading)this.cancel();else this.generation++;this.clear();this.caption('');}this.status();return;}
  if(m.action==='live-caption'){if(this.enabled&&typeof m.text==='string')this.caption(m.text.slice(-600));return;}
  if(m.action==='live-cancel'){this.cancel();this.status();return;}
  if(m.action==='live-clear'){this.cancel();this.clear();this.caption('');this.error='';this.status();return;}
  if(!['live-present','live-scene'].includes(m.action)||typeof m.id!=='string'||this.seen.has(m.id))return;
  this.seen.add(m.id);if(this.seen.size>200)this.seen.delete(this.seen.values().next().value);
  const token=++this.generation;this.error='';this.loading=true;this.status();
  try{
   const messages=m.action==='live-present'?m.messages:[];
   if(!Array.isArray(messages)||messages.length>2||(m.action==='live-present'&&!messages.length)||messages.some(v=>![0,1,2,3,4,5,6,8].includes(v.actor)||typeof v.text!=='string'||!v.text.trim()||v.text.length>80)||new Set(messages.map(v=>v.actor)).size!==messages.length)throw Error('接话内容无效，每轮最多两人，每条最多 80 字。');
   // The callback validates the cast before loading. The whole visual is ready
   // before any message is admitted; cancellation invalidates both operations.
   await this.take(m.sceneId,messages.map(v=>v.actor));
   if(token!==this.generation)return;
   const scene=this.getScene();
   if(!scene||scene.id!==m.sceneId)throw Error('场景尚未准备完成，接话未上屏。');
   if(messages.some(v=>!scene.actors[v.actor]?.present||scene.actors[v.actor]?.visualHidden))throw Error('接话人物不在所选场景中。');
   this.clear();
   if(messages.length)this.enqueue(messages.map((v,i)=>({actor:v.actor,text:v.text.trim(),replyTo:i?0:null,improv:true,sceneId:scene.id,source:'实时接话',staggerMs:1200,durationMs:Math.max(6000,Math.ceil(v.text.length*60000/220*1.4))+i*900})));
   this.lastId=m.id;
  }catch(e){if(token===this.generation){this.lastId=m.id;this.error=e.message||'上屏失败';}}
  finally{if(token===this.generation){this.loading=false;this.status();}}
 }
}
if(typeof module!=='undefined')module.exports=LiveStage;else root.LiveStage=LiveStage;
})(globalThis);
