(function(root){
'use strict';
const Calibration=(typeof module!=='undefined'?require('./speech-calibration.js'):root.SpeechCalibration);
function spokenNumber(word){const digits='零一二三四五六七八九',units={十:10,百:100,千:1000,万:10000};word=word.replace(/〇/g,'零').replace(/两/g,'二');if(!/[十百千万]/.test(word))return [...word].map(c=>digits.indexOf(c)).join('');let total=0,n=0;for(const c of word){if(c in units){if(c==='万'){total=(total+n||1)*10000;n=0;}else{total+=(n||1)*units[c];n=0;}}else n=digits.indexOf(c);}return String(total+n);}
const normalize=text=>String(text||'').normalize('NFKC').toLowerCase().replace(/天津美术学院/g,'天津美院').replace(/百廿/g,'一百二十').replace(/[零〇一二两三四五六七八九十百千万]+/g,spokenNumber).replace(/[^\p{L}\p{N}]/gu,'');
// Edit-distance alignment allows a few ASR substitutions and a partial sentence.
function fit(pattern,text){let row=Array(text.length+1).fill(0);for(let i=1;i<=pattern.length;i++){const next=[i];for(let j=1;j<=text.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(pattern[i-1]===text[j-1]?0:1));row=next;}let distance=Infinity,end=0;for(let j=1;j<row.length;j++)if(row[j]<=distance){distance=row[j];end=j;}return {similarity:1-distance/pattern.length,end,length:pattern.length};}
class ScriptFollower{
 constructor(script){this.script=script;this.rows=[];(script?.blocks||[]).forEach((b,index)=>b.sentences.forEach((s,sentenceIndex)=>this.rows.push({index,sentenceIndex,id:s.id,text:s.text,normal:normalize(s.text)})));this.reset();}
 reset(){this.range=null;this.cursor=-1;this.history='';this.last={matched:false,index:0,sentenceIndex:-1,complete:false,confidence:0};}
 seek(index,sentenceIndex=0){this.history='';this.cursor=this.rows.findIndex(r=>r.index===index&&r.sentenceIndex===sentenceIndex);this.last={matched:false,index,sentenceIndex:-1,complete:false,confidence:0};}
 feed(text,final=false){
  const part=normalize(Calibration.repair(text,this.script,this.last.index)),heard=(this.history+part).slice(-180);if(final)this.history=heard;
  const hold=()=>({...this.last,matched:false,complete:false});if(part.length<4||!this.rows.length)return hold();
  const candidates=[];
  for(let i=0;i<this.rows.length;i++){
   if(this.range&&(i<this.range.from||i>this.range.to))continue;
   if(this.cursor>=0&&i<this.cursor)continue;const r=this.rows[i],near=this.cursor>=0&&i<=this.cursor+5,max=Math.min(heard.length,r.normal.length+3,110),lengths=[max,Math.min(part.length,max),70,44,28,18,12,8,6].filter((v,j,a)=>v<=max&&v>=4&&a.indexOf(v)===j);let best=null;
   for(const len of lengths){const m=fit(heard.slice(-len),r.normal);if(m.similarity<.78)continue;const score=m.similarity+.09*Math.min(1,len/24)+(near?.025:0);if(!best||score>best.score)best={...m,score};}
   if(!best)continue;if(!near&&(best.similarity<.9||best.length<Math.min(9,r.normal.length)))continue;
   candidates.push({...best,row:i,near,...r});
  }
  candidates.sort((a,b)=>b.score-a.score||a.row-b.row);const best=candidates[0],runner=candidates[1];
  if(!best||best.score<.94||(runner&&best.score-runner.score<.018&&best.row!==this.cursor&&best.row!==this.cursor+1))return hold();
  if(final)this.cursor=best.row;const complete=Boolean(final&&best.end>=best.normal.length-1&&best.length>=Math.min(10,best.normal.length*.65));
  return this.last={matched:true,index:best.index,sentenceIndex:best.sentenceIndex,id:best.id,complete,confidence:Math.round(best.similarity*100),matchedChars:best.length,end:best.end,remaining:Math.max(0,best.normal.length-best.end),atEnd:best.end>=best.normal.length&&best.length>=Math.min(10,best.normal.length*.65)};
 }
}
function mappedText(text){
 let normal='';const offsets=[];
 for(const token of text.matchAll(/天津美术学院|天津美院|百廿|[零〇一二两三四五六七八九十百千万]+|./gsu)){
  const part=normalize(token[0]);normal+=part;
  for(let i=0;i<part.length;i++)offsets.push({start:token.index,end:token.index+token[0].length});
 }
 return {text,normal,offsets};
}
// Caption correction is deliberately narrower than locating a sentence:
// replace a few aligned characters, never fill missing words or reveal unread text.
class ScriptCaptions{
 constructor(script){this.script=script;this.rows=[];(script?.blocks||[]).forEach((b,index)=>b.sentences.forEach((s,sentenceIndex)=>this.rows.push({index,sentenceIndex,text:s.text})));}
 caption(raw,match){
  if(!match?.matched||match.confidence<90)return raw;
  raw=Calibration.repair(raw,this.script,match.index);
  const row=this.rows.findIndex(r=>r.index===match.index&&r.sentenceIndex===match.sentenceIndex);if(row<0)return raw;
  const heard=mappedText(raw),reference=mappedText(this.rows.slice(Math.max(0,row-1),row+1).map(r=>r.text).join(''));
  const length=heard.normal.length,limit=Math.min(2,Math.floor(length*.1));if(length<8||!limit)return raw;
  let best=null,ambiguous=false;
  for(let start=0;start+length<=reference.normal.length;start++){
   const diffs=[];for(let i=0;i<length;i++)if(heard.normal[i]!==reference.normal[start+i]){diffs.push(i);if(diffs.length>limit)break;}
   if(diffs.length>limit)continue;
   const target=reference.normal.slice(start,start+length);
   if(!best||diffs.length<best.diffs.length){best={start,diffs,target};ambiguous=false;}
   else if(diffs.length===best.diffs.length&&target!==best.target)ambiguous=true;
  }
  if(!best||ambiguous||!best.diffs.length)return raw;
  const edits=[];
  for(const i of best.diffs){
   const j=best.start+i,a=heard.offsets[i],b=reference.offsets[j];
   if(/[0-9不没未无非别勿莫]/.test(heard.normal[i]+reference.normal[j])||a.end-a.start!==1||b.end-b.start!==1)return raw;
   edits.push({at:a.start,text:reference.text.slice(b.start,b.end)});
  }
  let result=raw;for(const edit of edits.sort((a,b)=>b.at-a.at))result=result.slice(0,edit.at)+edit.text+result.slice(edit.at+1);
  return result;
 }
}
const api={ScriptFollower,ScriptCaptions,normalizeSpeech:normalize};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
