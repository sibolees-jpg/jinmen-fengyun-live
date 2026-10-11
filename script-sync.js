(function(root){
'use strict';
// The local service is authoritative; browser storage is never a shared source.
class ScriptSync{
 constructor(onChange,{fetchImpl=fetch}={}){this.onChange=onChange;this.fetchImpl=fetchImpl;this.revision=undefined;this.script=null;this.epoch=0;this.running=null;this.saving=false;}
 accept(record){if(!Number.isInteger(record?.revision)||!('script' in record))throw new Error('本机剧本返回格式异常。');const changed=this.revision!==record.revision;if(changed)this.onChange(record.script);this.revision=record.revision;this.script=record.script;}
 refresh(){
  if(this.saving)return Promise.resolve(false);if(this.running)return this.running;const epoch=this.epoch,send=this.fetchImpl;
  this.running=(async()=>{try{const response=await send('/api/script',{cache:'no-store',...(typeof AbortSignal!=='undefined'?{signal:AbortSignal.timeout(8000)}:{})});if(!response.ok)return false;const record=await response.json();if(epoch!==this.epoch)return false;this.accept(record);return true;}catch{return false;}})().finally(()=>this.running=null);return this.running;
 }
 async save(script){
  if(this.saving)throw new Error('剧本正在保存，请稍候。');if(this.revision===undefined)await this.refresh();if(this.revision===undefined)throw new Error('本机剧本服务未连接，修改尚未保存。');
  this.saving=true;const epoch=++this.epoch,send=this.fetchImpl;
  try{const response=await send('/api/script',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:this.revision,script})});if(!response.ok){let message='本机剧本未能保存。';try{message=(await response.json()).error?.message||message;}catch{}if(response.status===409){this.saving=false;await this.refresh();}throw new Error(message);}const record=await response.json();if(epoch!==this.epoch)throw new Error('本次保存已失效，请重新载入。');this.accept(record);return record.script;}finally{this.saving=false;}
 }
}
const api={ScriptSync};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
