(function(root){
'use strict';
const REHEARSAL_CPM=220;
class RehearsalPlayer{
 constructor(){this.stop();}
 start(script,index=0,{single=false,realtime=false,streaming=false}={}){this.stop();if(!script?.blocks?.[index])return;this.script=script;this.index=index;this.sentenceIndex=0;this.single=single;this.realtime=realtime;this.streaming=streaming;this.fired=false;this.phase='reading';this.elapsed=0;this.read=0;}
 stop(){this.script=null;this.index=0;this.sentenceIndex=0;this.phase='idle';this.elapsed=0;this.read=0;}
 get active(){return this.phase!=='idle';}
 tick(dt,{paused=false,busy=false}={}){
  if(!this.active||paused)return null;
  const block=this.script.blocks[this.index],sentence=block.sentences?.[this.sentenceIndex]||{id:`legacy-${this.index}`,text:block.source,mode:block.replies?.length?(block.discussion?'discussion':'reply'):'silent',replies:block.replies||[],delayMs:0,holdMs:900};
  if(this.realtime){
   this.elapsed+=Math.max(0,dt);this.read=Math.min(sentence.text.length,Math.floor(this.elapsed*REHEARSAL_CPM/60000));const caption=sentence.text.slice(0,this.read).slice(-80),triggerEnd=sentence.cuePolicy==='early'?Math.min(12,sentence.text.length):sentence.trigger&&sentence.text.includes(sentence.trigger)?sentence.text.indexOf(sentence.trigger)+sentence.trigger.length:sentence.text.length;
   if(!this.streaming&&!this.fired&&sentence.replies.length&&this.read>=triggerEnd){this.fired=true;return {type:'discussion',index:this.index,sentenceIndex:this.sentenceIndex,caption};}
   const transcript=sentence.text.slice(0,this.read),final=this.read===sentence.text.length;
   if(this.elapsed>=sentence.text.length*60000/REHEARSAL_CPM+sentence.holdMs)return {...this.advance(caption),transcript:sentence.text,final:true};
   return {type:'caption',index:this.index,sentenceIndex:this.sentenceIndex,caption,transcript,final};
  }
  if(this.phase==='discussion'){
   if(busy)return null;
   return this.advance();
  }
  this.elapsed+=Math.max(0,dt);this.read=Math.min(sentence.text.length,Math.floor(this.elapsed*REHEARSAL_CPM/60000));
  const caption=sentence.text.slice(0,this.read).slice(-56),ready=this.read===sentence.text.length&&this.elapsed>=sentence.text.length*60000/REHEARSAL_CPM+sentence.holdMs+sentence.delayMs;
  if(ready&&sentence.mode!=='silent'&&sentence.replies.length){this.phase='discussion';return {type:'discussion',index:this.index,sentenceIndex:this.sentenceIndex,cueId:sentence.id,caption,messages:sentence.replies,delayMs:sentence.delayMs,holdMs:sentence.holdMs};}
  if(ready)return this.advance(caption);
  return {type:'caption',index:this.index,sentenceIndex:this.sentenceIndex,cueId:sentence.id,caption};
 }
 advance(caption=''){
  const block=this.script.blocks[this.index];
  this.fired=false;
  if(this.sentenceIndex+1<(block.sentences?.length||1)){this.sentenceIndex++;this.phase='reading';this.elapsed=0;this.read=0;return {type:'sentence',index:this.index,sentenceIndex:this.sentenceIndex,caption};}
  if(this.single||this.index+1>=this.script.blocks.length){this.stop();return {type:'done'};}
  this.index++;this.sentenceIndex=0;this.phase='reading';this.elapsed=0;this.read=0;return {type:'topic',index:this.index};
 }
}
class RehearsalSync{
 constructor(onChange,{fetchImpl=fetch}={}){this.onChange=onChange;this.fetchImpl=fetchImpl;this.id=undefined;this.revision=undefined;this.inactive=false;this.epoch=0;this.running=false;}
 async refresh(){
  if(this.running)return;this.running=true;const epoch=this.epoch;
  try{
   const send=this.fetchImpl;
   const response=await send('/api/rehearsal/status',{cache:'no-store'});if(!response.ok)return;
   const {id,revision=null,inactive=false}=await response.json();if(epoch!==this.epoch||(id===this.id&&revision===this.revision&&inactive===this.inactive))return;
   let pack=null;
   if(id){const r=await send('/api/rehearsal',{cache:'no-store'});if(!r.ok)return;pack=await r.json();if(pack?.id!==id)return;}
   if(epoch!==this.epoch)return;this.inactive=inactive;this.onChange(pack);this.id=id;this.revision=revision;
  }catch{}finally{this.running=false;}
 }
 invalidate(){this.epoch++;this.id=undefined;this.revision=undefined;this.running=false;return this.refresh();}
 async clear(){
  const send=this.fetchImpl,response=await send('/api/rehearsal',{method:'DELETE'});
  if(!response.ok)throw new Error('测试包未能清除，请稍后重试。');
  this.epoch++;this.id=null;this.revision=null;this.inactive=false;this.onChange(null);return true;
 }
 async save(pack){
  const epoch=this.epoch,send=this.fetchImpl,response=await send('/api/rehearsal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pack)});if(epoch!==this.epoch)throw new Error('这次保存已失效，未重新载入已清除的剧本。');
  if(!response.ok){let message='编排未能保存，请稍后重试。';try{message=(await response.json()).error?.message||message;}catch{}throw new Error(message);}
  const saved=await response.json();if(epoch!==this.epoch)throw new Error('这次保存已失效，未重新载入已清除的剧本。');this.epoch++;this.id=saved.id;this.revision=saved.revision;this.inactive=false;this.onChange(saved);return saved;
 }
 async import(pack){const epoch=this.epoch,send=this.fetchImpl,response=await send('/api/rehearsal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({import:true,script:pack})});if(epoch!==this.epoch)throw new Error('这次导入已失效。');if(!response.ok){let message='剧本未能导入。';try{message=(await response.json()).error?.message||message;}catch{}throw new Error(message);}const saved=await response.json();if(epoch!==this.epoch)throw new Error('这次导入已失效。');this.epoch++;this.id=saved.id;this.revision=saved.revision;this.inactive=false;this.onChange(saved);return saved;}
}
const api={REHEARSAL_CPM,RehearsalPlayer,RehearsalSync};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
