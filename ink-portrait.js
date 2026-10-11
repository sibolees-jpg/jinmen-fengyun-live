(function(root){
'use strict';
// A lightweight paper-puppet rig: source artwork stays untouched. Canvas regions
// articulate the head and lower garment; optional eye landmarks close the lids.
function inkState(pose,time,id=0){const walk=pose.frame===5||pose.frame===6;return {walk,step:walk?Math.sin(time/105):0,head:walk?(pose.flip?.035:-.035):pose.frame===3?-.055:pose.frame===4?.055:pose.frame===2?Math.sin(time/550)*.025:0,blink:pose.frame===1,gesture:pose.frame===2?Math.sin(time/500)*.015:0};}
class InkPortrait{
 constructor(container,asset,id){this.container=container;this.asset=asset;this.id=id;this.ready=false;this.image=new Image();this.canvas=document.createElement('canvas');this.canvas.className='motion-canvas ink-canvas';this.canvas.width=360;this.canvas.height=540;this.canvas.setAttribute('aria-hidden','true');this.last=0;this.image.onload=()=>{this.ready=true;container.append(this.canvas);container.classList.add('has-motion');this.draw({frame:0,flip:false},0);};this.image.src=asset.src;}
 draw(pose,time=0){if(!this.ready)return;if(time&&time-this.last<48)return;this.last=time;const a=this.asset,ctx=this.canvas.getContext('2d'),[sx,sy,sw,sh]=a.box,k=Math.min(342/sw,528/sh),dw=sw*k,dh=sh*k,left=(360-dw)/2,top=540-dh,state=inkState(pose,time,this.id);ctx.clearRect(0,0,360,540);
  const cut=.28,legs=.76;ctx.save();ctx.translate(left,top);
  // Body stays anchored while the lower silhouette takes alternating small steps.
  ctx.drawImage(this.image,sx,sy+sh*cut,sw,sh*(legs-cut),0,dh*cut,dw,dh*(legs-cut)+1);
  for(let n=0;n<12;n++){const f=legs+(1-legs)*n/12,h=sh*(1-legs)/12,delta=state.step*Math.pow((f-legs)/(1-legs),1.3)*4;ctx.drawImage(this.image,sx,sy+sh*f,sw,h,delta,dh*f,dw,h*k+1);}
  ctx.save();ctx.translate(dw*.5,dh*cut);ctx.rotate(state.head);ctx.translate(-dw*.5,-dh*cut);ctx.drawImage(this.image,sx,sy,sw,sh*cut,0,0,dw,dh*cut+1);
  if(state.blink&&a.eyes){for(const eye of a.eyes){const [ex,ey,ew,eh]=eye;ctx.fillStyle='#f7f5ec';ctx.beginPath();ctx.ellipse(ex*k,ey*k,ew*k*.65,eh*k*.8,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#49443a';ctx.lineWidth=Math.max(.9,eh*k*.24);ctx.beginPath();ctx.moveTo((ex-ew*.58)*k,ey*k);ctx.quadraticCurveTo(ex*k,(ey+eh*.35)*k,(ex+ew*.58)*k,ey*k);ctx.stroke();}}
  ctx.restore();ctx.restore();
 }
 destroy(){this.image.onload=null;this.container.classList.remove('has-motion');this.canvas.remove();}
}
const api={InkPortrait,inkState};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
