(function(root){
'use strict';
class MemoryOutbox{
 constructor({send,storage,onState=()=>{},now=Date.now}){Object.assign(this,{send,storage,onState,now});this.key='jinmen-memory-outbox-v1';this.queue=[];this.busy=false;this.retryAt=0;this.error='';try{const saved=JSON.parse(storage?.getItem(this.key)||'[]');if(Array.isArray(saved))this.queue=saved;}catch{this.error='浏览器待存记录读取失败，请保留当前页面检查。';}this.report();}
 report(){this.onState({pending:this.queue.length,error:this.error});}
 persist(){try{if(!this.storage?.setItem&&this.queue.length)throw Error('storage unavailable');this.storage?.setItem(this.key,JSON.stringify(this.queue));return true;}catch{this.error='浏览器暂存失败，正在直接保存到服务；保存完成前请勿刷新。';return false;}}
 add(event){if(!event?.id||this.queue.some(e=>e.id===event.id))return;this.queue.push(event);this.persist();this.report();this.flush();}
 async flush(){if(this.busy||!this.queue.length||this.now()<this.retryAt)return;this.busy=true;try{while(this.queue.length){const next=this.queue[0];const result=await this.send(next);if(result?.saved!==true)throw Error('保存未确认');this.queue.shift();this.error='';this.persist();this.report();}}catch{this.retryAt=this.now()+2000;this.error='记忆保存暂未完成，已排队重试；请保留本页。';this.report();}finally{this.busy=false;}}
}
if(typeof module!=='undefined')module.exports=MemoryOutbox;else root.MemoryOutbox=MemoryOutbox;
})(globalThis);
