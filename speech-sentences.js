(function(root){
'use strict';
const split=typeof module!=='undefined'?require('./input-scheduler.js').firstSentence:root.firstSentence;
class SpeechSentences{
 constructor(){this.clear();}
 clear(){this.queue=[];this.tail='';this.interim='';this.lastCaption='';this.seq=0;}
 update({seq,text,final}){
  if(!Number.isInteger(seq)||seq<=this.seq||typeof text!=='string')return;
  this.seq=seq;
  this.lastCaption=this.tail+text;
  if(!final){this.interim=text;return;}
  this.interim='';this.tail+=text;
  let sentence;while((sentence=split(this.tail))){this.queue.push(sentence);this.tail=this.tail.trimStart().slice(sentence.length).trimStart();}
 }
 preview(){return this.tail+this.interim;}
 caption(limit=56){return Array.from(this.lastCaption).slice(-limit).join('');}
 take(){return this.queue.shift()||null;}
}
const normalize=text=>(typeof module!=='undefined'?require('./script-follow.js').normalizeSpeech:root.normalizeSpeech)(text);
// Keep authored words and punctuation together. Page boundaries only affect
// display; they never split or reschedule the manuscript's dialogue cues.
function subtitlePages(text,limit){
 const chars=Array.from(text),pages=[],wordEnds=new Set();let start=0,offset=0;
 if(chars.length<=limit)return chars.length?[{text,end:normalize(text).length}]:[];
 // Word boundaries are a preference; punctuation stays attached to its words.
 // Balance the remaining pages instead of leaving the last few characters alone.
 if(typeof Intl?.Segmenter==='function')for(const part of new Intl.Segmenter('zh',{granularity:'word'}).segment(text)){offset+=Array.from(part.segment).length;wordEnds.add(offset);}
 while(start<chars.length){
  const remaining=chars.length-start,count=Math.ceil(remaining/limit),ideal=remaining/count;
  let end=chars.length;
  if(count>1){
   const minimum=Math.min(Math.max(1,Math.floor(limit/2)),Math.max(8,Math.floor(ideal*.6))),lo=Math.max(minimum,remaining-(count-1)*limit),hi=Math.min(limit,remaining-(count-1)*minimum);let best=Infinity;
   for(let length=lo;length<=hi;length++){
    const at=start+length,previous=chars[at-1],next=chars[at];
    if(/[，。、：；。！？!?…、”’」』）》】]/u.test(next)||/[“‘「『（《【]/u.test(previous))continue;
    const pause=/[。！？!?；]/u.test(previous)?120:/[，、：\s]/u.test(previous)?80:0;
    const cost=(length-ideal)**2-pause+(wordEnds.size&&!wordEnds.has(at)?200:0);
    if(cost<best){best=cost;end=at;}
   }
   // An unusually long token still needs a bounded, balanced display page.
   if(!Number.isFinite(best))end=start+Math.min(limit,Math.round(ideal));
  }
  pages.push({text:chars.slice(start,end).join(''),end:normalize(chars.slice(0,end).join('')).length});start=end;
 }
 return pages;
}
// Authored subtitles follow the existing speech match, independently of the
// director's look-ahead card. Raw caption formatting is kept for unscripted use.
class AudienceSubtitles{
 constructor(script=null,limit=36){this.limit=limit;this.configure(script);}
 configure(script){
  this.anchors=(script?.blocks||[]).flatMap(b=>b.sentences.map(s=>String(s.text).replace(/[^\p{L}\p{N}]/gu,'').slice(0,8))).filter(s=>s.length>=4);
  this.rows=new Map((script?.blocks||[]).flatMap((b,index)=>b.sentences.map((s,sentenceIndex)=>[`${index}:${sentenceIndex}`,subtitlePages(String(s.text||'').trim(),script?.stageBinding?.openingCue==='named-cast'&&index===0&&s.text.includes('他们是')?Math.max(this.limit,Array.from(s.text.trim()).length):this.limit)])));
  this.reset();
 }
 reset(){this.position=null;this.current='';}
 follow(match){
  if(!match?.matched||!match.cueAligned&&match.confidence<82)return this.current;
  const {index,sentenceIndex}=match,pages=this.rows.get(`${index}:${sentenceIndex}`);if(!pages?.length)return this.current;
  const previous=this.position;
  if(previous&&(index<previous.index||index===previous.index&&sentenceIndex<previous.sentenceIndex))return this.current;
  let page=pages.findIndex(p=>p.end>=Math.max(1,match.end||1));if(page<0)page=pages.length-1;
  if(previous&&index===previous.index&&sentenceIndex===previous.sentenceIndex)page=Math.max(page,previous.page);
  this.position={index,sentenceIndex,page};return this.current=pages[page].text;
 }
 caption(raw){
  let text=String(raw||'').slice(-800).trim();if(!text)return '';
  let letters='',positions=[];
  for(const match of text.matchAll(/[\p{L}\p{N}]/gu)){letters+=match[0];positions.push(match.index);}
  let start=0;for(const anchor of this.anchors){const at=letters.lastIndexOf(anchor);if(at>0)start=Math.max(start,positions[at]);}
  text=text.slice(start);
  const clauses=text.match(/[^。！？!?；\n]+[。！？!?；]*[”’」』]*|[^\s]/gu)||[];
  text=(clauses.at(-1)||'').trim();
  return subtitlePages(text,this.limit).at(-1)?.text.trim()||'';
 }
}
const api={SpeechSentences,AudienceSubtitles};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
