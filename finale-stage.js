(function(root){
'use strict';

const ORDER=[8,3,5,2,0,1,4,6,7];
const SLOTS=[.285,.36,.435,.51,.585,.66,.735,.815,.915];
function positions(plan,initial,progress,scenery){
 const p=Math.max(0,Math.min(1,progress)),ease=p*p*(3-2*p);
 const people=ORDER.map((id,i)=>{
  const slot=scenery?.actors[id],target=slot?{x:slot.x/100,y:slot.y/100,scale:slot.scale}:{x:SLOTS[i],y:i%2?.943:.968,scale:.91},from=initial?.[id]||target;
  return {id,x:from.x+(target.x-from.x)*ease,y:from.y+(target.y-from.y)*ease,scale:(from.scale||.91)+(target.scale-(from.scale||.91))*ease};
 });
 return people;
}
function setupFinaleStage({channel,beforeEnter,onExit,getPositions,getPortrait,getScene}){
 let plan=JointFinale.defaultPlan();
 try{const saved=localStorage.getItem(JointFinale.KEY);if(saved)plan=JointFinale.normalize(JSON.parse(saved));}catch{}
 const player=new JointFinale.Player(plan),stage=document.getElementById('stage');
 const layer=document.createElement('section');layer.id='joint-finale';layer.hidden=true;layer.setAttribute('aria-label','新艺科倡议联合发布');
 layer.innerHTML='<div class="finale-heading" hidden><span class="finale-heading-note"></span><h1></h1><p></p></div><div class="finale-people"></div><div class="finale-labels"></div><div class="bubble finale-bubble" data-presentation="upper" aria-hidden="true"><svg class="bubble-tail" aria-hidden="true"><path></path><path class="bubble-connector"></path><path class="bubble-seam"></path><path class="bubble-notch"></path></svg><p class="bubble-text"></p></div>';
 stage.append(layer);
 const heading=layer.querySelector('.finale-heading'),bubble=layer.querySelector('.finale-bubble'),nodes=[],labels=[],portraits=[];
 let armed=false,initial=null,time=0,lastStatus='',labelKey='',labelLayout=[];
 for(const person of JointFinale.PARTICIPANTS){
  const node=document.createElement('div');node.className='actor finale-person';node.dataset.actor=String(person.id);node.setAttribute('role','img');node.setAttribute('aria-label',person.name);node.innerHTML='<div class="actor-shadow"></div><div class="art"></div>';layer.querySelector('.finale-people').append(node);nodes[person.id]=node;
  const label=document.createElement('span');label.className='nameplate';label.textContent=person.name;layer.querySelector('.finale-labels').append(label);labels[person.id]=label;
  resetPortrait(person.id);
 }
 function resetPortrait(id){
  portraits[id]?.destroy();portraits[id]=null;
  const container=nodes[id].querySelector('.art'),custom=getPortrait?.(id);
  if(custom){
   const slot=getScene?.()?.actors[id],img=document.createElement('img');img.src=custom;img.alt='';img.className='custom-avatar';container.replaceChildren(img);
   if(slot){img.style.transform=slot.facing==='left'?'scaleX(-1)':'';img.style.clipPath=slot.bodyClip?.length>=3?'polygon('+slot.bodyClip.map(p=>p.join('% ')+'%').join(',')+')':'';img.style.maskImage=slot.personMask&&!slot.maskDisabled?`url("${slot.personMask}")`:'';img.style.webkitMaskImage=img.style.maskImage;img.style.maskSize='100% 100%';img.style.webkitMaskSize='100% 100%';
    portraits[id]=typeof ActorAnimationPlayer!=='undefined'&&ActorAnimation.active(slot)?new ActorAnimationPlayer(container,slot):typeof ActorPetPlayer!=='undefined'&&ActorAnimation.options(slot.motion).enabled?new ActorPetPlayer(container,slot):null;
   }return;
  }
  const asset=INK_CAST[id];
  container.innerHTML=inkAvatarMarkup(id);
  container.innerHTML='<div class="ink-motion">'+container.innerHTML+'</div>';
  portraits[id]=new InkPortrait(container,asset,id);
 }
 function report(error){
  if(error){channel.postMessage({type:'finale-error',message:error.message||String(error)});return;}
  const snapshot={active:player.active,armed,state:player.state,index:player.index,paused:player.paused,name:player.plan.lines[player.index]?JointFinale.PARTICIPANTS[player.plan.lines[player.index].actor].name:''};
  const key=JSON.stringify(snapshot);if(key!==lastStatus){lastStatus=key;channel.postMessage({type:'finale-status',...snapshot});}
 }
 function command(message){
  const action=message.action;
  if(!action?.startsWith('finale-'))return false;
  try{
   if(action==='finale-plan'){
    if(player.active)throw new Error('请先退出发布，再修改编排。');
    plan=JointFinale.normalize(message.plan);player.setPlan(plan);
   }else if(action==='finale-arm'){
    if(player.active)throw new Error('请先退出当前发布。');
    if(message.plan){plan=JointFinale.normalize(message.plan);player.setPlan(plan);}armed=true;
   }else if(action==='finale-start'){
    if(player.active)throw new Error('发布已经开始，请用“下一条”或先退出。');
    if(message.plan){plan=JointFinale.normalize(message.plan);player.setPlan(plan);}
    player.start();initial=getPositions?.();armed=true;time=0;
    beforeEnter();for(let id=0;id<JointFinale.PARTICIPANTS.length;id++)resetPortrait(id);
   }else if(action==='finale-pause')player.pause();
   else if(action==='finale-next')player.next();
   else if(action==='finale-reset'){player.reset();armed=false;onExit?.();}
   lastStatus='';report();
  }catch(error){report(error);}
  return true;
 }
 function render(w,h,dt=0){
  if(!player.paused)time+=dt;
  player.update(dt);const active=player.active,standby=false;
  stage.classList.toggle('finale-active',active);layer.hidden=!active&&!standby;layer.dataset.standby=String(standby);layer.dataset.paused=String(player.paused);heading.hidden=!active;
  if(!active&&!standby){report();return;}
  const scenery=getScene?.(),scene=sceneRect(w,h,scenery?.backgroundAspect,Boolean(document.fullscreenElement)),layout=active?positions(plan,initial,player.movementProgress,scenery):[],byId=new Map(layout.map(p=>[p.id,p])),figures=[];
  const current=player.speaking;
  for(let id=0;id<JointFinale.PARTICIPANTS.length;id++){
   const pos=byId.get(id),node=nodes[id],label=labels[id];node.hidden=!pos;label.hidden=!pos||!active;if(!pos)continue;
   const slot=scenery?.actors[id],height=scene.height*.285*pos.scale,width=height*(slot?.aspect||2/3),x=scene.left+pos.x*scene.width,foot=scene.top+pos.y*scene.height;
   Object.assign(node.style,{width:width+'px',height:height+'px',transform:`translate(${x-width/2}px,${foot-height}px)`,zIndex:String(Math.round(pos.y*100))});
   const walking=active&&player.state==='entering';
   node.dataset.walking=String(walking);node.dataset.phase=current?.actor===id?'speaking':'idle';
   const pose=standby?0:walking?6:current?.actor===id?2:0;
   if(slot&&typeof SceneCatalog!=='undefined')Object.assign(node.querySelector('.art').style,SceneCatalog.cutoutStyle(slot));
   if(slot&&typeof PetMotion!=='undefined')Object.assign(node.querySelector('.actor-shadow').style,PetMotion.shadowStyle(slot));
   if(portraits[id]?.drawState)portraits[id].drawState({phase:node.dataset.phase,walking,travel:1},time);else if(!player.paused)portraits[id]?.draw({frame:pose,flip:false},standby?0:time);
   const scale=scenery?.nameplateScale||1;label.style.fontSize=(Math.max(9,Math.min(15,w*.0085)*scale)*1.15)+'px';label.style.padding=(4*scale*1.15)+'px '+(2*scale*1.15)+'px';
   figures.push({...nameplateFigure({id,x,foot,width,height},slot),labelWidth:label.offsetWidth||18,labelHeight:label.offsetHeight||38});
   pos.head=speechAnchor({x,foot,width,height},slot);
  }
  const nextLabelKey=JSON.stringify([figures,w,h]);if(nextLabelKey!==labelKey){labelKey=nextLabelKey;labelLayout=placeNameplates(figures,w,h,{reserved:{left:0,top:h+1,width:0,height:0}});}
  const placedNames=new Set(labelLayout.map(b=>b.id));for(const f of figures)labels[f.id].style.visibility=placedNames.has(f.id)?'visible':'hidden';
  for(const box of labelLayout)Object.assign(labels[box.id].style,{left:box.left+'px',top:box.top+'px'});
  if(active){
   heading.style.top=Math.max(14,scene.top>100?scene.top-100:scene.top+18)+'px';UIPatch.text(heading.querySelector('h1'),plan.title);
   UIPatch.text(heading.querySelector('.finale-heading-note'),plan.draft?'倡议测试稿 · 可编辑':'津门风云');
   UIPatch.text(heading.querySelector('p'),player.state==='ended'?'九位对话者 · 联合发布':player.state==='entering'?'九位对话者':`${String(player.index+1).padStart(2,'0')} / 9 · ${JointFinale.PARTICIPANTS[plan.lines[player.index].actor].name}`);
  }
  bubble.classList.toggle('visible',Boolean(current));bubble.setAttribute('aria-hidden',String(!current));
  if(current){
   const body=bubble.querySelector('.bubble-text');UIPatch.text(body,current.text);body.style.fontSize=((current.text.length>85?Math.max(12,Math.min(15,w*.0095)):Math.max(13,Math.min(15,w*.01)))*1.15)+'px';body.style.height=(Math.max(135,Math.min(175,h*.15))*1.15)+'px';bubble.dataset.actor=String(current.actor);bubble.dataset.long=String(current.text.length>85);
   const anchor=byId.get(current.actor).head;
   // The real presenter has explicitly left; the finale can use the full street.
   const box=placeBubbles([{id:current.actor,...anchor,width:bubble.offsetWidth||230,height:bubble.offsetHeight||220,presentation:'front'}],w,h,{reserved:{left:0,top:h+1,width:0,height:0}})[0];
   bubble.style.visibility=box?'visible':'hidden';
   if(box){Object.assign(bubble.style,{left:box.left+'px',top:box.top+'px'});const t=box.tail,tail=bubble.querySelector('.bubble-tail');Object.assign(tail.style,{left:t.left+'px',top:t.top+'px',width:t.width+'px',height:t.height+'px'});tail.setAttribute('viewBox',`0 0 ${t.width} ${t.height}`);tail.querySelector('path').setAttribute('d',t.points.map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' '));for(const [selector,points]of [['.bubble-connector',t.connector],['.bubble-seam',t.seam],['.bubble-notch',t.notch]])tail.querySelector(selector)?.setAttribute('d',(points||[]).map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' '));}
  }
  report();
 }
 return {get active(){return player.active;},get armed(){return armed;},command,render,report,syncStatus(){lastStatus='';report();}};
}
if(typeof module!=='undefined')module.exports={positions};else root.setupFinaleStage=setupFinaleStage;
})(globalThis);
