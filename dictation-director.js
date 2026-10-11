'use strict';
window.setupDictationDirector=function({send,toast,getStatus,stopNative}){
 const field=document.getElementById('dictation-text'),start=document.getElementById('dictation-start'),stop=document.getElementById('dictation-stop'),confirm=document.getElementById('dictation-confirm'),state=document.getElementById('dictation-status'),mode=document.getElementById('input-mode');
 const input=new DictationInput({send:event=>send('voice-transcript',event),onDraft:text=>{field.value=text;}});
 function render(){start.disabled=input.active||getStatus()?.finaleActive===true;stop.disabled=!input.active;confirm.disabled=!input.active||input.composing||!input.draft.trim();field.readOnly=!input.active;state.textContent=input.active?(input.pending?'正在送入跟稿，等待大屏确认':input.composing?'输入法组字中，暂不提交':'已准备接收豆包文字；停顿后自动提交，也可点击确认'):'点击“启用豆包听写”，再将输入焦点留在下方文本框。';}
 function stopInput(){if(input.active)send('voice-state',{active:false,session:input.session});input.stop();render();}
 start.onclick=()=>{const stage=getStatus();if(!stage||Date.now()-stage.receivedAt>4000){toast('请先打开观众大屏。');return;}if(stage.finaleActive){toast('请先退出联合发布。');return;}stopNative();input.start(crypto.randomUUID(),stage.controlEpoch);send('voice-state',{active:true,session:input.session,source:'doubao-input'});render();field.focus();};
 stop.onclick=stopInput;
 confirm.onclick=()=>{input.submit();render();field.focus();};
 field.addEventListener('compositionstart',()=>{if(input.active)send('voice-activity',{session:input.session,epoch:input.epoch});input.composing=true;render();});
 field.addEventListener('compositionend',()=>{input.update(field.value);render();});
 field.addEventListener('input',event=>{input.update(field.value,{composing:event.isComposing||input.composing});render();});
 field.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!input.composing){event.preventDefault();input.submit();render();}});
 mode.onchange=()=>{stopInput();stopNative();document.getElementById('doubao-input-panel').hidden=mode.value!=='doubao';document.getElementById('native-input-panel').hidden=mode.value!=='native';};
 setInterval(()=>{input.poll();render();},200);
 window.addEventListener('pagehide',stopInput);
 render();
 return {stop:stopInput,active:()=>input.active,onStatus(status){const changed=status.controlEpoch!==input.epoch;input.acknowledge({session:status.inputSession,seq:status.inputFinalSeq,epoch:status.controlEpoch});if(changed&&input.active&&status.inputSession!==input.session)send('voice-state',{active:true,session:input.session,source:'doubao-input'});render();}};
};
