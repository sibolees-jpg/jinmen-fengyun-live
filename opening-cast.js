(function(root){
'use strict';
const names=[['李鸿章',1],['梁启超',0],['严复',2],['蔡元培',4],['李叔同',3],['柏拉图',5],['伽利略',7],['达芬奇',6],['愚公',8]];
const clean=text=>String(text||'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
class OpeningCast{
 constructor(script){this.configure(script);}
 configure(script){
  // The introduction, not the global actor library, determines this show's cast.
  const intro=clean(script?.blocks?.[0]?.source);
  this.names=script?names.filter(([name])=>intro.includes(name)):names;
  this.reset();
 }
 reset(){this.seen=new Map();this.confirmed='';this.started=false;this.transitioned=false;}
 feed(text,final,now){
  if(this.transitioned)return false;
  const heard=(this.confirmed+clean(text)).slice(-260);
  if(heard.includes('他们是')||this.names.some(([name])=>heard.includes(name)))this.started=true;
  if(this.started){let offset=0;for(const [name,id] of this.names)if(heard.includes(name)&&!this.seen.has(id)){this.seen.set(id,now+offset);offset+=120;}}
  // Start at the next sentence's first phrase, independent of ASR punctuation.
  const transition=heard.includes('我们一起来说说')||heard.includes('天津美院办学');
  if(transition)this.transitioned=true;
  if(final)this.confirmed=heard.slice(-160);
  return transition;
 }
 opacity(id,now){const at=this.seen.get(id);return at===undefined?0:Math.max(0,Math.min(1,(now-at)/450));}
 snapshot(){return {introduced:[...this.seen.keys()],transitioned:this.transitioned};}
}
OpeningCast.names=names;if(typeof module!=='undefined')module.exports=OpeningCast;else root.OpeningCast=OpeningCast;
})(globalThis);
