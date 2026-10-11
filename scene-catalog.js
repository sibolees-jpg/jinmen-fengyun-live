(function(root){
'use strict';
const Animation=typeof module!=='undefined'?require('./actor-animation.js'):root.ActorAnimation;
const Bubbles=typeof module!=='undefined'?require('./dialogue-overlay.js'):root.DialogueOverlay;
const NAMES=['梁启超','李鸿章','严复','李叔同','蔡元培','柏拉图','达芬奇','伽利略','愚公'];
const STOCK='assets/backgrounds/scene-overview-v1.jpg';
const ACTOR_POSITION_MIN=-Infinity,ACTOR_POSITION_MAX=Infinity,ACTOR_SCALE_MIN=.05;
function placementRange(target){return target.startsWith('actor:')?{min:ACTOR_POSITION_MIN,max:ACTOR_POSITION_MAX}:{min:target==='background'?-100:0,max:100};}
const clone=v=>JSON.parse(JSON.stringify(v));
function id(value){if(typeof value!=='string'||!/^sc-[a-z0-9-]{1,80}$/.test(value))throw Error('场次编号无效');return value;}
function text(v,max=120){return String(v??'').trim().slice(0,max);}
function number(v,fallback,min,max){const n=Number(v??fallback);if(!Number.isFinite(n)||n<min||n>max)throw Error('站位数值超出范围');return n;}
function asset(v){if(!v)return '';if(typeof v!=='string'||!(v===STOCK||/^\/api\/scene-assets\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(v)))throw Error('素材引用无效，请重新上传');return v;}
function cutout(value,source){if(!value||value.source!==source)return null;const mask=asset(value.mask),mirror=asset(value.mirror);if(!mask.endsWith('.png')||!mirror.endsWith('.png'))throw Error('人物擦除范围需为透明 PNG');return {source:asset(source),mask,mirror};}
function cutoutFor(actor){return actor?.cutout?.source===actor?.poses?.idle&&actor.cutout.mask&&actor.cutout.mirror?actor.cutout:null;}
function cutoutStyle(actor){const c=cutoutFor(actor),url=c?`url("${actor.facing==='left'?c.mirror:c.mask}")`:'';return {maskImage:url,webkitMaskImage:url,maskSize:'100% 100%',webkitMaskSize:'100% 100%',maskRepeat:'no-repeat',webkitMaskRepeat:'no-repeat',maskMode:'alpha'};}
function polygon(points){if(!Array.isArray(points))return [];if(points.length>100)throw Error('遮挡轮廓过长');return points.map(p=>{if(!Array.isArray(p)||p.length!==2)throw Error('遮挡坐标无效');return [number(p[0],0,0,100),number(p[1],0,0,100)];});}
// A finished image is one visual block. Keep the original independent assets
// intact so disabling the placeholder restores the author's editable scene.
function composition(value){
 if(!value)return null;
 if(value.kind!=='image')throw Error('整景占位类型无效');
 const image=asset(value.image);if(!image)throw Error('整景占位缺少图片');
 const anchors={};for(const [id,p] of Object.entries(value.anchors||{})){
  if(!/^[0-8]$/.test(id)||!Array.isArray(p.box)||p.box.length!==4||!Array.isArray(p.head)||p.head.length!==2)throw Error('整景人物锚点无效');
  const box=p.box.map(n=>number(n,0,0,100)),head=p.head.map(n=>number(n,0,0,100));
  if(box[2]<=box[0]||box[3]<=box[1]||head[0]<box[0]||head[0]>box[2]||head[1]<box[1]||head[1]>box[3])throw Error('整景人物范围无效');
  anchors[id]={box,head};
 }
 return {kind:'image',enabled:value.enabled!==false,...(value.freeLayout===true?{freeLayout:true}:{}),image,width:number(value.width,0,1,16000),height:number(value.height,0,1,16000),sourceName:text(value.sourceName,160),anchors};
}
function sceneBlock(value){
 if(!value)return null;if(!/^(S0|[A-T][1-2])$/.test(value.code)||!/^[a-f0-9]{40}$/.test(value.revision))throw Error('动态场景编号或版本无效');
 const anchors={};for(const [key,p] of Object.entries(value.anchors||{})){if(!/^[0-8]$/.test(key)||!Array.isArray(p.box)||p.box.length!==4||!Array.isArray(p.head)||p.head.length!==2)throw Error('动态人物锚点无效');const box=p.box.map(n=>number(n,0,-1000,1000)),head=p.head.map(n=>number(n,0,-1000,1000));if(box[2]<=box[0]||box[3]<=box[1])throw Error('动态人物范围无效');anchors[key]={box,head};}
 return {enabled:value.enabled!==false,code:value.code,revision:value.revision,anchors};
}
function isFlat(scene){return scene?.composition?.enabled===true&&scene.composition.freeLayout===true;}
function isStaticCast(scene){return scene?.visualMode==='static-cast';}
function actorVisualKey(scene,actor){return JSON.stringify([actor.poses.idle,actor.embedded===true,scene.fallbackStanding===true,isStaticCast(scene),actor.animation,actor.motion,actor.facing]);}
function freeBubbles(scene){return isFlat(scene)||isStaticCast(scene);}
function isDynamic(scene){return !isFlat(scene)&&!isStaticCast(scene)&&scene?.sceneBlock?.enabled===true;}
function isComposite(scene){return !isStaticCast(scene)&&(isDynamic(scene)||scene?.composition?.enabled===true);}
function visualScene(scene){
 if(isStaticCast(scene))return {...scene,backgroundAspect:16/9,foreground:'',sceneryLayers:[],occluders:[],actors:scene.actors.map(a=>a.visualHidden?{...a,entry:'cut',embedded:true,unanchored:true}:{...a,entry:'cut'})};
 if(!isComposite(scene))return scene;
 const c=isDynamic(scene)?{...scene.sceneBlock,image:scene.background,width:16,height:9}:scene.composition,aspect=isFlat(scene)?16/9:c.width/c.height;
 return {...scene,background:c.image,backgroundAspect:aspect,backgroundTransform:{x:0,y:0,scale:1},placeholder:'',foreground:'',sceneryLayers:[],occluders:[],fallbackStanding:false,actors:scene.actors.map(a=>{
  const anchor=c.anchors[a.id],box=anchor?.box||[45,10,55,30],height=box[3]-box[1];
  return {...a,embedded:true,unanchored:!anchor,present:a.present||Boolean(anchor),poses:{idle:'',speaking:'',walkLeft:'',walkRight:''},animation:null,personMask:'',bodyClip:[],contentBounds:[0,0,1,1],facing:'right',furniture:false,entry:'cut',holdAfterSpeech:false,roamRadius:0,step:0,motion:{...a.motion,enabled:false,stationary:true},x:(box[0]+box[2])/2,y:box[3],scale:height/28.5,aspect:(box[2]-box[0])*aspect/height,headPoint:anchor?[(anchor.head[0]-box[0])/(box[2]-box[0]),(anchor.head[1]-box[1])/height]:[.5,0]};
 })};
}
function blankScene(key,name,{overview=false,finale=false}={}){return {id:key,name,background:overview?STOCK:'',foreground:'',foregroundLayer:110,sceneryLayers:[],notes:'',fallbackStanding:true,placeholder:'',actors:NAMES.map((name,i)=>({id:i,present:!overview,poses:{idle:'',speaking:'',walkLeft:'',walkRight:''},x:28+i*7.3,y:94,scale:1,facing:'right',layer:i})),presenter:{x:0,y:55,width:23,height:45}};}
function seed(){const definitions=[['overview','总缩略图／总览地图',['大全景']],['jingang','金刚公园',['入场中景','中景']],['main-building','北洋女师老主楼',['主楼中景','主楼楼梯 · 近景','主楼局部 · 近景']],['juewu','觉悟社',['主场景']],['study','社会美育工作站（北洋书房）',['室内']],['district','天美艺术街区',['主场景']],['xr','演讲地点拓展现实',['真人站位与集体呼吁']]];return {schemaVersion:1,maps:definitions.map(([key,name,scenes],i)=>({id:'sc-map-'+key,name,scenes:scenes.map((name,j)=>blankScene('sc-'+key+'-'+(j+1),name,{overview:i===0,finale:i===6}))}))};}
function normalize(value){
 if(value?.schemaVersion!==1||!Array.isArray(value.maps)||value.maps.length<1||value.maps.length>60)throw Error('场次库需包含 1–60 个地图');const keys=new Set();
 const unique=v=>{v=id(v);if(keys.has(v))throw Error('地图或景别编号重复');keys.add(v);return v;};let count=0;
 const normalized={schemaVersion:1,openingMode:['white','standby'].includes(value.openingMode)?value.openingMode:'scene',bindingMode:value.bindingMode==='timeline'?'timeline':'blocks',maps:value.maps.map(map=>{if(!text(map.name,60)||!Array.isArray(map.scenes)||!map.scenes.length||map.scenes.length>30)throw Error('请填写地图名称并保留至少一个景别');return {id:unique(map.id),name:text(map.name,60),sharedAssets:map.sharedAssets===true,scenes:map.scenes.map(scene=>{
  if(++count>200)throw Error('景别总数不能超过 200');if(!text(scene.name,60))throw Error('请填写景别名称');if(!Array.isArray(scene.actors)||![9,10].includes(scene.actors.length))throw Error('人物槽位不完整');
  const layerIds=new Set();
  return {...(scene.visualMode==='static-cast'?{visualMode:'static-cast'}:{}),...(scene.sceneBlock?{sceneBlock:sceneBlock(scene.sceneBlock)}:{}),...(scene.liveDialogue===true?{liveDialogue:true}:{}),...(scene.composition?{composition:composition(scene.composition)}:{}),id:unique(scene.id),name:text(scene.name,60),notes:text(scene.notes,1000),fallbackStanding:scene.fallbackStanding===true,placeholder:text(scene.placeholder,100),backgroundAspect:number(scene.backgroundAspect,2,.5,4),backgroundTransform:backgroundTransform(scene),nameplateScale:number(scene.nameplateScale,1,.5,1.5),background:asset(scene.background),foreground:asset(scene.foreground),foregroundLayer:number(scene.foregroundLayer,110,0,110),sceneryLayers:(scene.sceneryLayers||[]).slice(0,12).map(layer=>{const key=text(layer.id,60);if(!/^layer-[a-f0-9-]+$/.test(key)||layerIds.has(key))throw Error('场景图层编号无效或重复');layerIds.add(key);return {id:key,name:text(layer.name,60)||'场景图层',asset:asset(layer.asset),visible:layer.visible!==false,x:number(layer.x,50,0,100),y:number(layer.y,80,0,100),scale:number(layer.scale,1,.2,3),aspect:number(layer.aspect,1,.2,4),layer:number(layer.layer,65,0,110)};}),occluders:(scene.occluders||[]).slice(0,12).map(o=>({name:text(o.name,60),polygon:polygon(o.polygon),layer:number(o.layer,65,0,110)})),analysis:text(scene.analysis,240),actors:scene.actors.slice(0,NAMES.length).map((a,i)=>{if(a.id!==i)throw Error('人物编号不符');return {id:i,...(a.visualHidden===true?{visualHidden:true}:{}),bubble:Bubbles.normalize(a.bubble),...(a.bubbleCues?{bubbleCues:Bubbles.normalizeCues(a.bubbleCues)}:{}),present:a.present===true,motion:Animation.options(a.motion),animation:a.animation&&a.animation.base===a.poses?.idle?Animation.normalize(a.animation):null,labelPlacement:a.labelPlacement?{x:number(a.labelPlacement.x,.3,-1,1),y:number(a.labelPlacement.y,.75,0,1.2)}:null,assetName:text(a.assetName,160),contentBounds:Array.isArray(a.contentBounds)&&a.contentBounds.length===4?a.contentBounds.map(n=>number(n,0,0,1)):[0,0,1,1],entry:['cut','fade','left','right','path'].includes(a.entry)?a.entry:'cut',entryPath:(a.entryPath||[]).slice(0,8).map(p=>{if(!Array.isArray(p)||p.length!==2)throw Error('入场路径坐标无效');return [number(p[0],0,-15,115),number(p[1],50,25,100)];}),entryDurationMs:number(a.entryDurationMs,5000,600,20000),entryDelayMs:number(a.entryDelayMs,0,0,15000),entryReveal:a.entryReveal===true,roamRadius:number(a.roamRadius,0,0,1.2),holdAfterSpeech:a.holdAfterSpeech===true,mobility:a.mobility==='seated'?'seated':'standing',step:number(a.step,3,0,8),bodyClip:polygon(a.bodyClip),personMask:asset(a.personMask),...(a.cutout&&a.cutout.source===a.poses?.idle?{cutout:cutout(a.cutout,a.poses.idle)}:{}),maskReview:a.maskReview===true,maskDisabled:a.maskDisabled===true,furniture:a.furniture===true,furnitureLayer:number(a.furnitureLayer,Math.max(0,(a.layer??i)-1),0,110),aspect:number(a.aspect,2/3,.2,3),poses:Object.fromEntries(['idle','speaking','walkLeft','walkRight'].map(k=>[k,asset(a.poses?.[k])])),x:number(a.x,30,ACTOR_POSITION_MIN,ACTOR_POSITION_MAX),y:number(a.y,94,ACTOR_POSITION_MIN,ACTOR_POSITION_MAX),scale:number(a.scale,1,ACTOR_SCALE_MIN,Infinity),facing:a.facing==='left'?'left':'right',layer:number(a.layer,i,0,100)};}),presenter:{x:number(scene.presenter?.x,0,0,100),y:number(scene.presenter?.y,55,0,100),width:number(scene.presenter?.width,23,0,100),height:number(scene.presenter?.height,45,0,100)}};
 })};})};
 if(value.standbySceneId){normalized.standbySceneId=id(value.standbySceneId);if(!locate(normalized,normalized.standbySceneId))throw Error('暖场待机景别不存在');}
 if(normalized.openingMode==='standby'&&!normalized.standbySceneId)throw Error('请指定 S0 暖场待机景别');
 for(const map of normalized.maps)if(map.sharedAssets){const master=map.scenes[0];for(const scene of map.scenes.slice(1)){scene.fallbackStanding=master.fallbackStanding;scene.actors.forEach((a,i)=>{a.poses=clone(master.actors[i].poses);a.assetName=master.actors[i].assetName;a.aspect=master.actors[i].aspect;for(const key of ['personMask','bodyClip','maskReview','maskDisabled','furniture','mobility','animation','motion'])a[key]=clone(master.actors[i][key]);});}}
 if(value.timeline!==undefined){if(!Array.isArray(value.timeline)||value.timeline.length>200)throw Error('镜头本最多 200 段');normalized.timeline=value.timeline.map((r,i)=>{if(!locate(normalized,r.sceneId)||!text(r.text,30000))throw Error('镜头本需填写讲话并绑定景别');return {id:text(r.id||'shot-'+i,80),name:text(r.name,100),sceneId:r.sceneId,text:text(r.text,30000)};});}
 return normalized;
}
function locate(catalog,key){for(const [mi,map] of catalog.maps.entries()){const si=map.scenes.findIndex(s=>s.id===key);if(si>=0)return {map,scene:map.scenes[si],mi,si};}return null;}
function mapCode(catalog,mi){const q=/^sc-map-q925-([a-z]+)$/.exec(catalog.maps[mi]?.id||'');if(q)return q[1].toUpperCase();const standby=locate(catalog,catalog.standbySceneId)?.mi;return mi===standby?'S0':'S'+(mi+1-(standby!==undefined&&standby<mi?1:0));}
// Only visible base materials gate a scene cut; optional animation frames load lazily.
function playbackAssets(scene){if(isStaticCast(scene))return [...new Set([scene.background,...scene.actors.filter(a=>a.present&&!a.visualHidden).flatMap(a=>[a.poses.idle,...(cutoutFor(a)?[a.cutout.mask,a.cutout.mirror]:[])])].filter(Boolean))];if(isDynamic(scene))return [];if(isComposite(scene))return [scene.composition.image];return [...new Set([scene.background,scene.foreground,...(scene.sceneryLayers||[]).filter(a=>a.visible!==false).map(a=>a.asset),...scene.actors.flatMap(a=>[...Object.values(a.poses),a.personMask,...(cutoutFor(a)?[a.cutout.mask,a.cutout.mirror]:[])])].filter(Boolean))];}
function assets(scene){return [...new Set([...playbackAssets({...scene,visualMode:undefined,composition:null,sceneBlock:null}),...(scene.composition?[scene.composition.image]:[]),...(scene.sceneryLayers||[]).map(a=>a.asset),...scene.actors.flatMap(a=>[...Animation.assets(a),a.bubble?.fontAsset,...Object.values(a.bubbleCues||{}).map(b=>b.fontAsset)])].filter(Boolean))];}
// Front-to-back list. Scene layers are static; actor records keep their motion data.
function layerEntries(scene){
 const entries=[];
 if(scene.foreground)entries.push({key:'foreground',type:'scene',name:'前景／遮挡层',layer:scene.foregroundLayer??110});
 for(const item of scene.sceneryLayers||[])entries.push({key:'scenery:'+item.id,type:'scene',name:item.name,layer:item.layer,visible:item.visible!==false&&Boolean(item.asset)});
 for(const item of scene.actors)if(item.furniture&&item.bodyClip?.length>=3&&item.poses.idle)entries.push({key:'furniture:'+item.id,type:'scene',name:NAMES[item.id]+'素材中的桌椅',layer:item.furnitureLayer??item.layer-1});
 for(const [index,item] of (scene.occluders||[]).entries())entries.push({key:'occluder:'+index,type:'scene',name:item.name||'背景遮挡',layer:item.layer});
 for(const item of scene.actors)entries.push({key:'actor:'+item.id,type:'actor',name:NAMES[item.id],layer:item.layer,visible:item.present});
 entries.sort((a,b)=>b.layer-a.layer||({foreground:0,scenery:1,furniture:2,occluder:2,actor:3}[a.key.split(':')[0]]??9)-({foreground:0,scenery:1,furniture:2,occluder:2,actor:3}[b.key.split(':')[0]]??9)||a.key.localeCompare(b.key));
 entries.push({key:'background',type:'scene',name:'背景（固定底层）',layer:0,locked:true});return entries;
}
function reorderLayers(scene,source,target,after=false,scope='all'){
 if(source==='background'||source===target)return false;
 const entries=layerEntries(scene).filter(item=>item.key!=='background'),scoped=scope==='actor'||scope==='scene';
 const movable=scoped?entries.filter(item=>item.type===scope):entries.slice(),from=movable.findIndex(item=>item.key===source);
 if(from<0||target!=='background'&&!movable.some(item=>item.key===target))return false;
 const [item]=movable.splice(from,1),to=target==='background'?movable.length:movable.findIndex(entry=>entry.key===target)+(after?1:0);movable.splice(to,0,item);
 if(scoped){let next=0;for(let i=0;i<entries.length;i++)if(entries[i].type===scope)entries[i]=movable[next++];}
 else entries.splice(0,entries.length,...movable);
 entries.forEach((entry,index)=>{const depth=entries.length-index,[kind,key]=entry.key.split(':');if(kind==='actor')scene.actors[Number(key)].layer=depth;else if(kind==='furniture')scene.actors[Number(key)].furnitureLayer=depth;else if(kind==='occluder')scene.occluders[Number(key)].layer=depth;else if(kind==='scenery')scene.sceneryLayers.find(layer=>layer.id===key).layer=depth;else scene.foregroundLayer=depth;});
 return true;
}
function missing(scene){if(isComposite(scene))return [];return [...(!scene.background&&!scene.placeholder?['背景']:[]),...scene.actors.filter(a=>a.present&&!a.poses.idle&&!(scene.fallbackStanding&&a.id<9)).map(a=>NAMES[a.id]+'立绘')];}
// Preserve visible feet and height when replacement images have different margins.
function actorGeometry(actor){const [l,t,r,b]=actor.contentBounds||[0,0,1,1];return Animation?.geometry(actor)||{foot:[(l+r)/2,b],top:t};}
function actorAnchor(actor,backgroundAspect=2){const {foot:[x,y],top}=actorGeometry(actor),height=28.5*actor.scale;return {x:actor.x+height*actor.aspect/backgroundAspect*(x-.5),y:actor.y-height*(1-y),height:height*(y-top),layer:actor.layer};}
function fitActor(actor,anchor,backgroundAspect=2){const {foot:[x,y],top}=actorGeometry(actor);actor.scale=Math.max(ACTOR_SCALE_MIN,anchor.height/(28.5*Math.max(.05,y-top)));const height=28.5*actor.scale;actor.x=Math.max(ACTOR_POSITION_MIN,Math.min(ACTOR_POSITION_MAX,anchor.x-height*actor.aspect/backgroundAspect*(x-.5)));actor.y=Math.max(ACTOR_POSITION_MIN,Math.min(ACTOR_POSITION_MAX,anchor.y+height*(1-y)));if(anchor.layer!==undefined)actor.layer=anchor.layer;return actor;}
// All editor coordinates stay in the existing scene coordinate system.
function backgroundTransform(scene){const t=scene?.backgroundTransform;return {x:number(t?.x,0,-100,100),y:number(t?.y,0,-100,100),scale:number(t?.scale,1,.25,4)};}
function backgroundStyle(scene,width,height){const t=backgroundTransform(scene),style={transformOrigin:'50% 50%',transform:`translate(${t.x}%, ${t.y}%) scale(${t.scale})`};
 // Keep the transformed plane inside the original scene window, including letterboxes.
 // The legacy rectangular clip composes with each occluder's polygon clip-path.
 if(width&&height){const cut=(edge,offset,size)=>Math.max(0,Math.min(size,((edge-.5-offset/100)/t.scale+.5)*size));style.clip=`rect(${cut(0,t.y,height)}px, ${cut(1,t.x,width)}px, ${cut(1,t.y,height)}px, ${cut(0,t.x,width)}px)`;}return style;}
function placement(scene,target){if(target==='background')return backgroundTransform(scene);const [kind,key]=target.split(':');return kind==='scenery'?(scene.sceneryLayers||[]).find(layer=>layer.id===key):scene.actors[Number(key)];}
function placementBounds(scene,target,value=placement(scene,target)){
 const background=target==='background',height=(background?100:28.5)*value.scale,width=background?height:height*(value.aspect||2/3)/(scene.backgroundAspect||2);
 return {left:(background?50+value.x:value.x)-width/2,top:(background?50+value.y:value.y)-height/(background?2:1),width,height};
}
function movePlacement(target,start,dx,dy){const {min,max}=placementRange(target);return {x:Math.max(min,Math.min(max,start.x+dx)),y:Math.max(min,Math.min(max,start.y+dy)),scale:start.scale};}
// Project onto the diagonal in pixels; keep the opposite corner anchored.
function resizePlacement(scene,target,start,corner,dx,dy,aspect=scene.backgroundAspect||2){
 const box=placementBounds(scene,target,start),sx=corner.includes('e')?1:-1,sy=corner.includes('s')?1:-1,bg=target==='background',free=target.startsWith('actor:');
 const ax=box.left+(sx<0?box.width:0),ay=box.top+(sy<0?box.height:0),vx=sx*box.width*aspect,vy=sy*box.height;
 let factor=1+(dx*aspect*vx+dy*vy)/(vx*vx+vy*vy),lo=(bg?.25:free?ACTOR_SCALE_MIN:.2)/start.scale,hi=(bg?4:free?Infinity:3)/start.scale;
 const cx=ax-(bg?50:0),cy=ay-(bg?50:0),mx=sx*box.width/2,my=bg?sy*box.height/2:sy>0?box.height:0,{min,max}=placementRange(target);
 for(const [c,m] of [[cx,mx],[cy,my]])if(m){const ends=[(min-c)/m,(max-c)/m].sort((a,b)=>a-b);lo=Math.max(lo,ends[0]);hi=Math.min(hi,ends[1]);}
 factor=Math.max(lo,Math.min(hi,factor));
 return {x:Math.max(min,Math.min(max,cx+mx*factor)),y:Math.max(min,Math.min(max,cy+my*factor)),scale:Math.max(bg?.25:free?ACTOR_SCALE_MIN:.2,Math.min(bg?4:free?Infinity:3,start.scale*factor))};
}

const api={cutoutFor,cutoutStyle,ACTOR_POSITION_MIN,ACTOR_POSITION_MAX,ACTOR_SCALE_MIN,placementRange,isStaticCast,actorVisualKey,freeBubbles,isFlat,isDynamic,isComposite,visualScene,backgroundTransform,backgroundStyle,placement,placementBounds,movePlacement,resizePlacement,layerEntries,reorderLayers,actorAnchor,fitActor,NAMES,STOCK,clone,seed,normalize,blankScene,locate,mapCode,assets,playbackAssets,missing};if(typeof module!=='undefined')module.exports=api;else root.SceneCatalog=api;
})(globalThis);
