'use strict';
const $=id=>document.getElementById(id),channel=new StageChannel('director'),sessionId=crypto.randomUUID();
let catalog={actors:[],scenes:[]},stage=null,lastStatus=0,claimedStage='',draft=null,waiting=null,selected=[],finalBuffer='',finalAt=0,lastSeq=0,voiceSession='',enabled=false,micMode='stopped',sceneCommand=null;
let starting=false,modeRevision=0,remoteMode=Promise.resolve(),wantsMic=false,reconnectAt=0,reconnectAttempts=0,disconnectAt=0,claimUntil=0;
const names=ids=>ids.map(id=>catalog.actors.find(a=>a.id===id)?.name||String(id)).join('、');
const note=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
async function api(path,{method='GET',body,signal}={}){const r=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:signal||AbortSignal.timeout(12000)}),v=await r.json();if(!r.ok)throw Object.assign(Error(v.error?.message||'连接失败'),{code:v.error?.code});return v;}
let memoryStorage;try{memoryStorage=window.localStorage;}catch{}
let memoryDiskError='',memoryBrowserError='';
function memoryHealth(){const error=memoryDiskError||memoryBrowserError;$('memory-health').textContent=error?'记忆：'+error:'记忆：按参与者隔离保存 · 你可查看全部';$('memory-health').classList.toggle('error',Boolean(error));}
let memorySession=crypto.randomUUID(),memoryNext=null,memoryRevision=0,lastMemoryStatus=0;
const memoryOutbox=new MemoryOutbox({send:body=>api('/api/memory/events',{method:'POST',body}),storage:memoryStorage,onState:state=>{memoryBrowserError=state.error||'';memoryHealth();$('memory-save-status').textContent=state.error||(state.pending?'现场发言待保存 '+state.pending+' 条':'现场发言自动保存');$('memory-save-status').classList.toggle('error',Boolean(state.error));}});
function rememberAudience(text,id=crypto.randomUUID()){memoryOutbox.add({id:'audience:'+memorySession+':'+id,session:memorySession,kind:'audience',text,at:new Date().toISOString()});}
const memoryOptions=()=>new URLSearchParams({actor:$('memory-actor').value,date:$('memory-date').value||''});
async function refreshMemoryStatus(){try{const state=await api('/api/memory/status');memoryDiskError=state.error||'';memoryHealth();$('memory-status').textContent=state.error||('本机已保存 '+state.count+' 条 · 按北京时间归档'+(state.pending?' · '+state.pending+' 条正在重试保存':''));$('memory-status').classList.toggle('error',Boolean(state.error));}catch{memoryDiskError='暂时无法确认记忆保存状态';memoryHealth();$('memory-status').textContent='暂时无法读取记忆状态';$('memory-status').classList.add('error');}}
async function queryMemory(more=false){
 const version=++memoryRevision,params=memoryOptions();if(more&&memoryNext)params.set('before',String(memoryNext));
 $('memory-export').href='/api/memory/export?'+memoryOptions();$('memory-export').textContent=$('memory-actor').value||$('memory-date').value?'导出筛选结果':'导出全部记忆';
 try{const result=await api('/api/memory/events?'+params);if(version!==memoryRevision)return;if(!more)$('memory-results').replaceChildren();
 for(const e of result.entries||[]){const card=document.createElement('article');card.className='memory-entry';const heading=document.createElement('b'),line=document.createElement('p'),meta=document.createElement('p');heading.textContent=e.speaker;line.textContent=e.text;meta.className='muted';meta.textContent=new Date(e.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+(e.with?.length?' · 同轮参与：'+e.with.map(p=>p.name).join('、'):'')+(e.sceneName?' · '+e.sceneName:'');card.append(heading,line,meta);if(e.topic){const topic=document.createElement('p');topic.className='muted';topic.textContent='现场话题：'+e.topic;card.append(topic);}for(const peer of e.with||[]){const p=document.createElement('p');p.className='muted';p.textContent=peer.name+'：'+peer.text;card.append(p);}$('memory-results').append(card);}
 memoryNext=result.next;$('memory-more').hidden=!memoryNext;if(!$('memory-results').children.length)$('memory-results').textContent='当前条件下还没有记录。';await refreshMemoryStatus();
 }catch{$('memory-status').textContent='记忆读取失败，请稍后重试';}
}
$('memory-search').onclick=()=>queryMemory();$('memory-more').onclick=()=>queryMemory(true);$('memory-panel').ontoggle=()=>{if($('memory-panel').open)queryMemory();};
const request=(body,signal)=>api('/api/respond',{method:'POST',body:{...body,memorySession},signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
const connected=()=>channel.connected&&channel.active&&stage?.realtime?.version===1&&Date.now()-lastStatus<4000;
const idle=()=>connected()&&!stage.realtime.loading&&!stage.queue&&!stage.actors?.some(a=>a.phase!=='idle');
function claim(){claimUntil=Date.now()+2500;send('live-begin');send('live-mode',{enabled});}
function send(action,data={}){if(!channel.connected||!channel.active)return false;return channel.postMessage({type:'command',action,stageId:channel.stageId,session:sessionId,...data});}
function options(){return {improv:true,currentSceneId:stage?.scenery?.activeId,lockedSceneId:$('scene-mode').value||undefined,selectedActors:selected.length?[...selected]:undefined,maxSpeakers:2};}
const live=new LiveSession({request,onState:message=>note(message),onDraft:value=>{draft={...value,autoEligible:$('auto-publish').checked,sent:false};renderDraft();note('这一轮已生成，可编辑或直接上屏。');}});
const automatic=new AutoDiscussion({request,present:value=>present(value,value.sceneId),onDraft:value=>{draft={...value,autoEligible:false,sent:false};renderDraft();},onState:message=>note(message),onFatal:message=>{stopAll();note(message+'，请在“连接与资料”中处理后重新开始。',true);}});
function updateMode(){
 const on=automatic.running||starting;$('mic').textContent=on?'停止自动讨论':'开始自动讨论';$('mic').disabled=false;
 $('mode').textContent=starting?'正在启动':automatic.running?'自动讨论中':enabled?'手动干预':'尚未开始';$('mode').classList.toggle('running',on);
 $('microphone').disabled=wantsMic||capture.active||capture.starting;
}
function remoteEnable(value){remoteMode=remoteMode.catch(()=>{}).then(()=>api('/api/improv',{method:'PUT',body:{enabled:value}}));return remoteMode;}
function cancelWork(message='已取消待发内容，当前画面继续保留。',preserveDraft=false){
 live.cancel();finalBuffer='';const delivery=waiting;waiting=null;delivery?.reject(Error('待发内容已取消'));sceneCommand=null;if(!preserveDraft){draft=null;renderDraft();}send('live-cancel');note(message);
}
function intervene(message='已暂停自动讨论，可以临时手动调整。',preserveDraft=false){
 modeRevision++;starting=false;wantsMic=false;reconnectAt=0;automatic.stop();capture.dispose();micMode='stopped';cancelWork(message,preserveDraft);$('speech-status').textContent='自动收音已暂停';updateMode();
}
function stopAll(){intervene('自动讨论与收音已停止。');enabled=false;live.enable(false);send('live-mode',{enabled:false});remoteEnable(false).catch(e=>note(e.message,true));updateMode();}
async function enableManual(){const revision=modeRevision;if(!enabled){await remoteEnable(true);if(revision!==modeRevision)return;enabled=true;live.enable(true);claim();updateMode();}}
async function beginAutomatic({microphone=true,text=''}={}){
 // Open the same named stage window within the click gesture, before awaiting APIs.
 if(!connected())window.open('index.html','jinmen-realtime-stage');
 intervene();const revision=++modeRevision;starting=true;wantsMic=microphone;updateMode();note('正在连接自动讨论与大屏…');
 try{
  await remoteEnable(true);if(revision!==modeRevision)return;
  enabled=true;live.enable(true);claim();
  // Automatic means no lingering manual cast, scene lock or preview confirmation.
  selected=[];$('scene-mode').value='';$('auto-publish').checked=true;renderActors();
  memorySession=crypto.randomUUID();automatic.start();starting=false;reconnectAttempts=0;if(!microphone)$('speech-status').textContent='文字话题讨论中 · 麦克风未开启';updateMode();
  if(text){rememberAudience(text);$('transcript').textContent=text;send('live-caption',{text});automatic.hear(text);}
  if(microphone){await capture.start($('microphone').value);if(revision!==modeRevision)return;if(!capture.active&&!reconnectAt)stopAll();}
 }catch(e){if(revision===modeRevision){stopAll();note(e.message,true);}}
 finally{if(revision===modeRevision){starting=false;updateMode();}}
}
function renderActors(){
 const lock=catalog.scenes.find(s=>s.id===$('scene-mode').value);selected=selected.filter(id=>!lock||lock.actors.includes(id));
 $('actors').replaceChildren(...catalog.actors.map(a=>{const b=document.createElement('button');b.className='actor';b.classList.toggle('selected',selected.includes(a.id));b.setAttribute('aria-pressed',String(selected.includes(a.id)));b.disabled=Boolean(lock&&!lock.actors.includes(a.id));const name=document.createElement('b'),lens=document.createElement('span');name.textContent=a.name;lens.textContent=({'0':'社会与改革','1':'实务与建设','2':'逻辑与求证','3':'艺术与修养','4':'教育与美育','5':'理念与追问','6':'观察与创造','8':'行动与坚持'})[a.id];b.append(name,lens);b.onclick=()=>{if(!selected.includes(a.id)&&selected.length>=2){note('每轮最多两位，请先取消一位。');return;}intervene();selected=selected.includes(a.id)?selected.filter(id=>id!==a.id):[...selected,a.id];renderActors();};return b;}));
 $('actor-hint').textContent=selected.length?'手动指定：'+names(selected)+'。':'根据现场内容自动选择 1～2 位。';
}
function renderScenes(){
 $('scene-mode').replaceChildren(new Option('自动匹配场景',''),...catalog.scenes.map(s=>new Option(s.name,s.id)));$('scene-count').textContent=catalog.scenes.length+' 个场景';
 $('scenes').replaceChildren(...catalog.scenes.map(s=>{const card=document.createElement('article');card.className='scene-card';card.dataset.scene=s.id;const img=document.createElement('img');img.src=s.background;img.alt=s.name;img.loading='lazy';const title=document.createElement('b');title.textContent=s.name;const cast=document.createElement('p');cast.textContent=names(s.actors);const button=document.createElement('button');button.textContent='切到此景';button.onclick=()=>takeScene(s.id);card.append(img,title,cast,button);return card;}));
}
function editDraft(){if(automatic.running)intervene('已暂停自动讨论，正在编辑这轮接话。',true);if(draft)draft.autoEligible=false;}
function renderDraft(){
 $('publish-controls').hidden=!draft;
 if(!draft){const e=document.createElement('div');e.className='empty';e.textContent='接话内容将在这里出现，每条都可以编辑。';$('draft').replaceChildren(e);return;}
 $('draft').replaceChildren(...draft.messages.map((m,i)=>{
  const card=document.createElement('div');card.className='reply-card';const heading=document.createElement('div');heading.className='reply-heading';const name=document.createElement('select');name.setAttribute('aria-label','第 '+(i+1)+' 位接话人物');name.append(...catalog.actors.map(a=>new Option(a.name,String(a.id))));name.value=String(m.actor);name.onchange=()=>{const id=Number(name.value);editDraft();m.actor=id;renderDraft();};const num=document.createElement('span');num.className='muted';num.textContent=i?'稍后接话':'先接话';heading.append(name,num);
  const text=document.createElement('textarea');text.value=m.text;text.maxLength=80;text.setAttribute('aria-label','第 '+(i+1)+' 条接话内容');text.onfocus=()=>{if(automatic.running){editDraft();$('draft-note').textContent='已暂停自动讨论，修改后点击上屏。';}};text.oninput=()=>{m.text=text.value;draft.autoEligible=false;$('draft-note').textContent='已编辑，请点击上屏。';};
  const source=document.createElement('p');source.className='source-note';const citations=draft.knowledge?.roles?.find(r=>r.actor===m.actor)?.citations||[];source.textContent=citations.length?'参考：'+[...new Set(citations.map(c=>c.title))].join('、'):'现场接话 · 可自由修改';card.append(heading,text,source);return card;
 }));renderReplyScenes();$('draft-note').textContent=draft.sent?'已上屏':automatic.running?'当前气泡结束后自动上屏':draft.autoEligible?'舞台空闲时自动上屏':'确认后点击上屏';
}
function renderReplyScenes(){if(!draft)return;const valid=catalog.scenes.filter(s=>draft.messages.every(m=>s.actors.includes(m.actor)));$('reply-scene').replaceChildren(...valid.map(s=>new Option(s.name,s.id)));const preferred=valid.find(s=>s.id===draft.sceneId)||valid.find(s=>s.id===$('scene-mode').value)||valid[0];if(preferred)$('reply-scene').value=preferred.id;$('publish').disabled=!valid.length||new Set(draft.messages.map(m=>m.actor)).size!==draft.messages.length;}
function present(value,sceneId){
 if(waiting)return Promise.reject(Error('已有一轮正在上屏'));
 if(!connected())return Promise.reject(Error('大屏暂未连接'));
 if(!automatic.running)claim();
 if(value.messages.some(m=>!m.text.trim()||m.text.length>80)||new Set(value.messages.map(m=>m.actor)).size!==value.messages.length)return Promise.reject(Error('每条接话需 1～80 字，人物不能重复'));
 if(!catalog.scenes.some(s=>s.id===sceneId&&value.messages.every(m=>s.actors.includes(m.actor))))return Promise.reject(Error('所选场景没有包含接话人物'));
 return new Promise((resolve,reject)=>{const id=crypto.randomUUID();waiting={id,draft:structuredClone(value),sceneId,seen:new Set(),at:Date.now(),resolve,reject};if(draft)draft.autoEligible=false;if(!send('live-present',{id,sceneId,messages:value.messages,input:value.input||'',continuation:value.continuation===true,memorySession})){waiting=null;reject(Error('大屏未连接'));}});
}
async function publish(){if(!draft||waiting)return;const value=draft,sceneId=$('reply-scene').value;if(automatic.running)editDraft();try{const shown=await present(value,sceneId);live.remember({...value,memoryRoundId:shown.roundId});}catch(e){note(e.message,true);if(draft===value){draft.sent=true;draft.autoEligible=false;}}}
function takeScene(sceneId){if(!connected()){note('请先打开大屏。',true);return;}intervene();claim();$('scene-mode').value=sceneId;renderActors();const id=crypto.randomUUID();sceneCommand={id,at:Date.now()};send('live-scene',{id,sceneId});note('正在准备场景…');}
function showPresented(value,sceneName){
 const row=document.createElement('li');row.textContent=value.messages.map(v=>names([v.actor])+'：'+v.text).join(' / ');$('history').prepend(row);while($('history').children.length>20)$('history').lastElementChild.remove();
 $('onstage').replaceChildren(...value.messages.map(v=>{const box=document.createElement('div');box.className='spoken';const name=document.createElement('b'),line=document.createElement('span');name.textContent=names([v.actor]);line.textContent=v.text;box.append(name,line);return box;}));
 $('round-count').textContent=sceneName||'已上屏';if(draft){draft.sent=true;$('draft-note').textContent='已上屏';}
}
channel.onmessage=({data:m})=>{
 if(m.type==='channel-state'&&!m.active){stage=null;claimedStage='';automatic.suspend();cancelWork('大屏暂时断开，连接恢复后自动继续。');}
 if(m.type!=='status')return;stage=m;lastStatus=Date.now();
 if(m.realtime?.version!==1){note('大屏仍是旧页面，请刷新大屏加载实时版。',true);return;}
 if(claimedStage!==m.stageId){claimedStage=m.stageId;if(automatic.running||starting)claim();}
 if(automatic.running&&m.realtime.session!==sessionId&&Date.now()>claimUntil){intervene('另一导演台已接管大屏，本页已暂停。点击开始可接回自动讨论。');}
 $('current-scene').textContent=m.scenery?.activeName||'画面准备中…';document.querySelectorAll('.scene-card').forEach(c=>c.classList.toggle('active',c.dataset.scene===m.scenery?.activeId));
 if(waiting&&m.realtime.session===sessionId&&m.realtime.lastId===waiting.id){
  const value=waiting;
  if(m.realtime.error){waiting=null;value.reject(Error(m.realtime.error));}
  else if(!m.realtime.loading){
   for(const a of m.actors||[])if(a.phase==='speaking'&&a.captionVisible===true&&value.draft.messages.some(p=>p.actor===a.id&&p.text.trim()===a.text))value.seen.add(a.id);
   if(value.draft.messages.every(p=>value.seen.has(p.actor))){waiting=null;showPresented(value.draft,m.scenery?.activeName);value.resolve({sceneId:m.scenery?.activeId,roundId:value.id});}
  }
 }
 if(sceneCommand&&m.realtime.lastId===sceneCommand.id){note(m.realtime.error||'已切换到 '+m.scenery?.activeName,Boolean(m.realtime.error));sceneCommand=null;}
};
const capture=new SpeechCapture({
 onState({mode,message}){
  micMode=mode;$('speech-status').textContent=message;
  if(mode==='listening'){reconnectAt=0;reconnectAttempts=0;}
  if(wantsMic&&automatic.running&&['error','stopped'].includes(mode)){
   if(/权限|没有找到|麦克风已断开|密钥|鉴权|余额|未配置|不支持/.test(message)){stopAll();note(message,true);}
   else{reconnectAt=Date.now()+Math.min(15000,2000*2**Math.min(reconnectAttempts++,3));note('语音连接暂时中断，正在自动恢复…');}
  }
  updateMode();
 },
 onLevel({rms}){$('level').value=Math.min(1,(rms||0)*8);},
 onMetrics(m){$('latency').textContent='音频上传等待 '+Math.round(m.uploadBacklogMs||0)+' ms';},
 onTranscript(event){
  if(!automatic.running||!wantsMic)return;
  if(event.session!==voiceSession){voiceSession=event.session;lastSeq=0;finalBuffer='';}if(event.seq<=lastSeq)return;lastSeq=event.seq;
  $('transcript').textContent=event.text||'';if(enabled)send('live-caption',{text:event.text||''});
  if(event.text?.trim())automatic.hearing();
  if(event.final&&event.text?.trim()){rememberAudience(event.text.trim(),event.session+':'+event.seq);finalBuffer=(finalBuffer+' '+event.text.trim()).trim().slice(-2000);finalAt=Date.now();}
 },
 onCalibration(event){if(event.type==='reconnecting')$('speech-status').textContent='语音连接续接中…';}
});
capture.setProvider('api');
$('mic').onclick=()=>automatic.running||starting?stopAll():beginAutomatic();
$('generate').onclick=()=>{const text=$('input').value.trim();if(!text){note('请输入现场讨论的话题。',true);return;}if(automatic.running){rememberAudience(text);automatic.hear(text);send('live-caption',{text});$('transcript').textContent=text;}else beginAutomatic({microphone:false,text});};
$('cancel').onclick=()=>intervene();$('clear').onclick=()=>{intervene('气泡已清空，自动讨论已暂停。');send('live-clear');};
$('auto-actors').onclick=()=>{intervene();selected=[];renderActors();};$('scene-mode').onchange=()=>{intervene();renderActors();};
$('reply-scene').onchange=()=>{const id=$('reply-scene').value;editDraft();if(draft){draft.sceneId=id;renderDraft();}};
$('auto-publish').onchange=()=>{if(automatic.running)editDraft();if(draft)draft.autoEligible=$('auto-publish').checked&&!draft.sent;};
$('publish').onclick=publish;
$('manual-generate').onclick=async()=>{const text=$('input').value.trim();if(!text){note('请先在上方输入讨论话题。',true);return;}intervene();const revision=modeRevision;try{await enableManual();if(revision===modeRevision){rememberAudience(text);live.run(text,options());}}catch(e){note(e.message,true);}};
$('manual').onclick=()=>{intervene();const locked=catalog.scenes.find(s=>s.id===$('scene-mode').value),ids=selected.length?selected:[locked?.actors[0]??catalog.actors[0]?.id];draft={input:'现场手动接话',messages:ids.map(actor=>({actor,text:''})),sceneId:locked?.id||stage?.scenery?.activeId,autoEligible:false};renderDraft();note('填写台词后，选择场景并点击上屏。');};
$('model-form').onsubmit=async e=>{e.preventDefault();try{await api('/api/model-config',{method:'PUT',body:{apiKey:$('model-key').value}});$('model-key').value='';note('模型密钥已保存。');await refreshStatus();}catch(error){note(error.message,true);}};
$('speech-form').onsubmit=async e=>{e.preventDefault();try{await api('/api/speech/config',{method:'PUT',body:{authMode:'apiKey',apiKey:$('speech-key').value,resourceId:'volc.seedasr.sauc.duration'}});$('speech-key').value='';note('语音密钥已保存。');}catch(error){note(error.message,true);}};
async function refreshStatus(){try{const info=await api('/api/status');$('provider').textContent='模型：'+(info.model||'DeepSeek')+' · '+(info.configured?'凭据已配置':'尚未配置密钥');if(info.mode!=='realtime')note('服务尚未切换到实时版，请重新启动实时服务。',true);}catch(e){$('provider').textContent=e.message;}}
async function init(){try{catalog=await api('/api/live/catalog');renderScenes();renderActors();for(const a of catalog.actors)$('memory-actor').append(new Option(a.name,String(a.id)));refreshMemoryStatus();await refreshStatus();const speech=await api('/api/speech/status');if(micMode==='stopped')$('speech-status').textContent='豆包流式语音 · '+speech.message;await api('/api/knowledge');$('knowledge').textContent='八位角色独立资料与记忆 · 每轮自动读取本人参与的对话，未参与者不可读取；角色不能修改原记录。';const devices=await navigator.mediaDevices?.enumerateDevices();for(const d of devices||[])if(d.kind==='audioinput'&&d.deviceId)$('microphone').append(new Option(d.label||'麦克风',d.deviceId));}catch(e){note(e.message,true);}}
setInterval(()=>{
 memoryOutbox.flush();if(Date.now()-lastMemoryStatus>5000){lastMemoryStatus=Date.now();refreshMemoryStatus();}
 const on=connected();$('connection').textContent=on?'大屏已连接':'等待大屏连接';$('connection').classList.toggle('connected',on);
 if(!on&&!disconnectAt){disconnectAt=Date.now();automatic.suspend();}else if(on)disconnectAt=0;
 if(automatic.running&&!on&&disconnectAt&&Date.now()-disconnectAt>8000)note('请打开大屏；连接恢复后会按最新话题自动继续。',true);
 if(waiting&&Date.now()-waiting.at>18000){const value=waiting;waiting=null;send('live-cancel');value.reject(Error('上屏确认超时'));}
 if(sceneCommand&&Date.now()-sceneCommand.at>18000){sceneCommand=null;send('live-cancel');note('场景确认超时，可重试。',true);}
 if(finalBuffer&&Date.now()-finalAt>=250){automatic.hear(finalBuffer);finalBuffer='';}
 if(automatic.running){automatic.tick({connected:on&&stage.realtime.session===sessionId&&(!wantsMic||capture.active),idle:idle(),options:{currentSceneId:stage?.scenery?.activeId,maxSpeakers:2}});}
 else if(draft?.autoEligible&&!draft.sent&&!waiting&&idle())publish();
 if(wantsMic&&automatic.running&&reconnectAt&&Date.now()>=reconnectAt&&!capture.active&&!capture.starting&&!capture.stopping){reconnectAt=0;capture.start($('microphone').value);}
},150);
window.addEventListener('pagehide',()=>{automatic.stop();live.enable(false);capture.dispose();send('live-mode',{enabled:false});});
init();
