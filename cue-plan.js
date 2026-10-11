(function(root){
'use strict';
const count=text=>Array.from(String(text||'').replace(/[^\p{L}\p{N}]/gu,'')).length;
const policy='one-to-one';
function audit(script,catalog){
 if(script?.replyPolicy===dialoguePolicy)return auditDialogue(script,catalog);
 const errors=[],rows=(script?.blocks||[]).flatMap((b,index)=>(b.sentences||[]).map((s,sentenceIndex)=>({b,s,index,sentenceIndex})));
 const sceneIds=catalog?new Set(catalog.maps.flatMap(m=>m.scenes.map(s=>s.id))):null;
 for(const [at,{b,s,index,sentenceIndex}] of rows.entries()){
  const label=`S${index+1} 第 ${sentenceIndex+1} 句`,chorus=at===rows.length-1&&s.replies?.length===9&&new Set(s.replies.map(r=>r.actor)).size===9&&s.replies.every(r=>r.chorus===true);
  if(count(s.text)<18)errors.push(`${label}不足 18 个有效字（当前 ${count(s.text)} 字）`);
  if(!b.sceneId||sceneIds&&!sceneIds.has(b.sceneId))errors.push(`${label}未绑定有效演出场次`);
  const opening=at===0&&script.openingSilent===true&&s.mode==='silent'&&!s.replies?.length;
  if(!opening&&(s.mode==='silent'||!s.replies?.length))errors.push(`${label}缺少接话`);
  else if(!opening&&!chorus&&(s.mode!=='reply'||s.replies.length!==1||s.replies.some(r=>r.chorus)))errors.push(`${label}须恰好一人接话；仅末句可九人齐声`);
  if(s.cuePolicy==='early')errors.push(`${label}使用了提前触发，须改为讲完本句接话`);
 }
 return {ok:errors.length===0&&rows.length>0,errors,units:rows.length,openingSilent:script.openingSilent===true,replies:rows.reduce((n,r)=>n+(r.s.replies?.length||0),0),minChars:rows.length?Math.min(...rows.map(r=>count(r.s.text))):0,maxChars:rows.length?Math.max(...rows.map(r=>count(r.s.text))):0};
}
function assert(script,catalog){const result=audit(script,catalog);if(!result.ok)throw Error('换稿检查未通过：'+(result.errors.slice(0,8).join('；')||'剧本为空')+(result.errors.length>8?`；另有 ${result.errors.length-8} 处` :''));return result;}
// Keep every authored character and reply in order. Dynamic programming chooses
// natural clause boundaries; it never invents speech to meet the minimum length.
function partition(source,n,targets=[]){
 const prefix=[0];for(const ch of source)prefix.push(prefix.at(-1)+count(ch));
 const chars=Array.from(source),total=prefix.at(-1);if(total<n*18)throw Error(`正文 ${total} 字不足以安排 ${n} 次接话，每次至少 18 字；请补充正文或调整接话数量。`);
 const positions=[0];for(let i=1;i<=chars.length;i++)if(i===chars.length||/[，；：。！？!?\s]/u.test(chars[i-1])||/[”’」』》】）)]/u.test(chars[i-1]))positions.push(i);
 for(const target of targets){const at=prefix.findIndex(n=>n===target);if(at>0&&!positions.includes(at))positions.push(at);}positions.sort((a,b)=>a-b);
 function solve(all){
  const points=all?Array.from({length:chars.length+1},(_,i)=>i):positions,dp=new Map([[0,{cost:0,prev:null}]]),layers=[dp];
  for(let k=1;k<=n;k++){
   const layer=new Map();for(const end of points){if(prefix[end]<k*18||total-prefix[end]<(n-k)*18||k===n&&end!==chars.length)continue;
    let best;for(const [start,old] of layers[k-1]){const len=prefix[end]-prefix[start];if(len<18)continue;
     const ideal=total/n,anchor=targets[k-1]??total*k/n,boundary=end===chars.length?0:/[。！？!?]/u.test(chars[end-1])?0:/[，；：\s]/u.test(chars[end-1])?2:/[、”’」』》】）)]/u.test(chars[end-1])?7:90;
     const cost=old.cost+(len-ideal)**2*.055+(prefix[end]-anchor)**2*.018+boundary+(len>60?(len-60)**2:0);
     if(!best||cost<best.cost)best={cost,prev:start};
    }if(best)layer.set(end,best);
   }layers.push(layer);
  }
  if(!layers[n].has(chars.length))return null;let end=chars.length,parts=[];for(let k=n;k>0;k--){const start=layers[k].get(end).prev;parts.unshift(chars.slice(start,end).join(''));end=start;}return parts;
 }
 return solve(false)||(()=>{throw Error('无法在完整语意停顿处安排全部接话且每句至少 18 字；请增加讲话内容或调整接话数量，未覆盖旧稿。');})();
}
function arrange(script){
 if(!script?.blocks?.length)throw Error('请先导入带人物接话及场次的剧本。');
 const blocks=script.blocks.map((b,bi)=>{
  if(script.replyPolicy===policy&&b.sentences?.map(s=>s.text).join('')===b.source)return {...b,sentences:b.sentences.map(s=>({...s,replies:s.replies.map(r=>({...r}))}))};
  const groups=[],targets=[];let offset=0;
  for(const s of b.sentences||[]){offset+=count(s.text);if(s.replies?.length===9&&s.replies.every(r=>r.chorus)){groups.push(s.replies);targets.push(offset);}else for(const reply of s.replies||[]){groups.push([reply]);targets.push(offset);}}
  if(!groups.length)throw Error(`S${bi+1} 没有人物接话。请先补齐该场次的角色和台词。`);
  const opening=bi===0&&script.openingSilent===true?b.source.match(/^[\s\S]*?[。！？!?](?:[”’」』》】）)])?/)?.[0]:'';
  if(bi===0&&script.openingSilent===true&&(!opening||count(opening)<18))throw Error('开场白须是至少 18 字的完整第一句，且不安排人物接话。');
  const parts=partition(b.source.slice(opening?.length||0),groups.length,targets.map(t=>Math.max(0,t-count(opening))));
  const sentences=parts.map((text,i)=>({id:`one-s${bi+1}-${i+1}`,text,trigger:'',mode:groups[i].length===1?'reply':'discussion',replies:groups[i].map((r,j)=>({...r,replyTo:j?j-1:null,staggerMs:0})),delayMs:0,holdMs:0}));
  if(opening)sentences.unshift({id:'opening-silent',text:opening,trigger:'',mode:'silent',replies:[],delayMs:0,holdMs:0});
  return {...b,sentences};
 });
 const result={...script,replyPolicy:policy,blocks};assert(result);return result;
}
const dialoguePolicy='keyword-dialogue';
const protectedPolicy=value=>value===policy||value===dialoguePolicy;
function splitStops(source){
 const out=[];for(const part of String(source).match(/[\s\S]*?[。！？!?]+[”’」』》】）)]*|[\s\S]+$/gu)||[]){if(!count(part)&&out.length)out[out.length-1]+=part;else out.push(part);}return out;
}
const sequenceMode=script=>script?.stageBinding?.mode==='sequence-config'&&['pending','bound'].includes(script.stageBinding.status);
function silentReason(script,blockIndex,sentence){
 if(!sentence||sentence.replies?.length||sentence.dialogueLead)return '';
 if(sequenceMode(script)){
  const block=script.blocks[blockIndex];
  if(blockIndex===0&&block?.sequenceCode==='起始幕'&&sentence.silenceReason==='opening')return '开场介绍 · 不接话';
  if(script.stageBinding.openingCue==='named-cast'&&blockIndex===1&&sentence===block.sentences[0]&&sentence.silenceReason==='opening-transition'&&block.sentences.slice(1).some(s=>s.replies?.length))return '开场转入 · 等提问结束后接话';
  const last=block?.sentences.at(-1);
  if(blockIndex===script.blocks.length-1&&sentence.silenceReason==='finale-prelude'&&sentence.id!==last?.id&&last?.replies?.length===9&&last.replies.every(r=>r.chorus))return '结尾致辞 · 祝福句分别齐声';
 }
 return script?.openingSilent&&blockIndex===0&&sentence?.id===script.blocks[0]?.sentences[0]?.id?'开场白 · 不接话':'';
}
function sequenceProgress(script,presentation={},cues=[]){
 if(!sequenceMode(script))return null;const index=Math.max(0,Math.min(script.blocks.length-1,presentation.index||0)),block=script.blocks[index];
 const groups=block.sentences.flatMap((s,sentenceIndex)=>s.replies.length?[{index,sentenceIndex,id:s.id,key:`${index}:${s.id}`}]:[]),states=new Map(cues.map(c=>[c.key,c]));
 const active=groups.findIndex(g=>['playing','queued'].includes(states.get(g.key)?.state)),past=groups.findLastIndex(g=>g.sentenceIndex<=(presentation.sentenceIndex??-1));
 return {code:block.sequenceCode,mapName:'最新 Q 本',name:script.stageBinding.status==='bound'?block.title:'整套场景与人物待适配',current:groups.length?Math.max(0,active>=0?active:past)+1:0,total:groups.length,groups,first:{index,sentenceIndex:0},sceneId:block.sceneId||'',pending:script.stageBinding.status!=='bound'};
}
function keyword(text,reference=''){
 const chars=Array.from(text),segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('zh',{granularity:'word'}).segment(text)].filter(s=>s.isWordLike):[];
 const words=segments.length?segments.map(s=>({start:s.index,end:s.index+s.segment.length})):chars.map((c,i)=>({start:i,end:i+1})).filter(s=>count(text.slice(s.start,s.end)));
 const total=count(text);if(total<=6)return text.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu,'');
 let best;
 for(let i=0;i<words.length;i++)for(let j=i;j<words.length;j++){
  const phrase=text.slice(words[i].start,words[j].end),n=count(phrase);if(n>12)break;if(n<Math.min(6,total))continue;
  const middle=(count(text.slice(0,words[i].start))+n/2)/total;
  const repeated=reference.split(phrase).length-2;
  const score=Math.abs(middle-.5)*18+Math.abs(n-9)*.35+Math.max(0,repeated)*5+(/[。！？]/.test(phrase)?20:0)+(/[，；：、]/.test(phrase)?1.2:0)+(/^(我们|他们|这个|那个|各位|就是|现在)/.test(phrase)?1:0);
  if(!best||score<best.score)best={phrase,score};
 }
 return best?.phrase||text.replace(/[\p{P}\s]/gu,'');
}
function auditDialogue(script,catalog){
 const errors=[],rows=script.blocks.flatMap((b,index)=>b.sentences.map((s,sentenceIndex)=>({b,s,index,sentenceIndex}))),sceneIds=catalog?new Set(catalog.maps.flatMap(m=>m.scenes.map(s=>s.id))):null;
 if(sequenceMode(script)){
  const codes=new Set();for(const b of script.blocks){if(!/^(起始幕|[A-Z]+[1-9][0-9]*)$/.test(b.sequenceCode||'')||codes.has(b.sequenceCode))errors.push('序号无效或重复');codes.add(b.sequenceCode);if(script.stageBinding.status==='pending'&&b.sceneId)errors.push('待适配的新序号不能同时绑定旧场次');if(b.sequenceCode!=='起始幕'&&(!b.visualTrigger||!b.source.includes(b.visualTrigger)))errors.push(`${b.sequenceCode} 缺少本段整套配置触发词`);}
 }
 for(const [at,{b,s,index,sentenceIndex}] of rows.entries()){
  const label=`${b.sequenceCode||'S'+(index+1)} 第 ${sentenceIndex+1} 句`,opening=Boolean(silentReason(script,index,s))&&s.mode==='silent';
  if(script.stageBinding?.openingCue==='named-cast'&&b.sequenceCode==='起始幕'&&(s.replies?.length||s.dialogueLead||s.mode!=='silent'))errors.push(`${label}暖场只介绍人物，不能安排接话气泡`);
  if(splitStops(s.text).length!==1)errors.push(`${label}仍包含多个完整句，须按句号拆分`);
  if(!s.trigger||!count(s.trigger)||!s.text.replace(/[^\p{L}\p{N}]/gu,'').includes(s.trigger.replace(/[^\p{L}\p{N}]/gu,'')))errors.push(`${label}须填写来自本句的现场触发短语`);
  if((!sequenceMode(script)||script.stageBinding.status==='bound')&&(!b.sceneId||sceneIds&&!sceneIds.has(b.sceneId)))errors.push(`${label}未绑定有效演出场次`);
  if(script.stageBinding?.status==='bound'&&catalog&&s.replies?.length){const scene=catalog.maps.flatMap(m=>m.scenes).find(v=>v.id===b.sceneId);for(const reply of s.replies)if(!scene?.actors?.[reply.actor]?.present)errors.push(`${label}接话人物未在配置中出场`);}
  if(s.silenceReason&&!opening)errors.push(`${label}静默原因不适用于此句`);
  if(at===0&&script.openingSilent&&(s.replies?.length||s.dialogueLead))errors.push('第一句开场白须保持不接话');
  const target=s.dialogueLead?b.sentences.find(u=>u.id===s.dialogueLead):s;
  if(!opening&&(!target?.replies?.length||target.dialogueLead))errors.push(`${label}没有有效接话或延续对话`);
  if(s.dialogueLead&&b.sentences.findIndex(u=>u.id===s.dialogueLead)>=sentenceIndex)errors.push(`${label}须延续前面已安排的对话组`);
  if(s.replies?.length&&s.mode==='silent')errors.push(`${label}已安排台词但仍设为静默`);
  if(s.dialogueLead&&s.replies?.length)errors.push(`${label}延续对话不能重复安排原台词`);
  if(s.replies?.some(r=>r.chorus)&&!((at===rows.length-1||(sequenceMode(script)&&b.sequenceCode==='T1'&&index===script.blocks.length-1))&&s.replies.length===9&&new Set(s.replies.map(r=>r.actor)).size===9&&s.replies.every(r=>r.chorus)))errors.push(`${label}九人齐声只可安排在结尾 T1 祝福句`);
 }
 return {ok:!errors.length&&rows.length>0,errors,units:rows.length,openingSilent:script.openingSilent===true,replies:rows.reduce((n,r)=>n+r.s.replies.length,0),groups:rows.filter(r=>r.s.replies.length).length,continuations:rows.filter(r=>r.s.dialogueLead).length,keywords:true,minChars:Math.min(...rows.map(r=>count(r.s.text))),maxChars:Math.max(...rows.map(r=>count(r.s.text)))};
}

function arrangeDialogue(script){
 if(!script?.blocks?.length)throw Error('请先导入包含场次和人物台词的剧本。');
 const blocks=script.blocks.map((b,bi)=>{
  if(script.replyPolicy===dialoguePolicy&&b.sentences.map(s=>s.text).join('')===b.source){return {...b,sentences:b.sentences.map(s=>({...s,trigger:s.trigger&&s.text.includes(s.trigger)?s.trigger:keyword(s.text,script.text)}))};}
  if(sequenceMode(script))throw Error('此稿按 Word 同行接话绑定；正文变化后请导入重新核对的完整剧本 JSON，不能把旧接话平均分配到新句。');
  const groups=b.sentences.filter(s=>s.replies?.length).map(s=>s.replies),parts=splitStops(b.source);
  if(!groups.length)throw Error(`S${bi+1} 没有可沿用的对话台词。`);
  const first=bi===0&&script.openingSilent?1:0;
  // A new draft may have long sentences but fewer stops than existing groups.
  // Split clauses further; never join across a hard stop or merge original groups.
  while(parts.length-first<groups.length){
   let choice;parts.forEach((part,i)=>{if(i<first)return;for(const m of part.matchAll(/[，；：、]/gu)){const at=m.index+1;if(!count(part.slice(0,at))||!count(part.slice(at)))continue;const score=count(part)-Math.abs(count(part.slice(0,at))-count(part.slice(at)));if(!choice||score>choice.score)choice={i,at,score};}});
   if(!choice)throw Error(`S${bi+1} 正文可分句位置不足，无法保留全部原对话组；请核对新稿及台词安排。`);
   const part=parts[choice.i];parts.splice(choice.i,1,part.slice(0,choice.at),part.slice(choice.at));
  }
  const slots=parts.length-first;
  if(!slots)throw Error('开场白之后没有可安排接话的正文。');
  const sentences=parts.map((text,i)=>({id:`key-s${bi+1}-${i+1}`,text,trigger:keyword(text,script.text),cuePolicy:'keyword',mode:'silent',replies:[],delayMs:0,holdMs:0}));
  // Preserve authored dialogue groups; several short speech cards can share one
  // group. Replacing plain text never invents or duplicates character dialogue.
  groups.forEach((group,gi)=>{const at=group.every(r=>r.chorus)?sentences.length-1:first+Math.min(slots-1,Math.floor(gi*slots/groups.length)),row=sentences[at],offset=row.replies.length;row.replies.push(...group.map((r,j)=>({...r,replyTo:r.replyTo,staggerMs:r.staggerMs??1600})));row.mode=row.replies.length===1?'reply':'discussion';});
  let lead;for(const [i,row] of sentences.entries()){if(i<first)continue;if(row.replies.length)lead=row.id;else row.dialogueLead=lead;}
  return {...b,sentences};
 });
 const result={...script,replyPolicy:dialoguePolicy,blocks};assert(result);return result;
}

function replaceText(current,{title,text}){
 if(!current?.blocks?.length)throw Error('没有可沿用的接话顺序，请导入带接话的剧本 JSON。');
 const sources=String(text).replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
 if(sources.length!==current.blocks.length)throw Error(`请用空行分隔 ${current.blocks.length} 个场次，当前识别到 ${sources.length} 场。场次结构变化请导入带场次的剧本 JSON。`);
 const draft={...current,title,text:sources.join('\n'),blocks:current.blocks.map((b,i)=>({...b,source:sources[i]}))};return current.replyPolicy===dialoguePolicy?arrangeDialogue(draft):arrange(draft);
}
const api={policy,dialoguePolicy,protectedPolicy,count,audit,assert,partition,arrange,arrangeDialogue,splitStops,keyword,replaceText,sequenceMode,silentReason,sequenceProgress};if(typeof module!=='undefined')module.exports=api;else root.CuePlan=api;
})(globalThis);
