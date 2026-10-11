(function(root){
'use strict';
class StageEngine {
 constructor(count=7,capacity=3){this.capacity=capacity;this.topic=0;this.paused=false;this.queue=[];this.time=0;this.nextId=0;this.starts=new Map();this.actors=Array.from({length:count},(_,id)=>({id,phase:'idle',elapsed:0,slot:null,message:null,returnFrom:1}));}
 enqueue(m){if(!m||!Number.isInteger(m.actor)||!this.actors[m.actor]||m.topic!==this.topic||typeof m.text!=='string'||!m.text.trim()||this.queue.length>=(m.source==='演练预备'?128:21))return false;this.queue.push({...m,text:m.text.trim().slice(0,m.source==='演练预备'?160:80)});return true;}
 enqueueDiscussion(messages){
  if(this.queue.length+messages.length>128)return false;
  const ids=messages.map(()=>++this.nextId),ordered=messages[0]?.ordered===true,previous=this.lastPreparedId;
  const accepted=messages.map((m,i)=>this.enqueue({...m,topic:m.topic??this.topic,dialogue:true,id:ids[i],...(m.chorus?{chorusGroup:ids[0]}:{}),lookAt:Number.isInteger(m.replyTo)?messages[m.replyTo]?.actor:messages.find((other,j)=>j>i&&other.replyTo===i)?.actor,afterId:m.chorus?null:ordered?(i?ids[i-1]:previous):Number.isInteger(m.replyTo)?ids[m.replyTo]:(i?ids[i-1]:null)})).every(Boolean);
  if(accepted&&ordered)this.lastPreparedId=ids.at(-1);return accepted;
 }
 duration(a){
  if(['entering','leaving'].includes(a.phase)&&this.travelTime)return this.travelTime(a);
  if(a.phase==='speaking'&&Number.isFinite(a.message?.durationMs)&&a.message.durationMs>=2000)return Math.min(90000,a.message.durationMs);
  if(a.phase==='speaking'&&this.readingCpm===220&&!a.message?.actionOnly)return Math.max(2000,Math.round(Array.from(String(a.message?.text||'').replace(/[^\p{L}\p{N}]/gu,'')).length*60000/220));
  if(a.message?.dialogue)return {thinking:100,entering:400,speaking:Math.min(4500,Math.max(2600,(a.message.text.length||0)*80+1300)),leaving:450}[a.phase]||Infinity;
  return {thinking:650,entering:1150,speaking:Math.min(8000,Math.max(4400,(a.message?.text.length||0)*170+1500)),leaving:1100}[a.phase]||Infinity;
 }
 progress(a){if(a.phase==='entering')return Math.min(1,a.elapsed/this.duration(a));if(a.phase==='leaving')return a.returnFrom*(1-Math.min(1,a.elapsed/this.duration(a)));return ['speaking','listening'].includes(a.phase)?1:0;}
 ready(m){if(m.chorus&&(this.queue.slice(0,this.queue.indexOf(m)).some(q=>q.chorusGroup!==m.chorusGroup)||this.actors.some(a=>!['idle','listening'].includes(a.phase)&&a.message?.chorusGroup!==m.chorusGroup)))return false;const parent=this.starts.get(m.afterId);if(m.serial&&m.afterId)return parent?.finished===true;return !m.afterId||Boolean(parent&&this.time-parent.time>=Math.max(m.cueKey&&!m.chorus?800:0,m.staggerMs??(parent.durationMs||Math.max(1200,Math.min(2300,parent.text.length*65)))));}
 began(a){this.onMessageStart?.(a.message);if(a.message.id)this.starts.set(a.message.id,{time:this.time-a.elapsed,text:a.message.text,durationMs:a.message.durationMs});}
 leave(a){Object.assign(a,{phase:'leaving',elapsed:0,returnFrom:this.progress(a)});}
 admit(){
  const used=new Set(this.actors.filter(a=>a.phase!=='idle').map(a=>a.slot));
  for(let i=0;i<this.queue.length;){
   const m=this.queue[i],a=this.actors[m.actor];
   if(!this.ready(m)){i++;continue;}
   if(this.canStart&&!this.canStart(m,this.time)){i++;continue;}
   // A returning speaker keeps their place, including when all slots are full.
   if(m.dialogue&&a.message?.dialogue&&a.phase==='listening'){
    this.queue.splice(i,1);Object.assign(a,{phase:m.chorus?'thinking':'speaking',elapsed:0,message:m,captionBlocked:false});if(!m.chorus)this.began(a);continue;
   }
   if(a.phase!=='idle'){i++;continue;}
   if(!m.chorus&&used.size>=this.capacity){
    const listener=this.actors.find(other=>other.phase==='listening');
    if(listener)this.leave(listener);
    i++;continue;
   }
   let slot=0;while(used.has(slot))slot++;used.add(slot);this.queue.splice(i,1);Object.assign(a,{phase:'thinking',elapsed:0,slot,message:m,returnFrom:1,captionBlocked:false});
  }
 }
 step(dt){
  if(this.paused)return;this.admit();this.time+=Math.max(0,dt);
  for(const a of this.actors){
   if(!(a.phase==='speaking'&&a.captionBlocked))a.elapsed+=Math.max(0,dt);
   while(a.phase!=='idle'&&a.elapsed>=this.duration(a)){
    a.elapsed-=this.duration(a);
    if(a.phase==='thinking')a.phase='entering';
    else if(a.phase==='entering'){a.phase='speaking';this.began(a);}
    else if(a.phase==='speaking'){if(a.message.id&&this.starts.has(a.message.id))this.starts.get(a.message.id).finished=true;this.onMessageEnd?.(a.message);a.phase=a.message.dialogue?'listening':'leaving';a.returnFrom=1;}
    else Object.assign(a,{phase:'idle',elapsed:0,message:null,slot:null});
   }
  }
  this.admit();
  if(!this.queue.length&&!this.actors.some(a=>['thinking','entering','speaking'].includes(a.phase))){for(const a of this.actors)if(a.phase==='listening')this.leave(a);}
  const referenced=new Set(this.queue.map(m=>m.afterId));
  for(const id of this.starts.keys())if(!referenced.has(id)&&id!==this.lastPreparedId)this.starts.delete(id);
 }
 setTopic(id){this.topic=id;this.queue=[];this.starts.clear();this.lastPreparedId=null;for(const a of this.actors){if(a.phase==='idle')continue;const p=this.progress(a);if(p===0)Object.assign(a,{phase:'idle',elapsed:0,slot:null,message:null});else Object.assign(a,{phase:'leaving',elapsed:0,returnFrom:p});}}
 clear(){this.queue=[];this.starts.clear();this.lastPreparedId=null;for(const a of this.actors)Object.assign(a,{phase:'idle',elapsed:0,slot:null,message:null});}
}
if(typeof module!=='undefined')module.exports={StageEngine};else root.StageEngine=StageEngine;
})(globalThis);
