(function(root){
'use strict';
root.setupBubbleEditor=function({controls,preview,getScene,getScript,mark,editReplies,applyFont,setBusy=()=>{},isBusy=()=>false}){
 const D=root.DialogueOverlay,C=root.SceneCatalog,doc=controls.ownerDocument;
 controls.innerHTML='<details open class="bubble-editor"><summary>气泡与台词 · 本场独立</summary><p class="hint">点击预览里的任意气泡或选择人物，可单独编辑当前这条接话；也可切到本场人物默认样式。普通接话竖排，仅 T1 全体祝福共用横排框，T2 也竖排。T1 可选择人物分别调整对应尾巴，框体与文字为全体共用。预览仅作排版，不触发大屏。拖框移动，右下角缩放，右边中点调宽窄；移到气泡上后，拖蓝点移动尾巴根部，拖红点调整尖端。简化版位置和大小自由调整，可继续放大或移出画面，允许覆盖人物或其他气泡；蓝点调根部，红点固定尖端。</p><div class="bubble-editor-grid"><label>预览接话组<select data-bubble="group"></select></label><label>编辑人物<select data-bubble="actor"></select></label><label>修改范围<select data-bubble="scope"><option value="cue">仅当前这条气泡</option><option value="actor">本场此人物默认气泡</option></select></label><label>文字方向<input data-bubble="writingMode" readonly></label><label>气泡与文字大小<input data-bubble="scale" type="number" min="0.05" step="0.05"></label><label>宽窄重排<input data-bubble="widthScale" type="number" min="0.05" step="0.05"></label><label>字体<select data-bubble="font"><option value="hei">黑体</option><option value="song">宋体</option><option value="kangxi">康熙字典体</option></select></label><label>左侧 %<input data-bubble="x" type="number" step="0.1"></label><label>顶部 %<input data-bubble="y" type="number" step="0.1"></label><label>底色<input data-bubble="fill" type="color"></label><label>文字颜色<input data-bubble="ink" type="color"></label><label>描边颜色<input data-bubble="border" type="color"></label><label>描边粗细<input data-bubble="borderWidth" type="number" min="0.5" max="4" step="0.1"></label><label>圆角<input data-bubble="radius" type="number" min="0" max="20" step="1"></label><label>尾巴指向<select data-bubble="tailMode"><option value="actor">跟随对应人物</option><option value="manual">手动尖角</option><option value="point">固定尖端（拖红点）</option></select></label><label>尾巴所在边<select data-bubble="tailSide"><option value="auto">自动朝向本人</option><option value="bottom">下边</option><option value="left">左边</option><option value="right">右边</option><option value="top">上边</option></select></label><label>尖端角度 °<input data-bubble="tailAngle" type="number" min="-180" max="180" step="1"></label><label>尾巴根部 %<input data-bubble="tailBase" type="number" min="0" max="100" step="1"></label><label>尾巴宽度<input data-bubble="tailWidth" type="number" min="2" max="18" step="0.5"></label><label>尾巴长度<input data-bubble="tailLength" type="number" min="4" max="160" step="1"></label><label hidden>指向横移 %<input data-bubble="tailOffsetX" type="number" min="-15" max="15" step="0.1"></label><label hidden>指向纵移 %<input data-bubble="tailOffsetY" type="number" min="-15" max="15" step="0.1"></label><label class="bubble-check"><input data-bubble="visible" type="checkbox" checked>显示气泡预览</label></div><div class="bubble-editor-actions"><button type="button" data-bubble="undo" disabled>撤销</button><button type="button" data-bubble="redo" disabled>重做</button><label class="button">导入康熙字典体 · 全部气泡<input data-bubble="fontUpload" type="file" accept=".ttf,.otf,.woff,.woff2" hidden></label><button type="button" data-bubble="applyActor">复制当前样式到本场此人物全部气泡</button><button type="button" data-bubble="auto">恢复自动位置</button><button type="button" data-bubble="tailReset">尾巴自动指向本人</button><button type="button" data-bubble="reset">恢复本人气泡默认样式</button><button type="button" data-bubble="text">编辑本场接话文字与时序</button></div><p data-bubble="note" class="hint" role="status"></p></details>';
 const $=key=>controls.querySelector('[data-bubble="'+key+'"]');
 $('visible').checked=true;
 let picks=[];
 let undo=[],redo=[];
 let sceneId='',actor=0,group=0,groups=[],overlay=null,frame=null,result=null,lastScene=null,drag=null;
 function options(select,items,value){select.replaceChildren(...items.map(([id,label])=>{const o=doc.createElement('option');o.value=String(id);o.textContent=label;o.selected=String(id)===String(value);return o;}));}
 function chosen(){return getScene()?.actors[actor];}
 function chorus(){return D.sharedChorus(getScene(),groups[group]?.sentence.replies[0]);}
 function cueKey(){return (chorus()||$('scope').value==='cue')&&groups[group]?.sentence.replies.some(r=>r.actor===actor)?groups[group].sentence.id:'';}
 function config(){const message={cueId:cueKey(),chorus:chorus()},shared=D.resolve(getScene(),actor,message),own=D.resolveTail(getScene(),actor,message);return {...shared,...Object.fromEntries(D.TAIL_KEYS.map(k=>[k,own[k]]))};}
 function snapshot(){return getScene().actors.map(a=>({bubble:C.clone(a.bubble),bubbleCues:C.clone(a.bubbleCues||{})}));}
 function historyButtons(){$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;}
 function restoreSnapshot(value){getScene().actors.forEach((a,i)=>Object.assign(a,value[i]));historyButtons();fields();mark(false);clear();render();}
 function remember(){if(drag?.remembered)return;undo.push(snapshot());if(undo.length>40)undo.shift();redo=[];if(drag)drag.remembered=true;historyButtons();}
 function writeConfig(value,recordHistory=true){if(recordHistory)remember();const a=chosen(),key=cueKey(),style=D.normalize({...value,writingMode:D.writingMode(getScene(),{chorus:chorus()})});
  if(chorus()){const common=Object.fromEntries(Object.entries(style).filter(([k])=>!D.TAIL_KEYS.includes(k)));for(const reply of groups[group].sentence.replies){const target=getScene().actors[reply.actor],own=D.resolveTail(getScene(),target,{cueId:key,chorus:true});target.bubbleCues??={};target.bubbleCues[key]=D.normalize({...own,...common,...(reply.actor===actor?Object.fromEntries(D.TAIL_KEYS.map(k=>[k,style[k]])): {})});}return;}
  if(key){a.bubbleCues??={};a.bubbleCues[key]=style;}else a.bubble=style;}

 function editable(){const raw=getScene(),visual=C.visualScene(raw),ids=new Set(groups.flatMap(g=>g.sentence.replies.map(r=>r.actor)));return raw.actors.filter(a=>a.present||visual.actors[a.id].present||ids.has(a.id));}
 function fields(){const s=config();$('writingMode').value=s.writingMode==='horizontal'?(chorus()?'横排（T1 全体共享）':'横排（T2）'):'竖排';for(const k of ['scale','widthScale','x','y','font','fill','ink','border','borderWidth','radius','tailBase','tailSide','tailMode','tailAngle','tailWidth','tailLength','tailOffsetX','tailOffsetY'])$(k).value=String(s[k]??50);}
 function clear(){picks.forEach(n=>n.remove());picks=[];overlay?.destroy();overlay=null;frame?.remove();frame=null;result=null;}
 function refresh(){const scene=getScene();if(!scene)return;const script=getScript();groups=[];(script?.blocks||[]).forEach((b,index)=>{if(b.sceneId!==scene.id)return;b.sentences.forEach((s,sentenceIndex)=>{if(s.replies?.length)groups.push({sentence:s,index,sentenceIndex});});});
  if(scene.id!==sceneId){undo=[];redo=[];historyButtons();sceneId=scene.id;group=0;$('scope').value=groups.length?'cue':'actor';actor=groups[0]?.sentence.replies[0]?.actor??scene.actors.find(a=>a.present)?.id??0;clear();}
  group=Math.min(group,Math.max(0,groups.length-1));options($('group'),groups.length?groups.map((g,i)=>[i,`第 ${g.sentenceIndex+1} 句 · ${g.sentence.replies.map(r=>C.NAMES[r.actor]).join(' → ')}`]):[['0',scene.liveDialogue?'临场接话 · 样式样例':'本场没有人物接话 · 样式样例']],group);
  options($('actor'),editable().map(a=>[a.id,C.NAMES[a.id]]),actor);if(!editable().some(a=>a.id===actor))actor=editable()[0]?.id??0;if(chorus())$('scope').value='cue';$('scope').disabled=!groups.length||chorus();$('actor').value=String(actor);fields();$('text').disabled=!groups.length;$('applyActor').disabled=chorus();
 }
 function render(scene=getScene()){
  if(!scene)return;scene=C.visualScene(scene);lastScene=scene;const flat=C.freeBubbles(scene);
  if(!preview.contains(overlay?.element)){clear();overlay=D.mount(preview,{editing:true});}
  if(!$('visible').checked){overlay.clear();frame?.remove();frame=null;return;}
  const width=1280,height=width/(scene.backgroundAspect||16/9),displayWidth=preview.getBoundingClientRect().width||640,ratio=displayWidth/width;
  const previewIds=new Set([actor,...(groups[group]?.sentence.replies||[]).map(r=>r.actor)]);
  const figures=scene.actors.filter(a=>a.present||previewIds.has(a.id)).map(a=>{const heightPx=height*.285*a.scale;return {id:a.id,x:width*a.x/100,foot:height*a.y/100,width:heightPx*a.aspect,height:heightPx};});
  const obstacles=figures.filter(f=>!scene.actors[f.id].unanchored).map(f=>({left:f.x-f.width/2-4,top:f.foot-f.height-5,width:f.width+8,height:f.height+10}));
  const replies=groups[group]?.sentence.replies||[],unique=[...new Map(replies.map(r=>[r.actor,r])).values()];
  let samples=unique.length?unique:scene.actors.filter(a=>a.id===actor).map(a=>({actor:a.id,text:scene.liveDialogue?'这是临场接话气泡样例。正式演出时显示现场生成的回应。':'这是气泡排版样例。正式演出时显示剧本中的完整台词。'}));
  // Selected non-speaking actors can also edit their future default bubble.
  if(unique.length&&!samples.some(r=>r.actor===actor)&&scene.actors[actor])samples.push({actor,text:'本组此人物暂无接话。这是样式预览，不会加入演出剧本。'});
  if(chorus())samples=[{...unique[0],actor}];
  const items=samples.map(r=>{const a=scene.actors[r.actor],f=figures.find(f=>f.id===r.actor);if(!f)return null;return {id:r.actor,key:r,text:(!flat&&a.unanchored?C.NAMES[a.id]+'：':'')+r.text,hideTail:!flat&&Boolean(a.unanchored),message:{...r,cueId:groups[group]?.sentence.id},...root.speechAnchor(f,a),config:r.actor===actor?config():D.resolve(getScene(),r.actor,{cueId:groups[group]?.sentence.id,chorus:r.chorus}),presentation:'front'};}).filter(Boolean).map(item=>D.chorusItem(scene,item,figures,{left:0,top:0,width,height}));
  const z=scene.presenter||{},reserved={left:width*(z.x||0)/100,top:height*(z.y||0)/100,width:width*(z.width||0)/100,height:height*(z.height||0)/100};
  // Editing a style must remeasure even when the authored text is unchanged.
  result=overlay.update({items,width,height,displayWidth,reserved,obstacles,now:0,freeLayout:flat});
  const focusedOnly=!result.boxes.some(b=>b.id===actor)&&items.some(i=>i.id===actor);
  if(focusedOnly)result=overlay.update({items:items.filter(i=>i.id===actor),width,height,displayWidth,reserved:null,obstacles:[],now:0});
  picks.forEach(n=>n.remove());picks=[];
  for(const b of result.boxes.filter(b=>b.id!==actor)){const pick=doc.createElement('button');pick.type='button';pick.className='bubble-pick';pick.setAttribute('aria-label','编辑'+C.NAMES[b.id]+'的当前气泡');pick.title='编辑'+C.NAMES[b.id]+'的气泡';Object.assign(pick.style,{left:b.left*ratio+'px',top:b.top*ratio+'px',width:b.width*ratio+'px',height:b.height*ratio+'px'});pick.onclick=e=>{e.stopPropagation();actor=b.id;$('actor').value=String(actor);fields();clear();render();};preview.append(pick);picks.push(pick);}
  let box=result.boxes.find(b=>b.id===actor);if(!box){frame?.remove();frame=null;$('note').textContent=result.blocked.length?'当前多框空间不足，可选择其他组预览；正式播放仍会自动重排。':'本场无人出场，暂无气泡可调整。';return;}
  if(!frame){frame=doc.createElement('div');frame.className='bubble-edit-frame';frame.tabIndex=0;frame.setAttribute('aria-label','拖动气泡位置；方向键微调');
   for(const [mode,cls,label] of [['scale','bubble-edit-resize','气泡右下角等比缩放'],['width','bubble-edit-width','气泡右边中点调整宽窄'],['base','bubble-tail-base-handle','蓝点：拖动尾巴与气泡框的连接位置'],['tip','bubble-tail-tip-handle','红点：拖动尖尾巴的尖端']]){const handle=doc.createElement('button');handle.type='button';handle.className=cls;handle.dataset.bubbleDrag=mode;handle.setAttribute('aria-label',label);handle.title=label;frame.append(handle);}preview.append(frame);
   frame.addEventListener('pointerdown',e=>{if(isBusy()||e.button>0)return;e.stopPropagation();e.preventDefault();const b=result.boxes.find(b=>b.id===actor);if(!b)return;drag={pointerId:e.pointerId,mode:e.target.dataset.bubbleDrag||'move',x:e.clientX,y:e.clientY,start:config(),box:b,rect:preview.getBoundingClientRect()};frame.setPointerCapture?.(e.pointerId);frame.focus({preventScroll:true});});
   frame.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;e.stopPropagation();e.preventDefault();const g=drag,w=1280,h=w/(lastScene.backgroundAspect||16/9),dx=(e.clientX-g.x)*w/g.rect.width,dy=(e.clientY-g.y)*h/g.rect.height,next={...g.start},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    if(g.mode==='base'){const x=g.box.tail.handleBase.x+dx,y=g.box.tail.handleBase.y+dy,distances=[['left',Math.abs(x)],['right',Math.abs(x-g.box.width)],['top',Math.abs(y)],['bottom',Math.abs(y-g.box.height)]];next.tailSide=distances.sort((a,b)=>a[1]-b[1])[0][0];next.tailBase=clamp((['top','bottom'].includes(next.tailSide)?x/g.box.width:y/g.box.height)*100,0,100);}
    else if(g.mode==='tip'&&flat){next.tailMode='point';next.tailX=(g.box.left+g.box.tail.handleTip.x+dx)/w*100;next.tailY=(g.box.top+g.box.tail.handleTip.y+dy)/h*100;}
    else if(g.mode==='tip'){const vx=g.box.tail.handleTip.x+dx-g.box.tail.handleBase.x,vy=g.box.tail.handleTip.y+dy-g.box.tail.handleBase.y;next.tailMode='manual';next.tailSide=g.box.tail.side;next.tailLength=clamp(Math.hypot(vx,vy)/(1.15*g.start.scale),4,160);next.tailAngle=Math.atan2(vy,vx)*180/Math.PI;}
    else if(g.mode==='width'){next.widthScale=clamp(g.start.widthScale*(1+dx/g.box.width),.05,Infinity);}
    else{Object.assign(next,{manual:true,x:g.box.left/w*100,y:g.box.top/h*100});if(g.mode==='scale'){const factor=Math.max(.1,1+(dx*g.box.width+dy*g.box.height)/(g.box.width**2+g.box.height**2));next.scale=clamp(g.start.scale*factor,.05,Infinity);}else{next.x=next.x+dx/w*100;next.y=next.y+dy/h*100;}}
    writeConfig(next);fields();mark(false);render();});
   const finish=(e,cancel=false)=>{if(!drag||e.pointerId!==drag.pointerId)return;e.stopPropagation();const g=drag;drag=null;if(cancel){writeConfig(g.start,false);fields();mark(false);render();}frame?.releasePointerCapture?.(e.pointerId);};
   frame.addEventListener('pointerup',e=>finish(e));frame.addEventListener('pointercancel',e=>finish(e,true));frame.addEventListener('lostpointercapture',e=>finish(e));
   frame.addEventListener('keydown',e=>{if(isBusy()||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.stopPropagation();e.preventDefault();const b=result.boxes.find(b=>b.id===actor),s=config(),w=1280,h=w/(lastScene.backgroundAspect||16/9),step=e.shiftKey?1:.1,mode=e.target.dataset.bubbleDrag,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    if(mode==='base'){const horizontal=['top','bottom'].includes(b.tail.side);s.tailSide=b.tail.side;s.tailBase=clamp((s.tailBase??(horizontal?b.tail.handleBase.x/b.width:b.tail.handleBase.y/b.height)*100)+(horizontal?(dx||-dy):(dy||dx))*10,0,100);}
    else if(mode==='tip'&&C.freeBubbles(lastScene)){s.tailMode='point';s.tailX=(b.left+b.tail.handleTip.x)/w*100+dx;s.tailY=(b.top+b.tail.handleTip.y)/h*100+dy;}
    else if(mode==='tip'){const vx=b.tail.handleTip.x-b.tail.handleBase.x+dx*10,vy=b.tail.handleTip.y-b.tail.handleBase.y+dy*10;s.tailMode='manual';s.tailSide=b.tail.side;s.tailLength=clamp(Math.hypot(vx,vy)/(1.15*s.scale),4,160);s.tailAngle=Math.atan2(vy,vx)*180/Math.PI;}
    else if(mode==='scale')s.scale=clamp(s.scale+(dx||-dy)*.1,.05,Infinity);
    else if(mode==='width')s.widthScale=clamp(s.widthScale+(dx||-dy)*.1,.05,Infinity);
    else Object.assign(s,{manual:true,x:b.left/w*100+dx,y:b.top/h*100+dy});
    writeConfig(s);fields();mark(false);render();});
  }
  Object.assign(frame.style,{left:box.left*ratio+'px',top:box.top*ratio+'px',width:box.width*ratio+'px',height:box.height*ratio+'px'});
  for(const [cls,p] of [['bubble-tail-base-handle',box.tail.handleBase],['bubble-tail-tip-handle',box.tail.handleTip]]){const handle=frame.querySelector('.'+cls);handle.hidden=!flat&&chorus()&&lastScene.actors[actor]?.unanchored===true;Object.assign(handle.style,{left:p.x*ratio+'px',top:p.y*ratio+'px'});}
  const s=config(),shifted=s.manual&&(Math.abs(box.left-width*s.x/100)>2||Math.abs(box.top-height*s.y/100)>2);
  if(!s.manual){$('x').value=String(Math.round(box.left/width*1000)/10);$('y').value=String(Math.round(box.top/height*1000)/10);}
  if(s.tailBase==null)$('tailBase').value=String(Math.round((['top','bottom'].includes(box.tail.side)?box.tail.handleBase.x/box.width:box.tail.handleBase.y/box.height)*100));
  if(s.tailAngle==null)$('tailAngle').value=String(Math.round(Math.atan2(box.tail.handleTip.y-box.tail.handleBase.y,box.tail.handleTip.x-box.tail.handleBase.x)*180/Math.PI));
  $('note').textContent=`${C.NAMES[actor]} · ${chorus()?'仅当前这条气泡（全体共享祝福框，选择人物调整各自尾巴）':cueKey()?'仅当前这条气泡':'本场人物默认气泡'} · ${s.writingMode==='horizontal'?'横排':'竖排'}${!flat&&lastScene.actors[actor]?.unanchored?' · 画面无此人物，暂不画尾巴':s.tailMode==='actor'?' · 尾巴跟随本人':''} · ${s.manual?'手调位置':'自动排版'}${focusedOnly?' · 空间不足，单独显示选中气泡供编辑':shifted?(flat?' · 已限制在画面边界内':' · 为避免遮挡，当前已自动避让'):flat?' · 自由摆放，不自动避让':''}${s.font==='kangxi'&&!s.fontAsset?' · 字体文件待导入，暂用宋体备用':''} · 保存场次后生效`;
  $('auto').textContent=flat?'恢复起始位置':'恢复自动位置';$('tailReset').textContent=flat?'尾巴恢复短尖角':'尾巴自动指向本人';
 }
 $('group').onchange=()=>{group=Number($('group').value);actor=groups[group]?.sentence.replies[0]?.actor??actor;refresh();clear();render();};
 $('scope').onchange=()=>{fields();clear();render();};
 $('actor').onchange=()=>{actor=Number($('actor').value);fields();clear();render();};$('visible').onchange=()=>render();
 for(const key of ['scale','widthScale','x','y','font','fill','ink','border','borderWidth','radius','tailBase','tailSide','tailMode','tailAngle','tailWidth','tailLength','tailOffsetX','tailOffsetY'])$(key).oninput=()=>{const input=$(key),isNumber=input.type==='number';if(isNumber&&(!input.value||!Number.isFinite(Number(input.value))))return;const value=isNumber?Math.max(input.hasAttribute('min')?Number(input.getAttribute('min')):-Infinity,Math.min(input.hasAttribute('max')?Number(input.getAttribute('max')):Infinity,Number(input.value))):input.value;writeConfig({...config(),...(['tailSide','tailAngle','tailLength'].includes(key)?{tailMode:'manual'}:{}),...(['x','y'].includes(key)?{manual:true,x:Number($('x').value),y:Number($('y').value)}:{}),[key]:value});$('tailMode').value=config().tailMode;mark(false);render();};
 for(const key of ['scale','widthScale','x','y','borderWidth','radius','tailBase','tailSide','tailMode','tailAngle','tailWidth','tailLength','tailOffsetX','tailOffsetY'])$(key).onchange=()=>{fields();render();};
 $('auto').onclick=()=>{writeConfig({...config(),manual:false});clear();fields();mark(false);render();};
 $('tailReset').onclick=()=>{writeConfig({...config(),tailMode:C.freeBubbles(getScene())?'manual':'actor',tailLength:36,tailBase:null,tailSide:'auto',tailAngle:null,tailOffsetX:0,tailOffsetY:0});clear();fields();mark(false);render();};
 $('reset').onclick=()=>{writeConfig({...D.normalize(),...(C.freeBubbles(getScene())?{font:'kangxi',tailMode:'manual',tailLength:36}:{tailMode:'actor'})});clear();fields();mark(false);render();};
 $('text').onclick=()=>{const target=groups[group];if(target)editReplies(target.index);};
 $('applyActor').onclick=()=>{if(isBusy()||chorus())return;remember();const a=chosen(),style=config();a.bubble=C.clone(style);a.bubbleCues??={};for(const g of groups)if(g.sentence.replies.some(r=>r.actor===actor))a.bubbleCues[g.sentence.id]=C.clone(style);fields();mark(false);clear();render();$('note').textContent=C.NAMES[actor]+' · 本场所有气泡采用当前样式 · 保存场次后生效';};
 $('undo').onclick=()=>{if(!undo.length||isBusy())return;redo.push(snapshot());restoreSnapshot(undo.pop());};
 $('redo').onclick=()=>{if(!redo.length||isBusy())return;undo.push(snapshot());restoreSnapshot(redo.pop());};
 $('fontUpload').onchange=async()=>{const input=$('fontUpload'),file=input.files?.[0];if(!file||isBusy())return;const ext=file.name.split('.').pop().toLowerCase(),type={ttf:'font/ttf',otf:'font/otf',woff:'font/woff',woff2:'font/woff2'}[ext];
  setBusy(true);try{if(!type||file.size>50*1024*1024)throw Error('请选择 50 MB 内的 TTF、OTF 或 WOFF 字体');const bytes=await file.arrayBuffer();if(typeof FontFace==='function')await new FontFace('JinmenFontCheck',bytes).load();const response=await fetch('/api/scene-assets',{method:'POST',headers:{'Content-Type':type},body:file}),result=await response.json();if(!response.ok)throw Error(result.error?.message||'字体未导入');const style={font:'kangxi',fontAsset:result.url};D.loadFont(doc,style);if(applyFont)applyFont(style);else writeConfig({...config(),...style});undo=[];redo=[];historyButtons();fields();clear();render();$('note').textContent='已导入 '+file.name+' · 保存场次后应用本版全部气泡';}
  catch(error){$('note').textContent=error.message||'字体无法读取';}finally{input.value='';setBusy(false);}
 };
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(getScene())render();}):null;observer?.observe(preview);
 return {refresh,render,clear};
};
})(globalThis);
