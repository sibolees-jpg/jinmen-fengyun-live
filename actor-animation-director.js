(function(root){
'use strict';
let libraryPromise;
const library=()=>libraryPromise??=(fetch('assets/actor-animation-library/library.json').then(r=>{if(!r.ok)throw Error('人物素材库未载入');return r.json();}).catch(e=>{libraryPromise=null;throw e;}));
const clone=v=>JSON.parse(JSON.stringify(v));
const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
async function imageInfo(blob){
 const src=URL.createObjectURL(blob),img=new Image();try{img.src=src;await img.decode();if(img.naturalWidth*img.naturalHeight>40000000)throw Error('素材尺寸过大');const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=0,b=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>64){l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);}if(!r||!b)throw Error('图片没有可见人物');return {width:c.width,height:c.height,bounds:[l/c.width,t/c.height,r/c.width,b/c.height]};}finally{URL.revokeObjectURL(src);}
}
function apply(actor,scene,item,C){
 const anchor=C.actorAnchor(actor,scene.backgroundAspect);actor.animation=item.animation?ActorAnimation.normalize(item.animation):null;actor.motion=ActorAnimation.options(actor.motion);
 actor.motion.enabled=true;actor.motion.stationary=true;actor.motion.walking=false;
 actor.poses={idle:item.idle,speaking:'',walkLeft:'',walkRight:''};actor.assetName=item.name;actor.aspect=item.width/item.height;actor.contentBounds=[...item.bounds];actor.personMask='';actor.maskDisabled=true;actor.bodyClip=[];actor.furniture=false;actor.maskReview=Boolean(item.hasProps);actor.mobility=item.mobility||'standing';actor.labelPlacement=null;actor.entry='cut';actor.step=0;actor.roamRadius=0;actor.holdAfterSpeech=true;
 C.fitActor(actor,anchor,scene.backgroundAspect);
}
async function materialize(item,api){
 const copy=clone(item),paths=new Set([copy.idle,...Object.values(copy.animation?.clips||{}).flat()]),urls=new Map();
 for(const p of paths){if(!/^assets\/actor-animation-library\/[a-f0-9]{64}\.png$/.test(p))throw Error('素材库路径无效');const response=await fetch(p);if(!response.ok)throw Error('素材库缺少图片');const blob=await response.blob(),saved=await api('/api/scene-assets',{method:'POST',headers:{'Content-Type':'image/png'},body:blob});urls.set(p,saved.url);}
 copy.idle=urls.get(copy.idle);if(copy.animation){copy.animation.base=copy.idle;for(const k of ActorAnimation.CLIPS)copy.animation.clips[k]=(copy.animation.clips[k]||[]).map(p=>urls.get(p));}return copy;
}
async function importFolder(files,name,api){
 const list=[...files].filter(f=>f.name.endsWith('.png')&&f.name.startsWith(name+'_')),find=suffix=>list.find(f=>f.name===name+'_'+suffix+'.png');
 if(new Set(list.map(f=>f.name)).size!==list.length)throw Error('检测到同名动画帧，请只选择该人物的一套姿势文件夹');
 const idle=find('向右站立_睁眼闭嘴');if(!idle)throw Error('请选择包含“'+name+'_向右站立_睁眼闭嘴.png”的动画文件夹');
 const parts={idle:[idle],blink:[find('向右站立_闭眼')].filter(Boolean),talk:[find('向右站立_张嘴')].filter(Boolean),talkBlink:[find('向右站立_闭眼张嘴')].filter(Boolean)};
 for(const [k,prefix]of [['breath','向右呼吸_'],['walkLeft','向左行走_'],['walkRight','向右行走_']])parts[k]=list.filter(f=>new RegExp('^'+name+'_'+prefix+'\\d+\\.png$').test(f.name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
 if(Object.values(parts).some(v=>v.length>32))throw Error('每组动画最多 32 帧');
 const info=await imageInfo(idle),unique=[...new Set(Object.values(parts).flat())];
 if(info.width/info.height<.2||info.width/info.height>3)throw Error('人物画布宽高比需在 0.2–3 之间');
 // Validate every frame before uploading or changing the actor draft.
 for(const f of unique){if(f.size>20*1024*1024)throw Error('单帧不能超过 20 MB');if(f===idle)continue;const src=URL.createObjectURL(f),im=new Image();try{im.src=src;await im.decode();if(im.naturalWidth!==info.width||im.naturalHeight!==info.height)throw Error('同套动画必须统一画布尺寸：'+f.name);}finally{URL.revokeObjectURL(src);}}
 let anchor=[(info.bounds[0]+info.bounds[2])/2,info.bounds[3]],breathMs=4800;
 const metaFile=[...files].find(f=>f.name==='动画说明.json'&&(f.webkitRelativePath||'').split('/').includes(name));
 if(metaFile){const meta=JSON.parse(await metaFile.text());if(meta.canvas?.[0]!==info.width||meta.canvas?.[1]!==info.height)throw Error('动画说明中的画布尺寸不一致');anchor=[meta.foot[0]/info.width,meta.foot[1]/info.height];breathMs=(meta.breathing_cycle_seconds||4.8)*1000;}
 const dummy='/api/scene-assets/'+'0'.repeat(64)+'.png';ActorAnimation.normalize({version:1,name,width:info.width,height:info.height,anchor,bounds:info.bounds,base:dummy,clips:{idle:[dummy]},breathMs});
 const urls=new Map();for(const f of unique){const saved=await api('/api/scene-assets',{method:'POST',headers:{'Content-Type':'image/png'},body:f});urls.set(f,saved.url);}const clips=Object.fromEntries(Object.entries(parts).map(([k,frames])=>[k,frames.map(f=>urls.get(f))]));
 return {name:name+' · 导入动画',idle:urls.get(idle),...info,mobility:'standing',animation:{version:1,name:name+' · 导入动画',...info,anchor,base:urls.get(idle),clips,breathMs,walkFrameMs:90}};
}
root.mountActorAnimationControls=function({section,actor,scene,map,C,mark,refresh,api,setBusy}){
 const box=element('details');box.className='actor-animation-controls';box.append(element('summary','原地动作与素材库'));
 const status=element('p',actor.animation?'已配置：'+actor.animation.name:(typeof PetMotion!=='undefined'&&PetMotion.profileFor(actor.poses.idle)?'已启用轻微呼吸、眨眼与接话口型':'轻微呼吸已启用 · 新姿势的眼口位置需单独校准'));status.className='hint';box.append(status);
 const controls=element('div');controls.className='scene-numbers';
 for(const [key,label]of [['enabled','启用人物微动画'],['breathing','原地呼吸'],['blinking','偶尔眨眼'],['speaking','接话时张嘴'],['stationary','固定站位（默认）'],['walking','允许行走帧']]){const row=element('label'),input=element('input');input.type='checkbox';input.checked=ActorAnimation.options(actor.motion)[key];input.setAttribute('aria-label',C.NAMES[actor.id]+label);row.append(input,document.createTextNode(label));input.onchange=()=>{actor.motion=ActorAnimation.options(actor.motion);actor.motion[key]=input.checked;map.sharedAssets=false;if(key==='stationary'&&input.checked){actor.step=0;actor.roamRadius=0;actor.entry='cut';}mark();};controls.append(row);}box.append(controls);
 const select=element('select');select.setAttribute('aria-label',C.NAMES[actor.id]+'选择场次专用姿势');select.append(new Option('选择此人物的姿势…',''));let choices=[];
 library().then(data=>{choices=data.items.filter(v=>v.actor===actor.id);for(const item of choices)select.append(new Option(item.name+(item.animation?' · 原生动画':typeof PetMotion!=='undefined'&&PetMotion.profileFor(item.idle)?' · 轻微动作':' · 呼吸'),item.id));}).catch(e=>{status.textContent=e.message;});
 const use=element('button','仅替换当前景别'),upload=element('label','导入该人物动画文件夹'),files=element('input'),refit=element('button','重新适配当前素材');use.type=refit.type='button';files.type='file';files.multiple=true;files.setAttribute('webkitdirectory','');files.accept='.png,.json';files.hidden=true;upload.className='button';upload.append(files);
 async function run(fn){setBusy(true);status.textContent='正在读取与适配素材…';try{await fn();map.sharedAssets=false;refresh();mark();}catch(e){status.textContent=e.message||'素材未更换';}finally{files.value='';setBusy(false);}}
 use.onclick=()=>{const item=choices.find(v=>v.id===select.value);if(!item){status.textContent='请先选择一个姿势';return;}run(async()=>apply(actor,scene,await materialize(item,api),C));};
 files.onchange=()=>{if(files.files.length)run(async()=>apply(actor,scene,await importFolder(files.files,C.NAMES[actor.id],api),C));};
 refit.onclick=()=>run(async()=>{if(!actor.poses.idle)throw Error('请先上传人物立绘或选择姿势');const anchor=C.actorAnchor(actor,scene.backgroundAspect),response=await fetch(actor.poses.idle);if(!response.ok)throw Error('人物素材读取失败');const info=await imageInfo(await response.blob());actor.aspect=info.width/info.height;actor.contentBounds=info.bounds;if(actor.animation){actor.animation.bounds=info.bounds;actor.animation.width=info.width;actor.animation.height=info.height;}C.fitActor(actor,anchor,scene.backgroundAspect);});
 box.append(select,use,upload,refit,element('p','所有动作只影响当前景别。缺少的动画保留入口；替换单张立绘会解除旧动画。带家具或道具的姿势需在背景中复核。'));section.append(box);
};
root.ActorAnimationImport={apply,imageInfo,importFolder,materialize};
})(globalThis);
