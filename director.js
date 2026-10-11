'use strict';

const $=id=>document.getElementById(id),{teachers}=SHOW_DATA;
let speechScript=null,topics=SpeechScript.topics(speechScript,[]),tabs=[],selectedTopic=0,rehearsalControls;
let sharedScript=null,sharedReady=false;
const sharedSync=new ScriptSync(script=>{sharedScript=script;sharedReady=true;rehearsalControls?.applyShared(script);syncStageSettings();if(typeof capture!=='undefined'&&capture.active)channel.postMessage({type:'command',action:'voice-state',active:true,session:capture.id});});
const channel=typeof StageChannel==='function'?new StageChannel('director'):new BroadcastChannel(SHOW_DATA.castId+'-stage'),assets=new Map();
let latestStage=null,dictationControls=null,safetyUntil=0;
let lastStatus=0,toastTimer,stageAi={mode:'ready'},finaleActive=false;
let improvEnabled=false,improvSaving=false,improvReady=false,legacyStageSynced=false;
const phaseNames={idle:'安静旁听',thinking:'准备加入',entering:'走近接话',speaking:'正在发言',listening:'听同伴发言',leaving:'返回旁听'};
function toast(text){UIPatch.text($('toast'),text);$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
// Recognition events carry their own type; the stage command envelope must take precedence.
function send(action,data={}){if(action!=='hello'&&Date.now()-lastStatus>4000){toast('请先打开观众大屏，并保持它在同一浏览器中。');return false;}return channel.postMessage({...data,type:'command',action,stageId:latestStage?.stageId})!==false;}
function restoreAssets(){for(const [target,data] of assets)channel.postMessage({type:'command',action:'asset',target,data});}
function syncStageSettings(){
 if(sharedReady)channel.postMessage({type:'command',action:'speech-script',script:sharedScript});
 if(improvReady)channel.postMessage({type:'command',action:'script-improv',enabled:improvEnabled});
 channel.postMessage({type:'command',action:'improv-style',value:$('improv-style').value});
}
function applyImprov(enabled){
 improvEnabled=enabled===true;$('script-improv').checked=improvEnabled;
 channel.postMessage({type:'command',action:'script-improv',enabled:improvEnabled});
}
async function setImprov(enabled){
 if(!latestStage?.scenery?.liveDialogue)return;
 improvSaving=true;$('script-improv').disabled=true;
 if(!enabled)applyImprov(false);
 try{const response=await fetch('/api/improv',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});if(!response.ok)throw new Error();const result=await response.json();improvReady=true;applyImprov(result.improvEnabled);toast(improvEnabled?'T2 现场接话与字幕已开启。':'T2 现场接话与字幕已关闭。');}
 catch{applyImprov(false);toast('开关未能保存到本机服务，请刷新导演页后重试。');}
 finally{improvSaving=false;renderImprovControls();}
}
teachers.forEach((t,i)=>{
 const b=document.createElement('button');b.className='cast-card';b.style.setProperty('--person','#596157');b.setAttribute('aria-label',`邀请${t.name}发言`);b.innerHTML=`${typeof INK_CAST!=='undefined'?inkAvatarMarkup(i,'cast-portrait'):t.art?`<svg class="cast-portrait" viewBox="${t.viewBox||'0 0 1024 1536'}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><image href="${t.art}" width="${t.artWidth||1024}" height="${t.artHeight||1536}"/></svg>`:`<span class="cast-symbol">${t.surname}</span>`}<span><span class="cast-name">${t.name}</span><span class="cast-state" style="display:block">等待连接</span></span>`;b.onclick=()=>send('invite',{actor:i});$('cast').append(b);
 for(const id of ['asset-person','cue-person']){const opt=document.createElement('option');opt.value=i;opt.textContent=t.name;$(id).append(opt);}
});
const cards=[...document.querySelectorAll('.cast-card')];
function selectTopic(index){
 selectedTopic=topics[index]?index:0;
 tabs.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selectedTopic)));
 UIPatch.text($('topic-summary'),topics[selectedTopic]?.summary||topics[selectedTopic]?.subtitle||'');
 const replies=topics[selectedTopic]?.replies||[];
 cards.forEach((b,i)=>{b.disabled=!replies.some(m=>m.actor===i);b.title=b.disabled?'本段无此角色预备台词，可用现场文字试演。':'';});
 $('join').disabled=!replies.length;$('burst').disabled=replies.length<2;
 rehearsalControls?.select(selectedTopic);
}
function renderTopics(){
 topics=SpeechScript.topics(speechScript,[]);$('topic-tabs').replaceChildren();
 tabs=topics.map((topic,i)=>{
  const b=document.createElement('button');b.className='topic-tab';
  const number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0')+(topic.discussion?' · 讨论':'');
  b.append(number,document.createTextNode(topic.tag));b.title=topic.subtitle;
  b.onclick=()=>{selectTopic(i);send('topic',{topic:i});};$('topic-tabs').append(b);return b;
 });
 UIPatch.text($('script-title'),speechScript?.title||'等待导入演讲稿');
 UIPatch.text($('script-info'),speechScript?.kind==='rehearsal'?'仅测试 · '+topics.length+' 个主题':speechScript?CuePlan.sequenceMode(speechScript)?`${topics.length-1} 套编号配置＋起始幕 · ${speechScript.blocks.reduce((n,b)=>n+b.sentences.length,0)} 个短句`:''+topics.length+' 个主题':'空白稿件');
 UIPatch.text($('script-edit'),speechScript?.kind==='rehearsal'?'替换为其他稿件':speechScript?'编辑 / 替换稿件':'导入演讲稿');
 UIPatch.text($('cast-hint'),speechScript?.blocks?'点击本段参与者试演':'可通过语音或现场文字试演');
 selectTopic(latestStage?.topic||0);rehearsalControls?.render();renderSafety();
}
renderTopics();
let replacementDraft=null;
function updateScriptCount(){
 replacementDraft=null;if($('script-apply'))$('script-apply').disabled=true;if($('script-check-result'))$('script-check-result').textContent='正文有变动时须重新检查。';if($('script-check-preview'))$('script-check-preview').replaceChildren();
 const text=$('script-text').value;
 UIPatch.text($('script-count'),text.trim().length+' 字 · '+text.split(/\n+/).filter(s=>s.trim()).length+' 段');
 UIPatch.text($('script-error'),'');
}
function openScriptEditor(){
 $('script-name').value=speechScript?.kind==='rehearsal'?'':speechScript?.title||'';
 $('script-text').value=speechScript?.kind==='rehearsal'?'':speechScript?.blocks?.map(b=>b.source).join('\n\n')||'';$('script-file').value='';updateScriptCount();$('script-dialog').showModal();
}
async function saveScript(value){
 try{
  const next=value===null?null:SpeechScript.create(value);
  if(speechScript?.kind==='rehearsal')await rehearsalControls.clear();
  rehearsalControls?.reset();
  speechScript=await sharedSync.save(next);
 }catch(error){UIPatch.text($('script-error'),error.name==='QuotaExceededError'?'浏览器存储空间不足，原稿未被替换。':error.message||'无法保存，请检查浏览器本地存储权限。');return;}
 renderTopics();channel.postMessage({type:'command',action:'speech-script',script:speechScript});
 $('script-dialog').close();toast(speechScript?'稿件已替换并保存在本机。':'当前稿件已清空。');
}
$('script-edit').onclick=openScriptEditor;
$('script-cancel').onclick=()=>$('script-dialog').close();
$('script-text').oninput=updateScriptCount;
$('script-form').onsubmit=event=>{event.preventDefault();if(!replacementDraft){UIPatch.text($('script-error'),'请先点击自动编排并检查。');return;}saveScript(replacementDraft);};
$('script-reset').onclick=()=>saveScript(null);
function showReplacement(draft){
 const next=SpeechScript.create(draft),report=CuePlan.assert(next,window.performanceCatalog);
 replacementDraft=next;const preview=$('script-check-preview');preview.replaceChildren();
 for(const [bi,b] of next.blocks.entries())for(const [si,sentence] of b.sentences.entries()){
  const row=document.createElement('p');row.textContent=`${b.sequenceCode||'S'+(bi+1)} · ${si+1} · ${CuePlan.count(sentence.text)} 字：${sentence.text}【触发：${sentence.trigger||'句尾'}】 → ${sentence.replies.map(r=>teachers[r.actor].name).join('、')||(sentence.dialogueLead?'延续前组对话':'开场白 · 不接话')}`;preview.append(row);
 }
 UIPatch.text($('script-check-result'),report.keywords?`检查通过：${report.units} 个短句均有关键词，${report.groups} 组原对话，${report.replies} 条台词；${report.continuations} 句延续原对话。开场白不接话。请核对后保存。`:`检查通过：${report.openingSilent?`${report.units} 句：开场白不接话，其余 ${report.units-1} 句全部有接话`:`${report.units} 句全部有接话`}，${report.minChars}～${report.maxChars} 字。请核对对应人物与台词；保存后才生效。`);UIPatch.text($('script-error'),'');$('script-apply').disabled=false;
}
window.reviewCueScript=function(imported){
 $('script-name').value=imported.title;$('script-text').value=imported.blocks.map(b=>b.source).join('\n\n');updateScriptCount();$('script-dialog').showModal();
 try{showReplacement(CuePlan.protectedPolicy(imported.replyPolicy)?imported:CuePlan.arrangeDialogue(imported));}catch(error){UIPatch.text($('script-error'),error.message);}
};
$('script-check').onclick=()=>{try{showReplacement(CuePlan.replaceText(speechScript,{title:$('script-name').value,text:$('script-text').value}));}catch(error){UIPatch.text($('script-error'),error.message);}};
$('script-name').oninput=()=>{if(replacementDraft)replacementDraft.title=$('script-name').value;};
$('script-backup-restore').onclick=async()=>{try{
 const response=await fetch('/api/script/backups'),data=await response.json();if(!response.ok)throw Error('无法读取备份');
 if(!data.backups.length)throw Error('尚无可恢复的备份');
 const restored=await fetch('/api/script/restore',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.backups[0],revision:sharedSync.revision})}),record=await restored.json();if(!restored.ok)throw Error(record.error?.message||'恢复失败');
 sharedSync.accept(record);toast('已恢复上一份剧本，刚才的版本也已备份。');
 }catch(error){toast(error.message);}};

$('script-file').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(!/\.(txt|md)$/i.test(file.name)||file.size>1024*1024)throw new Error('请选择 1 MB 以内的 TXT 或 Markdown 文件；Word 内容可直接复制粘贴。');
  const imported=SpeechScript.create({title:file.name.replace(/\.(txt|md)$/i,''),text:await file.text()});
  $('script-name').value=imported.title;$('script-text').value=imported.text;updateScriptCount();
 }catch(error){UIPatch.text($('script-error'),error.message||'文件读取失败，请直接粘贴正文。');}
 event.target.value='';
};
if($('frontend-bubbles'))$('frontend-bubbles').onchange=()=>{const value=$('frontend-bubbles').value;if(send('frontend-bubbles',{value})){FrontendTrial.set(value);toast('已切换气泡显示方式，接话位置保持不变。');}};
channel.onmessage=({data:m})=>{
 if(m.type==='status'&&m.frontendTrial&&$('frontend-bubbles')){$('frontend-bubbles').value=m.frontendTrial.mode;FrontendTrial.set(m.frontendTrial.mode);}
 if(m.type==='channel-state'){if(!m.active||latestStage?.stageId&&latestStage.stageId!==m.stageId){dictationControls?.stop();lastStatus=0;latestStage=null;renderSafety();}if(m.active){syncStageSettings();send('hello');}return;}
 if(m.type==='finale-status'){finaleActive=m.active===true;if(latestStage)latestStage.finaleActive=finaleActive;if(finaleActive)dictationControls?.stop();renderSafety();if(speechUI)speechUI.render();return;}
 if(m.type==='rehearsal-sync'){rehearsalControls?.sync.invalidate();return;}
 if(m.type==='voice-overflow'){dictationControls?.stop();capture.stop();toast('待回应句子较多，已停止收音，已有句子将依次回应。');return;}
 if(m.type==='stage-ready'){legacyStageSynced=false;restoreAssets();syncStageSettings();send('hello');return;}
 if(m.type!=='status')return;latestStage={...m,receivedAt:Date.now(),finaleActive};lastStatus=Date.now();dictationControls?.onStatus(latestStage);renderSafety();renderDiagnostics(m);rehearsalControls?.status(m.rehearsal,m.cues);stageAi=m.ai||stageAi;renderImprovControls();lastStatus=Date.now();UIPatch.text($('connection'),stageCompatible(m)?'大屏已连接':'大屏版本旧 · 请刷新预览');$('connection').classList.add('connected');
 $('stage-version-note').hidden=stageCompatible(m);
 if(!stageCompatible(m)&&!legacyStageSynced&&sharedReady&&improvReady){legacyStageSynced=true;syncStageSettings();}
 UIPatch.text($('speech-preview'),m.speechRawCaption??m.speechPreview??m.speechCaption??'');
 UIPatch.text($('play'),m.paused?'继续讨论':'暂停讨论');UIPatch.text($('show-state'),finaleActive?'联合发布中':m.paused?'已暂停':stageAi.mode==='thinking'?'正在准备回应':m.actors.some(a=>a.phase!=='idle')?'本轮回应中':'等待演讲输入');UIPatch.text($('queue-status'),`队列 ${m.queue} 条`);
 $('speed').value=String(m.speed);$('capacity').value=String(m.capacity);const progress=m.presentation||m.follow;selectTopic(progress?.sentenceIndex>=0?progress.index:m.topic);rehearsalControls?.follow(progress);const focused=progress?.sentenceIndex>=0;tabs.forEach((tab,i)=>tab.hidden=focused&&i<progress.index);UIPatch.text($('completed-sections'),focused&&progress.index?`已收起 ${progress.index} 部分`:'');$('completed-sections').hidden=!focused||!progress.index;
 m.actors.forEach(a=>{const b=cards[a.id];b.classList.toggle('active',a.phase!=='idle');UIPatch.text(b.querySelector('.cast-state'),phaseNames[a.phase]);});
};
$('play').onclick=()=>send('play');$('join').onclick=()=>send('join');$('burst').onclick=()=>send('burst');$('clear').onclick=()=>send('clear');$('speed').onchange=e=>send('speed',{value:Number(e.target.value)});$('capacity').onchange=e=>send('capacity',{value:Number(e.target.value)});
$('send-cue').onclick=()=>{const text=$('cue-text').value.trim();if(!text){toast('先写一句发言。');return;}if(send('say',{actor:Number($('cue-person').value),text})){$('cue-text').value='';toast('文字已发送给大屏。');}};
function readImage(input,target){const file=input.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024){toast('请选择不超过 20 MB 的 PNG、JPG 或 WebP 图片。');return;}const reader=new FileReader();reader.onload=async()=>{try{const image=new Image();image.src=reader.result;await image.decode();assets.set(target,reader.result);if(send('asset',{target,data:reader.result}))toast('素材已送到观众大屏。');}catch{toast('图片无法读取，请更换文件。');}};reader.onerror=()=>toast('文件读取失败。');reader.readAsDataURL(file);}
$('background-file').onchange=()=>readImage($('background-file'),'background');$('person-file').onchange=()=>readImage($('person-file'),$('asset-person').value);$('reset-art').onclick=()=>{assets.clear();send('reset-art');};
setInterval(()=>{if(Date.now()-lastStatus>4000){UIPatch.text($('connection'),'大屏未连接');$('connection').classList.remove('connected');UIPatch.text($('show-state'),'等待大屏');UIPatch.text($('reply-pace'),'主大屏已失联，当前进度不可用；请在现有大屏点击接管。');cards.forEach(b=>UIPatch.text(b.querySelector('.cast-state'),'等待连接'));}},1500);
send('hello');

function renderImprovControls(){
 const live=latestStage?.scenery?.liveDialogue===true,connected=latestStage&&Date.now()-latestStage.receivedAt<4000;
 $('script-improv').closest('label').hidden=!live;$('improv-style').closest('label').hidden=!live;
 $('script-improv').disabled=!live||!connected||!improvReady||improvSaving;
 UIPatch.text($('discussion-mode'),'AI 即兴接话仅在最后的 T2 场景使用；其他场景按固定剧本演出。');
 const eligible=(latestStage?.improvActors||[]).map(id=>teachers[id]?.name).filter(Boolean);
 UIPatch.text($('improv-status'),!live?'AI 即兴仅用于 T2；本场只按剧本接话。':!improvReady?'正在连接现场接话服务…':`${improvEnabled?'T2 现场接话与字幕已开启':'T2 现场接话与字幕已关闭'} · ${eligible.length?'可用人物：'+eligible.join('、'):'等待人物空闲'}${!latestStage?.follow?.active?' · 麦克风未开启':''}${latestStage?.liveReply?` · ${latestStage.liveReply.inFlight?'已发送，DeepSeek 正在回应':latestStage.liveReply.ready?'回应已到达，等待人物空闲':latestStage.liveReply.queued?'已识别，等待本轮接话结束':latestStage.liveReply.lastResult||'等待现场发言'}`:''}`);
}
async function refreshProvider(){
 try{
  const response=await fetch('/api/status');if(!response.ok)throw new Error('unavailable');
  const info=await response.json();
  if(!improvSaving){const changed=!improvReady||improvEnabled!==info.improvEnabled;improvReady=typeof info.improvEnabled==='boolean';if(changed)applyImprov(info.improvEnabled);}
  renderImprovControls();
  if(latestStage?.scenery?.liveDialogue&&!info.configured)UIPatch.text($('improv-status'),'T2：DeepSeek 尚未配置，请在内容接口填写本机密钥。');
  UIPatch.text($('ai-provider'),info.configured?'DeepSeek 已配置':'待配置 DeepSeek');
  $('ai-provider').style.color=info.configured?'#566b4f':'';
  let state=info.busy?'正在生成回应':info.lastCall?.message||'等待首次调用';
  if(stageAi.mode==='fallback')state='本轮使用本地预备语料 · '+stageAi.message;
  if(['error','silent'].includes(stageAi.mode))state=stageAi.message;
  UIPatch.text($('ai-status'),`${info.model} · ${info.knowledge?`8 人资料库 · ${info.knowledge.works} 项资料`:'现场短接话'} · ${state}${info.lastCall?.latencyMs?' · '+(info.lastCall.latencyMs/1000).toFixed(1)+' 秒':''}`);
 }catch{UIPatch.text($('ai-provider'),'服务未连接');UIPatch.text($('ai-status'),'请使用“启动预览.command”启动本地后端。');}
}
refreshProvider();setInterval(refreshProvider,3000);

const speechUI=setupSpeechDirector({send,toast,getStatus:()=>latestStage&&({...latestStage,scriptReady:latestStage.scriptReady!==false&&stageCompatible(latestStage),guardRequired:CuePlan.protectedPolicy(speechScript?.replyPolicy),guardVersion:speechScript?.replyPolicy==='keyword-dialogue'?3:2}),getFinale:()=>finaleActive});
const capture=speechUI.capture;dictationControls=speechUI;

rehearsalControls=setupRehearsalDirector({setImprov,sharedSync,getSharedScript:()=>sharedScript,getSharedReady:()=>sharedReady,getScript:()=>speechScript,setScript:value=>{speechScript=value;renderTopics();},getTopic:()=>selectedTopic,send,toast,channel,isStageReady:()=>Boolean(latestStage&&Date.now()-latestStage.receivedAt<4000&&stageCompatible(latestStage)&&latestStage.scenery?.ready!==false),isReceiving:()=>speechUI.active(),stopCapture:()=>{dictationControls?.stop();capture.dispose();capture.state('stopped','收音已停止，可再次开启。');}});

rehearsalControls.render();
sharedSync.refresh();setInterval(()=>sharedSync.refresh(),1500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sharedSync.refresh();});
if(typeof setupFinaleDirector==='function')setupFinaleDirector({send,channel,toast,stopCapture:()=>{if(speechUI.active())throw new Error('请先点击麦克风停止接收，再开始联合发布。');}});

function stageCompatible(m){return (!CuePlan.sequenceMode(speechScript)||m?.sequenceScriptVersion>=(speechScript.stageBinding.status==='bound'?2:1))&&m?.stageVersion===13&&m.playbackVersion>=30&&(!CuePlan.protectedPolicy(speechScript?.replyPolicy)||m.cueGuardVersion>=(speechScript?.replyPolicy==='keyword-dialogue'?3:2));}
function nextManualSentence(m){
 const blocks=speechScript?.blocks;if(m?.scenery?.liveDialogue||!blocks?.length||m?.presentation?.complete)return null;
 const index=Number.isInteger(m?.presentation?.index)?m.presentation.index:0;
 const sentenceIndex=m?.presentation?.sentenceIndex>=0?m.presentation.sentenceIndex:0;
 if(!blocks[index]?.sentences?.[sentenceIndex])return null;
 if(sentenceIndex+1<blocks[index].sentences.length)return {index,sentenceIndex:sentenceIndex+1};
 return blocks[index+1]?.sentences?.length?{index:index+1,sentenceIndex:0}:null;
}
function renderSafety(){
 const m=latestStage,connected=m&&Date.now()-m.receivedAt<4000&&stageCompatible(m);
 const progress=m?.scenery?.progress,next=nextManualSentence(m);
 UIPatch.text($('section-progress'),!topics.length?'正在载入演出剧本':progress?progress.liveDialogue?progress.name:progress.code==='S0-M1'?'S0 · 暖场待机':progress.pending?`${progress.code} · 接话 ${progress.current}/${progress.total} · ${progress.name}`:`${progress.code}_${progress.current}/${progress.total} · ${progress.name}`:m?'等待景别绑定':'等待大屏连接');
 $('force-next').disabled=!connected||m.sentenceAdvanceVersion!==2||!next||m.rehearsal?.active||finaleActive||Date.now()<safetyUntil;
 $('force-cue').disabled=!connected||finaleActive||!(progress?.groups||[]).some(u=>!m.cues?.some(c=>c.key===u.key&&['queued','playing','played','interrupted','skipped'].includes(c.state)));
 UIPatch.text($('safety-hint'),progress?.liveDialogue?'本场为临场接话；同一开关控制现场接话与字幕。':connected&&m.sentenceAdvanceVersion!==2?'请刷新大屏，启用清积压逐句保险。':next?`下一句：${speechScript.blocks[next.index].sentences[next.sentenceIndex].text.slice(0,36)} · 点击清除旧积压并接话，自动重连语音。`:'已到讲稿末句；漏接话可用右侧补播。');
}
const cueNames={queued:'已排队',playing:'接话中',played:'已完成',cancelled:'已取消，可补播',interrupted:'中断，需手动试演',skipped:'保险跳过，不补播'};
function renderDiagnostics(m){
 renderDiagnosticsOLD(m);if(m.scenery?.liveDialogue){UIPatch.text($('reply-pace'),'T2 临场接话与字幕共用开关 · 字幕实时显示，语音停顿后回应');return;}if(!CuePlan.protectedPolicy(speechScript?.replyPolicy))return;
 const silentIndex=m.presentation?.sentenceIndex>=0?m.presentation.index:m.topic||0,silentExplanation=CuePlan.silentReason(speechScript,silentIndex,speechScript.blocks[silentIndex]?.sentences[Math.max(0,m.presentation?.sentenceIndex||0)]);
 const flow=m.replyFlow,speaking=(m.actors||[]).filter(a=>a.phase==='speaking'&&a.captionVisible!==false).map(a=>teachers[a.id]?.name),pending=flow?.pendingGroups??(m.cues||[]).filter(c=>c.state==='queued').length,waiting=pending?`待接话 ${pending} 组${flow?` / ${flow.pendingLines} 条台词`:''}`:'暂无待接话';
 const reason={"caption-layout":"正在调整对话框排版","scene":"等待上一场接话结束","actor":"等待同一人物上一条台词结束","stagger-or-capacity":"按顺序错开出框"}[flow?.waitingFor]||'';
 const delay=flow?.oldestWaitMs>=4000?` · 最久已等 ${(flow.oldestWaitMs/1000).toFixed(1)} 秒${reason?'，'+reason:''}`:'';
 UIPatch.text($('reply-pace'),speaking.length?`${speaking.join('、')}接话中 · ${waiting}${delay}`:flow?.blocked?.length?`${waiting} · 对话框空间不足，正在调整排版${delay}`:m.captionContinuations?.held?.length?`延续本组 · 保留人物文字 · ${waiting}${delay}`:pending?`${waiting}${delay}`:silentExplanation?silentExplanation:speechScript.replyPolicy==='keyword-dialogue'?'关键词触发 · 同组台词只播放一次，结尾九人齐声':'可以继续讲话 · 正文一人接话，结尾九人齐声');
}
function renderDiagnosticsOLD(m){UIPatch.text($('cue-alert'),[m.cueWarning,m.timingWarning].filter(Boolean).join(' '));$('cue-alert').hidden=!m.cueWarning&&!m.timingWarning;UIPatch.text($('cue-state'),(m.cues||[]).map(c=>`${c.key} ${cueNames[c.state]||c.state} ${c.completed}/${c.total}`).join('；')||'尚无接话记录');const names={'input-final':'确认输入','input-interim':'临时识别','matched-complete':'句末已匹配','matched-partial':'部分匹配','cue-queued':'接话排队','cue-start':'人物就绪','cue-visible':'实际出框','cue-line-done':'台词完成','cue-ready':'交给舞台','cue-duplicate':'跳过重复','scene-rescue':'保险切景重同步','scene-reacquired':'本场重新跟上','manual-next':'人工切段','manual-sentence':'保险下一句','seek':'定位部分'};UIPatch.text($('input-trace'),(m.trace||[]).slice(-20).map(v=>`${(v.at/1000).toFixed(1)}s ${names[v.type]||v.type} ${v.key||v.text||(Number.isInteger(v.index)?'第 '+(v.index+1)+' 部分':'')}${v.waitMs!==undefined?' · 入队后 '+(v.waitMs/1000).toFixed(1)+' 秒出框':''}`).join('\n'));}
$('force-next').onclick=()=>{const m=latestStage;if(!m||$('force-next').disabled)return;if(send('force-sentence',{expectedIndex:m.presentation?.index,expectedSentenceIndex:m.presentation?.sentenceIndex,epoch:m.controlEpoch,scriptSignature:m.scriptSignature})){safetyUntil=Date.now()+1000;renderSafety();setTimeout(renderSafety,1050);}};
$('force-cue').onclick=()=>{const m=latestStage;if(m&&!$('force-cue').disabled)send('force-cue',{expectedTopic:m.topic,epoch:m.controlEpoch});};
$('export-trace').onclick=()=>{if(!latestStage)return;const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),scriptTitle:speechScript?.title,stage:latestStage},null,2)],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='校庆接话诊断.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
setInterval(renderSafety,1000);
$('improv-style').onchange=()=>send('improv-style',{value:$('improv-style').value});
$('model-save').onclick=async()=>{const button=$('model-save');button.disabled=true;try{const response=await fetch('/api/model-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:$('model-key').value})}),result=await response.json();if(!response.ok)throw new Error(result.error?.message);$('model-key').value='';UIPatch.text($('model-result'),result.keySource==='environment'?'已保存；当前优先使用启动环境中的 DEEPSEEK_API_KEY。':'密钥已保存在本机。点击检查模型权限验证连接。');refreshProvider();}catch(error){UIPatch.text($('model-result'),error.message||'配置保存失败');}finally{button.disabled=false;}};
$('model-check').onclick=async()=>{const button=$('model-check');button.disabled=true;UIPatch.text($('model-result'),'正在检查模型权限（不生成台词）…');try{const response=await fetch('/api/model-check',{method:'POST'}),result=await response.json();if(!response.ok)throw new Error(result.error?.message);UIPatch.text($('model-result'),`DeepSeek 模型权限已验证：${result.model}。实际回应需在彩排中检验。`);}catch(error){UIPatch.text($('model-result'),error.message||'检查失败');}finally{button.disabled=false;}};

let stageWindow=null;
$('open-stage').onclick=event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(stageWindow&&!stageWindow.closed){stageWindow.focus();return;}stageWindow=window.open('','stage-screen');$('stage-open-help').hidden=false;if(stageWindow){try{if(stageWindow.location.href==='about:blank')stageWindow.location.replace(new URL('index.html',location.href).href);}catch{stageWindow.location=new URL('index.html',location.href).href;}stageWindow.focus();}};
