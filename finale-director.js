(function(root){
 'use strict';

 root.setupFinaleDirector=function({send,channel,toast,stopCapture}){
  if(document.getElementById('finale-panel'))return;
  const {KEY,PARTICIPANTS,defaultPlan,normalize}=root.JointFinale;
  let saved=defaultPlan(),working,dirty=false,lastPlanSent=false,lastStatus={active:false,armed:false,state:'idle',index:-1,paused:false};
  try{const raw=localStorage.getItem(KEY);if(raw)saved=normalize(JSON.parse(raw));}catch{toast('联合发布存档无法读取，已载入可编辑测试草稿。');}
  working=normalize(saved);
  const panel=document.createElement('section');panel.id='finale-panel';panel.className='panel finale-panel';
  panel.innerHTML=`
   <div class="panel-heading"><div><span class="test-badge" id="finale-draft-badge">测试草稿</span><h2>新艺科倡议 · 联合发布</h2></div><span id="finale-save-state">已载入</span></div>
   <p class="hint finale-intro"><strong>结尾呼吁人物资产</strong> · 九位对话者；演讲结束后逐个发出倡议，每人一条。本轮为文字气泡排练。</p>
   <div class="finale-meta"><label>发布标题<input id="finale-title" maxlength="100" autocomplete="off"></label></div>
   <p id="finale-entrance-hint" class="hint"></p>
   <div class="finale-transport"><button id="finale-save">保存发布编排</button><button id="finale-arm">进入待命</button><button id="finale-start" class="primary">开始发布</button><button id="finale-pause" disabled>暂停发布</button><button id="finale-next" disabled>下一条</button><button id="finale-reset" class="quiet">退出发布</button></div>
   <p id="finale-status" class="finale-status" role="status">尚未待命 · 九人测试台词可编辑</p><p id="finale-error" role="alert"></p>
   <details class="finale-edit"><summary>编辑九人倡议与顺序 <span id="finale-ready-count"></span></summary><label class="finale-draft-toggle"><input id="finale-draft" type="checkbox">这是测试草稿，尚未作为正式倡议定稿</label><div id="finale-lines"></div><div class="finale-file-actions"><button id="finale-import">导入 JSON</button><input id="finale-import-file" type="file" accept=".json,application/json" hidden><button id="finale-export">导出 JSON</button><button id="finale-clear-draft" class="danger">清空测试台词</button></div><p class="hint">导入、排序、清空和修改后需保存。清空仅移除本环节台词，九位人物与演讲剧本保留。</p></details>
   <p class="hint">联合发布沿用当前场次的九位人物素材与站位，待命保留演讲画面。</p>`;
  const rehearsal=document.getElementById('rehearsal-panel'),column=document.querySelector('.main-column');
  if(rehearsal)rehearsal.after(panel);else column?.append(panel);
  const el=id=>panel.querySelector('#'+id);
  const disabledBeforeRelease=new WeakMap(),playbackControlIds=new Set(['finale-pause','finale-next','finale-reset','finale-export']);
  function lockPlanControls(){
   for(const control of panel.querySelectorAll('input,textarea,select,button')){
    if(playbackControlIds.has(control.id))continue;
    if(lastStatus.active){if(!disabledBeforeRelease.has(control))disabledBeforeRelease.set(control,control.id==='finale-start'?false:control.disabled);control.disabled=true;}
    else if(disabledBeforeRelease.has(control)){control.disabled=disabledBeforeRelease.get(control);disabledBeforeRelease.delete(control);}
   }
  }
  function mutationBlocked(){if(!lastStatus.active)return false;error('联合发布中暂不修改编排，请先退出发布。');return true;}
  function error(message){UIPatch.text(el('finale-error'),message||'');if(message)toast(message);}
  function collect(){
   return {...working,title:el('finale-title').value,draft:el('finale-draft').checked,

    lines:[...el('finale-lines').children].map(row=>({id:row.dataset.id,actor:Number(row.dataset.actor),text:row.querySelector('textarea').value,durationMs:Number(row.querySelector('input').value)*1000}))};
  }
  function refreshCount(){
   const rows=[...el('finale-lines').children],count=rows.filter(row=>row.querySelector('textarea').value.trim()).length;
   UIPatch.text(el('finale-ready-count'),`${count} / 9 条已填写`);
   UIPatch.text(el('finale-draft-badge'),el('finale-draft').checked?'测试草稿':'正式编排');
   UIPatch.text(el('finale-save-state'),dirty?'有修改 · 尚未保存':'已保存至此浏览器');
   UIPatch.text(el('finale-entrance-hint'),'待命保持当前演讲画面；开始发布后按九人编排依次显示。');
  }
  function markDirty(){dirty=true;UIPatch.text(el('finale-error'),'');refreshCount();}
  function renderRows(){
   el('finale-lines').replaceChildren();
   working.lines.forEach((line,index)=>{
    const row=document.createElement('details');row.className='finale-line';row.dataset.id=line.id;row.dataset.actor=line.actor;
    const summary=document.createElement('summary'),number=document.createElement('span'),name=document.createElement('strong'),preview=document.createElement('span');
    number.className='finale-line-number';number.textContent=String(index+1).padStart(2,'0');name.textContent=PARTICIPANTS[line.actor].name;preview.className='finale-line-preview';preview.textContent=line.text||'待填写倡议';summary.append(number,name,preview);
    const editor=document.createElement('div');editor.className='finale-line-editor';
    const textLabel=document.createElement('label');textLabel.textContent='倡议内容';const textarea=document.createElement('textarea');textarea.rows=3;textarea.maxLength=160;textarea.value=line.text;textarea.setAttribute('aria-label',PARTICIPANTS[line.actor].name+'的倡议');textLabel.append(textarea);
    textarea.addEventListener('input',()=>{preview.textContent=textarea.value||'待填写倡议';markDirty();});
    const actions=document.createElement('div');actions.className='finale-line-actions';const durationLabel=document.createElement('label');durationLabel.textContent='显示时长（秒）';const duration=document.createElement('input');duration.type='number';duration.min=3;duration.max=30;duration.step=.5;duration.value=line.durationMs/1000;duration.setAttribute('aria-label',PARTICIPANTS[line.actor].name+'的显示时长');duration.addEventListener('input',markDirty);durationLabel.append(duration);actions.append(durationLabel);
    for(const [delta,label] of [[-1,'上移'],[1,'下移']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',PARTICIPANTS[line.actor].name+label);button.disabled=index+delta<0||index+delta>=working.lines.length;button.onclick=()=>{if(mutationBlocked())return;working=collect();const other=index+delta;[working.lines[index],working.lines[other]]=[working.lines[other],working.lines[index]];renderRows();el('finale-lines').children[other].open=true;markDirty();};actions.append(button);}
    editor.append(textLabel,actions);row.append(summary,editor);el('finale-lines').append(row);
   });lockPlanControls();
  }
  function renderPlan(){
   el('finale-title').value=working.title;el('finale-draft').checked=working.draft;
   renderRows();refreshCount();
  }
  function save({ready=false}={}){
   if(mutationBlocked())return null;
   try{
    const plan=normalize(collect());
    if(ready&&plan.lines.some(line=>!line.text))throw new Error('请先填写全部九位发布者的倡议内容。');
    localStorage.setItem(KEY,JSON.stringify(plan));saved=plan;working=normalize(plan);dirty=false;refreshCount();error('');
    lastPlanSent=send('finale-plan',{plan:saved})!==false;return saved;
   }catch(failure){error(failure.name==='QuotaExceededError'?'浏览器存储空间不足，发布编排未能保存。':failure.message||'发布编排保存失败。');return null;}
  }
  function updateStatus(status){
   lastStatus={...lastStatus,...status};
   const phases={idle:'待命',entering:'九位人物准备发布',speaking:'正在发布',gap:'准备下一条',ended:'九人联合发布已结束'};
   let message=lastStatus.active?phases[lastStatus.state]||'联合发布中':lastStatus.armed?'已待命 · 等待开始发布':'尚未待命';
   if(lastStatus.active&&lastStatus.index>=0&&lastStatus.state!=='ended')message+=` · 第 ${lastStatus.index+1} / 9 条${lastStatus.name?' · '+lastStatus.name:''}`;
   if(lastStatus.paused)message+=' · 已暂停';UIPatch.text(el('finale-status'),message);
   UIPatch.text(el('finale-pause'),lastStatus.paused?'继续发布':'暂停发布');el('finale-pause').disabled=!lastStatus.active||lastStatus.state==='ended';el('finale-next').disabled=!lastStatus.active||lastStatus.state==='ended';
   panel.dataset.active=String(Boolean(lastStatus.active));
   lockPlanControls();
  }
  for(const id of ['finale-title','finale-draft'])el(id).addEventListener('input',markDirty);
  el('finale-save').onclick=()=>{if(save())toast('联合发布编排已保存。');};
  el('finale-arm').onclick=()=>{const plan=save();if(plan&&send('finale-arm',{plan}))toast('已发送待命指令，演讲收音继续。');};
  el('finale-start').onclick=async()=>{const plan=save({ready:true});if(!plan)return;if(!lastPlanSent){error('观众大屏尚未连接，收音保持原状。请连接后再开始发布。');return;}el('finale-start').disabled=true;try{await stopCapture?.();if(!mutationBlocked())send('finale-start',{plan});}catch(failure){error(failure.message||'未能停止收音，请重试。');}finally{el('finale-start').disabled=Boolean(lastStatus.active);lockPlanControls();}};
  el('finale-pause').onclick=()=>send('finale-pause');el('finale-next').onclick=()=>send('finale-next');el('finale-reset').onclick=()=>send('finale-reset');
  el('finale-clear-draft').onclick=()=>{if(mutationBlocked())return;working=collect();working.lines=working.lines.map(line=>({...line,text:''}));working.draft=true;dirty=true;renderPlan();toast('测试台词已清空，点击保存后生效。');};
  el('finale-import').onclick=()=>{if(!mutationBlocked())el('finale-import-file').click();};
  el('finale-import-file').onchange=async event=>{
   const file=event.target.files[0];if(!file)return;
   try{if(mutationBlocked())return;if(file.size>1024*1024)throw new Error('请选择 1 MB 以内的发布编排 JSON。');const imported=normalize(JSON.parse(await file.text()));if(mutationBlocked())return;working=imported;dirty=true;renderPlan();error('');toast('已导入发布编排，请检查并保存。');}catch(failure){error(failure.message||'无法导入这份发布编排。');}finally{event.target.value='';}
  };
  el('finale-export').onclick=()=>{
   try{const plan=normalize(collect()),blob=new Blob([JSON.stringify(plan,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(plan.title.replace(/[\\/:*?"<>|]/g,'-')||'新艺科倡议')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(failure){error(failure.message||'导出失败，请检查发布编排。');}
  };
  const onMessage=({data:message})=>{
   if(message?.type==='finale-status')updateStatus(message);
   else if(message?.type==='finale-error')error(message.message||'联合发布出现问题。');
   else if(message?.type==='stage-ready'){
    channel.postMessage({type:'command',action:'finale-plan',plan:saved});
   }
  };
  if(channel?.addEventListener)channel.addEventListener('message',onMessage);
  renderPlan();
  // Reopening the director asks for the current release without replacing its plan.
  channel?.postMessage({type:'command',action:'hello'});
  return {panel,save,status:updateStatus,destroy(){channel?.removeEventListener?.('message',onMessage);panel.remove();}};
 };
})(typeof globalThis!=='undefined'?globalThis:this);
