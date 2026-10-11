(function(root){
'use strict';
// Decode only the current pose pack, cap decoded textures, and never await a
// texture on the speech path. The existing still remains visible on failure.
class ActorAnimationPlayer{
 constructor(container,actor,{imageFactory=()=>new Image(),highResolution=false}={}){
  this.container=container;this.actor=actor;this.pack=actor.animation;this.images=new Map();this.dead=false;this.last='';this.pending=0;this.framesDrawn=0;this.imageFactory=imageFactory;
  this.canvas=document.createElement('canvas');this.canvas.className='actor-sequence-canvas';this.canvas.setAttribute('aria-hidden','true');
  const scale=highResolution?Math.min(1,3072/Math.max(this.pack.width,this.pack.height)):Math.min(1,640/this.pack.height);this.canvas.width=Math.round(this.pack.width*scale);this.canvas.height=Math.round(this.pack.height*scale);container.append(this.canvas);
 }
 load(src){
  if(this.images.has(src))return this.images.get(src);
  if(this.pending>=2)return null;
  const record={ready:false,error:false,image:this.imageFactory()};this.images.set(src,record);this.pending++;
  record.image.onload=()=>{this.pending--;if(this.dead)return;const im=record.image;if(im.naturalWidth!==this.pack.width||im.naturalHeight!==this.pack.height){record.error=true;return;}const small=document.createElement('canvas');small.width=this.canvas.width;small.height=this.canvas.height;small.getContext('2d').drawImage(im,0,0,small.width,small.height);record.image=small;record.ready=true;};
  record.image.onerror=()=>{this.pending--;record.error=true;};record.image.src=src;return record;
 }
 drawState(state,time){
  if(this.dead)return;const pack=this.pack,src=ActorAnimation.frameAt(pack,this.actor.motion,state,time,this.actor.id),record=this.load(src);
  if(!record?.ready){this.load(pack.base);if(!this.last)return;return;}
  const flip=this.actor.facing==='left',key=src+':'+flip;if(key===this.last)return;
  const ctx=this.canvas.getContext('2d');ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.save();if(flip){ctx.translate(this.canvas.width,0);ctx.scale(-1,1);}ctx.drawImage(record.image,0,0);ctx.restore();this.last=key;this.framesDrawn++;this.container.classList.add('has-actor-sequence');
  // Keep a small texture cache. Breath cycles need at most 12 plus expressions.
  if(this.images.size>20)for(const [key,r]of this.images){if(key!==src&&key!==pack.base&&r.ready){this.images.delete(key);if(this.images.size<=18)break;}}
 }
 draw(){}
 destroy(){this.dead=true;for(const r of this.images.values()){r.image.onload=null;r.image.onerror=null;}this.images.clear();this.canvas.remove();this.container.classList.remove('has-actor-sequence');}
}
root.ActorAnimationPlayer=ActorAnimationPlayer;
})(globalThis);
