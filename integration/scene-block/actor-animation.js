(function(root){
'use strict';
const CLIPS=['idle','blink','talk','talkBlink','breath','walkLeft','walkRight'];
const defaults=()=>({enabled:true,stationary:true,breathing:true,blinking:true,speaking:true,walking:false});
function options(value={}){return Object.fromEntries(Object.entries(defaults()).map(([k,v])=>[k,typeof value[k]==='boolean'?value[k]:v]));}
function number(v,min,max,label){if(!Number.isFinite(v)||v<min||v>max)throw Error('动画'+label+'无效');return v;}
function url(v){if(typeof v!=='string'||!/^\/api\/scene-assets\/[a-f0-9]{64}\.(png|webp)$/.test(v))throw Error('动画帧需为已上传的 PNG 或 WebP');return v;}
function normalize(value){
 if(!value)return null;
 if(value.version!==1)throw Error('动画素材版本不支持');
 const width=number(value.width,16,8192,'宽度'),height=number(value.height,16,8192,'高度');
 if(width*height>40000000)throw Error('动画画布过大');
 const anchor=value.anchor,bounds=value.bounds;
 if(!Array.isArray(anchor)||anchor.length!==2||!Array.isArray(bounds)||bounds.length!==4)throw Error('动画缺少脚底或人物范围');
 anchor.forEach(n=>number(n,0,1,'脚底'));bounds.forEach(n=>number(n,0,1,'范围'));
 if(bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||anchor[1]<=bounds[1])throw Error('动画人物范围或脚底无效');
 const clips={};for(const k of CLIPS){const frames=value.clips?.[k]||[];if(!Array.isArray(frames)||frames.length>32)throw Error('每组动画最多 32 帧');clips[k]=frames.map(url);}
 if(clips.idle.length!==1)throw Error('动画需要一张待机基准图');
 const base=url(value.base);if(base!==clips.idle[0])throw Error('动画待机图与基准图不一致');
 return {version:1,name:String(value.name||'人物动画').slice(0,100),width,height,anchor:[...anchor],bounds:[...bounds],base,clips,breathMs:number(value.breathMs??4800,1600,20000,'呼吸周期'),walkFrameMs:number(value.walkFrameMs??90,40,1000,'行走帧间隔')};
}
function active(actor){return Boolean(actor?.animation&&options(actor.motion).enabled&&actor.animation.base===actor.poses?.idle);}
function assets(actor){return actor?.animation?CLIPS.flatMap(k=>actor.animation.clips[k]||[]):[];}
function geometry(actor){const [l,t,r,b]=actor.contentBounds||[0,0,1,1];return actor?.animation&&actor.animation.base===actor.poses?.idle?{foot:actor.animation.anchor,top:actor.animation.bounds[1]}:{foot:[(l+r)/2,b],top:t};}
function frameAt(pack,settings,state,time,id=0){
 const opt=options(settings),c=pack.clips,phase=(Math.max(0,time)+id*673),blink=opt.blinking&&phase%5300>=5040;
 const explicit=state.preview;
 if((state.walking||explicit==='walk-left'||explicit==='walk-right')&&opt.walking&&!opt.stationary){const frames=explicit==='walk-left'||state.travel<0?c.walkLeft:c.walkRight;if(frames.length)return frames[Math.floor(phase/pack.walkFrameMs)%frames.length];}
 if(explicit==='blink')return (Math.floor(phase/220)%2?c.blink[0]:c.idle[0])||c.idle[0];
 const talking=opt.speaking&&state.phase==='speaking'&&!state.actionOnly;
 if(talking){const mouth=phase%560<330;return (mouth?(blink?c.talkBlink[0]||c.talk[0]:c.talk[0]):blink?c.blink[0]:c.idle[0])||c.idle[0];}
 if(blink&&c.blink.length)return c.blink[0];
 if(opt.breathing&&c.breath.length)return c.breath[Math.floor(phase%pack.breathMs/pack.breathMs*c.breath.length)];
 return c.idle[0];
}
function detach(actor){actor.animation=null;actor.motion=options(actor.motion);}
const api={CLIPS,options,normalize,active,assets,geometry,frameAt,detach};
if(typeof module!=='undefined')module.exports=api;else root.ActorAnimation=api;
})(globalThis);
