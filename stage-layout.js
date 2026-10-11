(function(root){
'use strict';
const Pet=typeof module!=='undefined'?require('./actor-pet-motion.js'):root.PetMotion;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),ease=t=>t*t*(3-2*t);
function sceneRect(width,height,aspect=2,fullscreen=false){if(fullscreen){const h=Math.min(width/aspect,height),w=h*aspect;return {left:(width-w)/2,top:(height-h)/2,width:w,height:h};}const h=Math.min(width/aspect,height-74),w=h*aspect;return {left:(width-w)/2,top:Math.max(0,(height-74-h)*.48),width:w,height:h};}
function presenterZone(width,height){const scene=sceneRect(width,height),top=scene.top+scene.height*.56;return {left:0,top,width:scene.left+scene.width*.22,height:height-top};}
function presentationFor(message){
 if(['front','upper','background'].includes(message?.presentation))return message.presentation;
 return !message||Number.isInteger(message.replyTo)||['DeepSeek','模型即兴','连接提示'].includes(message.source)?'background':'front';
}
class InkBlocking{
 constructor(order,{random=Math.random}={}){
  // Keep the left foreground free for the live presenter, including body width.
  // The buildings extend below the old back row. Feet stay on the foreground
  // pavement, with small depth differences and no vertically stacked bodies.
  const points=[[.28,.955],[.585,.965],[.66,.93],[.505,.935],[.355,.925],[.80,.96],[.435,.975],[.735,.935],[.91,.96]];
  this.order=order;this.base=[];order.forEach((id,i)=>{const [x,y]=points[i%points.length];this.base[id]={x,y};});this.homes=this.base.map(p=>({...p}));this.targets=[];this.trip=null;this.random=random;this.lastTime=0;this.lastWalker=null;this.nextWalkAt=9000+random()*5000;
 }
 update(time,actors){
  this.lastTime=time;
  if(this.trip){const t=this.trip,a=actors[t.id];if(a.phase!=='idle')this.trip=null;else{const progress=clamp((time-t.start)/t.duration,0,1),e=ease(progress);this.homes[t.id]={x:t.from.x+(t.to.x-t.from.x)*e,y:t.from.y+(t.to.y-t.from.y)*e};if(progress===1)this.trip=null;}}
  if(time>=this.nextWalkAt){
   this.nextWalkAt=time+10000+this.random()*12000;
   if(!this.trip&&actors.every(a=>a.phase==='idle')){
    const start=Math.floor(this.random()*this.order.length);
    for(let i=0;i<this.order.length;i++){
     const id=this.order[(start+i)%this.order.length];if(id===this.lastWalker)continue;
     const from={...this.homes[id]},base=this.base[id],side=this.random()<.5?-1:1,distance=.022+this.random()*.018;
     const options=[side,-side].map(sign=>({x:clamp(base.x+sign*distance,.28,.94),y:clamp(base.y+(this.random()-.5)*.016,.92,.975)}));
     const to=options.find(p=>Math.hypot(p.x-from.x,p.y-from.y)>.012&&this.homes.every((o,j)=>j===id||Math.abs(o.x-p.x)>.068||Math.abs(o.y-p.y)>.11));
     if(to){this.trip={id,start:time,from,to,duration:2800+this.random()*1400};this.lastWalker=id;break;}
    }
   }
  }
  for(const a of actors){if(a.phase==='idle'){this.targets[a.id]=null;continue;}if(this.targets[a.id])continue;
   const home=this.homes[a.id];if(a.message?.improv){this.targets[a.id]={...home};continue;}const partner=actors[a.message?.lookAt];let x=home.x+(home.x<.5?.024:-.024),y=Math.min(.98,home.y+.025);
   if(partner){const other=this.homes[partner.id],center=clamp((home.x+other.x)/2,.37,.81),side=home.x<=other.x?-1:1;x=center+side*.09;y=Math.min(.975,Math.max(home.y,other.y)+.018);}
   const occupied=this.targets.filter(Boolean);if(occupied.some(t=>Math.abs(t.x-x)<.11&&Math.abs(t.y-y)<.09)){const options=[x-.13,x+.13,x-.26,x+.26].filter(v=>v>=.28&&v<.94);x=options.find(v=>occupied.every(t=>Math.abs(t.x-v)>=.11||Math.abs(t.y-y)>=.09))??x;}
   this.targets[a.id]={x:clamp(x,.28,.94),y};
  }
 }
 position(actor,progress){const home=this.homes[actor.id],target=this.targets[actor.id]||home,p=actor.message?.improv?0:ease(clamp(progress,0,1)),x=home.x+(target.x-home.x)*p,y=home.y+(target.y-home.y)*p;return {x,y,scale:.76+(y-.84)*1.25+p*.07,walking:actor.phase==='idle'&&this.trip?.id===actor.id,travel:Math.sign((this.trip?.id===actor.id?this.trip.to.x-home.x:target.x-home.x)*(actor.phase==='leaving'?-1:1))};}
 gaze(actor,actors){const speaker=actors.find(a=>a.id!==actor.id&&a.phase==='speaking'&&a.message?.lookAt===actor.id),partner=speaker||actors[actor.message?.lookAt];if(!partner)return 0;return Math.sign((this.targets[partner.id]||this.homes[partner.id]).x-(this.targets[actor.id]||this.homes[actor.id]).x);}
 travelTime(actor){const home=this.homes[actor.id],target=this.targets[actor.id]||home,distance=Math.hypot(target.x-home.x,target.y-home.y);return distance>.12?clamp(650+distance*2200,650,1800):400;}
 reset(){this.trip=null;this.targets=[];this.nextWalkAt=this.lastTime+9000+this.random()*5000;}
}
// Cast membership follows scene slots, never the dialogue queue. Retain a continuous
// pose/opacity when another cut arrives during a transition.
class SceneCastMotion{
 constructor(){this.from=null;this.to=null;this.at=0;this.duration=650;}
 cut(actors,now){this.move(actors,now);this.from=null;}
 move(actors,now){this.from=this.to?actors.map((_,i)=>this.sample(i,now)):null;this.to=actors.map(a=>({...a,aspect:a.aspect||2/3,opacity:a.present?1:0}));this.at=now;}
 sample(id,now){const b=this.to?.[id];if(!b)return null;const a=this.from?.[id]||b,p=ease(clamp((now-this.at)/this.duration,0,1)),out={};for(const key of ['x','y','scale','aspect','opacity'])out[key]=a[key]+(b[key]-a[key])*p;return out;}
}
// Scene-local walking in percentage coordinates. Speaking is a one-way move:
// settle at the new point rather than sliding back when the engine leaves a cue.
class SceneWalkMotion{
 reset(slots,time,{entryAt=time}={}){this.slots=slots;this.at=entryAt;this.states=slots.map((a,i)=>({x:a.x,y:a.y,locked:false,settled:false,trip:null,nextAt:time+9000+i*1700,turn:0}));}
 enabled(slot){return Boolean(slot?.holdAfterSpeech||slot?.roamRadius||slot?.entry==='path');}
 sample(id,actor,time,progress=0){
  const a=this.slots[id],s=this.states[id],elapsed=time-this.at-(a.entryDelayMs||0),path=a.entry==='path'&&a.entryPath?.length?[...a.entryPath,[a.x,a.y]]:null;
  let opacity=1,walking=false,travel=0,outside=false;
  if(!s.locked){
   if(path&&elapsed<(a.entryDurationMs||5000)){
    const t=clamp(elapsed/(a.entryDurationMs||5000),0,1)*(path.length-1),k=Math.min(path.length-2,Math.floor(t)),p=ease(t-k),from=path[k],to=path[k+1];s.x=from[0]+(to[0]-from[0])*p;s.y=from[1]+(to[1]-from[1])*p;
    opacity=elapsed<0?0:a.entryReveal?clamp(elapsed/500,0,1):1;walking=elapsed>=0;travel=Math.sign(to[0]-from[0]);outside=true;
   }else if(path&&!s.arrived){s.x=a.x;s.y=a.y;s.arrived=true;}
   const main=actor.message&&!actor.message.improv&&!actor.message.actionOnly&&actor.message.source!=='动作预览';
   if(main&&['thinking','entering','speaking','listening'].includes(actor.phase)){
    s.locked=true;s.trip=null;s.from={x:s.x,y:s.y};s.target={x:outside?a.x:s.x,y:(outside?a.y:s.y)+(a.mobility==='seated'?0:a.step||0)};
   }else if(!outside&&actor.phase==='idle'&&a.mobility!=='seated'&&a.roamRadius>0){
    if(time>=s.nextAt&&!s.trip){const sign=(s.turn++ + id)%2?-1:1;s.trip={at:time,from:{x:s.x,y:s.y},to:{x:a.x+sign*a.roamRadius,y:a.y+sign*a.roamRadius*.22},duration:2400+(id%3)*400};s.nextAt=time+14000+id*1300;}
    if(s.trip){const t=s.trip,p=ease(clamp((time-t.at)/t.duration,0,1));s.x=t.from.x+(t.to.x-t.from.x)*p;s.y=t.from.y+(t.to.y-t.from.y)*p;walking=p<1;travel=Math.sign(t.to.x-t.from.x);if(p===1)s.trip=null;}
   }
  }
  if(s.locked){
   // Cue cancellation before speech also leaves the cast at its last point.
   if(['speaking','listening'].includes(actor.phase)){s.settled=true;s.x=s.target.x;s.y=s.target.y;}
   else if(actor.phase==='entering'&&!s.settled){const p=ease(clamp(progress,0,1));s.x=s.from.x+(s.target.x-s.from.x)*p;s.y=s.from.y+(s.target.y-s.from.y)*p;walking=p<1;travel=Math.sign(s.target.x-s.from.x);}
   else if(['idle','leaving'].includes(actor.phase)){if(a.holdAfterSpeech)s.settled=true;else{const p=actor.phase==='idle'?0:ease(clamp(progress,0,1));s.x=s.from.x+(s.target.x-s.from.x)*p;s.y=s.from.y+(s.target.y-s.from.y)*p;if(actor.phase==='idle'){s.locked=false;s.settled=false;s.nextAt=time+14000;}else walking=p>0;}}
   outside=false;opacity=1;
  }
  return {...a,x:s.x,y:s.y,aspect:a.aspect||2/3,opacity,walking,travel,allowOutside:outside,enteringPath:outside};
 }
}

function overlap(a,b){return Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top));}
function speechAnchor(figure,actor){
 if(actor?.headPoint)return {x:figure.x-figure.width/2+actor.headPoint[0]*figure.width,y:figure.foot-figure.height+actor.headPoint[1]*figure.height};
 const profile=Pet?.profileFor(actor?.poses?.idle),shape=Pet?.footprintFor(actor?.poses?.idle),bounds=actor?.contentBounds||[0,0,1,1],band=shape?.bands?.[1]||shape?.bounds||bounds;
 let x=profile?(profile.head[0]+profile.head[2])/2:(band[0]+band[2])/2,y=profile?profile.head[1]:band[1];if(actor?.facing==='left')x=1-x;
 return {x:figure.x-figure.width/2+x*figure.width,y:figure.foot-figure.height+y*figure.height};
}
// Use portrait content, not its transparent image border, to protect the head.
function faceBounds(figure,actor){
 const profile=Pet?.profileFor(actor?.poses?.idle),bounds=actor?.contentBounds||Pet?.footprintFor(actor?.poses?.idle)?.bounds||[0,0,1,1];
 const cx=actor?.headPoint?.[0]??(bounds[0]+bounds[2])/2,top=actor?.headPoint?.[1]??bounds[1],half=Math.min((bounds[2]-bounds[0])*.36,(bounds[3]-bounds[1])*figure.height/figure.width*.09);
 let [l,t,r,b]=profile?.head||[cx-half,top,cx+half,top+(bounds[3]-bounds[1])*.2];
 if(actor?.facing==='left')[l,r]=[1-r,1-l];
 const pad=Math.max(4,Math.min(10,figure.height*.02));
 return {actorId:figure.id,left:figure.x-figure.width/2+l*figure.width-pad,top:figure.foot-figure.height+t*figure.height-pad,width:(r-l)*figure.width+pad*2,height:(b-t)*figure.height+pad*2};
}
function tailHits(box,tail,rect){
 const triangle=tail.notch.map(([x,y])=>[box.left+tail.left+x,box.top+tail.top+y]);
 const corners=[[rect.left,rect.top],[rect.left+rect.width,rect.top],[rect.left+rect.width,rect.top+rect.height],[rect.left,rect.top+rect.height]];
 const axes=[[1,0],[0,1],...triangle.map((p,i)=>{const q=triangle[(i+1)%3];return [p[1]-q[1],q[0]-p[0]];})];
 return axes.every(([x,y])=>{const a=triangle.map(p=>p[0]*x+p[1]*y),b=corners.map(p=>p[0]*x+p[1]*y);return Math.max(...a)>Math.min(...b)&&Math.max(...b)>Math.min(...a);});
}
function bubbleTail(box,speaker){
 const scale=1.15*(speaker.captionScale||1),s=speaker.config||{},head=speaker.tailTarget||speaker,target=[head.x-box.left,head.y-(s.tailMode==='point'?0:6*scale)-box.top],w=box.width,h=box.height;
 // One filled, tapered tail grows directly out of the nearest edge. Its tip
 // indicates direction; there is no leader line or separate arrow at the head.
 const dx=(target[0]-w/2)/w,dy=(target[1]-h/2)/h;
 const follow=s.tailMode==='actor'||s.tailMode==='point',side=s.tailMode!=='actor'&&['top','bottom','left','right'].includes(s.tailSide)?s.tailSide:Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'top':'bottom');
 const horizontal=side==='top'||side==='bottom',span=horizontal?w:h,half=Math.min((s.tailWidth??6)*scale/2,span/4),edge=Math.min(span/2,Math.max(half+4*scale,(s.radius||0)*(speaker.captionScale||1)+4)),c=clamp(s.tailBase==null?target[horizontal?0:1]:span*s.tailBase/100,edge,span-edge);
 const base=horizontal?[c,side==='top'?0:h]:[side==='left'?0:w,c],normal=side==='left'?[-1,0]:side==='right'?[1,0]:side==='top'?[0,-1]:[0,1],tangent=horizontal?[1,0]:[0,1];
 const angle=s.tailAngle==null?null:s.tailAngle*Math.PI/180,v=angle===null?[target[0]-base[0],target[1]-base[1]]:[Math.cos(angle),Math.sin(angle)],mag=Math.hypot(...v)||1;
 // An inward drag stays on the selected outside edge, never through the text.
 const along=clamp((v[0]*tangent[0]+v[1]*tangent[1])/mag,-.85,.85),out=Math.sqrt(1-along*along),lengthPx=(s.tailLength??12)*scale,tip=follow?target:base.map((p,i)=>p+(normal[i]*out+tangent[i]*along)*lengthPx);
 const seam=[-1,1].map(sign=>base.map((p,i)=>p-normal[i]*.75*scale+tangent[i]*half*sign)),notch=[seam[0],tip,seam[1]],all=notch;
 const left=Math.min(...all.map(p=>p[0]))-3,top=Math.min(...all.map(p=>p[1]))-3,width=Math.max(...all.map(p=>p[0]))-left+3,height=Math.max(...all.map(p=>p[1]))-top+3,local=list=>list.map(([x,y])=>[x-left,y-top]);
 return {left,top,width,height,side,points:[],connector:[],notch:local(notch),seam:local(seam),handleBase:{x:base[0],y:base[1]},handleTip:{x:tip[0],y:tip[1]}};
}
const captionStep=height=>Math.max(20,Math.min(48,height*.045));
function placeLegacyBubbles(items,width,height,{reserved=null,obstacles=[]}={}){
 const placed=[],margin=12,floor=height-80;
 for(const item of [...items].sort((a,b)=>(a.presentation==='background')-(b.presentation==='background')||a.x-b.x)){
  const bw=Math.min(item.width,width-24),bh=Math.min(item.height,floor-24),gap=item.presentation==='upper'?82:item.presentation==='front'?34:item.presentation==='background'?14:22,idealY=clamp(item.y-bh-gap,margin,floor-bh),candidates=[];
  const stagger=captionStep(height);
  const shiftsX=[-bw*.55,-bw-20,20,-bw*.5+80,-bw*.5-80],shiftsY=[0,-stagger,stagger,-stagger*2,stagger*2,-140,-220];
  for(const p of placed)shiftsY.push(p.top-stagger-idealY,p.top+stagger-idealY);
  if(obstacles.length){
   shiftsX.push(margin-item.x,width-margin-bw-item.x);shiftsY.push(margin-idealY,floor-bh-idealY);
   for(const o of [...obstacles,...placed]){shiftsX.push(o.left-bw-8-item.x,o.left+o.width+8-item.x);shiftsY.push(o.top-bh-8-idealY,o.top+o.height+8-idealY);}
  }
  if(reserved){shiftsX.push(reserved.left+reserved.width+margin-item.x);shiftsY.push(reserved.top-bh-margin-idealY);}
  for(const dy of shiftsY)for(const dx of shiftsX){
   const b={id:item.id,left:clamp(item.x+dx,margin,width-margin-bw),top:clamp(idealY+dy,margin,floor-bh),width:bw,height:bh};
   const tail=bubbleTail(b,item);
   if(obstacles.some(o=>overlap(b,o)))continue;
   const tailRect={left:b.left+tail.left,top:b.top+tail.top,width:tail.width,height:tail.height};
   b.detached=false;
   if(reserved&&(overlap(b,reserved)||(!b.detached&&overlap(tailRect,reserved))))continue;
   const collision=placed.reduce((sum,p)=>sum+overlap({...b,left:b.left-7,top:b.top-7,width:b.width+14,height:b.height+14},p),0);const distance=Math.abs(b.left+bw/2-item.x)+Math.abs(b.top-idealY)*1.1+placed.reduce((n,p)=>n+Math.max(0,stagger-Math.abs(b.top-p.top))*100,0);candidates.push({...b,score:collision*10000+distance});
  }
  candidates.sort((a,b)=>a.score-b.score);const chosen=candidates[0];if(!chosen)continue;chosen.tail=bubbleTail(chosen,item);placed.push(chosen);
 }
 return placed;
}
// Three captions are packed as a group. Greedy placement can block the last
// speaker even when a collision-free arrangement exists on the same screen.
function placeBubbleBodies(items,width,height,{reserved=null,obstacles=[],stable=false,preferSides=false}={}){
 if(!obstacles.length&&!stable)return placeLegacyBubbles(items,width,height,{reserved});
 const margin=12,floor=height-(preferSides?12:80),blocked=reserved?[...obstacles,reserved]:obstacles,pinned=[];
 const tailClear=(box,item,placed=[])=>!preferSides||![...blocked.filter(o=>o.actorId!==item.id),...placed].some(o=>tailHits(box,bubbleTail(box,item),o));
 for(const item of items){const p=item.previous||(!preferSides&&item.preferred?{...item.preferred,width:item.width,height:item.height,detached:false}:null);if(p&&p.left>=margin&&p.top>=margin&&p.left+p.width<=width-margin&&p.top+p.height<=floor&&!blocked.some(o=>overlap(p,o))&&!pinned.some(o=>overlap(p,o)||Math.abs(p.top-o.top)<captionStep(height))&&tailClear(p,item,pinned))pinned.push({...p,id:item.id,tail:bubbleTail(p,item)});}
 const ordered=items.filter(i=>!pinned.some(p=>p.id===i.id)).sort((a,b)=>b.width*b.height-a.width*a.height||a.id-b.id);
 let attempts=0,best=[];
 function candidates(item,placed,staggered){
  const bw=item.width,bh=item.height,ideal=clamp(preferSides?item.y-bh*.3:item.y-bh-24,margin,floor-bh);
  if(bw>width-24||bh>floor-24)return [];
  const xs=[margin,width-margin-bw,item.x-bw/2,item.x-bw-20,item.x+20,...(item.preferred?[item.preferred.left]:[])],ys=[margin,floor-bh,ideal,...(item.preferred?[item.preferred.top]:[])],step=captionStep(height);
  for(let i=1;i<=3;i++)ys.push(margin+i*step,ideal-i*step,ideal+i*step);
  for(const p of placed)ys.push(p.top-step,p.top+step);
  for(const o of [...blocked,...placed]){xs.push(o.left-bw-8,o.left+o.width+8);ys.push(o.top-bh-8,o.top+o.height+8);}
  for(let x=margin;x+bw<=width-margin;x+=bw+14)xs.push(x);
  const xx=[...new Set(xs.map(x=>clamp(Math.round(x),margin,width-margin-bw)))],yy=[...new Set(ys.map(y=>clamp(Math.round(y),margin,floor-bh)))],out=[];
  for(const left of xx)for(const top of yy){const box={id:item.id,left,top,width:bw,height:bh,detached:false};
   if(staggered&&placed.some(p=>Math.abs(p.top-top)<step))continue;
   if(blocked.some(o=>overlap(box,o))||placed.some(o=>overlap({...box,left:left-5,top:top-5,width:bw+10,height:bh+10},o))||!tailClear(box,item,placed)||preferSides&&placed.some(p=>tailHits(p,p.tail,box)))continue;
   const own=blocked.find(o=>o.actorId===item.id),sidePenalty=preferSides&&own&&left+bw>own.left&&left<own.left+own.width?160:0;
   out.push({...box,score:sidePenalty+(!preferSides&&item.preferred?Math.abs(left-item.preferred.left)+Math.abs(top-item.preferred.top)*1.1:Math.abs(left+bw/2-item.x)+Math.abs(top-ideal)*1.1),tail:bubbleTail(box,item)});
  }
  return out.sort((a,b)=>a.score-b.score).slice(0,70);
 }
 function search(index,placed,staggered){if(placed.length>best.length)best=placed;if(index===ordered.length)return placed;if(++attempts>1500)return null;
  for(const box of candidates(ordered[index],placed,staggered)){const found=search(index+1,[...placed,box],staggered);if(found)return found;}return null;
 }
 const staggered=search(0,pinned,true);if(staggered)return staggered;attempts=0;return search(0,pinned,false)||best;
}
function placeBubbles(items,width,height,options={}){
 const bodies=options.freeLayout?items.map(item=>{const box={id:item.id,left:item.preferred?.left??width*.1,top:item.preferred?.top??height*.1,width:item.width,height:item.height,detached:false};return {...box,tail:bubbleTail(box,item)};}):placeBubbleBodies(items,width,height,options);
 return bodies.map(box=>{
  const item=items.find(i=>i.id===box.id);if(!item?.tailTargets?.length)return box;
  const tails=item.tailTargets.map(t=>({...bubbleTail(box,{...t,captionScale:item.captionScale,tailTarget:t.config?.tailMode==='point'?{x:t.config.tailX*width/100,y:t.config.tailY*height/100}:{x:t.x+(t.config?.tailOffsetX||0)*width/100,y:t.y+(t.config?.tailOffsetY||0)*height/100}}),actor:t.id}));
  return {...box,tails,tail:tails.find(t=>t.actor===item.id)||tails[0]};
 });
}
function scenePosition(slot,smooth,actor,progress,scene,width,height){
 if(slot.embedded)return {x:slot.x/100,y:slot.y/100,scale:slot.scale,walking:false,travel:0};
 // Authored stationary placements are allowed outside the scene, just like the editor.
 if(slot.motion?.stationary)return {x:smooth.x/100,y:smooth.y/100,scale:smooth.scale,walking:false,travel:0};
 const p=actor.message?.improv||slot.mobility==='seated'?0:ease(clamp(progress,0,1)),step=Math.min(slot.step??3,100-smooth.y),scale=smooth.scale*(1+p*.055),bodyH=scene.height*.285*scale,bodyW=bodyH*smooth.aspect;
 const outside=smooth.allowOutside||slot.x<0||slot.x>100||slot.y<0||slot.y>100,rawX=scene.left+scene.width*smooth.x/100,rawFoot=scene.top+scene.height*(smooth.y+p*step)/100,x=outside?rawX:clamp(rawX,bodyW/2+8,width-bodyW/2-8),foot=outside?rawFoot:clamp(rawFoot,bodyH+8,height-10);
 return {x:(x-scene.left)/scene.width,y:(foot-scene.top)/scene.height,scale,walking:p>0&&['entering','leaving'].includes(actor.phase),travel:0};
}
// Labels remain attached to the owner's lower left/right silhouette, never a free screen slot.
function nameplateFigure(figure,actor){
 const data=Pet?.footprintFor(actor?.poses?.idle),bounds=data?.bounds||actor?.contentBounds||[0,0,1,1],feet=data?.feet||bounds;
 const rect=b=>{const l=actor?.facing==='left'?1-b[2]:b[0],r=actor?.facing==='left'?1-b[0]:b[2];return {left:figure.x-figure.width/2+l*figure.width,top:figure.foot-figure.height+b[1]*figure.height,width:(r-l)*figure.width,height:(b[3]-b[1])*figure.height};};
 const lower=rect(feet);return {...figure,feet:lower,body:rect(bounds),bands:(data?.bands||[bounds]).map(rect)};
}
function placeNameplates(figures,width,height,{reserved=presenterZone(width,height),bounds={left:0,top:0,width,height},keepVisible=false}={}){
 const intersects=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
 const edge={left:bounds.left+2,top:bounds.top+2,right:bounds.left+bounds.width-2,bottom:bounds.top+bounds.height-2};
 const gap=2,margin=2,items=figures.map(f=>{
  const foot=f.feet,fw=f.labelWidth,fh=f.labelHeight,bottom=foot.top+foot.height,cy=bottom-fh*.5,neighbors=figures.filter(o=>o.id!==f.id&&Math.abs(o.feet.top+o.feet.height-bottom)<Math.max(fh*2,f.height*.25));
  const nearest=neighbors.sort((a,b)=>Math.abs(a.x-f.x)-Math.abs(b.x-f.x))[0],preferred=nearest?(nearest.x<f.x?'right':'left'):(f.id%2?'right':'left');
  const candidates=[];
  const anchors=[foot,...f.bands.filter(b=>b.top+b.height>f.body.top+f.body.height*.25).reverse()];
  for(const anchor of anchors){const bottom=anchor.top+anchor.height,lift=Math.max(0,(foot.top+foot.height-bottom)/f.height);
  for(const inside of [false,true])for(const side of ['left','right'])for(const drop of [0,.38,.8,1.08]){
   const left=side==='left'?anchor.left-fw+(inside?fw*.5:-gap):anchor.left+anchor.width+(inside?-fw*.5:gap),top=bottom-fh*.86+drop*fh;
   const box={id:f.id,left,top,width:fw,height:fh,side,ownerX:side==='left'?anchor.left:anchor.left+anchor.width,ownerY:bottom};
   if(left<edge.left||left+fw>edge.right||top<edge.top||top+fh>edge.bottom)continue;
   if(figures.some(other=>other.id!==f.id&&other.bands.some(b=>intersects(box,b))))continue;
   candidates.push({...box,score:(intersects(box,reserved)?1:0)+drop*20+lift*100+(anchor===foot?0:8)+(inside?30:0)+(side===preferred?0:2)});
  }
  }
  candidates.sort((a,b)=>a.score-b.score);return {f,candidates:candidates.slice(0,100)};
 }).sort((a,b)=>a.candidates.length-b.candidates.length||a.f.id-b.f.id);
 let tries=0,best=[];
 function search(index,placed){if(placed.length>best.length)best=placed;if(index===items.length)return placed;if(++tries>6000)return null;
  for(const box of items[index].candidates){if(placed.some(p=>intersects({...box,left:box.left-1,top:box.top-1,width:box.width+2,height:box.height+2},p)))continue;const found=search(index+1,[...placed,box]);if(found)return found;}return null;
 }
 const complete=search(0,[]);if(complete)return complete;
 // Do not move a blocked seal onto a different person's body. Keep solving the remaining owners locally.
 const placed=[];for(const item of items){const box=item.candidates.find(b=>!placed.some(p=>intersects(b,p)));if(box)placed.push(box);}const result=placed.length>best.length?placed:best;
 if(!keepVisible)return result;
 // Project missing/offscreen owners onto the scene edge. Keep labels readable and
 // independently draggable in the editor even when the entire portrait is outside.
 for(const {f} of items.filter(item=>!result.some(p=>p.id===item.f.id))){
  const fw=f.labelWidth,fh=f.labelHeight,ownerX=f.feet.left+f.feet.width/2,ownerY=f.feet.top+f.feet.height;
  const x=clamp(ownerX-fw/2,edge.left,edge.right-fw),y=clamp(ownerY-fh*.86,edge.top,edge.bottom-fh),xs=[x],ys=[y];
  for(let xx=edge.left;xx<=edge.right-fw;xx+=fw+4)xs.push(xx);
  for(let yy=edge.top;yy<=edge.bottom-fh;yy+=fh+4)ys.push(yy);
  xs.push(edge.right-fw);ys.push(edge.bottom-fh);
  let bestBox=null;
  for(const left of xs)for(const top of ys){const b={id:f.id,left,top,width:fw,height:fh,ownerX,ownerY,side:left+fw/2<ownerX?'left':'right',docked:true};
   const hits=result.filter(p=>intersects({...b,left:left-2,top:top-2,width:fw+4,height:fh+4},p)).length,bodyHits=figures.filter(o=>o.id!==f.id&&o.bands.some(p=>intersects(b,p))).length;
   const score=hits*1e9+bodyHits*1e6+(intersects(b,reserved)?100:0)+Math.hypot(left-x,top-y);
   if(!bestBox||score<bestBox.score)bestBox={...b,score};
  }
  if(bestBox)result.push(bestBox);
 }
 return result;
}

// Convert the visible subtitle to stage coordinates, including a scaled preview.
function audienceSubtitleBounds(caption,stage,width,height){
 if(!caption?.textContent?.trim()||caption.hidden||typeof caption.getBoundingClientRect!=='function'||typeof stage?.getBoundingClientRect!=='function')return null;
 const text=caption.getBoundingClientRect(),frame=stage.getBoundingClientRect();
 if(!text.width||!text.height||!frame.width||!frame.height)return null;
 return {left:(text.left-frame.left)*width/frame.width,top:(text.top-frame.top)*height/frame.height,width:text.width*width/frame.width,height:text.height*height/frame.height};
}
// Keep the authored attachment and horizontal position. Only covered seals lift.
function avoidNameplateSubtitle(boxes,subtitle,{bounds={top:0},gap=8}={}){
 if(!subtitle||subtitle.width<=0||subtitle.height<=0)return boxes;
 const overlaps=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
 const covered=boxes.filter(b=>overlaps(b,subtitle)).sort((a,b)=>a.top-b.top||a.id-b.id);
 if(!covered.length)return boxes;
 const fixed=boxes.filter(b=>!overlaps(b,subtitle)),shifted=new Map();
 for(const box of covered){
  let top=subtitle.top-gap-box.height;
  // An upward move must not cover an otherwise unaffected nameplate.
  for(let i=0;i<=fixed.length;i++){
   const hits=fixed.filter(b=>overlaps({...box,top},b));if(!hits.length)break;
   top=Math.min(...hits.map(b=>b.top-gap-box.height));
  }
  const next={...box,top:Math.max(bounds.top+2,Math.min(box.top,top))};fixed.push(next);shifted.set(box.id,next);
 }
 return boxes.map(b=>shifted.get(b.id)||b);
}

const api={speechAnchor,faceBounds,nameplateFigure,placeNameplates,audienceSubtitleBounds,avoidNameplateSubtitle,scenePosition,SceneWalkMotion,SceneCastMotion,InkBlocking,placeBubbles,sceneRect,presenterZone,presentationFor};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
