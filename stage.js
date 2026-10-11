'use strict';
const realtimeOnly=globalThis.REALTIME_EDITION===true;
let liveStage=null,liveTakeGeneration=0;
const {teachers}=SHOW_DATA,engine=new StageEngine(teachers.length,innerWidth<600?2:3);
engine.readingCpm=220;
const channel=typeof StageChannel==='function'?new StageChannel('stage'):new BroadcastChannel(SHOW_DATA.castId+'-stage');
const stageOrder=SHOW_DATA.stageOrder||teachers.map((_,i)=>i);
const blocking=new InkBlocking(stageOrder),ambientMotion=new AmbientMotion(teachers.length);engine.travelTime=a=>activeScenery&&ActorAnimation.options(activeScenery.actors[a.id].motion).stationary?0:activeScenery&&sceneWalk.enabled(activeScenery.actors[a.id])?650:blocking.travelTime(a);
let speechScript=null,topics=SpeechScript.topics(speechScript,[]),jointFinale=null;
let cueTracker=null,deferredReplyScene=null,dialogueDisplay=new CaptionLayout.DialogueDisplay(null);
let scriptFollower=new ScriptFollower(speechScript),scriptCaptions=new ScriptCaptions(speechScript),followState={matched:false,index:0,sentenceIndex:-1};
const rehearsalPlayer=new RehearsalPlayer(),cueLedger=new CueLedger();
let aiState={mode:'ready',message:''};
const speechSentences=new SpeechSentences(),audienceSubtitles=new AudienceSubtitles(),liveSubtitles=new AudienceSubtitles();
let voiceSession='',voiceActive=false,inputFinalSeq=0;
let manualSceneScope=null,voiceReset=null,sequenceSceneManual=false;
const retiredVoiceSessions=new Set();
let presentation={active:false,source:'',index:0,sentenceIndex:-1},progressCandidate=null,previewRun=null;
const castMotion=new SceneCastMotion(),sceneWalk=new SceneWalkMotion();
let occlusionNodes=[],furnitureNodes=[],sceneryLayerNodes=[],sceneEnteredAt=0,openingSpeechTime=0,desiredShotId='',sceneRetryAt=0;
const openingCast=new OpeningCast();
const actorNodes=[],labelNodes=[],bubbleNodes=[],motionPlayers=[],assetUrls=new Map();
let manualSceneRequest=null;
let sharedScript=null,remoteRehearsal=null,activeScenery=null,scenePlayback=null,sceneForeground=null,shotFollower=null,openingAt=null,entryAt=null,openingTarget=null,shotLoadToken=0,sceneNextAfter=0,sceneBindingWarning='';
const openingLayer=document.createElement('div');openingLayer.className='opening-white';openingLayer.style.opacity='1';document.getElementById('stage').append(openingLayer);
const placeholderLabel=document.createElement('div');placeholderLabel.className='scene-placeholder-title';document.getElementById('stage').append(placeholderLabel);
function preloadSceneImage(src){return new Promise((resolve,reject)=>{const img=new Image(),timer=setTimeout(()=>reject(Error('素材加载超时，保留原画面')),12000);img.onload=async()=>{try{if(typeof img.decode==='function')await img.decode();clearTimeout(timer);resolve();}catch(error){clearTimeout(timer);reject(error);}};img.onerror=()=>{clearTimeout(timer);reject(Error('素材无法读取，保留原画面'));};img.src=src;});}
const sceneDissolve=typeof ScenePlayback==='function'&&ScenePlayback.Dissolve?new ScenePlayback.Dissolve(document.getElementById('stage')):null;
const sceneBlock=typeof JinmenSceneBlock!=='undefined'?new JinmenSceneBlock.Block(document.getElementById('stage')):null;
function isLiveDialogue(){return realtimeOnly||activeScenery?.liveDialogue===true;}
function applyScenery(scene){
 const dissolve=activeScenery?.id!==scene.id&&SceneCatalog.isStaticCast(activeScenery)&&SceneCatalog.isStaticCast(scene);
 if(dissolve)sceneDissolve?.capture();
 sceneBlock?.commit(scene);
 if(activeScenery?.id!==scene.id){
  // Held/fading cards belong to their original scene, never to the new actor's defaults.
  for(const [id,card] of dialogueDisplay.cards)if(!messageInScene(card.message,scene.id))dialogueDisplay.cards.delete(id);
  clearBubblePresentation();
 }
 // A live-only scene owns a fresh input generation. Late audio/model replies
 // from the previous scene must not leak into it (or out of it).
 if(!realtimeOnly&&!manualSceneRequest&&activeScenery?.id!==scene.id&&(isLiveDialogue()||scene.liveDialogue===true)){
  const wasActive=voiceActive;resetPlayback({keepVoice:true});awaitingSection=false;
  if(voiceSession)retiredVoiceSessions.add(voiceSession);
  voiceSession='';speechSentences.seq=0;inputFinalSeq=0;
  voiceReset={token:String(Date.now())+'-'+controlEpoch,epoch:controlEpoch,sceneId:scene.id,kind:'live-scene',liveDialogue:scene.liveDialogue===true,pending:wasActive};
  shotFollower?.seek(shotFollower.index);pause(false);
  trace('live-scene',{sceneId:scene.id,enabled:scene.liveDialogue===true});
 }
 if(namedOpening()&&scene.id===openingSceneId()&&activeScenery?.id!==scene.id)openingCast.reset();
 if(realtimeOnly){scene=structuredClone(scene);if(scene.actors[7])scene.actors[7].present=false;}
 scene=SceneCatalog.visualScene(scene);document.getElementById('stage').classList.toggle('flat-image',SceneCatalog.isFlat(scene));document.getElementById('stage').classList.toggle('static-cast',SceneCatalog.isStaticCast(scene));
 for(const n of occlusionNodes)n.remove();occlusionNodes=[];
 for(const o of scene.occluders||[]){if(!scene.background||o.polygon.length<3)continue;const n=document.createElement('div');n.className='scene-auto-occlusion';n.dataset.occluder=o.name;n.style.backgroundImage=`url("${scene.background}")`;n.style.clipPath='polygon('+o.polygon.map(p=>p.join('% ')+'%').join(',')+')';n.style.zIndex=String(o.layer);document.getElementById('stage').append(n);occlusionNodes.push(n);}
 for(const n of sceneryLayerNodes)n.remove();sceneryLayerNodes=[];
 for(const layer of scene.sceneryLayers||[]){if(layer.visible===false||!layer.asset)continue;const n=document.createElement('img');n.className='scene-static-layer';n.src=layer.asset;n.alt='';n.dataset.layerId=layer.id;n.style.zIndex=String(layer.layer);document.getElementById('stage').append(n);sceneryLayerNodes.push(n);}
 for(const n of furnitureNodes)n.remove();furnitureNodes=[];
 scene.actors.forEach(a=>{if(!a.furniture||a.bodyClip?.length<3||!a.poses.idle)return;const n=document.createElement('img');n.className='scene-static-furniture';n.src=a.poses.idle;n.dataset.actor=String(a.id);n.alt='';const points=a.bodyClip.map(p=>p.join('% ')+'%');n.style.clipPath='polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,'+points.join(',')+','+points[0]+')';n.style.zIndex=String(a.furnitureLayer??a.layer-1);document.getElementById('stage').append(n);furnitureNodes.push(n);});
 castMotion.cut(scene.actors,performance.now());sceneEnteredAt=performance.now();sceneWalk.reset(scene.actors,engine.time,{entryAt:openingAt!==null?openingSpeechTime:engine.time});
 actorNodes.forEach((n,i)=>{
  const a=scene.actors[i],key=SceneCatalog.actorVisualKey(scene,a);
  // The same artwork can move to its next authored mark without decoding again.
  if(n.dataset.assetKey===key){if(motionPlayers[i]?.actor)motionPlayers[i].actor=a;return;}
  const previous=n.querySelector('.art'),oldPlayer=motionPlayers[i];
  const art=document.createElement('div');art.className=a.entry==='fade'?'art asset-enter':'art';
  if(a.embedded){motionPlayers[i]=null;}
  else if(a.poses.idle){const image=document.createElement('img');image.className='custom-avatar';image.src=a.poses.idle;image.alt=teachers[i].name;art.append(image);motionPlayers[i]=typeof ActorAnimationPlayer!=='undefined'&&ActorAnimation.active(a)?new ActorAnimationPlayer(art,a,{highResolution:SceneCatalog.isStaticCast(scene)}):typeof ActorPetPlayer!=='undefined'&&ActorAnimation.options(a.motion).enabled?new ActorPetPlayer(art,a):null;}
  else if(scene.fallbackStanding){art.innerHTML=typeof INK_CAST!=='undefined'?'<div class="ink-motion">'+inkAvatarMarkup(i)+'</div>':makeAvatar(teachers[i],i);motionPlayers[i]=typeof INK_CAST!=='undefined'?new InkPortrait(art,INK_CAST[i],i):null;}
  else{const empty=document.createElement('span');empty.className='scene-avatar-placeholder';empty.textContent=teachers[i].name+' · 素材待补';art.append(empty);motionPlayers[i]=null;}
  oldPlayer?.destroy();previous.remove();n.append(art);n.dataset.assetKey=key;setTimeout(()=>art.classList.remove('asset-enter'),420);
 });
 if(!sceneForeground){sceneForeground=document.createElement('img');sceneForeground.className='scene-foreground';document.getElementById('stage').append(sceneForeground);}sceneForeground.hidden=!scene.foreground;sceneForeground.style.zIndex=String(scene.foregroundLayer??110);if(scene.foreground)sceneForeground.src=scene.foreground;
 activeScenery=scene;placeholderLabel.textContent=scene.placeholder||'';placeholderLabel.hidden=!scene.placeholder;document.querySelector('.print-background').style.backgroundColor=scene.placeholder?'#fff3c4':'#fff';document.querySelector('.print-background').style.backgroundImage=scene.background?`url("${scene.background}")`:'none';document.querySelector('.print-background').style.backgroundSize='contain';
 if(manualSceneRequest?.sceneId===scene.id){manualSceneRequest=null;syncSceneSpeech(scene.id);}
 document.getElementById('stage').classList.add('show-import');document.getElementById('stage').classList.remove('scene-loading');
 // Position the entire new cast before exposing its background.
 if(dissolve){render();sceneDissolve?.reveal();}
}
let scheduledCue=null,manualCues=[],allowImprov=false;
let liveQueuedAt=-Infinity;const liveReplyStats={requests:0,completed:0,dropped:0,lastResult:'',lastSentAt:null};
function liveReplyStatus(){return {version:41,enabled:allowImprov,style:improvStyle,queued:speechSentences.queue.length,inFlight:pipeline.inFlight,ready:Boolean(pipeline.pending),finalInput:lastSpeechFinal,...liveReplyStats};}
let lastSpeechAt=-Infinity,lastSpeechFinal=true,improvStyle='dialogue',lastScene='';
let inputFloor=0,controlEpoch=0,nextAdvanceAt=0,awaitingSection=false;
let cueTail='',stableCandidates=[],stableSince=0,cueWarning='';
function replyDiagnostics(){
 const waiting=[...engine.queue,...manualCues.flatMap(c=>c.messages.map(m=>({...m,cueKey:c.key,queuedAt:c.queuedAt})))],blocked=engine.actors.filter(a=>a.phase==='speaking'&&a.captionBlocked).map(a=>({actor:a.id,key:a.message?.cueKey,waitMs:Math.round(engine.time-(a.captionBlockedSince??engine.time))}));
 const pending=waiting.length,oldestWaitMs=Math.round(Math.max(0,...waiting.map(m=>engine.time-(m.queuedAt??engine.time))));
 return {pendingLines:pending,pendingGroups:new Set(waiting.map(m=>m.cueKey)).size,oldestWaitMs,blocked,viewport:{width:w,height:h},waitingFor:blocked.length?'caption-layout':manualCues[0]&&speechScript?.blocks[manualCues[0].index]?.sceneId!==activeScenery?.id?'scene':waiting.some(m=>engine.actors[m.actor]?.phase==='speaking')?'actor':pending?'stagger-or-capacity':''};
}
const inputTrace=[],cueEvents=[];
function trace(type,detail={}){inputTrace.push({at:Math.round(performance.now()),type,...detail});if(inputTrace.length>100)inputTrace.shift();if(['cue-queued','cue-visible','cue-line-done'].includes(type)){cueEvents.push(inputTrace.at(-1));if(cueEvents.length>600)cueEvents.shift();}}
engine.onMessageStart=m=>{dialogueDisplay.started(m,engine.time,engine.duration(engine.actors[m.actor]));if(m.cueKey){cueLedger.start(m.cueKey,m.cueLine);trace('cue-start',{key:m.cueKey,line:m.cueLine});status();if(previewRun){const si=speechScript.blocks[previewRun.index].sentences.findIndex(s=>`${previewRun.index}:${s.id}`===m.cueKey);if(si>=0){const shot=SceneScript.rowFor(shotFollower?.rows||[],previewRun.index,si);if(shot>=0&&shotFollower.rows[shot].sceneId!==activeScenery?.id){shotFollower.seek(shot);cutShot(shotFollower.rows[shot]);}setPresentation(previewRun.index,si,'preview');}}}};
engine.onMessageEnd=m=>{dialogueDisplay.finished(m,engine.time);if(m.cueKey){cueLedger.finish(m.cueKey,m.cueLine);trace('cue-line-done',{key:m.cueKey,line:m.cueLine});status();}};
engine.canStart=(m,now)=>dialogueDisplay.canStart(m,now);
let turn=0,speed=1,lastTime=0,w=innerWidth,h=innerHeight,roundCursor=0;
function invite(id){if(isLiveDialogue())return false;const line=topics[engine.topic]?.replies?.find(m=>m.actor===id);if(line)cancelImprov();return line?engine.enqueue({...line,replyTo:null,topic:engine.topic,source:'演练预备'}):false;}
function inviteNext(){if(speechScript?.blocks){const actor=topics[engine.topic]?.replies?.[0]?.actor;return Number.isInteger(actor)?invite(actor):false;}for(let j=0;j<teachers.length;j++){const id=turn++%teachers.length;if(engine.actors[id].phase==='idle'&&!engine.queue.some(m=>m.actor===id))return invite(id);}return false;}
function inviteGroup(){if(isLiveDialogue())return;if(speechScript?.blocks){playPrepared(engine.topic);return;}for(let j=0,n=0;j<teachers.length&&n<engine.capacity;j++){const id=turn++%teachers.length;if(engine.actors[id].phase==='idle'&&!engine.queue.some(m=>m.actor===id)){invite(id);n++;}}}
function pause(value){engine.paused=value;document.body.classList.toggle('paused',value);}
function timingWarning(){const late=engine.queue.filter(m=>Number.isInteger(m.section)&&m.section<engine.topic).length+engine.actors.filter(a=>a.phase==='speaking'&&Number.isInteger(a.message?.section)&&a.message.section<engine.topic).length+manualCues.filter(c=>c.index<engine.topic).reduce((n,c)=>n+c.messages.length,0);return late?`上段仍有 ${late} 条台词，已标记时间冲突。`:'';}
function availableImprovActors(){if(!isLiveDialogue())return [];return SpeechScript.improvActors(null,engine.topic,engine.actors.filter(a=>a.phase!=='idle').map(a=>a.id),followState.index===engine.topic?followState.sentenceIndex:0).filter(id=>!activeScenery||activeScenery.actors?.[id]?.present===true);}
function sceneProgress(){if(isLiveDialogue())return {code:activeScenery.id.startsWith('sc-q925-')?activeScenery.id.slice(8).toUpperCase():activeScenery.name,sceneId:activeScenery.id,name:activeScenery.name,liveDialogue:true,current:0,total:0,groups:[]};if(CuePlan.sequenceMode(speechScript))return CuePlan.sequenceProgress(speechScript,{...presentation,index:presentation.sentenceIndex>=0?presentation.index:engine.topic},cueLedger.snapshot());return SceneScript.progress(scenePlayback?.prepared?.catalog,shotFollower?.rows||[],speechScript,activeScenery?.id,presentation,cueLedger.snapshot());}
function status(){if(realtimeOnly){channel.postMessage({type:'status',stageVersion:13,realtime:liveStage?.snapshot(),scenery:scenePlayback?.snapshot(),queue:engine.queue.length,paused:engine.paused,actors:engine.actors.map(a=>({id:a.id,phase:a.phase,captionVisible:a.phase==='speaking'&&!a.captionBlocked,text:a.message?.text||''}))});return;}channel.postMessage({type:'status',realtime:liveStage?.snapshot(),openingCast:openingCast.snapshot(),frontendTrial:typeof FrontendTrial!=='undefined'?{mode:FrontendTrial.mode(),source:FrontendTrial.source,baseline:FrontendTrial.baseline}:null,flatImageVersion:46,stageVersion:13,sceneTransition:{version:2,durationMs:sceneDissolve?.duration||0},liveDialogueVersion:2,liveReply:isLiveDialogue()?liveReplyStatus():null,improvScope:realtimeOnly?'all_scenes':'live_scene_only',playbackVersion:30,cueGuardVersion:4,sequenceScriptVersion:2,captionVersion:46,captionMode:isLiveDialogue()?(allowImprov?'realtime':'off'):'manuscript',bubbleEditorVersion:3,chorusBubbleVersion:1,sceneBlock:sceneBlock?.snapshot(),animation:{configured:motionPlayers.filter(p=>p?.pack||p?.kind==='pet').length,ready:motionPlayers.filter(p=>(p?.pack||p?.kind==='pet')&&p.last).length,frames:motionPlayers.reduce((n,p)=>n+(p?.framesDrawn||0),0),failedFrames:motionPlayers.reduce((n,p)=>n+(p?.images?[...p.images.values()].filter(r=>r.error).length:0),0)},sentenceAdvanceVersion:2,sceneResyncVersion:1,voiceReset,recognitionScope:manualSceneScope,captionContinuations:dialogueDisplay.snapshot(),replyFlow:replyDiagnostics(),cueEvents,cueTracking:cueTracker?.snapshot(),scenery:{...scenePlayback?.snapshot(),liveDialogue:isLiveDialogue(),shot:shotFollower?.snapshot(),ready:Boolean(scenePlayback?.prepared),bindingWarning:sceneBindingWarning,progress:sceneProgress()},scriptReady:sharedSync.revision!==undefined,scriptSignature:SpeechCalibration.signature(speechScript),cueWarning,timingWarning:timingWarning(),inputSession:voiceSession,inputSeq:speechSentences.seq,inputFinalSeq,controlEpoch,awaitingSection,cues:cueLedger.snapshot(),trace:inputTrace.slice(-100),improvActors:availableImprovActors(),presentation:{...presentation,liveDialogue:isLiveDialogue(),sceneName:activeScenery?.name},follow:{...followState,active:voiceActive},rehearsal:{liveDialogue:isLiveDialogue(),active:rehearsalPlayer.active,index:engine.topic,total:speechScript?.blocks?.length||0,sentenceIndex:rehearsalPlayer.sentenceIndex,phase:rehearsalPlayer.phase},topic:engine.topic,paused:engine.paused,auto:false,ai:aiState,speed,capacity:engine.capacity,queue:engine.queue.length,speechQueue:speechSentences.queue.length+(pipeline.pending?1:0)+(pipeline.inFlight?1:0),speechCaption:audienceCaption(),speechRawCaption:speechSentences.caption(),speechPreview:speechSentences.preview(),actors:engine.actors.map(a=>({id:a.id,phase:a.phase,captionVisible:a.phase==='speaking'&&!a.captionBlocked,captionBlocked:Boolean(a.captionBlocked),cueKey:a.message?.cueKey,cueLine:a.message?.cueLine,text:a.phase==='speaking'?a.message?.text:''}))});}
for(let i=0;i<teachers.length;i++){
 const t=teachers[i],el=document.createElement('div');el.className='actor';el.setAttribute('role','img');el.setAttribute('aria-label',t.name);el.style.setProperty('--idle-tilt',`${[.32,.48,.24,.20][i]||.3}deg`);el.style.setProperty('--express-tilt',`${[.65,1.1,.8,.5][i]||.6}deg`);el.dataset.phase='idle';el.dataset.assetKey='standing';el.style.setProperty('--delay',`${-i*1.43}s`);el.style.setProperty('--breathe',`${3.4+i*.31}s`);el.style.setProperty('--blink',`${4.3+i*.47}s`);el.innerHTML=`<div class="actor-shadow"></div><div class="art">${typeof INK_CAST!=='undefined'?'<div class="ink-motion">'+inkAvatarMarkup(i)+'</div>':makeAvatar(t,i)}</div><span class="thought">···</span><span class="nameplate">${t.name}</span>`;document.getElementById('actors').append(el);actorNodes.push(el);const seal=el.querySelector('.nameplate');document.getElementById('labels').append(seal);labelNodes.push(seal);seal.style.opacity='0';
 const key=(t.art||'').split('/').pop().replace(/\.png$/,'').replace('galileo-v2','galileo');const motionAsset=typeof MOTION_ASSETS!=='undefined'?MOTION_ASSETS[key]:null;motionPlayers.push(typeof INK_CAST!=='undefined'?new InkPortrait(el.querySelector('.art'),INK_CAST[i],i):(motionAsset?new MotionPortrait(el.querySelector('.art'),motionAsset):null));
 const bubble=DialogueOverlay.createCard(document,i,t.name);document.getElementById('bubbles').append(bubble);bubbleNodes.push(bubble);
}
function applyAsset(target,data){if(typeof data!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(data))return;if(target==='background'){document.querySelector('.print-background').style.backgroundImage=`url("${data}")`;document.getElementById('stage').classList.add('show-import');}else{const id=Number(target);if(!actorNodes[id])return;motionPlayers[id]?.destroy();motionPlayers[id]=null;const img=document.createElement('img');img.src=data;img.className='custom-avatar';img.alt=teachers[id].name;actorNodes[id].querySelector('.art').replaceChildren(img);}}
channel.onmessage=({data:m})=>{
 if(m?.type==='channel-state'){const banner=document.getElementById('stage-connection');if(banner){banner.hidden=m.active;banner.querySelector('span').textContent=m.connected===false?'本机服务已断开，正在重连…':realtimeOnly?'这是备用大屏，接管后显示本页的实时场景。':'这是备用大屏。接管将从本页当前段开始。';banner.querySelector('button').hidden=m.connected===false;}if(m.active){channel.postMessage({type:'stage-ready'});status();}return;}
 if(!m||m.type!=='command')return;
 if(realtimeOnly){if(['hello','stage-pulse'].includes(m.action)){if(document.hidden)advanceClock(performance.now());status();}else liveStage?.command(m);return;}
 if(isLiveDialogue()&&['force-next','force-sentence','force-cue','rehearsal-start','rehearsal-discuss','rehearsal-cue','scene-next'].includes(m.action))return;
 if(jointFinale?.command(m))return;
 if(jointFinale?.active&&!['hello','stage-pulse','asset','reset-art','speech-script','script-improv'].includes(m.action))return;
 switch(m.action){
 case 'scene-take':takeManualScene(m.sceneId,m.revision);return;
 case 'scene-reload':loadShotScenes();return;
 case 'scene-next':if(shotFollower&&performance.now()>=sceneNextAfter&&(m.expectedIndex===undefined||m.expectedIndex===shotFollower.index)){const actual=shotFollower.rows.findIndex(r=>r.sceneId===activeScenery?.id),next=shotFollower.started?(actual>=0?actual:shotFollower.index)+1:0;if(shotFollower.rows[next]){sceneNextAfter=performance.now()+800;rescueScene(next);}}return;
 case 'scene-reset':resetPlayback({keepVoice:true});cueLedger.clear();inputFloor=0;awaitingSection=false;engine.topic=0;resetShotScenes();return;
 case 'scene-cancel':scenePlayback?.cancel();return;
 case 'frontend-bubbles':if(typeof FrontendTrial!=='undefined'&&FrontendTrial.set(m.value)){bubbleLayoutKey='';bubbleLayout=[];bubbleNodes.forEach(b=>{b.dataset.pageKey='';b._colleagueKey='';b._colleagueReveals=[];b.classList.remove('colleague-bubble');b.removeAttribute('data-connected');});render();}break;
 case 'hello': if(document.hidden)advanceClock(performance.now());status();jointFinale?.syncStatus();return;
 case 'stage-pulse': advanceWithoutFrame(performance.now());status();return;
 case 'play':pause(!engine.paused);break;
 case 'join':inviteNext();pause(false);break;
 case 'burst':inviteGroup();pause(false);break;
 case 'invite':if(Number.isInteger(m.actor)&&teachers[m.actor]){invite(m.actor);pause(false);}break;
 case 'clear':resetShotScenes();resetPlayback({keepVoice:true});cueLedger.clear();inputFloor=0;awaitingSection=false;pause(false);trace('reset');break;
 case 'rehearsal-start':if(!voiceActive&&speechScript?.blocks){resetPlayback();cueLedger.clear();inputFloor=0;awaitingSection=false;engine.setTopic(0);resetShotScenes();const timeline=shotFollower?.rows;const script=timeline?.length?{blocks:timeline.map(row=>({sentences:SpeechScript.splitSource(row.text).map((text,i)=>({id:`shot-${i}`,text,replies:[],holdMs:0}))}))}:speechScript;rehearsalPlayer.start(cueTracker?speechScript:script,0,{realtime:true,streaming:Boolean(cueTracker||timeline?.length)});rehearsalTranscript='';setPresentation(0,0,'rehearsal');testInput.readOnly=true;document.getElementById('test-composer').classList.add('voice-caption');pause(false);}break;
 case 'rehearsal-discuss':playPrepared(m.index);break;
 case 'rehearsal-cue':playPrepared(m.index,m.sentenceIndex);break;
 case 'improv-style':if(['dialogue','motion'].includes(m.value)&&improvStyle!==m.value){improvStyle=m.value;cancelImprov();}break;
 case 'voice-activity':if(isLiveDialogue()&&improvStyle!=='motion')break;if(m.session===voiceSession&&m.epoch===controlEpoch){lastSpeechAt=performance.now();lastSpeechFinal=false;cancelImprov();if(speechScript)speechSentences.queue=[];}break;
 case 'script-improv':{
  const enabled=m.enabled===true;
  if(enabled!==allowImprov){
   speechSentences.queue=[];
   if(isLiveDialogue()){
    // Start with fresh speech after reopening, while preserving the ASR sequence
    // guard and the independently running microphone/diagnostic transcript.
    speechSentences.tail='';speechSentences.interim='';speechSentences.lastCaption='';
    liveSubtitles.reset();testInput.value='';inputScheduler.cancel(performance.now(),'');
   }
  }
  allowImprov=enabled;if(!allowImprov)cancelImprov();
  if(isLiveDialogue())liveCaption.textContent=audienceCaption();
 }break;
 case 'rehearsal-stop':if(voiceActive)break;resetPlayback();pause(false);break;
 case 'rehearsal-sync':rehearsalSync.invalidate();break;
 case 'speech-script':replaceSpeechScript(m.script);break;
 case 'topic':if(Number.isInteger(m.topic)&&topics[m.topic])seekSection(m.topic);break;
 case 'force-next':if(m.expectedTopic===engine.topic&&m.epoch===controlEpoch&&performance.now()>=nextAdvanceAt&&topics[engine.topic+1]){nextAdvanceAt=performance.now()+1200;seekSection(engine.topic+1,{waitForMatch:true});pause(false);trace('manual-next',{index:engine.topic});}break;
 case 'force-sentence':if(m.epoch===controlEpoch&&m.scriptSignature===SpeechCalibration.signature(speechScript)&&m.expectedIndex===presentation.index&&m.expectedSentenceIndex===presentation.sentenceIndex&&performance.now()>=nextAdvanceAt&&!rehearsalPlayer.active){if(advanceManualSentence()){nextAdvanceAt=performance.now()+800;pause(false);}}break;
 case 'force-cue':if(m.expectedTopic===engine.topic&&m.epoch===controlEpoch){const group=cueTracker?.rows.slice(cueTracker.floor).find(u=>speechScript.blocks[u.index].sentences[u.sentenceIndex].replies.length&&!cueLedger.has(u.key))||sceneProgress()?.groups?.find(u=>!cueLedger.has(u.key));const index=group?.index??engine.topic,si=group?.sentenceIndex??(sceneProgress()?-1:speechScript?.blocks[index]?.sentences.findIndex(v=>v.replies.length&&!cueLedger.has(`${index}:${v.id}`)));if(si>=0){cancelImprov();queueCue(index,si);advanceManualCues();pause(false);}}break;
 case 'speed':if([.75,1,1.5].includes(m.value))speed=m.value;break;
 case 'capacity':if([1,2,3].includes(m.value)){cancelImprov();engine.capacity=m.value;}break;
 case 'pose-preview':if(Number.isInteger(m.actor)&&teachers[m.actor]){resetPlayback();engine.enqueue({actor:m.actor,text:'动作预览',topic:engine.topic,source:'动作预览',action:m.pose,durationMs:20000});pause(false);}break;
 case 'say':cancelImprov();if(engine.enqueue({actor:m.actor,text:m.text,topic:engine.topic,source:'现场提示'}))pause(false);break;
 case 'voice-state':if(retiredVoiceSessions.has(m.session)||voiceReset?.pending&&m.active&&m.resetToken!==voiceReset.token)break;if(voiceReset?.pending&&m.active&&m.session){voiceReset.pending=false;}voiceActive=m.active===true;if(voiceActive){rehearsalPlayer.stop();previewRun=null;}if(presentation.source==='speech')presentation.active=voiceActive;testInput.readOnly=voiceActive;document.getElementById('test-composer').classList.toggle('voice-caption',voiceActive);if(!voiceActive)inputScheduler.cancel(performance.now(),testInput.value);if(m.session&&m.session!==voiceSession){voiceSession=m.session;cueTracker?.restartInput();inputFinalSeq=0;speechSentences.seq=0;speechSentences.interim='';cueTail='';stableCandidates=[];scriptFollower.seek(Math.max(inputFloor,engine.topic),presentation.index===engine.topic?Math.max(0,presentation.sentenceIndex):0);followState={...scriptFollower.last};}break;
 case 'voice-transcript':
  if(voiceReset?.pending||!Number.isInteger(m.seq)||typeof m.text!=='string'||m.text.length>6000||m.session!==voiceSession||m.seq<=speechSentences.seq||(m.epoch!==undefined&&m.epoch!==controlEpoch))break;
  if(speechScript&&(!isLiveDialogue()||improvStyle==='motion')){cancelImprov();speechSentences.queue=speechSentences.queue.filter(isScriptInput);}
  lastSpeechAt=performance.now();lastSpeechFinal=m.final===true;
  if(m.source==='doubao-input'&&m.final)speechSentences.tail='';
  speechSentences.update(m);if((m.source==='doubao-input'||isLiveDialogue())&&m.final&&speechSentences.tail.trim()){speechSentences.queue.push(speechSentences.tail.trim());speechSentences.tail='';}if(m.final)inputFinalSeq=m.seq;followSpeech(m);testInput.value=speechSentences.preview();liveCaption.textContent=audienceCaption();
  if(!isLiveDialogue()||mainlineBusy()||awaitingSection||!allowImprov)speechSentences.queue=[];else{if(m.final&&speechSentences.queue.length)liveQueuedAt=performance.now();liveReplyStats.dropped+=Math.max(0,speechSentences.queue.length-1);speechSentences.queue=speechSentences.queue.slice(-1);}
  if(speechSentences.queue.length>24)channel.postMessage({type:'voice-overflow'});
  break;
 case 'voice-confirm':if(!voiceActive&&speechSentences.preview().trim()){speechSentences.queue.push(speechSentences.preview().trim());if(isLiveDialogue()){liveQueuedAt=performance.now();speechSentences.queue=speechSentences.queue.slice(-1);}speechSentences.tail='';speechSentences.interim='';testInput.value='';}break;
 case 'asset':if(activeScenery)break;applyAsset(m.target,m.data);break;
 case 'reset-art':if(activeScenery)break;lastScene='';document.querySelector('.print-background').style.backgroundImage='';document.getElementById('stage').classList.remove('show-import');actorNodes.forEach((el,i)=>{motionPlayers[i]?.destroy();el.querySelector('.art').innerHTML=typeof INK_CAST!=='undefined'?'<div class="ink-motion">'+inkAvatarMarkup(i)+'</div>':makeAvatar(teachers[i],i);const key=(teachers[i].art||'').split('/').pop().replace(/\.png$/,'').replace('galileo-v2','galileo');motionPlayers[i]=typeof INK_CAST!=='undefined'?new InkPortrait(el.querySelector('.art'),INK_CAST[i],i):(typeof MOTION_ASSETS!=='undefined'&&MOTION_ASSETS[key]?new MotionPortrait(el.querySelector('.art'),MOTION_ASSETS[key]):null);});break;
 }
 status();
};
function isFullscreen(){return Boolean(document.fullscreenElement)||document.getElementById('stage').classList.contains('preview-fullscreen');}
function render(){
 if(w<240||h<180)return;
 const planned=ScenePlan.resolve(speechScript?.blocks?.[engine.topic]?.scene);if(!activeScenery&&!document.getElementById('stage').classList.contains('scene-loading')&&lastScene!==planned.id){lastScene=planned.id;document.querySelector('.print-background').style.backgroundImage=`url("${planned.image}")`;}
 blocking.update(engine.time,engine.actors);
 const scene=sceneRect(w,h,activeScenery?.backgroundAspect||2,isFullscreen()),zone=activeScenery?.presenter,reserved=zone?{left:scene.left+scene.width*zone.x/100,top:scene.top+scene.height*zone.y/100,width:scene.width*zone.width/100,height:scene.height*zone.height/100}:presenterZone(w,h),background=document.querySelector('.print-background'),sceneryTransform=typeof SceneCatalog!=='undefined'?SceneCatalog.backgroundStyle(activeScenery,scene.width,scene.height):{};
 for(const n of occlusionNodes)Object.assign(n.style,{left:scene.left+'px',top:scene.top+'px',width:scene.width+'px',height:scene.height+'px',...sceneryTransform});
 for(const n of sceneryLayerNodes){const layer=activeScenery.sceneryLayers.find(item=>item.id===n.dataset.layerId),bh=scene.height*.285*layer.scale,bw=bh*layer.aspect;Object.assign(n.style,{left:scene.left+scene.width*layer.x/100-bw/2+'px',top:scene.top+scene.height*layer.y/100-bh+'px',width:bw+'px',height:bh+'px'});}
 for(const n of furnitureNodes){const a=activeScenery.actors[Number(n.dataset.actor)],bh=scene.height*.285*a.scale,bw=bh*a.aspect;Object.assign(n.style,{left:scene.left+scene.width*a.x/100-bw/2+'px',top:scene.top+scene.height*a.y/100-bh+'px',width:bw+'px',height:bh+'px'});}
 Object.assign(background.style,{left:scene.left+'px',top:scene.top+'px',width:scene.width+'px',height:scene.height+'px',...sceneryTransform});
 const captionLeft=reserved.left+reserved.width,composer=document.getElementById('test-composer');
 composer.style.left=(captionLeft+(w-captionLeft)/2)+'px';composer.style.width=Math.min(840,w-captionLeft-32)+'px';
 if(activeScenery&&sceneForeground)Object.assign(sceneForeground.style,{left:scene.left+'px',top:scene.top+'px',width:scene.width+'px',height:scene.height+'px',...sceneryTransform});
 sceneBlock?.layout(scene);sceneBlock?.update(engine.actors,engine.paused);
 if(sceneBlock?.active&&SceneCatalog.isDynamic(activeScenery)){activeScenery.sceneBlock.anchors=sceneBlock.active.anchors;activeScenery=SceneCatalog.visualScene(activeScenery);}
 const paper=[],figures=[],flat=typeof SceneCatalog!=='undefined'&&SceneCatalog.isFlat(activeScenery),free=typeof SceneCatalog!=='undefined'&&SceneCatalog.freeBubbles(activeScenery);
 const clipCast=typeof SceneCatalog!=='undefined'&&SceneCatalog.isStaticCast(activeScenery);Object.assign(document.getElementById('actors').style,{position:clipCast?'absolute':'',inset:clipCast?'0':'',clipPath:clipCast?`inset(${scene.top}px ${w-scene.left-scene.width}px ${h-scene.top-scene.height}px ${scene.left}px)`:''});
 document.getElementById('stage').style.setProperty('--bubble-limit',Math.max(80,Math.min(h-110,scene.height*.65))+'px');
 Object.assign(placeholderLabel.style,{left:scene.left+'px',top:(scene.top+scene.height*.2)+'px',width:scene.width+'px'});
 engine.actors.forEach((a,i)=>{
  const el=actorNodes[i],slot=activeScenery?.actors[i],base=blocking.position(a,engine.progress(a)),stationary=Boolean(slot&&typeof ActorAnimation!=='undefined'&&ActorAnimation.options(slot.motion).stationary),walk=!stationary&&sceneWalk.enabled(slot)?sceneWalk.sample(i,a,engine.time,engine.progress(a)):null,smooth=walk||(slot?castMotion.sample(i,performance.now()):null),pos=slot?scenePosition(slot,smooth,a,walk||stationary?0:engine.progress(a),scene,w,h):base,height=scene.height*.285,width=height*(slot?.embedded?slot.aspect:(smooth?.aspect||2/3)),x=sceneActorX(i,scene.left+pos.x*scene.width,scene,nowEntry()),foot=scene.top+pos.y*scene.height;if(walk){pos.walking=walk.walking;pos.travel=walk.travel;}
  const introOpacity=namedOpening()&&activeScenery?.id===openingSceneId()?openingCast.opacity(i,performance.now()):1;const cast=slot?castMotion.sample(i,performance.now()):null,shown=(!cast||cast.opacity>0)&&introOpacity>0;el.hidden=!shown||Boolean(slot?.embedded);labelNodes[i].hidden=flat||!shown||Boolean(slot?.unanchored);const candidateMessage=dialogueDisplay.message(a,engine.time),displayMessage=messageInScene(candidateMessage,activeScenery?.id)?candidateMessage:null;if(!displayMessage)a.captionBlocked=false;labelNodes[i].style.transition=clipCast?'none':'opacity .3s';el.style.opacity=String(introOpacity*(cast?.opacity??1)*(walk?.opacity??1)*(slot?.entry==='fade'?Math.max(0,Math.min(1,(performance.now()-sceneEnteredAt)/450)):1));labelNodes[i].style.opacity=String(introOpacity*(cast?.opacity??1)*(walk?.enteringPath?0:1)*(slot?1:Math.max(0,Math.min(1,x/40,(w-x)/40))));if(!shown){bubbleNodes[i].classList.remove('visible');bubbleNodes[i].setAttribute('aria-hidden','true');return;}
  if(slot){const image=el.querySelector('.custom-avatar'),src=(walk?.walking?(walk.travel<0?slot.poses.walkLeft:slot.poses.walkRight):!stationary&&['left','right'].includes(slot?.entry)&&performance.now()-sceneEnteredAt<900?(slot.entry==='right'?slot.poses.walkLeft:slot.poses.walkRight):a.message?.action==='walk-left'?slot.poses.walkLeft:a.message?.action==='walk-right'?slot.poses.walkRight:a.phase==='speaking'?slot.poses.speaking:'')||slot.poses.idle;if(image){if(src&&image.getAttribute('src')!==src)image.src=src;image.style.transform=slot.facing==='left'?'scaleX(-1)':'';image.style.clipPath=slot.bodyClip?.length>=3?'polygon('+slot.bodyClip.map(p=>p.join('% ')+'%').join(',')+')':'';image.style.maskImage=slot.personMask&&!slot.maskDisabled?`url("${slot.personMask}")`:'';image.style.webkitMaskImage=image.style.maskImage;image.style.maskSize='100% 100%';image.style.webkitMaskSize='100% 100%';}}
  el.style.width=width+'px';el.style.height=height+'px';el.style.setProperty('--label-scale',String(1/pos.scale));el.style.transform=`translate(${x-width/2}px,${foot-height}px) scale(${pos.scale})`;el.style.zIndex=String(slot?slot.layer:Math.round(pos.y*100));el.dataset.phase=a.phase;if(flat||!slot?.unanchored)figures.push({id:i,x,foot,width:width*pos.scale,height:height*pos.scale});
  el.dataset.seated=String(slot?.mobility==='seated');
  const walking=!stationary&&((['left','right'].includes(slot?.entry)&&performance.now()-sceneEnteredAt<900)||pos.walking||(!slot&&!a.message?.improv&&['entering','leaving'].includes(a.phase))),look=blocking.gaze(a,engine.actors)||(walking?pos.travel:0);el.dataset.walking=String(walking);el.dataset.looking=look<0?'left':look>0?'right':'front';
  const preview=a.message?.source==='动作预览'||a.message?.actionOnly?a.message.action:undefined,autoPose=!preview&&!walking&&!look&&(!a.message?.action||a.message.action==='idle')?ambientMotion.pose(a,engine.time):null;
  el.dataset.autoPose=autoPose?['idle','blink','nod','left','right'][autoPose.frame]:'';
  if(slot){Object.assign(el.querySelector('.art').style,SceneCatalog.cutoutStyle(slot));if(typeof PetMotion!=='undefined')Object.assign(el.querySelector('.actor-shadow').style,PetMotion.shadowStyle(slot));}
  if(motionPlayers[i]?.drawState)motionPlayers[i].drawState({phase:a.phase,walking:!stationary&&walking,travel:pos.travel,preview,actionOnly:Boolean(a.message?.actionOnly||a.message?.source==='动作预览')},engine.time);else motionPlayers[i]?.draw(autoPose||motionPose(pos.walking?{...a,phase:'entering'}:a,{time:engine.time,look,travel:pos.travel,preview}),engine.time);
  const b=bubbleNodes[i],warmup=namedOpening()&&activeScenery?.id===openingSceneId(),visible=!warmup&&Boolean(displayMessage)&&dialogueDisplay.canReveal(displayMessage,engine.time)&&displayMessage.source!=='动作预览'&&!displayMessage.actionOnly&&(!displayMessage.chorus||!engine.actors.some(other=>other.id<i&&dialogueDisplay.message(other,engine.time)?.chorus));if(warmup||!messageInScene(b.displayMessage,activeScenery?.id))b.fadeUntil=0;else if(b.classList.contains('visible')&&!visible)b.fadeUntil=engine.time+420;if(visible){b.displayMessage=displayMessage;b.fadeUntil=0;}b.classList.toggle('visible',visible);b.setAttribute('aria-hidden',String(!visible));
  if(displayMessage){b.dataset.presentation=presentationFor(displayMessage);const who=b.querySelector('.bubble-who'),name=displayMessage.source==='连接提示'?'连接提示':teachers[i].name;if(who.textContent!==name)who.textContent=name;b.dataset.long=String(displayMessage.text.length>85);}

  b.querySelector('.bubble-who').textContent='';
  // A disappearing bubble must stay attached throughout the return walk too.
  if(visible||b.fadeUntil>engine.time){const message=visible?displayMessage:b.displayMessage;paper.push(DialogueOverlay.decorate({id:i,...speechAnchor({x,foot,width:width*pos.scale,height:height*pos.scale},slot),text:(!flat&&slot?.unanchored?teachers[i].name+'：':'')+message.text,hideTail:!flat&&Boolean(slot?.unanchored),message,fading:!visible,maxHeight:b.captionFit?.message===message&&b.captionFit.width===w&&b.captionFit.height===h?b.captionFit.maxHeight:null,presentation:b.dataset.presentation},DialogueOverlay.resolve(activeScenery,slot,message),scene));}else if(a.phase==='speaking')a.captionBlocked=Boolean(displayMessage)&&!visible&&!displayMessage.chorus;
 });
 if(!free&&typeof FrontendTrial!=='undefined'&&FrontendTrial.colleague())paper.splice(0,paper.length,...FrontendTrial.prepare(paper,activeScenery?.id));
 for(let i=0;i<paper.length;i++)paper[i]=DialogueOverlay.chorusItem(activeScenery,paper[i],figures,scene);
 const trialSilhouette=id=>(sceneBlock?.active?.anchors?.[id]?.silhouette||[]).map(b=>({actorId:id,left:scene.left+b[0]*scene.width/100,top:scene.top+b[1]*scene.height/100,width:b[2]*scene.width/100,height:b[3]*scene.height/100}));
 if(typeof FrontendTrial!=='undefined'&&FrontendTrial.colleague())for(const item of paper){item.silhouette=trialSilhouette(item.id);for(const target of item.tailTargets||[])target.silhouette=trialSilhouette(target.id);}
 const labelFigures=figures.filter(f=>!labelNodes[f.id].hidden&&Number(labelNodes[f.id].style.opacity)>0).map(f=>{
  const label=labelNodes[f.id],labelScale=activeScenery?.nameplateScale||1;label.style.fontSize=(Math.max(9,Math.min(15,w*.0085)*labelScale)*CaptionLayout.DISPLAY_SCALE)+'px';label.style.padding=(4*labelScale*CaptionLayout.DISPLAY_SCALE)+'px '+(2*labelScale*CaptionLayout.DISPLAY_SCALE)+'px';
  return {...nameplateFigure(f,activeScenery?.actors[f.id]),labelWidth:label.offsetWidth||18,labelHeight:label.offsetHeight||38};
 });
 const labelKey=JSON.stringify([labelFigures,w,h,reserved,scene]);if(labelKey!==nameplateLayoutKey){nameplateLayoutKey=labelKey;nameplateLayout=placeNameplates(labelFigures,w,h,{reserved,bounds:scene,keepVisible:true});}
 const subtitle=audienceSubtitleBounds(liveCaption,document.getElementById('stage'),w,h),seals=avoidNameplateSubtitle(nameplateLayout,subtitle,{bounds:scene}),placedLabels=new Set(seals.map(s=>s.id));
 for(const f of labelFigures)labelNodes[f.id].style.visibility=placedLabels.has(f.id)?'visible':'hidden';
 for(const box of seals){const label=labelNodes[box.id];label.style.left=box.left+'px';label.style.top=box.top+'px';label.dataset.side=box.side;}
 liveFaceObstacles=realtimeOnly?figures.map(f=>faceBounds(f,activeScenery?.actors[f.id])):[];
 const obstacles=realtimeOnly?[...liveFaceObstacles,...(subtitle?[subtitle]:[])]:[...figures.flatMap(f=>typeof FrontendTrial!=='undefined'&&FrontendTrial.colleague()&&trialSilhouette(f.id).length?trialSilhouette(f.id):[{actorId:f.id,left:f.x-f.width/2-4,top:f.foot-f.height-5,width:f.width+8,height:f.height+10}]),...seals];
 const layoutKey=JSON.stringify([paper.map(({message,...item})=>item),w,h,reserved,obstacles]);if(layoutKey!==bubbleLayoutKey){
  const previous=bubbleLayout.filter(p=>{const b=bubbleNodes[p.id];return b.captionFit?.width===w&&b.captionFit?.height===h&&p.styleKey===paper.find(i=>i.id===p.id)?.styleKey;});const fitted=realtimeOnly?DialogueOverlay.fitFree(paper,scene,{avoidFaces:true,obstacles,previous}):free?DialogueOverlay.fitFree(paper,scene):(typeof FrontendTrial!=='undefined'&&FrontendTrial.colleague()?ColleagueBubbles:CaptionLayout).fitCards(paper,w,h,{place:placeBubbles,reserved,obstacles,previous});bubbleLayout=fitted.boxes.map(box=>({...box,...Object.fromEntries(['message','layout','maxHeight','styleKey','hideTail'].map(key=>[key,fitted.cards.find(c=>c.id===box.id)[key]]))}));
  for(const card of fitted.cards.filter(c=>fitted.boxes.some(b=>b.id===c.id))){const b=bubbleNodes[card.id];DialogueOverlay.styleCard(b,card.config,card.renderScale||1);renderCaption(b,{message:{...card.message,text:card.text}},card.layout);b.captionFit={message:card.message,width:w,height:h,maxHeight:card.maxHeight};}
  bubbleLayoutKey=JSON.stringify([paper.map(({message,...item})=>({...item,maxHeight:bubbleNodes[item.id].captionFit?.maxHeight})),w,h,reserved,obstacles]);
 }
 const boxes=bubbleLayout,placed=new Set(boxes.map(b=>b.id));
 for(const item of paper){const a=engine.actors[item.id],b=bubbleNodes[item.id],revealed=placed.has(item.id)&&(item.fading||dialogueDisplay.canReveal(item.message,engine.time));a.captionBlocked=a.phase==='speaking'&&(!revealed||item.fading)&&!(a.message?.chorus&&(item.fading||item.message!==a.message));b.style.visibility=revealed?'visible':'hidden';if(!revealed&&!item.fading){b.classList.remove('visible');b.fadeUntil=0;}
  if(a.captionBlocked)a.captionBlockedSince??=engine.time;else{a.captionBlockedSince=null;if(!item.fading&&item.message.visibleAt===undefined){dialogueDisplay.visible(item.message,engine.time);if(item.message.cueKey)trace('cue-visible',{key:a.message.cueKey,line:a.message.cueLine,waitMs:Math.round(engine.time-(a.message.queuedAt??engine.time))});}}
 }
 for(const box of boxes){const b=bubbleNodes[box.id];DialogueOverlay.placeCard(b,box);if(box.layout?.colleague){const actor=engine.actors[box.id];ColleagueBubbles.advance(b,engine.time,{key:box.message,visible:b.classList.contains('visible'),durationMs:engine.duration(actor),remainingMs:actor.phase==='speaking'?Math.max(0,engine.duration(actor)-actor.elapsed):2000});}}
}
function advanceClock(now){const rawDt=lastTime?Math.min(Math.max(0,now-lastTime),1000):0,dt=rawDt*speed;lastTime=now;if(!jointFinale?.active){if(!engine.paused){dialogueDisplay.tick(engine.time);for(const a of engine.actors)if(dialogueDisplay.shouldFinish(a,engine.time))a.elapsed=engine.duration(a);}engine.step(dt);advanceRehearsal(dt);advanceManualCues();advancePresentation();shotFollower?.tick();advanceOpening(now);scenePlayback?.tick();retryShotScene(now);if(scheduledCue&&engine.time>=scheduledCue.at&&!engine.paused){pipeline.pending=scheduledCue.round;scheduledCue=null;presentReady();}}return rawDt;}
let lastRender=0,renderElapsed=0;
let nameplateLayoutKey='',nameplateLayout=[];
let bubbleLayoutKey='',bubbleLayout=[],liveFaceObstacles=[];
function frame(now){requestAnimationFrame(frame);const rawDt=advanceClock(now);renderElapsed+=rawDt;if(w<240||h<180)return;if(now-lastRender>=32){render();jointFinale?.render(w,h,renderElapsed);renderElapsed=0;lastRender=now;}}
// Timers keep cue bookkeeping progressing while the director tab has focus.
// Rendering still belongs to requestAnimationFrame on the audience screen.
function advanceWithoutFrame(now){if(now-lastTime<120)return;const dt=advanceClock(now);renderElapsed+=dt;if(w>=240&&h>=180){render();jointFinale?.render(w,h,renderElapsed);renderElapsed=0;lastRender=now;}}
setInterval(()=>advanceWithoutFrame(performance.now()),100);
new ResizeObserver(()=>{w=document.getElementById('stage').clientWidth;h=document.getElementById('stage').clientHeight;}).observe(document.getElementById('stage'));
async function fullscreen(){
 if(isFullscreen())return;
 const viewport=document.getElementById('stage-viewport')||document.getElementById('stage');
 try{if(!viewport.requestFullscreen)throw Error('当前浏览器不支持原生全屏');await viewport.requestFullscreen({navigationUI:'hide'});syncFullscreen();}
 catch(error){const button=document.getElementById('stage-fullscreen');button.textContent='重试全屏预览';button.title=error.message;}
}
function syncFullscreen(){const on=Boolean(document.fullscreenElement),stage=document.getElementById('stage'),button=document.getElementById('stage-fullscreen');stage.classList.remove('preview-fullscreen');stage.classList.toggle('fullscreen-view',on);button.hidden=on;button.textContent='全屏预览';button.setAttribute('aria-pressed',String(on));}
document.getElementById('stage-fullscreen').onclick=fullscreen;document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('stage').classList.remove('preview-fullscreen');if(document.fullscreenElement)document.exitFullscreen().then(syncFullscreen).catch(()=>{});else syncFullscreen();}});
document.getElementById('stage').ondblclick=e=>{if(!isFullscreen()&&!e.target.closest('.test-composer,button,a'))fullscreen();};document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,button')||e.isComposing)return;if(e.key.toLowerCase()==='f'&&!isFullscreen())fullscreen();});document.addEventListener('visibilitychange',()=>lastTime=0);


const testInput=document.getElementById('test-text'),liveCaption=document.getElementById('live-caption'),inputScheduler=new InputScheduler();
const responseClient=new ResponseClient({names:teachers.map(t=>t.name),fallback:()=>null});
const pipeline=new RoundPipeline(responseClient);
let composing=false;
function cancelReply(){pipeline.clear();aiState=responseClient.state;document.body.classList.remove('awaiting-reply');}
function generatedMessage(m){return m?.improv===true||['DeepSeek','模型即兴'].includes(m?.source)||m?.source==='连接提示';}
function cancelImprov(){
 const prepared=pipeline.pending&&!pipeline.pending.messages.some(generatedMessage)?pipeline.pending:null;
 cancelReply();if(prepared)pipeline.pending=prepared;
 engine.queue=engine.queue.filter(m=>!generatedMessage(m));
 for(const a of engine.actors)if(generatedMessage(a.message)){Object.assign(a,{phase:'idle',elapsed:0,returnFrom:0,message:null,slot:null});blocking.targets[a.id]=null;}
}
function isScriptInput(text){return !isLiveDialogue()&&new ScriptFollower(speechScript).feed(text,true).matched;}
function mainlineBusy(){return Boolean(jointFinale?.active)||rehearsalPlayer.active||Boolean(scheduledCue)||manualCues.length>0||Boolean(pipeline.pending&&!pipeline.pending.improv)||engine.queue.some(m=>!generatedMessage(m))||engine.actors.some(a=>a.phase!=='idle'&&!generatedMessage(a.message));}
function improvStageIdle(){return !mainlineBusy()&&!engine.paused&&!engine.queue.length&&engine.actors.every(a=>a.phase==='idle');}
function speechHasPaused(){return !voiceActive||(lastSpeechFinal&&performance.now()-lastSpeechAt>=1200);}

function messageInScene(message,sceneId){
 if(!message)return false;
 const owner=message.sceneId||(Number.isInteger(message.section)?speechScript?.blocks[message.section]?.sceneId:null);
 return !owner||!sceneId||owner===sceneId;
}
function clearBubblePresentation(){
 bubbleNodes.forEach(b=>{b.querySelector('.bubble-text').textContent='';b.querySelector('.bubble-who').textContent='';b.dataset.text='';b.dataset.pageKey='';b.classList.remove('visible');b.style.visibility='hidden';b.fadeUntil=0;b.displayMessage=null;b.captionFit=null;b.setAttribute('aria-hidden','true');});bubbleLayout=[];bubbleLayoutKey='';
}
function resetPlayback({keepVoice=false}={}){
 if(typeof FrontendTrial!=='undefined')FrontendTrial.clear();
 manualSceneRequest=null;rehearsalPlayer.stop();manualSceneScope=null;dialogueDisplay.reset();deferredReplyScene=null;presentation={active:false,source:'',index:engine.topic,sentenceIndex:-1};progressCandidate=null;previewRun=null;cueLedger.cancel();controlEpoch++;cueTail='';stableCandidates=[];cueWarning='';const preservedSeq=speechSentences.seq;scriptFollower.reset();cueTracker?.reset();followState={...scriptFollower.last};scheduledCue=null;manualCues=[];cancelReply();engine.clear();blocking.reset();speechSentences.clear();audienceSubtitles.reset();if(keepVoice)speechSentences.seq=preservedSeq;liveCaption.textContent='';testInput.value='';testInput.readOnly=false;inputScheduler.cancel(performance.now(),'');if(!keepVoice){voiceActive=false;voiceSession='';}testInput.readOnly=voiceActive;
 document.getElementById('test-composer').classList.toggle('voice-caption',voiceActive);
 clearBubblePresentation();
}
function seekSection(index,{waitForMatch=false}={}){
 const boundSequence=speechScript?.stageBinding?.status==='bound';if(boundSequence)resetPlayback({keepVoice:true});
 previewShot(speechScript?.blocks[index]?.source);if(CuePlan.sequenceMode(speechScript))ensureExistingSequenceScene(index);
 if(!boundSequence)resetPlayback({keepVoice:true});inputFloor=index;awaitingSection=waitForMatch;engine.setTopic(index);scriptFollower.seek(index);cueTracker?.reset(index);followState={...scriptFollower.last};trace('seek',{index});
}
function queueCue(index,sentenceIndex,{force=false,delayMs,reason}={}){
 if(isLiveDialogue())return false;
 // A silent introduction still owns a visual cue. Execute it before the
 // no-reply return, for recognized keywords, rescue and single-line previews.
 const block=speechScript?.blocks?.[index],unit=block?.sentences?.[sentenceIndex];
 if(block?.sceneId===openingSceneId()&&unit){
  const combined=unit.text.includes('他们是')&&openingCast.names.filter(([name])=>unit.text.includes(name)).length>1;
  if(!combined||reason==='manual-sentence')followOpening(combined?unit.text:unit.trigger||unit.text,false,reason||'prepared');
 }
 if(namedOpening()&&block?.sceneId===openingSceneId())return false;
 let sentence=speechScript?.blocks[index]?.sentences[sentenceIndex];const inputKey=`${index}:${sentence?.id}`;if(sentence?.dialogueLead)sentence=speechScript.blocks[index].sentences.find(s=>s.id===sentence.dialogueLead);if(!sentence?.replies?.length||sentence.mode==='silent')return false;
 const key=`${index}:${sentence.id}`;if(manualSceneScope&&cueTracker&&cueTracker.rows.findIndex(r=>r.key===inputKey)<cueTracker.floor)return false;if(!cueLedger.reserve(key,sentence.replies.length,{force:force&&speechScript?.replyPolicy!=='keyword-dialogue'})){trace('cue-duplicate',{key});return false;}
 if(voiceActive||rehearsalPlayer.active)dialogueDisplay.activate(key);
 cancelImprov();manualCues.push({index,key,messages:sentence.replies,queuedAt:engine.time,readyAt:engine.time+(delayMs??sentence.delayMs??0)});trace('cue-queued',{key,index,reason});return true;
}
function playPrepared(index,sentenceIndex){
 const block=speechScript?.blocks?.[index];if(!block||voiceActive)return;
 resetPlayback({keepVoice:true});inputFloor=index;awaitingSection=false;engine.setTopic(index);scriptFollower.seek(index,Number.isInteger(sentenceIndex)?sentenceIndex:0);
 const openingPreview=namedOpening()&&block.sceneId===openingSceneId();
 if(openingPreview){
  if(activeScenery?.id!==openingSceneId()||!Number.isInteger(sentenceIndex))resetShotScenes();
  if(!Number.isInteger(sentenceIndex)||block.sentences[sentenceIndex]?.text.includes('他们是')){
   // Preview the introduction along its actual text timeline; queuing all
   // silent name cards at once would reveal the entire cast immediately.
   rehearsalPlayer.start(speechScript,index,{single:true,realtime:true,streaming:true});if(Number.isInteger(sentenceIndex))rehearsalPlayer.sentenceIndex=sentenceIndex;rehearsalTranscript='';
   setPresentation(index,0,'rehearsal');testInput.readOnly=true;document.getElementById('test-composer').classList.add('voice-caption');pause(false);status();return;
  }
 }else previewShot(block.sentences[Number.isInteger(sentenceIndex)?sentenceIndex:0]?.text||block.source);
 previewRun=openingPreview?null:{index,last:Number.isInteger(sentenceIndex)?sentenceIndex:block.sentences.length-1};showScriptSubtitle(index,Number.isInteger(sentenceIndex)?sentenceIndex:0);setPresentation(index,Number.isInteger(sentenceIndex)?sentenceIndex:0,'preview');
 block.sentences.forEach((_sentence,si)=>{if(!Number.isInteger(sentenceIndex)||si===sentenceIndex)queueCue(index,si,{force:true});});
 pause(false);advanceManualCues();status();
}
function advanceManualCues(){
 if(engine.paused||isLiveDialogue())return;
 if(cueTracker){for(const cue of cueTracker.take())queueCue(cue.index,cue.sentenceIndex,{reason:cue.reason});updateCueWarning();}
 if(stableCandidates.length&&performance.now()-stableSince>=650){const candidates=stableCandidates;stableCandidates=[];for(const c of candidates){if(c.index>engine.topic){engine.topic=c.index;scriptFollower.seek(c.index,c.sentenceIndex);awaitingSection=false;}queueCue(c.index,c.sentenceIndex);trace('cue-stable',{key:`${c.index}:${speechScript.blocks[c.index].sentences[c.sentenceIndex].id}`});}}
 const busy=engine.queue.length||engine.actors.some(a=>a.phase!=='idle')||dialogueDisplay.closing(engine.time);
 if(cueTracker&&speechScript?.replyPolicy!=='keyword-dialogue'&&busy)return;
 if(!manualCues.length){if(deferredReplyScene&&!busy){const row=deferredReplyScene;deferredReplyScene=null;cutShot(row,true);}return;}const cue=manualCues[0];
 if(cueTracker){const row=shotFollower?.rows.find(r=>r.sceneId===speechScript.blocks[cue.index]?.sceneId);if(row&&row.sceneId!==activeScenery?.id){if(busy)return;cutShot(row,true);if(activeScenery?.id!==row.sceneId)return;}}
 if(engine.time<cue.readyAt||engine.queue.length+cue.messages.length>128)return;
 const messages=cue.messages.map((m,cueLine)=>({...m,...(speechScript?.readingCpm===220&&!m.durationMs?{durationMs:CaptionLayout.duration(m.text)}:{}),topic:engine.topic,section:cue.index,sceneId:speechScript.blocks[cue.index]?.sceneId,queuedAt:cue.queuedAt,source:'演练预备',cueKey:cue.key,cueLine,ordered:true,serial:Boolean(cueTracker)&&speechScript?.replyPolicy!=='keyword-dialogue'}));
 if(engine.enqueueDiscussion(messages)){manualCues.shift();trace('cue-ready',{key:cue.key});}
}
let rehearsalTranscript='';
function advanceRehearsal(dt){
 const event=rehearsalPlayer.tick(dt,{paused:engine.paused,busy:engine.queue.length>0||engine.actors.some(a=>a.phase!=='idle')});
 if(!event)return;
 if(rehearsalPlayer.streaming){
  const key=event.transcript+'|'+event.final;if(event.transcript&&key!==rehearsalTranscript){rehearsalTranscript=key;followSpeech({text:event.transcript,final:event.final===true,source:'rehearsal'});}
  if(event.caption!==undefined)liveCaption.textContent=audienceCaption(event.caption);
  if(event.type!=='done')return;
 }
 if(event.type==='done'){presentation.active=false;presentation.complete=true;clearAudienceCaption();testInput.readOnly=false;document.getElementById('test-composer').classList.remove('voice-caption');status();return;}
 if(event.type==='topic')engine.topic=event.index;
 const sentence=speechScript.blocks[rehearsalPlayer.index].sentences[rehearsalPlayer.sentenceIndex];dialogueDisplay.observe({matched:true,confidence:100,index:rehearsalPlayer.index,sentenceIndex:rehearsalPlayer.sentenceIndex,remaining:CaptionLayout.count(sentence.text.slice(rehearsalPlayer.read))},true,engine.time);if(rehearsalPlayer.elapsed>=Math.max(0,sentence.text.length*60000/REHEARSAL_CPM-500))finishSpeechPosition(rehearsalPlayer.index,rehearsalPlayer.sentenceIndex,'rehearsal');else setPresentation(rehearsalPlayer.index,rehearsalPlayer.sentenceIndex,'rehearsal');
 if(event.caption!==undefined)liveCaption.textContent=audienceCaption(event.caption);
 if(rehearsalPlayer.read>0){audienceSubtitles.follow({matched:true,confidence:100,index:rehearsalPlayer.index,sentenceIndex:rehearsalPlayer.sentenceIndex,end:normalizeSpeech(sentence.text.slice(0,rehearsalPlayer.read)).length});liveCaption.textContent=audienceCaption(event.caption);}
 if(event.type==='discussion'){queueCue(event.index,event.sentenceIndex,{force:true,delayMs:0});advanceManualCues();}
}
function replaceSpeechScript(value){
 let next;try{next=value===null?null:SpeechScript.create(value);}catch{return;}
 if(JSON.stringify(next)===JSON.stringify(speechScript))return;
 resetPlayback({keepVoice:true});inputFloor=0;awaitingSection=false;engine.setTopic(0);roundCursor=0;cueLedger.clear();
 speechScript=next;openingCast.configure(next);audienceSubtitles.configure(next);dialogueDisplay=new CaptionLayout.DialogueDisplay(next);cueTracker=CuePlan.protectedPolicy(next?.replyPolicy)?new CueTracker(next):null;scriptFollower=new ScriptFollower(next);scriptCaptions=new ScriptCaptions(next);followState={...scriptFollower.last};topics=SpeechScript.topics(next,[]);if(scenePlayback?.prepared)rebindShots(true);status();
}
function audienceCaption(raw=speechSentences.lastCaption){return isLiveDialogue()?(allowImprov?liveSubtitles.caption(raw):''):speechScript?.blocks?.length?audienceSubtitles.current:audienceSubtitles.caption(raw);}
function clearAudienceCaption(){audienceSubtitles.reset();liveCaption.textContent='';}
function showScriptSubtitle(index,sentenceIndex,end=1){audienceSubtitles.follow({matched:true,confidence:100,index,sentenceIndex,end});liveCaption.textContent=audienceCaption();}
function followOpening(text,final,source){
 if(!namedOpening()||activeScenery?.id!==openingSceneId())return;
 const before=new Set(openingCast.snapshot().introduced),transition=openingCast.feed(text,final,performance.now());
 const actors=openingCast.snapshot().introduced.filter(id=>!before.has(id));
 if(actors.length){
  trace('opening-reveal',{actors,source});
  // Individual names can reveal the cast even if the greeting was skipped.
  // Use that same exact-name evidence for the matching authored subtitle.
  const name=openingCast.names.find(([,id])=>id===actors.at(-1))?.[0],index=speechScript.blocks.findIndex(b=>b.sceneId===openingSceneId()),sentenceIndex=speechScript.blocks[index]?.sentences.findIndex(s=>s.trigger===name||s.text.includes('他们是')&&s.text.includes(name));
  if(sentenceIndex>=0){setPresentation(index,sentenceIndex,'speech');const text=speechScript.blocks[index].sentences[sentenceIndex].text;showScriptSubtitle(index,sentenceIndex,normalizeSpeech(text.slice(0,text.indexOf(name)+name.length)).length);}
 }
 if(transition){
  // The transition phrase can recover from a missed name or a manual S0 rescue.
  const row=shotFollower?.rows[0],first=row?.units?.[0];if(first){
   shotFollower.seek(0);if(manualSceneScope)scopeToScene(row,0);else{cueTracker?.reset(first.index,first.sentenceIndex);scriptFollower.seek(first.index,first.sentenceIndex);}
   inputFloor=first.index;engine.topic=first.index;followState={...(cueTracker?.follow||scriptFollower.last)};showScriptSubtitle(first.index,first.sentenceIndex);setPresentation(first.index,first.sentenceIndex,'speech');
  }
  beginExistingOpening();
 }
}
function followSpeech(message){
 if(manualSceneRequest)return;
 if(isLiveDialogue()){trace(message.final?'input-final':'input-interim',{text:String(message.text).slice(-180),source:message.source||'speech'});return;}
 if(namedOpening()&&activeScenery?.id===openingSceneId())followOpening(SpeechCalibration.repair(message.text,speechScript),message.final===true,message.source||'speech');
 else if(CuePlan.sequenceMode(speechScript)&&normal(message.text).includes('尊敬的'))beginExistingOpening();
 if(speechScript?.stageBinding?.status==='bound'&&shotFollower){const heard=normal(SpeechCalibration.repair(message.text,speechScript));const next=Math.max(0,shotFollower.index+1),row=shotFollower.rows[next];if(row?.visualTrigger&&[row.visualTrigger,speechScript.blocks[row.units[0].index].sentences[0].trigger].some(anchor=>anchor&&heard.includes(normal(anchor)))){const first=row.units[0];if(manualSceneScope)scopeToScene(row,next);followBoundScene({matched:true,cueAligned:true,confidence:100,index:first.index,sentenceIndex:first.sentenceIndex},false);}}
 // The three-character greeting starts only the S0 transition, never a reply.
 if(!namedOpening()&&standbyOpening()&&activeScenery?.id===openingSceneId()&&shotFollower&&!shotFollower.started&&normal(message.text).includes('尊敬的')){shotFollower.started=true;shotFollower.index=0;shotFollower.opening(shotFollower.rows[0]);trace('opening-keyword',{text:'尊敬的'});}
 if(!cueTracker)shotFollower?.feed(SpeechCalibration.repair(message.text,speechScript),message.final===true);
 if(!speechScript?.blocks)return;
 trace(message.final?'input-final':'input-interim',{text:String(message.text).slice(-180),source:message.source||'speech',recognitionLagMs:message.recognitionLagMs,uploadBacklogMs:message.uploadBacklogMs,transportBufferedBytes:message.transportBufferedBytes,deliveryMs:Number.isFinite(message.receivedAt)?Math.max(0,Date.now()-message.receivedAt):undefined});
 if(cueTracker){const oldFloor=cueTracker.floor,cues=cueTracker.feed(message.text,message.final===true);if(manualSceneScope&&cueTracker.floor>oldFloor+1){discardSceneReplies();markSkippedBeforeScope();trace('scene-reacquired',{index:cueTracker.rows[cueTracker.floor].index,sentenceIndex:cueTracker.rows[cueTracker.floor].sentenceIndex});}for(const cue of cues)queueCue(cue.index,cue.sentenceIndex,{reason:cue.reason});}
 const parts=cueTracker?[message.text]:message.final?SpeechScript.splitSource(message.text):[message.text];
 const interimDetected=[];
 for(const part of parts){
  const minIndex=Math.max(inputFloor,engine.topic),detected=[];
  followState=cueTracker?{...cueTracker.follow}:scriptFollower.feed(part,message.final);
  audienceSubtitles.follow(followState);liveCaption.textContent=audienceCaption();
  dialogueDisplay.observe(followState,message.final===true,engine.time);
  trackSpeechProgress(followState,message.final);
  followBoundScene(followState,Boolean(message.final&&(followState.complete||followState.atEnd)));
  if(followState.matched){
   cancelImprov();
   if(message.final){engine.topic=Math.max(engine.topic,followState.index);awaitingSection=false;}
   trace(followState.complete?'matched-complete':'matched-partial',{index:followState.index,sentenceIndex:followState.sentenceIndex,confidence:followState.confidence});
   const row=speechScript.blocks[followState.index]?.sentences[followState.sentenceIndex];
   if(!cueTracker&&(followState.complete||(row?.cuePolicy==='early'&&followState.confidence>=94&&followState.matchedChars>=8)))detected.push({index:followState.index,sentenceIndex:followState.sentenceIndex});
  }
  if(message.final){
   const maxIndex=followState.matched?followState.index:engine.topic+1;
   if(!cueTracker)detected.push(...SpeechScript.findCues(speechScript,cueTail+part,{minIndex,maxIndex}));
   cueTail=(cueTail+part).slice(-300);
   for(const cue of detected.sort((a,b)=>a.index-b.index||a.sentenceIndex-b.sentenceIndex)){awaitingSection=false;if(cue.index>engine.topic){engine.topic=cue.index;scriptFollower.seek(cue.index,cue.sentenceIndex);}queueCue(cue.index,cue.sentenceIndex);}
  }else{
   if(!cueTracker)detected.push(...SpeechScript.findCues(speechScript,cueTail+part,{minIndex,maxIndex:followState.matched?followState.index:engine.topic}));
   interimDetected.push(...detected.filter(c=>!awaitingSection||c.index>=inputFloor));
  }
 }
 if(message.final){stableCandidates=[];cueWarning='';if(followState.matched){const missed=speechScript.blocks[followState.index].sentences.filter((s,i)=>i<followState.sentenceIndex&&s.replies.length&&!cueLedger.has(`${followState.index}:${s.id}`));if(missed.length)cueWarning=`本部分有 ${missed.length} 处接话未触发，可点“补播本段接话”。`;}}
 else if(!cueTracker){const next=interimDetected.filter(c=>speechScript.blocks[c.index]?.sentences[c.sentenceIndex]?.replies.length&&!cueLedger.has(`${c.index}:${speechScript.blocks[c.index].sentences[c.sentenceIndex].id}`));if(JSON.stringify(next.map(c=>[c.index,c.sentenceIndex]))!==JSON.stringify(stableCandidates.map(c=>[c.index,c.sentenceIndex]))){stableCandidates=next;stableSince=performance.now();}}
 if(cueTracker)updateCueWarning();
 advanceManualCues();
}
function updateCueWarning(){
 if(!cueTracker)return;const missing=cueTracker.missing().filter(r=>speechScript.blocks[r.index].sentences[r.sentenceIndex].replies.length&&!cueLedger.has(r.key));
 cueWarning=missing.length?`有 ${missing.length} 句缺少可靠识别：`+missing.slice(0,3).map(r=>`S${r.index+1} 第 ${r.sentenceIndex+1} 句`).join('、')+'。点击补播依次恢复，已播放的不会重播。':'';
}
// Progress can prepare the next card without changing the cue's owning section.
function nextPosition(index,sentenceIndex){
 if(sentenceIndex+1<speechScript.blocks[index].sentences.length)return {index,sentenceIndex:sentenceIndex+1};
 return index+1<speechScript.blocks.length?{index:index+1,sentenceIndex:0}:null;
}
function advanceManualSentence(){
 if(!speechScript?.blocks?.length)return false;
 const current={index:presentation.sentenceIndex>=0?presentation.index:0,sentenceIndex:presentation.sentenceIndex>=0?presentation.sentenceIndex:0};
 const next=nextPosition(current.index,current.sentenceIndex);if(!next)return false;
 const sentence=speechScript.blocks[next.index].sentences[next.sentenceIndex],key=`${next.index}:${sentence.dialogueLead||sentence.id}`;
 // Rescue takes effect locally before any network reconnect. Keep only this
 // group's existing card/turns, so a continuation never flashes or replays.
 discardRepliesExcept(key,next);controlEpoch++;
 const previous=cueLedger.records.get(key);if(previous?.state==='skipped'&&!previous.started.length)previous.state='cancelled';
 progressCandidate=null;stableCandidates=[];cueTail='';previewRun=null;cueWarning='';
 if(voiceSession)retiredVoiceSessions.add(voiceSession);voiceSession='';inputFinalSeq=0;speechSentences.clear();testInput.value='';clearAudienceCaption();inputScheduler.cancel(performance.now(),'');
 voiceReset={kind:'sentence',token:String(Date.now())+'-'+controlEpoch,epoch:controlEpoch,pending:voiceActive,index:next.index,sentenceIndex:next.sentenceIndex};
 inputFloor=next.index;awaitingSection=false;engine.topic=next.index;
 const shot=SceneScript.rowFor(shotFollower?.rows||[],next.index,next.sentenceIndex),row=shotFollower?.rows[shot];
 if(row)scopeToScene(row,shot,{from:next,keepKey:key});else{manualSceneScope=null;scriptFollower.seek(next.index,next.sentenceIndex);cueTracker?.reset(next.index,next.sentenceIndex);}
 followState={...(cueTracker?.follow||scriptFollower.last)};
 dialogueDisplay.observe({matched:true,confidence:100,index:next.index,sentenceIndex:next.sentenceIndex,remaining:CaptionLayout.count(sentence.text)},true,engine.time);
 if(row&&shotFollower.started){shotFollower.seek(shot);openingAt=null;entryAt=null;openingLayer.style.opacity='0';if(activeScenery?.id!==row.sceneId)cutShot(row,true);}
 else followBoundScene({matched:true,confidence:100,index:next.index,sentenceIndex:next.sentenceIndex},false);
 showScriptSubtitle(next.index,next.sentenceIndex);setPresentation(next.index,next.sentenceIndex,'manual','next');
 dialogueDisplay.activate(key);queueCue(next.index,next.sentenceIndex,{reason:'manual-sentence',delayMs:0});pause(false);advanceManualCues();
 trace('manual-sentence',{index:next.index,sentenceIndex:next.sentenceIndex});status();return true;
}
function setPresentation(index,sentenceIndex,source,phase='speaking'){
 if(CuePlan.sequenceMode(speechScript))ensureExistingSequenceScene(index);
 if(!speechScript?.blocks?.[index]?.sentences?.[sentenceIndex])return;
 if(presentation.source===source&&(index<presentation.index||index===presentation.index&&sentenceIndex<presentation.sentenceIndex))return;
 const changed=presentation.index!==index||presentation.sentenceIndex!==sentenceIndex||presentation.source!==source||presentation.phase!==phase;
 presentation={active:source==='speech'?(voiceActive||rehearsalPlayer.active):true,source,index,sentenceIndex,phase,matched:true,complete:false};
 if(changed)status();
}
function finishSpeechPosition(index,sentenceIndex,source='speech'){
 if(source==='speech'||source==='rehearsal')followBoundScene({matched:true,index,sentenceIndex,confidence:100},true);
 const next=nextPosition(index,sentenceIndex);
 if(presentation.source===source&&((!next&&presentation.complete)||(next&&presentation.index===next.index&&presentation.sentenceIndex===next.sentenceIndex&&presentation.phase==='speaking')))return;
 if(next)setPresentation(next.index,next.sentenceIndex,source,'next');
 else{setPresentation(index,sentenceIndex,source,'complete');presentation.complete=true;presentation.active=false;status();}
}
function trackSpeechProgress(match,final){
 if(!match.matched||(!match.cueAligned&&match.confidence<85)||match.matchedChars<Math.min(6,speechScript.blocks[match.index]?.sentences[match.sentenceIndex]?.text.length||6)){progressCandidate=null;return;}
 const end=match.atEnd&&(match.cueAligned||match.confidence>=90),nearEnd=match.remaining<=1&&match.confidence>=97&&match.matchedChars>=10;
 if(final){progressCandidate=null;if(end||match.complete)finishSpeechPosition(match.index,match.sentenceIndex);else setPresentation(match.index,match.sentenceIndex,'speech');return;}
 const advance=end||nearEnd,key=`${match.index}:${match.sentenceIndex}:${advance}`;
 if(progressCandidate?.key!==key)progressCandidate={key,index:match.index,sentenceIndex:match.sentenceIndex,advance,since:performance.now()};
}
function advancePresentation(){
 if(progressCandidate&&performance.now()-progressCandidate.since>=(progressCandidate.advance?150:300)){
  const candidate=progressCandidate;progressCandidate=null;
  if(candidate.advance)finishSpeechPosition(candidate.index,candidate.sentenceIndex);
  else{setPresentation(candidate.index,candidate.sentenceIndex,'speech');engine.topic=Math.max(engine.topic,candidate.index);awaitingSection=false;}
 }
 if(!previewRun||manualCues.length||engine.queue.length||engine.actors.some(a=>a.phase!=='idle'))return;
 const {index,last}=previewRun;previewRun=null;const next=nextPosition(index,last);
 if(next){engine.topic=next.index;scriptFollower.seek(next.index,next.sentenceIndex);previewShot(speechScript.blocks[next.index].sentences[next.sentenceIndex].text);setPresentation(next.index,next.sentenceIndex,'ready','next');}
 else{presentation.active=false;presentation.complete=true;status();}
}
function stageBusy(){return Boolean(jointFinale?.active)||rehearsalPlayer.active||Boolean(scheduledCue)||manualCues.length>0||!pipeline.canRequest(engine.paused);}
function presentReady(){
 if(jointFinale?.active)return;
 if(pipeline.pending?.improv){
  if(!isLiveDialogue()||!allowImprov||pipeline.pending.topic!==engine.topic||mainlineBusy()){cancelImprov();return;}
  if(performance.now()>pipeline.pending.expiresAt){cancelImprov();aiState={mode:'silent',message:'即兴已过时，本轮跳过'};return;}
  // T2 replies may arrive while the speaker continues. Raw audio must not
  // veto a complete, already-requested turn or make it expire silently.
  if(!improvStageIdle())return;
  if(!pipeline.pending.actionOnly)try{pipeline.pending.messages=normalizeImprov(pipeline.pending.messages,availableImprovActors()).map(m=>({...m,topic:engine.topic,source:'模型即兴'}));}catch{cancelImprov();return;}
 }
 const round=pipeline.take({paused:engine.paused,presenting:engine.queue.length>0||engine.actors.some(a=>!['idle','leaving'].includes(a.phase))});
 if(!round)return;
 if(speechScript?.blocks&&!allowImprov&&round.messages.some(generatedMessage))return;
 if(!round.cueKey&&round.topic!==engine.topic)engine.setTopic(round.topic);
 roundCursor=round.nextCursor;
 engine.enqueueDiscussion(round.messages.map(m=>({...m,topic:engine.topic})));if(round.cueKey)trace('cue-ready',{key:round.cueKey});
 if(round.improv&&!round.actionOnly)responseClient.remember(round.input,round.messages);
 status();
}
async function respondToSpeech(text,{voice=false}={}){
 if(!speechScript&&stageBusy())return;
 if(!voice)testInput.value=inputScheduler.consume(testInput.value,text);
 if(speechScript&&!voice){cancelImprov();followSpeech({text,final:true,source:'text'});}
 if(!isLiveDialogue()||!allowImprov){aiState={mode:'silent',message:isLiveDialogue()?'T2 现场接话已关闭':'AI 即兴接话仅用于最后的 T2 场景'};status();return;}
 const improv=allowImprov,improvActors=improv?availableImprovActors():undefined;
 if(improv&&(!improvActors.length||!improvStageIdle()||stageBusy())){aiState={mode:'silent',message:improvActors.length?'主线优先，本轮即兴已跳过':'当前部分角色已全部占用，无可用配角'};status();return;}
 if(improv&&improvStyle==='motion'){pipeline.pending={topic:engine.topic,improv:true,actionOnly:true,expiresAt:performance.now()+8000,nextCursor:roundCursor,messages:[{actor:improvActors[0],text:'点头',topic:engine.topic,improv:true,actionOnly:true,presentation:'background',source:'配角动作',action:'gesture',durationMs:2200}]};aiState={mode:'silent',message:'配角以点头回应，无模型调用'};presentReady();status();return;}
 document.body.classList.add('awaiting-reply');
 const expiresAt=performance.now()+8000;
 liveReplyStats.requests++;liveReplyStats.lastSentAt=performance.now();liveReplyStats.lastResult='已发送';trace('improv-request',{characters:text.length,sceneId:activeScenery.id});
 const requestGeneration=pipeline.generation;
 const pending=pipeline.request(text,{topic:engine.topic,cursor:roundCursor,liveSceneId:isLiveDialogue()?activeScenery.id:undefined,speech:isLiveDialogue()?undefined:SpeechScript.context(speechScript,engine.topic,followState.sentenceIndex),rehearsalId:speechScript?.kind==='rehearsal'?speechScript.id:undefined,improv,improvActors});
 aiState=responseClient.state;status();
 const round=await pending;
 if(requestGeneration!==pipeline.generation)return;
 document.body.classList.remove('awaiting-reply');
 aiState=responseClient.state;
 liveReplyStats.completed++;liveReplyStats.lastResult=aiState.message||'本轮已取消';trace('improv-result',{mode:aiState.mode,reason:aiState.reason||'',messages:round?.messages?.length||0});
 if(!round){status();return;}
 if(round.improv)round.expiresAt=expiresAt;
 if(round.failed&&!composing&&!voiceActive&&!testInput.value.trim())testInput.value=inputScheduler.restoreFailed(performance.now(),text,testInput.value);
 presentReady();
 status();
}
document.getElementById('test-composer').addEventListener('submit',event=>{
 event.preventDefault();if(composing||jointFinale?.active)return;
 if(voiceActive)return;
 if(!testInput.value.trim())return;
 pause(false);
 const ready=inputScheduler.submit(performance.now(),testInput.value,{busy:!speechScript&&stageBusy()});
 if(ready)respondToSpeech(ready);
 testInput.focus();
});
testInput.addEventListener('compositionstart',()=>{composing=true;if(speechScript)cancelImprov();});
testInput.addEventListener('compositionend',()=>composing=false);
testInput.addEventListener('input',()=>{if(!voiceActive){if(speechScript)cancelImprov();speechSentences.tail='';speechSentences.interim='';speechSentences.lastCaption='';liveCaption.textContent='';}});
testInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.isComposing||event.keyCode===229))event.preventDefault();});
inputScheduler.poll(performance.now(),'');
setInterval(()=>{
 if(realtimeOnly)return;
 presentReady();
 if(speechScript&&speechSentences.queue.length&&performance.now()-(isLiveDialogue()?liveQueuedAt:lastSpeechAt)>8000){liveReplyStats.dropped+=speechSentences.queue.length;speechSentences.queue=[];}
 if(!stageBusy()&&speechSentences.queue.length&&(!isLiveDialogue()||improvStageIdle())){respondToSpeech(speechSentences.take(),{voice:true});return;}
 if(voiceActive)return;
 const ready=inputScheduler.poll(performance.now(),testInput.value,{busy:!speechScript&&stageBusy(),composing});
 if(ready)respondToSpeech(ready);
},100);

const rehearsalSync=new RehearsalSync(pack=>{remoteRehearsal=pack;if(!sharedScript)replaceSpeechScript(pack);});
const sharedSync=realtimeOnly?{}:new ScriptSync(script=>{sharedScript=script;replaceSpeechScript(script||remoteRehearsal);});
if(!realtimeOnly){sharedSync.refresh();setInterval(()=>sharedSync.refresh(),1500);
rehearsalSync.refresh();setInterval(()=>rehearsalSync.refresh(),1500);}
document.addEventListener('visibilitychange',()=>{if(!realtimeOnly&&!document.hidden)rehearsalSync.invalidate();});
if(!realtimeOnly&&typeof setupFinaleStage==='function')jointFinale=setupFinaleStage({channel,beforeEnter:()=>{resetPlayback();pause(false);},onExit:()=>{resetPlayback();pause(false);},getPositions:()=>engine.actors.map(a=>blocking.position(a,engine.progress(a))),getScene:()=>activeScenery,getPortrait:id=>activeScenery?.actors[id]?.poses.idle||actorNodes[id]?.querySelector('.custom-avatar')?.src});
requestAnimationFrame(frame);setInterval(status,700);channel.postMessage({type:'stage-ready'});status();

const takeover=document.getElementById('stage-takeover');if(takeover)takeover.onclick=()=>channel.postMessage({type:'stage-takeover'});

if(typeof ScenePlayback==='function')scenePlayback=new ScenePlayback({load:async()=>{const r=await fetch('/api/scenes');if(!r.ok)throw Error('场次库无法读取');return r.json();},preload:preloadSceneImage,commit:applyScenery,prepareVisual:sceneBlock?scene=>sceneBlock.prepare(scene):null,cancelVisual:()=>sceneBlock?.cancel(),busy:()=>mainlineBusy()||engine.actors.some(a=>a.phase!=='idle')||engine.queue.length>0||dialogueDisplay.closing(engine.time),changed:status});

function nowEntry(){return performance.now()-(entryAt??-1e8);}
function sceneActorX(id,target,scene,elapsed){const slot=activeScenery?.actors[id];if(slot&&ActorAnimation.options(slot.motion).stationary)return target;const mode=slot?.entry||'cut';if(!['left','right'].includes(mode))return target;const p=Math.max(0,Math.min(1,(performance.now()-sceneEnteredAt)/900)),start=mode==='right'?scene.left+scene.width+160:scene.left-160;return start+(target-start)*p;}
function discardSceneReplies(){
 manualCues=[];stableCandidates=[];scheduledCue=null;deferredReplyScene=null;cancelReply();engine.clear();dialogueDisplay.reset();
 for(const r of cueLedger.records.values())if(['queued','playing','cancelled','interrupted'].includes(r.state))r.state='skipped';
}
function discardRepliesExcept(key,position){
 cancelReply();scheduledCue=null;deferredReplyScene=null;
 manualCues=manualCues.filter(c=>c.key===key);for(const c of manualCues)c.readyAt=engine.time;
 engine.queue=engine.queue.filter(m=>m.cueKey===key);
 const retained=new Set(engine.queue.map(m=>m.id));
 for(const a of engine.actors){if(a.message?.cueKey===key){if(a.message.id)retained.add(a.message.id);continue;}Object.assign(a,{phase:'idle',elapsed:0,returnFrom:0,message:null,slot:null,captionBlocked:false});blocking.targets[a.id]=null;
  // A finished speaker may be idle while their continuation card is still held.
  if(dialogueDisplay.cards.get(a.id)?.message.cueKey===key)continue;
  const b=bubbleNodes[a.id];b.querySelector('.bubble-text').textContent='';b.dataset.text='';b.dataset.pageKey='';b.classList.remove('visible');b.fadeUntil=0;b.displayMessage=null;b.captionFit=null;b.setAttribute('aria-hidden','true');
 }
 for(const id of engine.starts.keys())if(!retained.has(id))engine.starts.delete(id);
 for(const m of engine.queue)if(!retained.has(m.afterId))m.afterId=null;
 engine.lastPreparedId=retained.size?Math.max(...retained):null;
 for(const [id,c]of dialogueDisplay.cards)if(c.message.cueKey!==key)dialogueDisplay.cards.delete(id);
 for(const id of dialogueDisplay.groups.keys())if(id!==key)dialogueDisplay.groups.delete(id);
 const at=cueTracker?.rows.findIndex(r=>r.index===position.index&&r.sentenceIndex===position.sentenceIndex)??-1;
 for(const r of cueLedger.records.values())if(r.key!==key&&['queued','playing','cancelled','interrupted'].includes(r.state)){const row=cueTracker?.rows.findIndex(u=>u.key===r.key)??-1;r.state=row<=at?'skipped':r.started.length?'interrupted':'cancelled';}
 bubbleLayout=bubbleLayout.filter(b=>dialogueDisplay.cards.get(b.id)?.message.cueKey===key);bubbleLayoutKey='';
}
function markSkippedBeforeScope(keepKey){if(!cueTracker||!manualSceneScope)return;for(const row of cueTracker.rows.slice(0,cueTracker.floor)){const replies=speechScript.blocks[row.index].sentences[row.sentenceIndex].replies;if(row.key!==keepKey&&replies.length&&!cueLedger.has(row.key))cueLedger.records.set(row.key,{key:row.key,state:'skipped',count:replies.length,started:[],finished:[]});}}
function scopeToScene(row,index,{from,keepKey}={}){
 const units=row?.units;if(!units?.length)return;const first=from||units[0];manualSceneScope={sceneId:row.sceneId,shotIndex:index,first,last:units.at(-1)};cueTracker?.setScope(units);if(from&&cueTracker)cueTracker.moveScopeFloor(cueTracker.rows.findIndex(r=>r.index===from.index&&r.sentenceIndex===from.sentenceIndex));markSkippedBeforeScope(keepKey);
 scriptFollower.seek(first.index,first.sentenceIndex);const indices=units.map(u=>scriptFollower.rows.findIndex(r=>r.index===u.index&&r.sentenceIndex===u.sentenceIndex));scriptFollower.range={from:scriptFollower.cursor,to:Math.max(...indices)};
}
function rescueScene(index){
 const row=shotFollower?.rows[index],first=row?.units?.[0];if(!first)return;
 const wasActive=voiceActive;resetPlayback({keepVoice:true});discardSceneReplies();scenePlayback?.cancel();
 if(voiceSession)retiredVoiceSessions.add(voiceSession);voiceSession='';speechSentences.seq=0;inputFinalSeq=0;voiceReset={token:String(Date.now())+'-'+controlEpoch,epoch:controlEpoch,sceneId:row.sceneId,pending:wasActive};
 shotFollower.seek(index);scopeToScene(row,index);inputFloor=first.index;awaitingSection=false;engine.topic=first.index;followState={...(cueTracker?.follow||scriptFollower.last)};
 openingAt=null;entryAt=null;openingTarget=null;openingLayer.style.opacity='0';cutShot(row,true);pause(false);setPresentation(first.index,first.sentenceIndex,'manual','next');trace('scene-rescue',{sceneId:row.sceneId,index:first.index,sentenceIndex:first.sentenceIndex});status();
}
function syncSceneSpeech(sceneId=activeScenery?.id){
 const index=shotFollower?.rows.findIndex(r=>r.sceneId===sceneId)??-1,row=shotFollower?.rows[index];
 let unit=row?.units?.[0];
 if(index>=0){shotFollower.seek(index);scopeToScene(row,index);}
 else{const block=speechScript?.blocks?.findIndex(b=>b.sceneId===sceneId)??-1;if(block>=0){unit={index:block,sentenceIndex:0};manualSceneScope=null;scriptFollower.seek(block,0);cueTracker?.reset(block,0);}if(sceneId===openingSceneId())shotFollower?.reset();}
 if(!unit)return;followState={...(cueTracker?.follow||scriptFollower.last)};inputFloor=unit.index;engine.topic=unit.index;setPresentation(unit.index,unit.sentenceIndex,'ready');
}
function takeManualScene(sceneId,revision){
 if(!sceneId||!scenePlayback)return;
 const target=scenePlayback.prepared&&SceneCatalog.locate(scenePlayback.prepared.catalog,sceneId)?.scene;
 // Legacy independently selected maps do not own a manuscript range.
 if(!speechScript?.blocks?.some(b=>b.sceneId===sceneId)&&!isLiveDialogue()&&!target?.liveDialogue&&!namedOpening()){
  clearAudienceCaption();desiredShotId='';openingTarget=null;openingAt=null;entryAt=null;openingLayer.style.opacity='0';
  if(scenePlayback.prepared?.revision!==revision||!scenePlayback.cut(sceneId))scenePlayback.take(sceneId,revision,{immediate:true});return;
 }
 const liveChange=isLiveDialogue()||target?.liveDialogue===true,wasActive=voiceActive;resetPlayback({keepVoice:true});discardSceneReplies();scenePlayback.cancel();
 if(voiceSession)retiredVoiceSessions.add(voiceSession);voiceSession='';speechSentences.seq=0;inputFinalSeq=0;
 voiceReset={kind:liveChange?'live-scene':'scene',...(liveChange?{liveDialogue:target?.liveDialogue===true}:{}),token:String(Date.now())+'-'+controlEpoch,epoch:controlEpoch,sceneId,pending:wasActive};
 manualSceneRequest={sceneId};awaitingSection=false;
 if(CuePlan.sequenceMode(speechScript)&&speechScript.stageBinding.status==='pending')sequenceSceneManual=true;
 desiredShotId=sceneId;sceneRetryAt=performance.now()+2000;openingTarget=null;openingAt=null;entryAt=null;openingLayer.style.opacity='0';openingLayer.style.backgroundImage='';
 if(sceneId===openingSceneId())openingCast.reset();
 pause(false);
 if(scenePlayback.prepared?.revision!==revision||!scenePlayback.cut(sceneId))scenePlayback.take(sceneId,undefined,{immediate:true}).then(()=>{if(manualSceneRequest?.sceneId===sceneId&&!scenePlayback.pending){manualSceneRequest=null;desiredShotId='';syncSceneSpeech();status();}});
 trace('scene-manual',{sceneId});status();
}

function cutShot(row,replyReady=false){if(cueTracker&&!replyReady&&(manualCues.length||engine.queue.length||engine.actors.some(a=>a.phase!=='idle')||dialogueDisplay.closing(engine.time))){deferredReplyScene=row;return;}desiredShotId=row.sceneId;sceneRetryAt=performance.now()+2000;if(openingAt!==null&&(row.sceneId.startsWith('sc-jingang-')||(standbyOpening()&&row.sceneId===shotFollower?.rows[0]?.sceneId)||(whiteOpening()&&row.sceneId===openingSceneId()))){openingTarget=row;status();return;}openingAt=null;entryAt=null;openingLayer.style.opacity='0';if(!scenePlayback.cut(row.sceneId)&&scenePlayback.prepared)scenePlayback.take(row.sceneId,scenePlayback.prepared.revision,{immediate:true});trace('scene-cut',{sceneId:row.sceneId});status();}
function advanceOpening(now){if(openingAt===null)return;const elapsed=now-openingAt;if(standbyOpening()){const target=(openingTarget||shotFollower.rows[0]).sceneId;if(scenePlayback.active?.id!==target&&!scenePlayback.cut(target)){openingLayer.style.opacity='1';if(!scenePlayback.pending&&now>=sceneRetryAt){sceneRetryAt=now+2000;scenePlayback.take(target,scenePlayback.prepared.revision,{immediate:true});}return;}if(scenePlayback.active?.id!==target)return;if(entryAt===null)entryAt=now;const fadeElapsed=now-entryAt;openingLayer.style.opacity=String(Math.max(0,1-fadeElapsed/1700));if(fadeElapsed>=1700){openingAt=null;openingLayer.style.backgroundImage='';}return;}if(whiteOpening()){const target=(openingTarget||shotFollower.rows[0]).sceneId;if(scenePlayback.active?.id!==target&&!scenePlayback.cut(target))return;openingLayer.style.opacity=String(Math.max(0,1-elapsed/650));if(elapsed>=650)openingAt=null;return;}if(elapsed<550){openingLayer.style.opacity=String(elapsed/550);return;}if(elapsed<1050){openingLayer.style.opacity='1';return;}
 if(entryAt===null){const id=(openingTarget||shotFollower.rows[0]).sceneId;if(scenePlayback.active?.id!==id&&!scenePlayback.cut(id)){if(!scenePlayback.pending&&now>=sceneRetryAt){sceneRetryAt=now+2000;scenePlayback.take(id,scenePlayback.prepared.revision,{immediate:true});}return;}entryAt=now+450;}
 openingLayer.style.opacity=String(Math.max(0,1-(elapsed-1050)/650));if(elapsed>=1700)openingAt=null;
}
function retryShotScene(now){if(!desiredShotId||openingAt!==null||scenePlayback?.active?.id===desiredShotId||scenePlayback?.pending||now<sceneRetryAt)return;sceneRetryAt=now+2000;const revision=scenePlayback?.prepared?.revision;if(revision!==undefined)scenePlayback.take(desiredShotId,revision,{immediate:true});}
function openingSceneId(){const maps=scenePlayback?.prepared?.catalog.maps||[];return scenePlayback?.prepared?.catalog.standbySceneId||(maps.find(m=>m.id==='sc-map-overview')||maps[0])?.scenes[0]?.id||'sc-overview-1';}
function standbyOpening(){return scenePlayback?.prepared?.catalog.openingMode==='standby';}
function whiteOpening(){return scenePlayback?.prepared?.catalog.openingMode==='white';}
// New voice sequence IDs do not replace the saved visual catalog. Keep its
// actual assets available until the colleague's complete configs are bound.
function existingPerformanceScene(){const catalog=scenePlayback?.prepared?.catalog,standby=catalog?.standbySceneId;return catalog?.timeline?.map(r=>r.sceneId).find(id=>id!==standby&&SceneCatalog.locate(catalog,id))||catalog?.maps.flatMap(m=>m.scenes).find(s=>s.id!==standby)?.id;}
function namedOpening(){return speechScript?.stageBinding?.openingCue==='named-cast';}
function beginExistingOpening(){
 if(namedOpening()&&!openingCast.transitioned)return;
 if(!CuePlan.sequenceMode(speechScript)||sequenceSceneManual||openingAt!==null||activeScenery?.id!==openingSceneId())return;
 const target=existingPerformanceScene();if(!target||target===activeScenery.id)return;
 if(SceneCatalog.isStaticCast(activeScenery)){openingTarget=null;openingAt=null;entryAt=null;openingLayer.style.opacity='0';openingLayer.style.backgroundImage='';desiredShotId=target;if(!scenePlayback.cut(target))scenePlayback.take(target,scenePlayback.prepared?.revision,{immediate:true});return;}
 openingTarget={sceneId:target};openingSpeechTime=engine.time;entryAt=null;desiredShotId=target;
 if(standbyOpening())Object.assign(openingLayer.style,{backgroundImage:activeScenery.background?`url("${activeScenery.background}")`:'',backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat',opacity:'1'});
 openingAt=performance.now();
}
function ensureExistingSequenceScene(index=0){if(CuePlan.sequenceMode(speechScript)&&speechScript.stageBinding.status==='pending'&&index>0)beginExistingOpening();}
function resetShotScenes(){
 openingCast.reset();
 desiredShotId='';openingTarget=null;sequenceSceneManual=false;openingLayer.style.backgroundImage='';openingAt=null;entryAt=null;openingLayer.style.opacity=whiteOpening()?'1':'0';shotFollower?.reset();scenePlayback?.cancel();
 const target=openingSceneId();if(scenePlayback?.prepared&&!scenePlayback.cut(target))scenePlayback.take(target,scenePlayback.prepared.revision,{immediate:true});status();
}
function rebindShots(reset=false){
 const old=shotFollower,bound=SceneScript.bind(scenePlayback.prepared.catalog,speechScript);
 sceneBindingWarning=bound.warning;
 if(CuePlan.sequenceMode(speechScript)&&speechScript.stageBinding.status==='pending'){shotFollower=null;scenePlayback.cancel();if(reset||!activeScenery||!SceneCatalog.locate(scenePlayback.prepared.catalog,activeScenery.id))resetShotScenes();status();return;}
 shotFollower=typeof ShotFollower==='function'&&bound.rows.length?new ShotFollower(bound.rows,{change:cutShot,opening:()=>{if(speechScript?.stageBinding?.status==='bound'){beginExistingOpening();return;}openingSpeechTime=engine.time;entryAt=null;openingTarget=null;if(standbyOpening()){const standby=SceneCatalog.locate(scenePlayback.prepared.catalog,openingSceneId())?.scene;Object.assign(openingLayer.style,{backgroundImage:standby?.background?`url("${standby.background}")`:'',backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat',opacity:'1'});openingAt=performance.now();}else if(cueTracker&&!whiteOpening()){openingAt=null;openingLayer.style.opacity='0';scenePlayback.cut(openingSceneId());}else openingAt=performance.now();},now:()=>performance.now()}):null;
 if(reset)resetShotScenes();
 else if(old&&shotFollower&&JSON.stringify(old.rows.map(r=>r.text))===JSON.stringify(shotFollower.rows.map(r=>r.text)))shotFollower.seek(old.index);
}
function followBoundScene(match,complete){
 if(isLiveDialogue())return;
 if(!shotFollower||!match?.matched||(!match.cueAligned&&match.confidence<90))return;
 const index=SceneScript.rowFor(shotFollower.rows,match.index,match.sentenceIndex);if(index<0)return;
 if(index===0&&namedOpening())openingCast.transitioned=true;
 if(index===0&&!shotFollower.started){shotFollower.started=true;shotFollower.index=0;shotFollower.opening(shotFollower.rows[0]);}
 else if(index>shotFollower.index){shotFollower.started=true;shotFollower.move(index);}
 if(index===shotFollower.index&&openingAt===null&&activeScenery?.id!==shotFollower.rows[index].sceneId&&!desiredShotId)cutShot(shotFollower.rows[index]);
 const end=shotFollower.rows[index].units?.at(-1);
 if(speechScript?.stageBinding?.status!=='bound'&&complete&&end?.index===match.index&&end.sentenceIndex===match.sentenceIndex){shotFollower.move(index+1);if(manualSceneScope&&shotFollower.rows[index+1])scopeToScene(shotFollower.rows[index+1],index+1);}
}
async function loadShotScenes(){const token=++shotLoadToken;try{const record=await scenePlayback.load();await scenePlayback.prepare(record);if(token!==shotLoadToken)return;rebindShots();
 const refreshed=activeScenery&&SceneCatalog.locate(scenePlayback.prepared.catalog,activeScenery.id)?.scene;if(refreshed){activeScenery.actors.forEach((a,i)=>{a.bubble=refreshed.actors[i].bubble;a.bubbleCues=refreshed.actors[i].bubbleCues;});bubbleLayout=[];bubbleLayoutKey='';bubbleNodes.forEach(b=>b.captionFit=null);}
 if(!activeScenery){openingLayer.style.opacity=whiteOpening()?'1':'0';scenePlayback.cut(openingSceneId());}else if(desiredShotId&&desiredShotId!==activeScenery.id)sceneRetryAt=0;status();
 }catch(e){scenePlayback.message='镜头本未就绪：'+e.message;status();}}
if(realtimeOnly&&scenePlayback){
 liveStage=new LiveStage({getScene:()=>activeScenery,status,caption:text=>{liveCaption.textContent=liveSubtitles.caption(text);},clear:()=>{engine.clear();dialogueDisplay.reset();clearBubblePresentation();pause(false);},enqueue:messages=>{engine.enqueueDiscussion(messages);status();},take:async(id,actors=[])=>{
  const generation=++liveTakeGeneration;scenePlayback.cancel();
  if(!id)return;
  const record=await scenePlayback.load(),target=SceneCatalog.locate(SceneCatalog.normalize(record.catalog),id)?.scene;
  if(generation!==liveTakeGeneration)return;
  if(!target||actors.some(i=>!target.actors[i]?.present||target.actors[i]?.visualHidden))throw Error('所选场景没有对应人物，未上屏。');
  await scenePlayback.take(id,record.revision,{immediate:true});
  if(scenePlayback.active?.id!==id)throw Error(scenePlayback.message||'场景加载失败');
  openingLayer.style.opacity='0';
 }});
 const startupGeneration=liveTakeGeneration;scenePlayback.load().then(record=>{if(startupGeneration!==liveTakeGeneration)return;scenePlayback.prepared={...record,catalog:SceneCatalog.normalize(record.catalog),failed:new Set()};return scenePlayback.take('sc-q925-t2',record.revision,{immediate:true});}).then(()=>{openingLayer.style.opacity='0';status();}).catch(()=>{scenePlayback.message='舞台加载失败，请刷新重试';status();});
}else if(scenePlayback&&typeof ShotFollower==='function')loadShotScenes();

function previewShot(text){
 if(!shotFollower||!text)return;
 const needle=normal(text).slice(0,22),index=shotFollower.rows.findIndex(r=>normal(r.text).includes(needle));
 if(index<0)return;
 if(index===0&&shotFollower.index<0){shotFollower.feed('尊敬的',true);return;}
 shotFollower.seek(index);cutShot(shotFollower.rows[index]);
}

function fitBubbleText(b){
 if(typeof getComputedStyle!=='function'||!b.dataset.text)return;
 const key=[b.dataset.text,b.dataset.presentation,activeScenery?.id,w,h].join('|');if(b.dataset.fitKey===key)return;b.dataset.fitKey=key;
 const text=b.querySelector('.bubble-text');text.style.fontSize='';let size=parseFloat(getComputedStyle(text).fontSize)||14;
 // Audience captions have no operator to scroll them. Fit the entire fixed line.
 while((text.scrollWidth>text.clientWidth+1||text.scrollHeight>text.clientHeight+1)&&size>10){size-=.5;text.style.fontSize=size+'px';}
}

function renderCaption(b,a,fitted){
 const layout=fitted||CaptionLayout.whole(a.message.text,{fontSize:Math.max(12,Math.min(16,w*.0095)),maxHeight:Math.max(80,Math.min(360,h*.42,h-135)),maxWidth:Math.max(90,Math.min(340,w*.36)-24),scale:CaptionLayout.DISPLAY_SCALE});
 DialogueOverlay.renderText(b,a.message.text,layout,document);
}
