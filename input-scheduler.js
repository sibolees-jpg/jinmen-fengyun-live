(function(root){
'use strict';
function firstSentence(value){
 const text=String(value||'').trimStart();
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(!/[。！？!?\n.]/.test(c))continue;
  if(c==='.'&&((/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||''))||text[i+1]==='.'||text[i-1]==='.'))continue;
  let end=i+1;while(end<text.length&&/[。！？!?\n”’」』）)"']/u.test(text[end]))end++;
  const sentence=text.slice(0,end).trim();return /[\p{L}\p{N}]/u.test(sentence)?sentence:null;
 }
 return null;
}
class InputScheduler{
 constructor(){this.lastSubmitted='';this.pendingManual=false;}
 poll(_now,draft,{busy=false,composing=false,enabled=true}={}){
  const text=String(draft||'').trim();
  if(!text){this.lastSubmitted='';this.pendingManual=false;return null;}
  if(composing||busy)return null;
  const sentence=firstSentence(text)||(this.pendingManual?text:null);
  if((!enabled&&!this.pendingManual)||!sentence||(!this.pendingManual&&text===this.lastSubmitted))return null;
  this.pendingManual=false;this.lastSubmitted=text;return sentence;
 }
 submit(now,draft,options={}){this.pendingManual=true;return this.poll(now,draft,options);}
 consume(draft,sent){const text=String(draft||'').trimStart();if(!text.startsWith(sent))return draft;this.lastSubmitted='';return text.slice(sent.length).trimStart();}
 restoreFailed(now,failed,draft,{composing=false}={}){if(composing||String(draft||'').trim())return draft;this.cancel(now,failed);return failed;}
 cancel(_now,draft){this.pendingManual=false;this.lastSubmitted=String(draft||'').trim();}
}
if(typeof module!=='undefined')module.exports={InputScheduler,firstSentence};else{root.InputScheduler=InputScheduler;root.firstSentence=firstSentence;}
})(globalThis);
