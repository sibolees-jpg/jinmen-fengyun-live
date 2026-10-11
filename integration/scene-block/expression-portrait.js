(function(root){
'use strict';
const catalog=root.PORTRAIT_EXPRESSIONS||{assets:[],fallback:[]},bySource=new Map(),byId=new Map(),cache=new Map();
function canonical(src){try{return decodeURIComponent(new URL(src,typeof location==='undefined'?'http://local/':location.href).pathname);}catch{return src;}}
for(const a of catalog.assets){byId.set(a.id,a);for(const src of [...a.source,...a.frames,...(a.walk||[])])bySource.set(canonical(src),a);}
function expressionAsset(src){if(typeof src==='number')return byId.get(catalog.fallback[src]);const key=canonical(src),direct=bySource.get(key);if(direct)return direct;const hash=key.split('/').pop();if(/^[a-f0-9]{64}\.(png|webp)$/.test(hash)){const match=catalog.assets.find(a=>a.source.some(s=>canonical(s).split('/').pop()===hash));if(match)bySource.set(key,match);return match;}}
function expressionState(pose,time,state={},offset=0){
 const blink=pose.frame===1||(time+offset)%(4200+offset%2100)<135;
 const mouth=state.speaking===true&&Math.sin((time+offset)/72)>-.25;
 const gaze=pose.frame===3?'left':pose.frame===4?'right':null;
 return {blink,mouth,gaze,index:blink?(mouth?3:1):gaze==='left'?(mouth?6:4):gaze==='right'?(mouth?7:5):mouth?2:0};
}
function bitmap(src){if(!cache.has(src))cache.set(src,fetch(src).then(r=>{if(!r.ok)throw Error('表情素材加载失败：'+src);return r.blob();}).then(async b=>{const raw=await createImageBitmap(b),ratio=Math.min(1,3072/Math.max(raw.width,raw.height));if(ratio===1)return raw;const im=await createImageBitmap(raw,{resizeWidth:Math.max(1,Math.round(raw.width*ratio)),resizeHeight:Math.round(raw.height*ratio),resizeQuality:'high'});raw.close();return im;}));return cache.get(src);}
class ExpressionPortrait{
 constructor(container,asset,{slot=null}={}){
  this.container=container;this.asset=asset;this.slot=slot;this.dead=false;this.ready=false;this.last=0;this.offset=Math.random()*10000;this.loaded=new Map();this.pending=new Map();
  this.canvas=document.createElement('canvas');this.canvas.className='motion-canvas expression-portrait';this.canvas.setAttribute('aria-hidden','true');
  this.mask=slot?.personMask&&!slot.maskDisabled?slot.personMask:null;
  this.readyPromise=Promise.all([...asset.frames,...(this.mask?[this.mask]:[])].map(src=>this.load(src))).then(()=>{if(this.dead)return;const im=this.loaded.get(asset.frames[0]);this.canvas.width=im.width;this.canvas.height=im.height;container.append(this.canvas);container.classList.add('has-motion');this.ready=true;this.draw({frame:0},0);}).catch(e=>{this.error=e.message;container.dataset.artError=e.message;console.error(e);});
 }
 load(src){if(!this.pending.has(src))this.pending.set(src,bitmap(src).then(im=>{if(!this.dead)this.loaded.set(src,im);return im;}));return this.pending.get(src);}
 draw(pose,time=0,state={}){
  if(!this.ready||this.dead)return;const s=expressionState(pose,time,state,this.offset),index=this.asset.frames[s.index]?s.index:(s.blink?1:0)+(s.mouth?2:0),src=this.asset.frames[index],flip=state.facing==='left';
  const key=index+':'+flip;if(key===this.key)return;const im=this.loaded.get(src);if(!im)return;this.key=key;this.state=s;this.last++;
  const c=this.canvas,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.save();if(flip){ctx.translate(c.width,0);ctx.scale(-1,1);}const clip=this.slot?.bodyClip;if(clip?.length>=3){ctx.beginPath();clip.forEach((p,i)=>i?ctx.lineTo(p[0]*c.width/100,p[1]*c.height/100):ctx.moveTo(p[0]*c.width/100,p[1]*c.height/100));ctx.closePath();ctx.clip();}ctx.drawImage(im,0,0,c.width,c.height);ctx.restore();
  c.dataset.pose=(s.blink?'closed-eyes':'open-eyes')+'-'+(s.mouth?'open-mouth':'closed-mouth');c.dataset.frame=String(index);
  if(this.mask){ctx.save();ctx.globalCompositeOperation='destination-in';ctx.drawImage(this.loaded.get(this.mask),0,0,c.width,c.height);ctx.restore();}
 }
 destroy(){this.dead=true;this.container.classList.remove('has-motion');this.canvas.remove();this.loaded.clear();}
}
const api={ExpressionPortrait,expressionAsset,expressionState};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
