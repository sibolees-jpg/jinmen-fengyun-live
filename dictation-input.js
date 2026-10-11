(function(root){
'use strict';
class DictationInput{
 constructor({send,onDraft=()=>{},now=()=>performance.now(),settleMs=1200}={}){this.send=send;this.onDraft=onDraft;this.now=now;this.settleMs=settleMs;this.active=false;this.seq=0;this.epoch=0;this.reset();}
 start(session,epoch=0){this.reset();this.session=session;this.epoch=epoch;this.seq=0;this.active=true;}
 stop(){this.active=false;this.reset();}
 reset(){this.draft='';this.composing=false;this.pending=null;this.changedAt=this.now();this.onDraft('');}
 update(value,{composing=false}={}){if(!this.active)return;this.draft=String(value);this.composing=composing;this.changedAt=this.now();if(!composing&&!this.pending&&this.draft.trim())this.send({...this.event(this.draft,false),preview:true});}
 event(text,final){return {session:this.session,epoch:this.epoch,seq:++this.seq,text,final,source:'doubao-input'};}
 submit(){
  if(!this.active||this.composing||this.pending||!this.draft.trim())return false;
  const text=this.draft.trimStart().slice(0,2000),event=this.event(text,true);
  if(this.send(event)===false)return false;
  this.pending={event,at:this.now()};this.draft=this.draft.trimStart().slice(text.length).trimStart();this.onDraft(this.draft);return true;
 }
 poll(){if(!this.active||this.composing)return;if(this.pending){if(this.now()-this.pending.at>=1500){this.send(this.pending.event);this.pending.at=this.now();}return;}if(this.now()-this.changedAt>=this.settleMs)this.submit();}
 acknowledge({session,seq,epoch}){if(epoch!==undefined&&epoch!==this.epoch){this.epoch=epoch;this.reset();return;}if(session===this.session&&this.pending&&seq>=this.pending.event.seq)this.pending=null;}
}
if(typeof module!=='undefined')module.exports={DictationInput};else root.DictationInput=DictationInput;
})(globalThis);
