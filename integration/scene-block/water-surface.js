(function(root){
'use strict';
// Three registered crops of original water; no generic overlays or cross-fades.
const definitions={},cache=new Map(),shotDefinitions=new WeakMap(),frames=[];
const frameIndex=(now,duration=360)=>Math.floor(Math.max(0,now)/duration)%3;
function definition(scene){const direct=definitions[scene.id];if(direct?.background===scene.background)return direct;const cached=shotDefinitions.get(scene);if(cached?.background===scene.background)return cached.value;const value=Object.values(definitions).find(d=>d.background===scene.background);shotDefinitions.set(scene,{background:scene.background,value});return value;}
function config(scene){return definition(scene)?.regions||[];}
function load(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('原水面三帧素材加载失败'));im.src=src;});}
function prepare(scene){const regions=config(scene);if(!regions.length)return Promise.resolve([]);const key=scene.background;if(!cache.has(key))cache.set(key,Promise.all(regions.map(async(r,i)=>{if(r.frames?.length!==3)throw Error('水面必须配置三帧');const images=await Promise.all(r.frames.map(load));return {...r,key:key+'|'+i,canvases:images};})).catch(e=>{cache.delete(key);throw e;}));return cache.get(key);}
function geometry(r,scene,p){let q;if(r.object){const o=scene.objects.find(o=>o.id===r.object);if(!o?.visible)return null;q=SceneObjects.geometry(o,scene,p);q={...q,foot:q.foot+.01};}else q={...SceneObjects.viewport(scene,p),foot:-9.5e7};const [x,y,w,h]=r.rect;return {x:q.x+x*q.width,y:q.y+y*q.height,width:w*q.width,height:h*q.height,foot:q.foot,depth:q.foot};}
class Surface{
 constructor(){this.epoch=0;this.regions=[];this.error='';}
 set(scene){const epoch=++this.epoch;this.scene=scene;this.regions=[];this.error='';return this.ready=prepare(scene).then(rows=>{if(epoch===this.epoch)this.regions=rows;}).catch(e=>{if(epoch===this.epoch)this.error=e.message;});}
 quads(p,now){const out=[];for(const r of this.regions){const q=geometry(r,this.scene,p);if(q){const i=frameIndex(now,r.duration);out.push({...q,canvas:r.canvases[i],key:r.key+'|'+i,revision:1,opacity:1});}}return out;}
 destroy(){this.epoch++;this.regions=[];}
}
class Layer{
 constructor(host){this.host=host;this.surface=new Surface();this.nodes=[];this.epoch=0;}
 set(scene){this.clear();this.scene=scene;const epoch=++this.epoch;this.surface.set(scene).then(()=>{if(epoch!==this.epoch)return;for(const r of this.surface.regions){const im=document.createElement('img');im.className='scene-water';im.alt='';Object.assign(im.style,{position:'absolute',pointerEvents:'none'});this.host.append(im);this.nodes.push({r,im,index:-1});}});}
 draw(rect,{hidden=false,now=performance.now()}={}){for(const node of this.nodes){const {r,im}=node,o=r.object?this.scene.objects.find(o=>o.id===r.object):null;im.hidden=hidden||Boolean(r.object&&!o?.visible);if(im.hidden)continue;const base=o?{left:rect.left+(o.x-o.width/2)*rect.width/100,top:rect.top+(o.y-o.height)*rect.height/100,width:o.width*rect.width/100,height:o.height*rect.height/100}:rect;const [x,y,w,h]=r.rect,index=frameIndex(now,r.duration);if(index!==node.index){im.src=r.frames[index];node.index=index;}Object.assign(im.style,{left:base.left+x*base.width+'px',top:base.top+y*base.height+'px',width:w*base.width+'px',height:h*base.height+'px',zIndex:String(o?SceneObjects.depth(o.y,100)+1:2)});}}
 clear(){this.epoch++;for(const n of this.nodes)n.im.remove();this.nodes=[];this.surface.destroy();}
}
const api={definitions,frames,frameIndex,config,prepare,Surface,Layer};if(typeof module!=='undefined')module.exports=api;else root.WaterSurface=api;
})(globalThis);
