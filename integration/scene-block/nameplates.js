(function(root){
'use strict';
const clamp=(n,l,r)=>Math.max(l,Math.min(r,n));
function metrics(viewWidth,text,scale=1){
 scale=1;const font=clamp(viewWidth*.015,18,26);
 return {font,width:font*1.15+6*scale+2,height:Array.from(text).length*(font+.5)+10*scale+2,scale};
}
function position(body,width,height,size){
 const gap=clamp(width*.006,6,12),margin=6;
 return {left:clamp(body.left+body.width+gap,margin,width-size.width-margin),top:clamp(body.top+clamp(body.height*.1,6,24),margin,height-size.height-margin),width:size.width,height:size.height};
}
function screenBody(b,w,h,zoom=1){return {left:w/2+(b.left-w/2)*zoom,top:h/2+(b.top-h/2)*zoom,width:b.width*zoom,height:b.height*zoom};}
class Index{
 constructor(rects=[],w=4096,h=4096){this.cells=new Map();this.w=w;this.h=h;for(const r of rects)this.add(r);}
 keys(r){const keys=[];for(let y=Math.max(0,Math.floor(r.top/96));y<=Math.min(Math.ceil(this.h/96),Math.floor((r.top+r.height)/96));y++)for(let x=Math.max(0,Math.floor(r.left/96));x<=Math.min(Math.ceil(this.w/96),Math.floor((r.left+r.width)/96));x++)keys.push(x+','+y);return keys;}
 add(r){for(const k of this.keys(r)){if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(r);}}
 overlap(r){let area=0;const seen=new Set();for(const k of this.keys(r))for(const b of this.cells.get(k)||[]){if(seen.has(b))continue;seen.add(b);area+=Math.max(0,Math.min(r.left+r.width,b.left+b.width)-Math.max(r.left,b.left))*Math.max(0,Math.min(r.top+r.height,b.top+b.height)-Math.max(r.top,b.top));}return area;}
}
function paint(label,body,width,height,scale=1,placed=null){
 const size=metrics(width,label.textContent),key=[width,label.textContent].join('|');
 if(label.nameplateKey!==key){label.nameplateKey=key;Object.assign(label.style,{fontSize:size.font+'px',padding:'5px 3px',width:size.width+'px',height:size.height+'px'});}
 const rect=placed||position(body,width,height,size);label.style.left=rect.left+'px';label.style.top=rect.top+'px';return rect;
}
function arrange(items,w,h,obstacles=[]){
 const index=new Index([...items.flatMap(i=>i.obstacles||[i.body]),...obstacles],w,h),out=[];
 for(const item of items){const size=metrics(w,item.label.textContent),ideal=position(item.side||item.body,w,h,size);let best=null;
  const consider=(left,top)=>{const r={left:clamp(left,6,w-size.width-6),top:clamp(top,6,h-size.height-6),width:size.width,height:size.height};const padded={left:r.left-4,top:r.top-4,width:r.width+8,height:r.height+8};const score=index.overlap(padded)*10000+Math.abs(r.left-ideal.left)+Math.abs(r.top-ideal.top)*1.4;if(!best||score<best.score)best={...r,score};};
  consider(ideal.left,ideal.top);
  if(best.score>0)for(let ring=1;ring<=6;ring++){const d=ring*(size.width+8);for(const y of [0,-d,d])for(const x of [0,d,-d])consider(ideal.left+x,ideal.top+y);if(best.score<10000)break;}
  if(best.score>=10000){consider(item.body.left-size.width-8,ideal.top);consider(item.body.left+item.body.width/2-size.width/2,item.body.top-size.height-10);}
  const r=paint(item.label,item.body,w,h,1,best);index.add(r);out.push({...r,actorId:item.id});
 }return out;
}
function body(slot,rect){
 const [l,t,r,b]=slot?.animation?.bounds||slot?.contentBounds||[0,0,1,1];
 return {left:rect.x+(slot?.facing==='left'?1-r:l)*rect.width,top:rect.y+t*rect.height,width:(r-l)*rect.width,height:(b-t)*rect.height};
}
function visible(body,w,h){return body.width>1&&body.height>1&&body.left<w&&body.left+body.width>0&&body.top<h&&body.top+body.height>0;}
const api={metrics,position,paint,body,visible,arrange,screenBody};if(typeof module!=='undefined')module.exports=api;else root.Nameplates=api;
})(globalThis);
