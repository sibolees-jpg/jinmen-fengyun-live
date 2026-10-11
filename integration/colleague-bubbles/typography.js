(function(root){
'use strict';
const segmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('zh',{granularity:'grapheme'}):null;
function graphemes(text){return segmenter?Array.from(segmenter.segment(text),s=>s.segment):Array.from(text);}
class RevealClock {
 constructor(){this.elapsed=0;this.last=null;this.count=0;}
 update(now,total,{enabled=true,visible=true,durationMs=Infinity,remainingMs=Infinity}={}){
  const dt=this.last===null?0:Math.max(0,now-this.last);this.last=now;
  if(visible)this.elapsed+=dt;
  // Finish early enough to read the final glyph, including after a slow frame.
  const budget=Math.max(1,Math.min(total*65,durationMs-250,this.elapsed+remainingMs-200));
  if(visible)this.count=enabled?Math.max(this.count,Math.min(total,1+Math.floor(this.elapsed/Math.max(1,budget/Math.max(1,total-1))))):total;
  return this.count;
 }
}
function format(text){return String(text||'').replace(/[\p{P}\p{S}\s]+/gu,'\u3000').replace(/^\u3000+|\u3000+$/gu,'');}
function count(text){return Array.from(String(text||'').replace(/[^\p{L}\p{N}]/gu,'')).length;}
function duration(text){return Math.max(2000,Math.round(count(text)*60000/220));}
function pages(text,rows=17,columns=3){
 const all=[];
 // Each punctuated clause starts a new vertical column. Only a clause longer
 // than the available height wraps; it never shares a column with the next.
 for(const sentence of String(text||'').split(/[。！？!?；;\n\r]+/u)){
  const chars=graphemes(format(sentence).replace(/\s/gu,''));
  for(let i=0;i<chars.length;i+=rows)all.push(chars.slice(i,i+rows).join(''));
 }
 const result=[];for(let i=0;i<all.length;i+=columns)result.push(all.slice(i,i+columns));return result.length?result:[['']];
}

function pageAt(pages,elapsed,total){const counts=pages.map(p=>count(p.join(''))),sum=counts.reduce((a,b)=>a+b,0)||1,point=Math.max(0,Math.min(.999999,elapsed/total))*sum;let edge=0;for(let i=0;i<counts.length;i++){edge+=counts[i];if(point<edge)return i;}return pages.length-1;}
// One authored turn is one persistent card: column wrapping is spatial,
// never a time-based replacement of the beginning by the end.
function whole(text,{fontSize=16,maxHeight=310,maxWidth=300}={}){
 let font=Math.max(12,fontSize),result;
 for(;font>=10;font-=.5){
  const rows=Math.max(3,Math.floor((maxHeight-2)/(font*1.12))),columns=pages(text,rows,Infinity)[0],width=columns.length*font*1.25+Math.max(0,columns.length-1)*5,height=Math.max(...columns.map(c=>Array.from(c).length))*font*1.12+2;
  result={columns,fontSize:font,width:Math.ceil(width),height:Math.ceil(height),rows};if(width<=maxWidth)break;
 }
 return result;
}
// Real sentence paragraphs; spacing is never used to simulate a line break.
function sentences(text){
 const clean=String(text||'').replace(/\r\n?/g,'\n').replace(/[^\S\n]+/gu,' ').trim();
 return clean.match(/[^。！？!?；;\n]+[。！？!?；;]+[”’」』）)]*|[^。！？!?；;\n]+/gu)?.map(s=>s.trim()).filter(Boolean)||[''];
}
function prose(text,{fontSize=18,maxWidth=500}={}){
 const paragraphs=sentences(text),font=Math.max(14,fontSize),longest=Math.max(1,...paragraphs.map(s=>graphemes(s).length));
 return {paragraphs,fontSize:font,width:Math.ceil(Math.min(maxWidth,Math.max(font*4,longest*font*1.12)))};
}
const api={sentences,prose,graphemes,RevealClock,format,count,duration,pages,pageAt,whole};if(typeof module!=='undefined')module.exports=api;else root.ColleagueTypography=api;
})(globalThis);
