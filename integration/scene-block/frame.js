'use strict';
// This document owns graphics only. No microphone, StageChannel, cue timer or AI API.
const params=new URLSearchParams(location.search),code=params.get('code'),token=params.get('token'),origin=location.origin;
let view,scene,states=[],paused=true,ready=false,lastTick=0,clock=0;
const send=(type,detail={})=>parent.postMessage({scope:'jinmen-scene-block',version:1,type,token,code,...detail},origin);
function anchors(){
 const out={};if(!view)return out;
 for(const a of view.sim.actors){const id=view.speakerBindings.byInstance.get(a.id),native=view.native.get(a.id);if(!Number.isInteger(id)||id<0||id>8||!native)continue;
  const p=view.projection.actor(a);if(!p)continue;const height=view.projection.cell*7.5*a.settings.size*p[2],r=view.nativeGeometry(a,native,p,height),body=portraitBody(native.slot,r),head=portraitHead(native.slot,r),w=view.host.clientWidth,h=view.host.clientHeight;
  const box=[Math.max(0,body.left/w*100),Math.max(0,body.top/h*100),Math.min(100,(body.left+body.width)/w*100),Math.min(100,(body.top+body.height)/h*100)];if(box[2]>box[0]&&box[3]>box[1])out[id]={box,head:[head.x/w*100,head.y/h*100],silhouette:portraitObstacles(native.slot,r).map(b=>[b.left/w*100,b.top/h*100,b.width/w*100,b.height/h*100])};
 }return out;
}
addEventListener('message',e=>{const m=e.data;if(e.source!==parent||e.origin!==origin||m?.scope!=='jinmen-scene-host'||m.version!==1||m.token!==token||m.code!==code)return;
 if(m.type==='state'){states=Array.isArray(m.actors)?m.actors.slice(0,9):[];paused=m.paused===true;}
});
const frame=()=>new Promise(r=>requestAnimationFrame(r));
(async()=>{
 if(!/^(S0|[A-T][1-2])$/.test(code||'')||!token)throw Error('场景编号无效');
 const response=await fetch('scenes.json');if(!response.ok)throw Error('场景配置未加载');scene=(await response.json()).scenes[code];if(!scene)throw Error('未交付此场景');
 const host=document.getElementById('visual');view=new PlaneView(host,{actorState:i=>states[i],speaking:()=>new Set(states.filter(isTextSpeaking).map(a=>'stage_'+a.id)),onNotice:t=>send('error',{message:t})});
 // The host owns the clock/pause. Disable the renderer's independent RAF loop.
 cancelAnimationFrame(view.raf);view.drawNameplates=()=>{};view.setScene(scene);cancelAnimationFrame(view.raf);
 view.getFrame=(w,h)=>sceneRect(w,h,scene.backgroundAspect||16/9,true);view.projectionDirty=true;
 if(scene.background)await view.bg.decode();await view.ready;await view.water.ready;
 // Keep the old scene until all initial visible textures and idle portraits are ready.
 const until=performance.now()+14000;
 while(true){
  view.syncProjection();const quads=view.drawables();view.portraits.draw(view.sim.actors,view.projection,view.config.npc,0,quads);view.drawNative();
  for(const n of view.native.values())if(n.player?.load)n.player.load(n.slot.animation.base);
  const loaded=[...view.native.values()].every(n=>!n.player||n.player.last),pending=[...view.portraits.spritePending.values()];
  await Promise.all(pending);
  if(view.portraits.error||view.water.error)throw Error(view.portraits.error||view.water.error);
  if(loaded)break;if(performance.now()>until)throw Error('人物动画加载超时');await frame();
 }
 ready=true;send('ready',{anchors:anchors(),sourceSceneId:scene.id});
 let reported=0;
 function draw(now){
  const dt=lastTick?Math.min(50,now-lastTick):0;lastTick=now;if(!paused)clock+=dt;
  view.syncProjection();if(!paused)view.sim.step(dt/1000,view.projection,view.speakerBindings.speaking(view.speaking()));
  // Water and vehicles share the stage's paused clock too.
  view.hostTime=clock;const quads=view.drawables();view.portraits.draw(view.sim.actors,view.projection,view.config.npc,paused?0:dt/1000,quads);view.drawNative();view.stats.frames++;
  if(now-reported>=80){send('anchors',{anchors:anchors(),frames:view.stats.frames,animation:{configured:view.native.size,frames:[...view.native.values()].reduce((n,v)=>n+(v.player?.framesDrawn||0),0),failedFrames:[...view.native.values()].reduce((n,v)=>n+[...(v.player?.images?.values()||[])].filter(r=>r.error).length,0),speaking:states.filter(isTextSpeaking).map(a=>a.id)}});reported=now;}requestAnimationFrame(draw);
 }requestAnimationFrame(draw);
})().catch(e=>send('error',{message:e.message||'动态场景加载失败'}));
