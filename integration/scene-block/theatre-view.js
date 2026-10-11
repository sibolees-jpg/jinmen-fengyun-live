(function(root){
'use strict';
const clamp=v=>Math.max(.25,Math.min(5,Number(v)||1));
function zoomWheel(camera,delta){
 const key='theatreZoom',min=.25,max=5;
 camera[key]=Math.max(min,Math.min(max,(camera[key]??1)*Math.exp(-delta*.001)));return key;
}
function theatrePoint(point,width,height,zoom=1){return [width/2+(point[0]-width/2)/zoom,height/2+(point[1]-height/2)/zoom];}
class TheatreViewport{
 constructor(host,{exclude=''}={}){
  this.host=host;this.exclude=exclude;this.zoom=1;this.world=document.createElement('div');this.world.className='theatre-world';
  Object.assign(this.world.style,{position:'absolute',inset:'0',transformOrigin:'50% 50%'});host.append(this.world);
  const move=nodes=>{for(const n of nodes)if(n.nodeType===1&&n!==this.world&&(!exclude||!n.matches(exclude)))this.world.append(n);};
  move([...host.children]);this.observer=new MutationObserver(records=>records.forEach(r=>move([...r.addedNodes].filter(n=>n.parentNode===host))));this.observer.observe(host,{childList:true});
 }
 setScale(value){const zoom=clamp(value);if(this.zoom===zoom)return;this.zoom=zoom;this.world.style.transform=`scale(${zoom})`;}
 point(p){return theatrePoint(p,this.host.clientWidth,this.host.clientHeight,this.zoom);}
 destroy(){this.observer.disconnect();this.world.replaceWith(...this.world.childNodes);}
}
const api={TheatreViewport,zoomWheel,theatrePoint};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
