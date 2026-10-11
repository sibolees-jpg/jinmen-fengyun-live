(function(root){
'use strict';
const DISPLAY_SCALE=1.15,DWELL_SCALE=1.4;
// Keep the author's punctuation; only normalize spacing for vertical columns.
function format(text){return String(text||'').replace(/\s+/gu,'\u3000').replace(/^\u3000+|\u3000+$/gu,'');}
function count(text){return Array.from(String(text||'').replace(/[^\p{L}\p{N}]/gu,'')).length;}
function duration(text){return Math.max(2000,Math.round(count(text)*60000/220));}
function pages(text,rows=17,columns=3){
 const all=[],tokens=[];let col='';
 // Keep closing marks with the preceding character, and opening marks with
 // the following one, so a column break does not strand a comma or quotation.
 for(const c of Array.from(format(text))){
  const prior=tokens.at(-1);
  if(prior&&prior!=='\u3000'&&(/[，。！？；：、,.!?;:%％‰…—）】〕〉》」』”’\)\]\}]/u.test(c)||/[（【〔〈《「『“‘\(\[\{]$/u.test(prior)))tokens[tokens.length-1]+=c;
  else tokens.push(c);
 }
 const push=()=>{if(col.trim())all.push(col.replace(/\u3000+$/u,''));col='';};
 for(const token of tokens){
  if(token==='\u3000'){if(col&&Array.from(col).length+1<rows)col+='\u3000';else push();continue;}
  if(col&&Array.from(col).length+Array.from(token).length>rows)push();
  col+=token;if(Array.from(col).length>=rows)push();
 }push();
 const result=[];for(let i=0;i<all.length;i+=columns)result.push(all.slice(i,i+columns));return result.length?result:[['']];
}
function pageAt(pages,elapsed,total){const counts=pages.map(p=>count(p.join(''))),sum=counts.reduce((a,b)=>a+b,0)||1,point=Math.max(0,Math.min(.999999,elapsed/total))*sum;let edge=0;for(let i=0;i<counts.length;i++){edge+=counts[i];if(point<edge)return i;}return pages.length-1;}
// One authored turn is one persistent card: column wrapping is spatial,
// never a time-based replacement of the beginning by the end.
function horizontal(text,{fontSize=16,maxHeight=310,maxWidth=300,scale=1}={}){
 const source=String(text||'').replace(/\r/g,''),advance=c=>/[\x00-\x7f]/.test(c)?.74:1.12;
 let result;
 for(let font=Math.max(12,fontSize);font>=10;font-=.5){
  const columns=[];let line='',used=0;
  for(const c of Array.from(source)){if(c==='\n'){columns.push(line);line='';used=0;continue;}const step=advance(c)*font;if(line&&used+step>maxWidth){columns.push(line);line='';used=0;}line+=c;used+=step;}
  if(line||!columns.length)columns.push(line);
  const width=Math.max(...columns.map(l=>Array.from(l).reduce((n,c)=>n+advance(c)*font,0)),1),height=columns.length*font*1.4;
  result={columns,rows:columns.length,fontSize:font,width:Math.ceil(width),height:Math.ceil(height),writingMode:'horizontal'};if(height<=maxHeight)break;
 }
 return {...result,fontSize:result.fontSize*scale,width:result.width*scale,height:result.height*scale};
}
function whole(text,{fontSize=16,maxHeight=310,maxWidth=300,scale=1,writingMode='vertical'}={}){
 if(writingMode==='horizontal')return horizontal(text,{fontSize,maxHeight,maxWidth,scale});
 let font=Math.max(12,fontSize),result;
 for(;font>=10;font-=.5){
  const rows=Math.max(3,Math.floor((maxHeight-2)/(font*1.12))),columns=pages(text,rows,Infinity)[0],width=columns.length*font*1.25+Math.max(0,columns.length-1)*5,height=Math.max(...columns.map(c=>Array.from(c).length))*font*1.12+2;
  result={columns,fontSize:font,width:Math.ceil(width),height:Math.ceil(height),rows};if(width<=maxWidth)break;
 }
 return {...result,fontSize:result.fontSize*scale,width:result.width*scale,height:result.height*scale};
}
// Fit complete turns to the actual free stage area before allowing the queue
// to wait. A tall card that can never fit must not freeze every later reply.
function fitCards(items,width,height,{place,reserved,obstacles=[],previous=[]}={}){
 const base=Math.max(80,Math.min(360,height*.42,height-135)),fontSize=Math.max(12,Math.min(16,width*.0095)),maxWidth=Math.max(90,Math.min(340,width*.36)-24);
 let best={boxes:[],cards:[]};
 for(const ratio of [1,.82,.67,.52,.4,.3,.22]){
  const cards=items.map(item=>{const factor=item.captionScale||1,prior=previous.find(p=>p.id===item.id&&p.message===item.message&&p.styleKey===item.styleKey),maxHeight=prior?.maxHeight||Math.max(55,Math.min(base*ratio/(item.config?.widthScale||1),item.maxHeight||base*1.6)),layout=prior?.layout||whole(item.text,{fontSize:item.sharedChorus?fontSize*1.25:fontSize,maxHeight,scale:DISPLAY_SCALE*factor,writingMode:item.config?.writingMode,maxWidth:item.sharedChorus?Math.min(width*.86,width*.66*(item.config?.widthScale||1))/(DISPLAY_SCALE*factor):item.config?.writingMode==='horizontal'?maxWidth*(item.config?.widthScale||1):maxWidth}),edge=((item.config?.borderWidth??1.725)-1.725)*2*factor;if(item.sharedChorus)layout.width=Math.max(layout.width,Math.min(width*.86,width*.78*(item.config?.widthScale||1)));return {...item,layout,maxHeight,width:layout.width+23*DISPLAY_SCALE*factor+edge,height:layout.height+21*DISPLAY_SCALE*factor+edge,...(prior?{previous:prior}: {})};});
  const boxes=place(cards,width,height,{reserved,obstacles,stable:true});
  if(boxes.length>best.boxes.length)best={boxes,cards};
  if(boxes.length===items.length)return {boxes,cards};
 }
 // Preserve geometry whenever possible. Only repack an existing card when
 // retaining it would hide another reply; position changes are eased by CSS.
 if(previous.length){const repacked=fitCards(items,width,height,{place,reserved,obstacles});if(repacked.boxes.length>best.boxes.length)return repacked;}
 return best;
}
// Keep completed character cards visible through the final continuation sentence.
// Live speech evidence, not a countdown started at the keyword, closes a group.
class DialogueDisplay{
 constructor(script,{leadMs=1500,stableMs=280,minVisibleMs=2000,closeStaggerMs=650,dwellScale=DWELL_SCALE}={}){this.script=script;this.leadMs=leadMs;this.stableMs=stableMs;this.minVisibleMs=minVisibleMs;this.closeStaggerMs=closeStaggerMs;this.dwellScale=dwellScale;this.reset();}
 reset(){this.groups=new Map();this.cards=new Map();this.rate=220/60;this.lastSample=null;this.position=-1;this.rows=[];this.now=0;
  let offset=0;(this.script?.blocks||[]).forEach((b,index)=>b.sentences.forEach((s,sentenceIndex)=>{this.rows.push({index,sentenceIndex,id:s.id,length:count(s.text),offset});offset+=count(s.text);}));
 }
 activate(key){if(this.groups.has(key))return;const [blockIndex,...id]=key.split(':'),index=Number(blockIndex),block=this.script?.blocks[index],lead=id.join(':'),start=block?.sentences.findIndex(s=>s.id===lead);if(start===undefined||start<0)return;
  let end=start;while(block.sentences[end+1]?.dialogueLead===lead)end++;
  if(end===start)return;this.groups.set(key,{key,index,start,end,closedAt:null,pendingAt:null});
 }
 started(message,now,readMs=message.durationMs||duration(message.text)){this.now=now;this.cards.set(message.actor,{message,startedAt:now,visibleAt:null,readMs:Math.max(this.minVisibleMs,readMs),closeAt:null,finished:false,late:this.groups.get(message.cueKey)?.closedAt!==null&&this.groups.has(message.cueKey)});}
 canReveal(message,now){if(message.chorus||!message.cueKey||this.cards.get(message.actor)?.visibleAt!==null)return true;return ![...this.cards.values()].some(c=>c.message!==message&&c.message.cueKey===message.cueKey&&c.visibleAt!==null&&now-c.visibleAt<800);}
 visible(message,now){const card=this.cards.get(message.actor);if(card?.message===message&&card.visibleAt===null){card.visibleAt=now;message.visibleAt=now;this.schedule(message.cueKey);}}
 // The additional reading time belongs to the card, not a walking/speaking
 // slot. Another person can reply while this completed card stays readable.
 readableUntil(card){return card.visibleAt===null?Infinity:card.visibleAt+(card.baseReadMs??card.readMs)*this.dwellScale;}
 // P0: a new authored turn may take over its own person's extra visual tail.
 // Waiting for the entire tail here would accumulate delay along ordered cues.
 canStart(message,now){const card=this.cards.get(message.actor);return !card||card.visibleAt===null||card.message===message||now>=card.visibleAt+this.minVisibleMs*this.dwellScale;}
 schedule(key){
  const cards=[...this.cards.values()].filter(c=>c.message.cueKey===key&&c.visibleAt!==null).sort((a,b)=>a.visibleAt-b.visibleAt),group=this.groups.get(key);let previous=-Infinity;
  for(const card of cards){const open=group?.closedAt===null&&!card.late;
   const baseMs=card.baseReadMs??card.readMs,baseEnd=open?Infinity:Math.max(card.visibleAt+baseMs,group?.closedAt??0,card.finishedAt??0);
   card.closeAt=Math.max(this.readableUntil(card),card.visibleAt+(baseEnd-card.visibleAt)*this.dwellScale,previous+(card.message.chorus?0:this.closeStaggerMs));previous=card.closeAt;
  }
 }
 groupCards(group){return [...this.cards.values()].filter(c=>c.message.cueKey===group.key&&!c.late).sort((a,b)=>a.startedAt-b.startedAt||(a.message.cueLine||0)-(b.message.cueLine||0));}
 spread(group){const cards=this.groupCards(group);return cards.some(c=>c.message.chorus)?0:Math.min(1200,Math.max(0,cards.length-1)*this.closeStaggerMs);}
 close(group,now){group.closedAt=now;this.schedule(group.key);}
 finished(message,now=this.now){const card=this.cards.get(message.actor);if(card?.message===message){card.finished=true;card.finishedAt=now;card.baseReadMs=Math.min(card.readMs,Math.max(this.minVisibleMs,now-(card.visibleAt??now)));this.schedule(message.cueKey);}}
 observe(match,final,now){
  if(!match?.matched||match.confidence<85||!Number.isFinite(match.remaining)){for(const g of this.groups.values())if(g.closedAt===null)g.pendingAt=null;return;}
  const at=this.rows.findIndex(r=>r.index===match.index&&r.sentenceIndex===match.sentenceIndex);if(at<0||at<this.position)return;this.position=at;const row=this.rows[at],point=row.offset+Math.max(0,row.length-match.remaining),old=this.lastSample;
  if(old&&point>old.point&&now-old.at>=300&&now-old.at<=10000){const measured=(point-old.point)*1000/(now-old.at);if(measured>=1.5&&measured<=8)this.rate=this.rate*.7+measured*.3;}
  if(!old||point>old.point)this.lastSample={point,at:now};
  for(const group of this.groups.values()){
   if(group.closedAt!==null)continue;
   const past=match.index>group.index||match.index===group.index&&match.sentenceIndex>group.end;
   const near=match.index===group.index&&match.sentenceIndex===group.end&&match.remaining/this.rate*1000<=this.leadMs+this.spread(group)/2;
   if(past||near){group.pendingAt??=now;if(final)this.close(group,now);}
   else group.pendingAt=null;
  }
  this.tick(now);
 }
 tick(now){this.now=now;for(const group of this.groups.values())if(group.closedAt===null&&group.pendingAt!==null&&now-group.pendingAt>=this.stableMs)this.close(group,now);}
 closing(now){return [...this.cards.values()].some(c=>c.finished&&Number.isFinite(c.closeAt)&&now<c.closeAt+420);}
 shouldFinish(actor,now){const card=this.cards.get(actor.id),group=this.groups.get(actor.message?.cueKey);return actor.phase==='speaking'&&card?.message===actor.message&&!card.late&&Boolean(group)&&group.closedAt!==null&&card.visibleAt!==null&&now>=card.visibleAt+this.minVisibleMs&&actor.elapsed>=this.minVisibleMs&&!actor.captionBlocked;}
 message(actor,now){
  const card=this.cards.get(actor.id);if(actor.phase==='speaking')return actor.message;
  const group=this.groups.get(card?.message?.cueKey);
  return card?.finished&&card.visibleAt!==null&&now<card.closeAt?card.message:null;
 }
 snapshot(){return {leadMs:this.leadMs,dwellScale:this.dwellScale,closeStaggerMs:this.closeStaggerMs,estimatedCpm:Math.round(this.rate*60),groups:[...this.groups.values()].map(g=>({key:g.key,endSentence:g.end,closed:g.closedAt!==null})),held:[...this.cards.values()].filter(c=>c.finished&&c.visibleAt!==null&&this.now<c.closeAt).map(c=>c.message.actor)};}
}

const api={DISPLAY_SCALE,DWELL_SCALE,format,count,duration,pages,pageAt,whole,fitCards,DialogueDisplay};if(typeof module!=='undefined')module.exports=api;else root.CaptionLayout=api;
})(globalThis);
