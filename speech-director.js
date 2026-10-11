(function(root){
'use strict';
root.setupSpeechDirector=function({send,toast,getStatus,getFinale}){
 const $=id=>document.getElementById(id),text=UIPatch.text,attr=UIPatch.attr;
 let info=null,mode='stopped',message='',source='api',lastActivity=0,pendingAt=0,localStopping=false;const pending=[];let level=0,lastLevelAt=0;const latency={};let resetToken='',captureEpoch=null;
 const microphonePreferenceKey='jinmen.microphone.preference.v1';let microphonePreference=null,microphoneRevision=0;
 try{const saved=JSON.parse(localStorage.getItem(microphonePreferenceKey));if(saved&&typeof saved.deviceId==='string'&&typeof saved.label==='string')microphonePreference=saved;}catch{}
 const connected=()=>{const s=getStatus();return s&&Date.now()-s.receivedAt<4000&&s.stageVersion===13&&(!s.guardRequired||s.cueGuardVersion>=(s.guardVersion||2))&&s.scriptReady!==false&&s.scenery?.ready!==false&&!getFinale();};
 const textMode=()=>source==='local'||source==='macos'&&(info?.available===false||input.active);
 const field=$('dictation-text');
 const input=new DictationInput({send:event=>send('voice-transcript',event),onDraft:value=>{if(field.value!==value)field.value=value;}});
 const capture=new SpeechCapture({
  onState(state){if(state.mode==='starting'&&!capture.id){pending.length=0;captureEpoch=getStatus()?.controlEpoch;}mode=state.mode;message=state.message;if(!textMode()&&!capture.monitorOnly)send('voice-state',{active:['starting','listening','stopping'].includes(mode),session:capture.id||'',resetToken,source:source==='macos'?'macos':'doubao-api'});render();if(['stopped','error'].includes(mode))loadMicrophones();},
  onLevel(event){renderLevel(event);},
  onMetrics(value){Object.assign(latency,value);const box=$('speech-latency');if(box)text(box,`上传积压 ${Math.round(latency.uploadBacklogMs||0)} ms · 云端进度差 ${Number.isFinite(latency.recognitionLagMs)?(latency.recognitionLagMs/1000).toFixed(1)+' 秒':'等待识别'}（含停顿）${latency.recognitionLagMs>5000?' · 持续讲话时若仍落后，可用“保险 · 下一句话”清空重跟':''}`);},
  onTranscript(event){if(textMode())return;event={...event,epoch:captureEpoch??getStatus()?.controlEpoch};if(!pending.length)pendingAt=Date.now();pending.push(event);flush();},
  onActivity(event){if(Date.now()-lastActivity<300)return;lastActivity=Date.now();send('voice-activity',{...event,epoch:getStatus()?.controlEpoch});},
  onCalibration(event){if(source!=='api')return;if(event.type==='reconnecting'){message='语音会话自动续接中 · 保持收音';render();return;}if(event.type==='calibration'&&mode==='listening'){message='持续收音中 · 停顿后仍保持开启';render();}if(event.type==='calibrating')text($('calibration-status'),'语音校准文稿 · 换稿重连中');else if(event.type==='calibration')text($('calibration-status'),`语音校准文稿 · 豆包已接收 ${event.hotwords} 词`);if(event.type==='recalibrated')send('voice-state',{active:true,session:capture.id});}
 });
 function flush(){
  const state=getStatus();for(let i=0;i<pending.length;){const event=pending[i];if(event.epoch!==state?.controlEpoch){pending.splice(i,1);continue;}if(event.scriptSignature&&event.scriptSignature!==state?.scriptSignature){i++;continue;}pending.splice(i,1);if(!send('voice-transcript',{...event,source:source==='macos'?'macos':'doubao-api'})){capture.fail('大屏连接中断，收音已停止。');break;}}
  if(pending.length>30||(pending.length&&Date.now()-pendingAt>5000)){pending.length=0;capture.fail('稿件同步未完成，收音已停止。请刷新大屏后继续。');}
 }
 function stopLocal({discard=false}={}){
  if(!input.active)return;
  if(!discard&&connected()&&(input.composing||input.pending||input.draft.trim())){localStopping=true;input.submit();render();return;}
  send('voice-state',{active:false,session:input.session,resetToken,source:'doubao-input'});input.stop();localStopping=false;render();
 }
 function render(){
  const local=textMode(),working=local?input.active:['starting','listening','stopping','monitoring'].includes(mode),on=local?input.active:mode==='listening',button=$('speech-toggle');
  button.disabled=(capture.monitorOnly&&(capture.active||capture.starting))||(local?localStopping:mode==='stopping')||(!working&&(!connected()||(!local&&!info?.available)));
  attr(button,'aria-pressed',on);attr(button,'aria-label',local?(on?(source==='macos'?'停止 macOS 听写接收':'停止接收豆包输入法'):(source==='macos'?'启用 macOS 听写接收':'启用本地豆包输入法')):(on?'停止接收':mode==='starting'?'取消连接':'启用接收'));attr(button,'data-recording',on);
  attr($('speech-icon'),'src',on?'assets/ui/mic-on.png':'assets/ui/mic-off.png');attr($('speech-icon'),'class',on?'mic-on':'mic-off');
  text($('speech-toggle-label'),local?(localStopping?'确认末句中':on?'停止接收':'启用接收'):mode==='starting'?'取消连接':mode==='stopping'?'停止中':on?'停止接收':'启用接收');
  const localState=!connected()?'等待大屏连接':localStopping?'等待末句确认':input.active?(input.composing?'豆包正在组字':input.pending?'正在送入大屏':document.activeElement!==field?'接收已启用 · 点击下方输入框继续听写':'接收已启用 · 使用豆包快捷键说话'):'本地豆包输入法 · 无需 API 密钥';
  $('local-input-panel').hidden=!local;text($('local-input-title'),source==='macos'?'macOS 听写文字接收':'豆包文字接收');text($('local-input-help'),source==='macos'?'本机识别组件未就绪；点击此框，使用 macOS 系统听写，文字自动送入大屏。':'切换到豆包输入法，使用其语音快捷键；停顿后自动送入大屏。');field.placeholder=source==='macos'?'启用接收后，在此框使用 macOS 系统听写。':'启用接收后，在此框使用豆包本地语音输入。';text($('speech-status'),local?(source==='macos'?localState.replaceAll('豆包','macOS 系统听写'):localState):working||mode==='error'?message:!connected()?'等待大屏连接':info?.available?'已就绪 · 点击启用后持续收音':info?.message||'等待语音服务');
  attr($('speech-status'),'data-error',!local&&mode==='error');$('microphone').disabled=working;$('input-mode').disabled=working;$('voice-backup').disabled=working;
  $('microphone-test').disabled=Boolean(input.active||capture.stopping||(capture.starting||capture.active)&&!capture.monitorOnly);text($('microphone-test'),capture.monitorOnly&&capture.starting?'取消检测':capture.monitorOnly&&capture.active?'停止检测':'检测设备');
  field.readOnly=!input.active;$('dictation-confirm').disabled=!input.active||input.composing||!input.draft.trim()||Boolean(input.pending);
  if(working&&!connected()){if(local)stopLocal({discard:true});else if(mode==='listening')capture.fail('大屏已断开，收音已停止；请重新连接。');}
 }
 function renderLevel(event){
  const rms=Number.isFinite(event.rms)?Math.max(0,event.rms):0,peak=Number.isFinite(event.peak)?event.peak:0;
  level=event.active?Math.max(Math.min(1,Math.max(0,(20*Math.log10(Math.max(rms,1e-6))+60)/60)),level*.72):0;lastLevelAt=Date.now();
  const value=Math.round(level*100),bar=$('input-level');attr(bar,'aria-valuenow',value);attr(bar,'data-clipping',peak>=.98);$('input-level-fill').style.transform=`scaleX(${value/100})`;
  text($('input-level-label'),!event.active?'麦克风未开启':peak>=.98?'输入过强':rms>.003?'收到音频输入':'麦克风已开启 · 安静');
 }
 $('microphone-test').onclick=()=>{if(capture.monitorOnly&&(capture.active||capture.starting))capture.stop();else if(!capture.active&&!capture.starting&&!input.active)capture.start($('microphone').value,{monitorOnly:true});};
 function calibration(){const c=info?.calibration;text($('calibration-status'),source!=='api'?'语音校准文稿 · 本机匹配已更新':c?`语音校准文稿 · ${c.state==='accepted'?'豆包已接收':'已准备'} ${c.hotwords} 词`:'语音校准文稿 · 等待稿件');$('calibration-status').title=source!=='api'?'换稿更新本程序的关键句与人名容错；不向本地输入法或系统词库注入热词。':'换稿自动更新热词，开始录音时提交豆包 API。热词不能保证零错字。';}
 async function refresh(){const requested=source;try{const response=await fetch(source==='macos'?'/api/macos-speech/status':'/api/speech/status',{signal:AbortSignal.timeout(9000)});if(!response.ok)throw new Error();const result=await response.json();if(requested!==source)return;info=result;if(!capture.active&&!capture.starting&&!capture.stopping&&mode!=='error')message=info.message;}catch{if(requested!==source)return;info=null;message='语音服务未连接';}calibration();render();}

 const microphoneBusy=()=>input.active||capture.active||capture.starting||capture.stopping;
 function rememberMicrophone(preference){microphonePreference=preference;try{localStorage.setItem(microphonePreferenceKey,JSON.stringify(preference));}catch{}}
 async function loadMicrophones(){
  if(microphoneBusy())return;const revision=++microphoneRevision;
  try{
   const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'&&d.deviceId);
   // A device-list refresh must never change the microphone under an active session.
   if(revision!==microphoneRevision||microphoneBusy())return;
   const select=$('microphone'),physical=devices.filter(d=>!['default','communications'].includes(d.deviceId)),named=physical.filter(d=>d.label),preferred=microphonePreference;
   const dji=named.find(d=>/\bDJI\b|大疆/i.test(d.label)),backup=named.find(d=>/MacBook.*(?:Microphone|麦克风)|(?:Built.in|内建|内置).*麦克风|Built.in Microphone/i.test(d.label));
   let selected=preferred?.deviceId===''?null:devices.find(d=>d.deviceId===preferred?.deviceId)||named.find(d=>preferred?.label&&d.label===preferred.label);
   if(!selected&&preferred?.deviceId!=='')selected=preferred?backup:dji||backup;
   const awaitingPermission=Boolean(preferred?.deviceId&&!devices.some(d=>d.label));
   select.replaceChildren(new Option('系统默认麦克风',''));
   for(const device of devices)select.append(new Option(device.label||(awaitingPermission&&device.deviceId===preferred.deviceId?preferred.label+'（待权限确认）':'麦克风'),device.deviceId));
   // Safari can hide devices again after reload. Do not silently replace a remembered mic with the system default.
   if(awaitingPermission&&!devices.some(d=>d.deviceId===preferred.deviceId))select.append(new Option(preferred.label+'（待权限确认）',preferred.deviceId));
   select.value=awaitingPermission?preferred.deviceId:selected?.deviceId||'';
   // Keep the DJI preference when it is unplugged; a temporary backup is not a new preference.
   if(!preferred&&selected===dji&&dji)rememberMicrophone({deviceId:dji.deviceId,label:dji.label});
  }catch{}
 }
 $('microphone').onchange=()=>{if(microphoneBusy())return;microphoneRevision++;const select=$('microphone'),option=[...select.options].find(o=>o.value===select.value);rememberMicrophone({deviceId:select.value,label:select.value===microphonePreference?.deviceId?microphonePreference.label:option?.textContent||''});};
 navigator.mediaDevices?.addEventListener?.('devicechange',loadMicrophones);
 $('speech-toggle').onclick=()=>{
  if(textMode()){if(input.active){stopLocal();return;}if(!connected())return;input.start(crypto.randomUUID(),getStatus().controlEpoch);send('voice-state',{active:true,session:input.session,resetToken,source:'doubao-input'});render();field.focus();}
  else if(capture.active||capture.starting)capture.stop();else if(connected()&&info?.available)capture.start($('microphone').value);
 };
 field.addEventListener('compositionstart',()=>{if(!input.active)return;input.composing=true;send('voice-activity',{session:input.session,epoch:input.epoch});render();});
 field.addEventListener('compositionend',()=>{input.update(field.value);if(localStopping)input.submit();render();});
 field.addEventListener('input',event=>{input.update(field.value,{composing:event.isComposing||input.composing});render();});
 field.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!input.composing){event.preventDefault();input.submit();render();}});
 $('dictation-confirm').onclick=()=>{input.submit();render();field.focus();};
 function chooseSource(value){if(input.active||capture.active||capture.starting||capture.stopping)return;source=['local','macos'].includes(value)?value:'api';capture.setProvider(source);mode='stopped';message='';info=null;pending.length=0;$('input-mode').value=source;$('voice-backup').value=source;$('local-input-panel').hidden=source!=='local';$('api-input-panel').hidden=source!=='api';text($('speech-provider'),source==='local'?'豆包本地输入法 · 备用一':source==='macos'?'macOS 本机识别 · 备用二':'豆包流式语音 · 默认');calibration();render();refresh();if(source!=='local')loadMicrophones();}
 $('input-mode').value='api';$('voice-backup').value='api';$('input-mode').onchange=()=>chooseSource($('input-mode').value);$('voice-backup').onchange=()=>chooseSource($('voice-backup').value);

 $('speech-auth-mode').onchange=()=>{const legacy=$('speech-auth-mode').value==='legacy';$('asr-key-row').hidden=legacy;$('asr-legacy-fields').hidden=!legacy;};
 $('speech-config-save').onclick=async()=>{const button=$('speech-config-save');button.disabled=true;try{const response=await fetch('/api/speech/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({authMode:$('speech-auth-mode').value,apiKey:$('asr-key').value,appId:$('asr-app-id').value,accessToken:$('asr-token').value,resourceId:$('asr-resource').value})}),result=await response.json();if(!response.ok)throw new Error(result.error?.message);for(const id of ['asr-key','asr-app-id','asr-token'])$(id).value='';text($('speech-config-result'),'已保存。点击麦克风验证连接。');await refresh();}catch(error){text($('speech-config-result'),error.message||'保存失败');}finally{button.disabled=false;}};
 window.addEventListener('pagehide',()=>{if(input.active)stopLocal({discard:true});if(capture.active||capture.starting){const monitoring=capture.monitorOnly;capture.dispose();if(!monitoring)send('voice-state',{active:false});}});
 loadMicrophones();refresh();setInterval(refresh,2500);setInterval(()=>{if(capture.active&&Date.now()-lastLevelAt>1000){renderLevel({rms:0,active:false});text($('input-level-label'),'等待麦克风数据');}input.poll();if(localStopping&&!input.pending&&!input.composing&&!input.draft.trim())stopLocal();flush();render();},200);
 return {capture,refresh,render,active:()=>input.active||!capture.monitorOnly&&(capture.active||capture.starting||capture.stopping),stop:()=>{if(capture.monitorOnly)return;stopLocal({discard:true});return capture.stop();},onStatus(status){const rescue=status.voiceReset;if(rescue?.token&&rescue.token!==resetToken){resetToken=rescue.token;pending.length=0;captureEpoch=status.controlEpoch;if(input.active){input.start(crypto.randomUUID(),status.controlEpoch);send('voice-state',{active:true,session:input.session,resetToken,source:'doubao-input'});field.focus();}else if(capture.active||capture.starting||capture.stopping){capture.restartFresh($('microphone').value);}toast(rescue.kind==='live-scene'?(rescue.liveDialogue?'已切入临场接话，旧识别已清除；此前收音时自动重新连接。':'已回到固定稿场景，临场接话积压已清除。'):rescue.kind==='sentence'?'逐句保险：旧积压已清除，已推进一句并接话；原来正在收音时自动重连。':'切景保险：旧识别已作废，从新场第一句重新跟稿。');}else if(captureEpoch!==null&&captureEpoch!==status.controlEpoch){pending.length=0;captureEpoch=status.controlEpoch;}const changed=status.controlEpoch!==input.epoch;input.acknowledge({session:status.inputSession,seq:status.inputFinalSeq,epoch:status.controlEpoch});if(changed&&input.active&&status.inputSession!==input.session)send('voice-state',{active:true,session:input.session,resetToken,source:'doubao-input'});flush();render();}};
};
})(globalThis);
