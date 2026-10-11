(function(root){
'use strict';
const Calibration=typeof module!=='undefined'?require('./speech-calibration.js'):root.SpeechCalibration;
const norm=s=>(typeof module!=='undefined'?require('./script-follow.js').normalizeSpeech:root.normalizeSpeech)(s);
function distance(pattern,text){
 let row=Array(text.length+1).fill(0);
 for(let i=1;i<=pattern.length;i++){const next=[i];for(let j=1;j<=text.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+.4,row[j-1]+(pattern[i-1]===text[j-1]?0:1));row=next;}
 let best=Infinity,end=0;for(let j=1;j<row.length;j++)if(row[j]<=best){best=row[j];end=j;}return {edits:best,end};
}
function distinctAnchors(pattern,text,size){
 let count=0,last=-size;
 for(let i=0;i+size<=pattern.length;i++){
  if(i<last+size||!text.includes(pattern.slice(i,i+size)))continue;
  count++;last=i;if(count===2)break;
 }
 return count;
}
// ASR may omit a name or split one authored sentence across several finals.
// A completed tail plus ordered, separated evidence is safer than requiring
// the whole recognized sentence to resemble the manuscript character by character.
function anchorEvidence(pattern,text){
 const tailWindow=Math.max(24,Math.floor(pattern.length*.7));
 for(let size=Math.min(6,pattern.length);size>=2;size--){
   const start=pattern.length-size,tail=pattern.slice(start),endAt=text.lastIndexOf(tail);
   if(pattern.indexOf(tail)!==start||endAt<0||text.length-endAt-size>tailWindow)continue;
   const before=text.slice(Math.max(0,endAt-Math.max(120,pattern.length*3)),endAt);
   const context=pattern.slice(Math.max(0,start-14),start),nearby=before.slice(-40);
   if(!Array.from({length:Math.max(0,context.length-2)},(_,i)=>context.slice(i,i+3)).some(part=>nearby.includes(part)))continue;
   let p=0,t=0,coverage=0,hits=0,longest=0;
   while(p+3<=start&&t<before.length){
    let found=false;
    for(let length=Math.min(8,start-p);length>=3;length--){
     const at=before.indexOf(pattern.slice(p,p+length),t);
     if(at<0)continue;
     coverage+=length;hits++;longest=Math.max(longest,length);t=at+length;p+=length;found=true;break;
    }
    if(!found)p++;
   }
   const minimum=size>=4?.30:size===3?.40:.45;
   if(longest>=4&&hits>=(size===2?3:2)&&coverage>=Math.max(size===2?11:7,Math.ceil(pattern.length*minimum)))
    return {end:endAt+size,confidence:Math.min(89,Math.round(100*(coverage+size)/pattern.length))};
 }
 return null;
}
class CueTracker{
 constructor(script,{now=()=>performance.now(),stableMs=280}={}){this.script=script;this.now=now;this.stableMs=stableMs;this.rows=script.blocks.flatMap((b,index)=>b.sentences.map((s,sentenceIndex)=>({index,sentenceIndex,id:s.id,key:`${index}:${s.id}`,cuePolicy:s.cuePolicy,normal:norm(s.text),trigger:script.replyPolicy==='keyword-dialogue'?norm(s.trigger):''})));this.reset();}
 reset(index=0,sentenceIndex=0){this.scope=null;this.floor=this.rows.findIndex(r=>r.index===index&&r.sentenceIndex===sentenceIndex);if(this.floor<0)this.floor=0;this.history='';this.committedLength=0;this.positions=new Map();this.done=new Set();this.candidates=new Map();this.latest=this.floor-1;this.progressAt=this.floor-1;this.evidence=new Map();const Follower=typeof module!=='undefined'?require('./script-follow.js').ScriptFollower:root.ScriptFollower;this.locator=new Follower(this.script);this.locator.seek(index,sentenceIndex);this.follow={...this.locator.last};}
 feed(text,final=false){
  // After a manual scene rescue, use fresh evidence from this scene only.
  // A distinctive middle keyword can reacquire any remaining sentence without
  // replaying the sentences the speaker has already passed.
  if(this.scope){
   const fresh=norm(Calibration.repair(String(text),this.script)),hits=[];
   for(let at=this.floor;at<=this.scope.to;at++){const r=this.rows[at];if(!r||this.done.has(r.key))continue;const exact=r.trigger.length>=4&&fresh.includes(r.trigger),whole=r.normal.length>=4&&fresh.includes(r.normal);let fuzzy=false;
    if(!exact&&!whole&&r.trigger.length>=8){const fit=distance(r.trigger,fresh);fuzzy=fit.edits<=Math.min(3,Math.floor(r.trigger.length*.25))&&distinctAnchors(r.trigger,fresh,2)>=2;}
    if(exact||whole||fuzzy)hits.push({at,exact:exact||whole});
   }
   const exact=hits.filter(h=>h.exact),unique=exact.length===1?exact[0]:hits.length===1?hits[0]:null;
   if(unique){this.moveScopeFloor(unique.at);this.locator.cursor=unique.at;}
   this.locator.range={from:this.floor,to:this.scope.to};
  }
  const full=norm(Calibration.repair(this.history+String(text),this.script)),heard=full.slice(-2400),now=this.now(),present=new Set(),base=full.length-heard.length;
  if(final){this.history+=String(text);this.committedLength=full.length;}
  if(heard.length<(this.script.replyPolicy==='keyword-dialogue'?1:4)){this.follow={...this.follow,matched:false,complete:false,atEnd:false};return [];}
  const oldCursor=this.locator.cursor,oldFollow=this.follow;this.follow=this.locator.feed(text,final);
  const located=this.rows.findIndex(r=>r.index===this.follow.index&&r.sentenceIndex===this.follow.sentenceIndex);
  let reliable=this.follow.matched&&this.follow.confidence>=82&&this.follow.matchedChars>=8&&located>=this.floor;
  if(!this.scope&&this.script.replyPolicy==='keyword-dialogue'&&located>Math.max(this.floor,this.progressAt)+3&&this.follow.matchedChars<Math.max(12,this.rows[located]?.normal.length*.65)){reliable=false;this.locator.cursor=oldCursor;this.locator.last={...oldFollow};this.follow={...oldFollow,matched:false,complete:false,atEnd:false};}
  if(reliable&&this.scope)this.moveScopeFloor(located);
  const previous=this.progressAt;
  if(reliable){this.progressAt=Math.max(this.progressAt,located);this.latest=Math.max(this.latest,located);this.evidence.set(located,{end:this.follow.end,chars:this.follow.matchedChars});}
  const nextPending=Math.max(this.floor,this.progressAt);
  const candidate=(at,reason,confidence,evidenceEnd)=>{
   const r=this.rows[at];if(this.done.has(r.key))return;
   // Explicit end-phrase cues cannot use near-end estimates or boundary
   // recovery to reply before the speaker actually reaches that phrase.
   if(r.cuePolicy==='after-phrase'){
    const after=Math.max(base,...this.rows.slice(this.floor,at).map(p=>this.positions.get(p.key)??this.candidates.get(p.key)?.evidenceEnd??base));
    if(!r.trigger||!heard.slice(Math.max(0,after-base)).includes(r.trigger))return;
   }
   present.add(r.key);const old=this.candidates.get(r.key);
   this.candidates.set(r.key,{...r,at,reason,confidence,evidenceEnd,since:old?.since??now,confirmed:final||old?.confirmed===true});
  };
  if(reliable){
   const r=this.rows[located],covered=this.follow.matchedChars>=Math.min(12,Math.ceil(r.normal.length*.45));
   // Locate where the reader is in the manuscript, rather than demand an exact
   // whole-sentence transcript or exact last three characters.
   const shortTailLoss=final&&this.follow.remaining<=Math.min(3,Math.floor(r.normal.length*.15))&&this.follow.matchedChars>=r.normal.length*.65;
   if(covered&&(this.follow.end>=r.normal.length-1||shortTailLoss))candidate(located,'speech-position',this.follow.confidence,full.length);
   // Continuous reading across a boundary confirms the previous unit even when
   // its final word was dropped. A distant jump never autoplays unread scenes.
   if(!this.scope&&previous>=this.floor&&located>previous&&located-previous<=3){
    for(let at=previous;at<located;at++)candidate(at,'boundary-crossed',this.follow.confidence,full.length);
   }
  }
  for(let at=this.floor;at<this.rows.length;at++){
   if(this.scope&&at>this.scope.to)break;
   const r=this.rows[at];if(this.done.has(r.key))continue;
   if(this.script.replyPolicy==='keyword-dialogue'&&Math.abs(at-nextPending)>2&&!(reliable&&at===located))continue;
   if(r.trigger){
    // Only the nearby manuscript window can answer a keyword. Fresh evidence
    // prevents repeated phrases in the retained ASR history from firing ahead.
    const priorEnd=Math.max(base,...this.rows.slice(this.floor,at).map(p=>this.positions.get(p.key)??this.candidates.get(p.key)?.evidenceEnd??base));
    const input=heard.slice(Math.max(0,priorEnd-base));let hit=input.indexOf(r.trigger),end=hit+r.trigger.length,confidence=100;
    if(hit<0&&r.trigger.length>=6){const fit=distance(r.trigger,input),nearContext=at>=nextPending-1&&at<=nextPending+1,limit=nearContext&&r.trigger.length>=8?Math.min(3,Math.floor(r.trigger.length*.25)):r.trigger.length>=10?2:1;
     if(fit.edits<=limit&&distinctAnchors(r.trigger,input,2)>=2){hit=0;end=fit.end;confidence=Math.round(100*(1-fit.edits/r.trigger.length));}}
    if(hit>=0){candidate(at,'keyword',confidence,priorEnd+end);this.latest=Math.max(this.latest,at);}
   }
   const prior=this.rows.slice(this.floor,at).filter(p=>this.script.replyPolicy==='keyword-dialogue'||p.normal===r.normal).map(p=>this.positions.get(p.key)??this.candidates.get(p.key)?.evidenceEnd??-Infinity),after=prior.length?Math.max(...prior):base;
   const available=heard.slice(Math.max(0,after-base)),offset=heard.length-available.length;let found=available.indexOf(r.normal),end=found+r.normal.length,match=found>=0,confidence=100;
   if(!match){
    // Restrict fuzzy alignment to rows with distinctive evidence. This avoids
    // comparing every phrase to the whole manuscript on each audio update.
    const near=Math.abs(at-nextPending)<=2,anchors=distinctAnchors(r.normal,available,near?3:4);
    if(anchors>=2&&(!near||available.length>=Math.ceil(r.normal.length*.85))){
     const fit=distance(r.normal,available),limit=Math.max(1,Math.floor(r.normal.length*(near?.26:.22)));
     const endSeen=available.slice(Math.max(0,fit.end-8),fit.end).includes(r.normal.slice(-3));
     const heardTail=available.slice(Math.max(0,fit.end-5),fit.end),tailErrors=Array.from(r.normal.slice(-5)).filter((c,i)=>c!==heardTail[i]).length;
     end=fit.end;match=fit.edits<=limit&&(endSeen||final&&tailErrors<=(near?3:2));confidence=Math.round((1-fit.edits/r.normal.length)*100);
    }
    if(!match&&near&&final){const evidence=anchorEvidence(r.normal,available);if(evidence){end=evidence.end;confidence=evidence.confidence;match=true;}}
   }
   if(!match)continue;present.add(r.key);this.latest=Math.max(this.latest,at);
   candidate(at,'text-alignment',confidence,base+offset+end);
  }
  const aligned=[...this.candidates.values()].filter(c=>c.reason!=='keyword'&&present.has(c.key)&&c.evidenceEnd>=full.length-24).sort((a,b)=>b.at-a.at)[0];
  if(aligned){
   if(!this.scope&&previous>=this.floor&&aligned.at>previous&&aligned.at-previous<=3)for(let at=previous;at<aligned.at;at++)candidate(at,'boundary-crossed',aligned.confidence,aligned.evidenceEnd);
   this.progressAt=Math.max(this.progressAt,aligned.at);
   if(!reliable||aligned.at>=located){
    this.follow={matched:true,index:aligned.index,sentenceIndex:aligned.sentenceIndex,id:aligned.id,complete:final,confidence:aligned.confidence,cueAligned:true,matchedChars:Math.round(aligned.normal.length*aligned.confidence/100),end:aligned.normal.length,remaining:0,atEnd:true};
    if(final)this.locator.cursor=Math.max(this.locator.cursor,aligned.at);
   }
  }
  const keywordAt=[...this.candidates.values()].filter(c=>c.reason==='keyword'&&present.has(c.key)).sort((a,b)=>b.at-a.at)[0];
  if(keywordAt){this.progressAt=Math.max(this.progressAt,keywordAt.at);
   if(!reliable&&keywordAt.at>=located){const end=keywordAt.normal.indexOf(keywordAt.trigger)+keywordAt.trigger.length;this.follow={matched:true,index:keywordAt.index,sentenceIndex:keywordAt.sentenceIndex,id:keywordAt.id,confidence:keywordAt.confidence,matchedChars:keywordAt.trigger.length,end,remaining:Math.max(0,keywordAt.normal.length-end),complete:false,atEnd:false,keyword:true};}
  }
  // Interim revisions may retract evidence, but extending into a new sentence
  // must not reset the stability timer for an earlier completed sentence.
  for(const [key,c] of this.candidates){if(c.reason==='boundary-crossed'&&reliable&&located>c.at&&located-c.at<=3)present.add(key);if(!c.confirmed&&!present.has(key))this.candidates.delete(key);}
  return this.take();
 }
 setScope(units){const indices=units.map(u=>this.rows.findIndex(r=>r.index===u.index&&r.sentenceIndex===u.sentenceIndex)).filter(i=>i>=0);if(!indices.length)return;const scope={from:Math.min(...indices),to:Math.max(...indices)},r=this.rows[scope.from];this.reset(r.index,r.sentenceIndex);this.scope=scope;this.locator.range={...scope};}
 moveScopeFloor(at){if(!this.scope||at<this.floor||at>this.scope.to)return;this.floor=at;for(const [key,c]of this.candidates)if(c.at<at)this.candidates.delete(key);}
 take(){
  const ready=[...this.candidates.values()].filter(c=>c.confirmed||this.now()-c.since>=this.stableMs).sort((a,b)=>a.at-b.at);
  for(const c of ready){this.done.add(c.key);this.positions.set(c.key,c.evidenceEnd);this.candidates.delete(c.key);}return ready;
 }
 restartInput(){this.history='';this.committedLength=0;this.positions.clear();this.candidates.clear();this.locator.seek(this.follow.index||0,Math.max(0,this.follow.sentenceIndex||0));}
 missing(){if(this.latest<this.floor)return [];return this.rows.slice(this.floor,this.latest).filter(r=>!this.done.has(r.key)&&!this.candidates.has(r.key));}
 snapshot(){return {position:this.follow,completed:this.done.size,pending:this.candidates.size,missing:this.missing().map(r=>r.key)};}
}
const api={CueTracker};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
