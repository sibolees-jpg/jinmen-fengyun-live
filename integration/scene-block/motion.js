(function(root){
'use strict';
// Phase alone also includes silent action previews. Only a displayed line may
// drive speech; keep caption eligibility separate so blocked lines can retry.
function hasSpeechText(actor){
 const m=actor?.message;
 return actor?.phase==='speaking'&&typeof m?.text==='string'&&Boolean(m.text.trim())&&!m.actionOnly&&m.source!=='动作预览';
}
function isTextSpeaking(actor){return hasSpeechText(actor)&&actor.captionBlocked!==true;}
function speechMouthOpen(actor,time=0){return isTextSpeaking(actor)&&Math.sin((time+(Number(actor.id)||0)*137)/72)>-.25;}
function motionPose(actor,{time=0,look=0,travel=-1,preview}={}){
 const action=preview||(['speaking','listening'].includes(actor.phase)?actor.message?.action:'idle')||'idle';
 if(preview==='blink')return {frame:Math.floor(time/450)%2,flip:false};
 if(preview==='walk-left'||preview==='walk-right'||['entering','leaving'].includes(actor.phase))return {frame:5+Math.floor(time/200)%2,flip:preview?preview==='walk-right':travel>0};
 if(action==='seated')return {frame:7,flip:false};
 if(speechMouthOpen(actor,time))return {frame:2,flip:false};
 if(action==='left')return {frame:3,flip:false};
 if(action==='right')return {frame:4,flip:false};
 if(look)return {frame:look<0?3:4,flip:false};
 const cycle=(time+actor.id*1397)%5300;
 return {frame:cycle>=4180&&cycle<4380?1:0,flip:false};
}
class AmbientMotion{
 constructor(count,{random=Math.random}={}){this.random=random;this.actions=Array.from({length:count},()=>({nextAt:1500+random()*6500,until:0,pose:null}));}
 pose(actor,time){
  const state=this.actions[actor.id];if(!state||!['idle','speaking','listening'].includes(actor.phase)||hasSpeechText(actor))return null;
  if(time>=state.nextAt){const frame=[1,3,4][Math.min(2,Math.floor(this.random()*3))],duration=frame===1?190:1400+this.random()*1300;state.pose={frame,flip:false};state.until=time+duration;state.nextAt=state.until+3500+this.random()*7500;}
  return time<state.until?state.pose:null;
 }
}
class MotionPortrait{
 constructor(container,asset){
  this.asset=asset;this.container=container;this.ready=false;this.last='';
  this.canvas=document.createElement('canvas');this.canvas.className='motion-canvas';this.canvas.width=320;this.canvas.height=480;this.canvas.setAttribute('aria-hidden','true');
  this.image=new Image();this.image.onload=()=>{this.ready=true;container.append(this.canvas);container.classList.add('has-motion');this.draw({frame:0,flip:false});};this.image.src=asset.src;
 }
 draw({frame,flip}){
  if(!this.ready)return;if(!this.asset.frames[frame])frame=0;const key=frame+':'+flip;if(key===this.last)return;this.last=key;
  const [x,y,width,height]=this.asset.frames[frame],canvas=this.canvas,ctx=canvas.getContext('2d');
  const scale=this.asset.registered?1:Math.min((canvas.width-16)/Math.max(...this.asset.frames.map(b=>b[2])),(canvas.height-8)/Math.max(...this.asset.frames.map(b=>b[3])));
  const dw=width*scale,dh=height*scale;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();if(flip){ctx.translate(canvas.width,0);ctx.scale(-1,1);}ctx.drawImage(this.image,x,y,width,height,(canvas.width-dw)/2,canvas.height-dh,dw,dh);ctx.restore();
 }
 destroy(){this.image.onload=null;this.container.classList.remove('has-motion');this.canvas.remove();}
}
const api={hasSpeechText,isTextSpeaking,speechMouthOpen,motionPose,MotionPortrait,AmbientMotion};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
