(function(root){
'use strict';
const clamp=n=>Math.max(0,Math.min(1,n));
function point(x,y,rect,flip=false){return [flip?1-clamp((x-rect.left)/rect.width):clamp((x-rect.left)/rect.width),clamp((y-rect.top)/rect.height)];}
function crop(a,b){return {left:Math.min(a[0],b[0]),top:Math.min(a[1],b[1]),right:Math.max(a[0],b[0]),bottom:Math.max(a[1],b[1])};}
// Keep the draft's background transform, actor sizes and stacking exactly as
// displayed. The clone has no editor handlers and never changes the live stage.
function sceneContext(preview,actorId,canvas){
 if(!preview)return null;
 const scene=preview.cloneNode(true),target=scene.querySelector('.scene-preview-person[data-edit-target="actor:'+actorId+'"]');
 if(!target)return null;
 scene.removeAttribute('id');scene.removeAttribute('tabindex');scene.removeAttribute('data-mode');scene.classList.add('actor-cutout-scene');scene.setAttribute('aria-label','当前场景原位擦除预览');
 scene.querySelectorAll('.scene-selection-frame,.scene-presenter-zone,.bubble-edit-frame,.dialogue-overlay,jmf-dialogue-layer,.scene-preview-nameplate,button,input,select,iframe').forEach(n=>n.remove());
 for(const n of scene.querySelectorAll('[id],[data-edit-target],[tabindex]')){n.removeAttribute('id');n.removeAttribute('data-edit-target');n.removeAttribute('tabindex');}
 const original=target.querySelector('img');
 if(original){canvas.style.transform=original.style.transform;canvas.style.clipPath=original.style.clipPath;canvas.style.maskImage=original.style.maskImage;canvas.style.maskSize=original.style.maskSize;}
 target.style.maskImage='none';target.style.webkitMaskImage='none';target.classList.add('actor-cutout-target');target.replaceChildren(canvas);
 return scene;
}
class History{
 constructor(){this.ops=[];this.redoOps=[];}
 add(op){this.ops.push(op);this.redoOps=[];}
 undo(){if(this.ops.length)this.redoOps.push(this.ops.pop());}
 redo(){if(this.redoOps.length)this.ops.push(this.redoOps.pop());}
}
function paintMask(canvas,base,ops){
 const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='source-over';ctx.fillStyle='#fff';
 if(base)ctx.drawImage(base,0,0,w,h);else ctx.fillRect(0,0,w,h);
 for(const op of ops){
  ctx.globalCompositeOperation='source-over';
  if(op.type==='reset'){ctx.clearRect(0,0,w,h);ctx.fillRect(0,0,w,h);continue;}
  if(op.type==='crop'){const r=op.rect;ctx.clearRect(0,0,w,r.top*h);ctx.clearRect(0,r.bottom*h,w,h);ctx.clearRect(0,0,r.left*w,h);ctx.clearRect(r.right*w,0,w,h);continue;}
  ctx.globalCompositeOperation=op.type==='erase'?'destination-out':'source-over';ctx.lineWidth=op.size*w;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff';
  const first=op.points[0];if(!first)continue;ctx.beginPath();ctx.arc(first[0]*w,first[1]*h,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();
  if(op.points.length>1){ctx.beginPath();ctx.moveTo(first[0]*w,first[1]*h);for(const p of op.points.slice(1))ctx.lineTo(p[0]*w,p[1]*h);ctx.stroke();}
 }
 ctx.globalCompositeOperation='source-over';
}
const api={point,crop,History,paintMask,sceneContext};
if(typeof module!=='undefined')module.exports=api;
root.ActorCutout=api;
if(typeof document==='undefined')return;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('人物或擦除记录读取失败，请重试'));img.src=src;});
const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('擦除范围生成失败')),'image/png'));
root.mountActorCutoutControls=function({section,actor,map,C,mark,refresh,getPreview,api:request,setBusy}){
 const row=node('div','actor-cutout-controls'),open=node('button','','擦除 / 裁剪人物'),restore=node('button','quiet','恢复未擦除素材');open.type=restore.type='button';
 open.disabled=!actor.poses.idle;open.setAttribute('aria-label',C.NAMES[actor.id]+'擦除或裁剪人物');restore.disabled=!C.cutoutFor(actor);restore.setAttribute('aria-label',C.NAMES[actor.id]+'恢复未擦除素材');
 restore.onclick=()=>{actor.cutout=null;map.sharedAssets=false;refresh();mark();};row.append(open,restore,node('small','hint','只改当前场次；原图保留，眨眼和说话同步擦除。'));section.append(row);
 open.onclick=async()=>{
  setBusy(true);const dialog=node('dialog','actor-cutout-dialog');dialog.setAttribute('aria-label',C.NAMES[actor.id]+'人物擦除与裁剪');
  dialog.innerHTML='<header><h2></h2><button type="button" data-cutout="cancel">取消</button></header><div class="actor-cutout-toolbar"><label>工具<select aria-label="人物修整工具"><option value="erase">橡皮擦</option><option value="restore">恢复笔</option><option value="crop">矩形裁剪</option></select></label><label>笔刷大小 <input type="range" min="2" max="200" value="48" aria-label="橡皮擦大小"><output></output></label><button type="button" data-cutout="undo">撤销</button><button type="button" data-cutout="redo">重做</button><button type="button" data-cutout="reset">恢复原图</button></div><p class="actor-cutout-help">橡皮擦涂掉的部分变透明；恢复笔可补回。矩形裁剪请拖出要保留的区域。支持撤销，原图始终保留。</p><div class="actor-cutout-workspace"><canvas aria-label="人物擦除画布"></canvas></div><p class="actor-cutout-status" role="status">正在读取人物素材…</p><footer><span>应用后仍需点「保存场次」才会更新大屏。</span><button type="button" class="primary" data-cutout="apply" disabled>应用到人物草稿</button></footer>';
  dialog.querySelector('h2').textContent=C.NAMES[actor.id]+' · 在场景中擦除与裁剪';document.body.append(dialog);dialog.showModal();
  const find=key=>dialog.querySelector('[data-cutout="'+key+'"]'),canvas=dialog.querySelector('canvas'),mask=document.createElement('canvas'),tool=dialog.querySelector('select'),size=dialog.querySelector('input'),output=dialog.querySelector('output'),status=dialog.querySelector('[role=status]'),history=new History();
  const context=sceneContext(getPreview?.(),actor.id,canvas),surface=context||canvas;
  if(context){dialog.classList.add('has-scene-context');dialog.querySelector('.actor-cutout-workspace').replaceChildren(context);dialog.querySelector('.actor-cutout-help').textContent='直接在原站位擦除，擦掉后立即露出背景或后方人物。只修改当前人物；恢复笔可补回，矩形裁剪保留框选区域。';}
  canvas.style.transform=actor.facing==='left'?'scaleX(-1)':'';
  let source,base,active=null,cursor=null,closed=false,saving=false,changed=false,raf=0;
  const finish=()=>{if(saving)return;closed=true;if(raf)cancelAnimationFrame(raf);dialog.close();dialog.remove();setBusy(false);};
  find('cancel').onclick=finish;dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
  function controls(){output.textContent=size.value+' px';size.disabled=tool.value==='crop';find('undo').disabled=!history.ops.length||Boolean(active);find('redo').disabled=!history.redoOps.length||Boolean(active);find('apply').disabled=!source||!changed||Boolean(active)||saving;}
  function draw(){
   raf=0;if(closed||!source)return;const ops=[...history.ops,...(active?.type!=='crop'&&active?[active]:[])];paintMask(mask,base,ops);
   const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.save();ctx.drawImage(source,0,0,w,h);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.restore();
   const scale=w/Math.max(1,canvas.getBoundingClientRect().width);ctx.lineWidth=scale*1.5;ctx.strokeStyle='#aa4d16';ctx.setLineDash([5*scale,3*scale]);
   if(active?.type==='crop'){const r=crop(active.start,active.end);ctx.strokeRect(r.left*w,r.top*h,(r.right-r.left)*w,(r.bottom-r.top)*h);}
   else if(cursor&&tool.value!=='crop'){ctx.beginPath();ctx.arc(cursor[0]*w,cursor[1]*h,Number(size.value)/2,0,Math.PI*2);ctx.stroke();}ctx.setLineDash([]);controls();
  }
  const schedule=()=>{if(!raf)raf=requestAnimationFrame(draw);};
  tool.onchange=size.oninput=()=>{controls();schedule();};
  for(const action of ['undo','redo'])find(action).onclick=()=>{if(active)return;history[action]();changed=history.ops.length>0;status.textContent='尚未应用 · 可继续修改';draw();};
  find('reset').onclick=()=>{if(!source||active)return;history.add({type:'reset'});changed=true;status.textContent='已恢复原图 · 可以撤销';draw();};
  const locate=event=>{const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;return [actor.facing==='left'?1-x:x,y];};
  surface.addEventListener('pointerdown',event=>{if(!source||saving||active||event.button>0)return;const p=locate(event);if(p.some(v=>v<0||v>1))return;active=tool.value==='crop'?{type:'crop',start:p,end:p}:{type:tool.value,size:Number(size.value)/canvas.width,points:[p]};active.pointerId=event.pointerId;surface.setPointerCapture(event.pointerId);cursor=p;event.preventDefault();draw();});
  surface.addEventListener('pointermove',event=>{cursor=locate(event);if(active?.pointerId===event.pointerId){if(active.type==='crop')active.end=cursor.map(clamp);else active.points.push(cursor);event.preventDefault();}schedule();});
  function end(event,cancel=false){if(!active||active.pointerId!==event.pointerId)return;const op=active;active=null;
   if(!cancel){if(op.type==='crop'){const rect=crop(op.start,op.end);if((rect.right-rect.left)*canvas.width>=4&&(rect.bottom-rect.top)*canvas.height>=4)history.add({type:'crop',rect});}else history.add({type:op.type,size:op.size,points:op.points});changed=history.ops.length>0;status.textContent=context?'尚未应用 · 已在原场景显示擦除效果':'尚未应用 · 棋盘格区域代表透明';}
   if(surface.hasPointerCapture(event.pointerId))surface.releasePointerCapture(event.pointerId);draw();}
  surface.addEventListener('pointerup',event=>end(event));surface.addEventListener('pointercancel',event=>end(event,true));surface.addEventListener('lostpointercapture',event=>end(event,true));surface.addEventListener('pointerleave',()=>{cursor=null;schedule();});
  find('apply').onclick=async()=>{
   if(!source||active||saving||!changed)return;saving=true;dialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);status.textContent='正在保存擦除范围…';
   try{paintMask(mask,base,history.ops);const mirrored=document.createElement('canvas');mirrored.width=mask.width;mirrored.height=mask.height;const ctx=mirrored.getContext('2d');ctx.translate(mask.width,0);ctx.scale(-1,1);ctx.drawImage(mask,0,0);
    const normal=await request('/api/scene-assets',{method:'POST',headers:{'Content-Type':'image/png'},body:await png(mask)}),mirror=await request('/api/scene-assets',{method:'POST',headers:{'Content-Type':'image/png'},body:await png(mirrored)});
    actor.cutout={source:actor.poses.idle,mask:normal.url,mirror:mirror.url};map.sharedAssets=false;refresh();mark();saving=false;finish();
   }catch(e){status.textContent=e.message||'擦除范围未保存，请重试';saving=false;dialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);controls();}
  };
  try{const stored=C.cutoutFor(actor),images=await Promise.all([load(actor.poses.idle),stored?load(stored.mask):Promise.resolve(null)]);if(closed)return;[source,base]=images;
   const w=source.naturalWidth,h=source.naturalHeight;if(!w||!h||w*h>40000000)throw Error('人物素材尺寸无法编辑');const scale=Math.min(1,4096/Math.max(w,h));canvas.width=mask.width=Math.round(w*scale);canvas.height=mask.height=Math.round(h*scale);size.max=String(Math.ceil(canvas.width*.6));
   status.textContent=`原图 ${w} × ${h} px · ${actor.facing==='left'?'按当前翻转方向编辑':'只修改透明范围，不改变站位或大小'}`;draw();
  }catch(e){source=null;status.textContent=e.message;controls();}
 };
};
})(globalThis);
