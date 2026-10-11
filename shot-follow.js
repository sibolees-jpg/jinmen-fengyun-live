(function(root){
'use strict';
const normal=s=>String(s||'').normalize('NFKC').replace(/天津美术学院/g,'天津美院').replace(/百(?:廿|二|年)(?=老人)/g,'百二十').replace(/百廿/g,'百二十').replace(/办学一百二十年/g,'办学120年').replace(/[^\p{L}\p{N}]/gu,'');
function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length];}
// A boundary needs a long, distinctive tail. Pauses and elapsed time alone never turn a page.
function contains(heard,anchor){if(!anchor)return false;if(heard.includes(anchor))return true;if(anchor.length<18)return false;const max=anchor.length>=26?2:1,starts=new Set();for(const offset of [0,10,20]){const seed=anchor.slice(offset,offset+8);if(seed.length<6)continue;let at=heard.indexOf(seed);while(at>=0){for(let shift=-max;shift<=max;shift++)if(at-offset+shift>=0)starts.add(at-offset+shift);at=heard.indexOf(seed,at+1);}}for(const start of starts)for(let delta=-max;delta<=max;delta++){const part=heard.slice(start,start+anchor.length+delta);if(Math.abs(part.length-anchor.length)<=max&&part.slice(-2)===anchor.slice(-2)&&distance(anchor,part)<=max)return true;}return false;}
function lastClause(text){const pieces=String(text).split(/[，。！？；：]/).map(normal).filter(Boolean);let tail='';while(pieces.length&&tail.length<12)tail=pieces.pop()+tail;return tail;}
class ShotFollower{
 constructor(timeline,{change=()=>{},opening=()=>{},now=()=>performance.now()}={}){this.rows=timeline.map(s=>({...s,start:normal(s.text).slice(0,28),end:normal(s.text).slice(-32),clause:lastClause(s.text),tail:normal((s.text.match(/[^。！？]+[。！？]?/g)||[]).at(-1))}));this.openingAnchors=(timeline[0]?.text.match(/[^。！？]+[。！？]?/g)||[]).slice(0,3).map(normal).filter(s=>s.length>=10);Object.assign(this,{change,opening,now});this.reset();}
 reset(){this.index=-1;this.history='';this.candidate=null;this.started=false;this.ended=false;}
 seek(index){this.index=index;this.history='';this.candidate=null;this.started=index>=0;this.ended=false;}
 snapshot(){const row=this.rows[this.index];return {index:this.index,total:this.rows.length,sceneId:row?.sceneId||'',name:row?.name||'开场总览',end:row?.text.slice(-65)||'',ended:this.ended};}
 move(index){if(index<=this.index)return;if(index>=this.rows.length){this.ended=true;this.candidate=null;return;}this.index=index;this.candidate=null;this.change(this.rows[index],index);}
 feed(text,final=false){const part=normal(text);if(!part)return;const heard=(this.history+part).slice(-7000);if(final)this.history=heard.slice(-120);if(!this.started&&(/尊敬的?/.test(heard)||this.openingAnchors.some(anchor=>heard.includes(anchor)))){this.started=true;this.index=0;this.opening(this.rows[0]);}
  let next=this.index;
  for(let i=Math.max(0,this.index);i<this.rows.length;i++){
   if(contains(heard,this.rows[i].end)||(i===Math.max(0,this.index)&&((this.rows[i].tail.length>=8&&heard.includes(this.rows[i].tail))||heard.includes(this.rows[i].clause)||contains(heard,this.rows[i].end.slice(-18)))))next=Math.max(next,i+1);
   else if(i>this.index&&contains(heard,this.rows[i].start))next=Math.max(next,i);
  }
  if(next<=this.index){this.candidate=null;return;}
  if(final){this.started=true;this.move(next);return;}
  if(this.candidate?.index!==next)this.candidate={index:next,at:this.now()};
 }
 tick(){if(this.candidate&&this.now()-this.candidate.at>=160)this.move(this.candidate.index);}
 next(){this.started=true;this.move(this.index+1);}
}
const api={ShotFollower,normal,contains};if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
