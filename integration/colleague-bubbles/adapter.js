(function(root){
'use strict';
const Type=typeof module!=='undefined'?require('./typography.js'):root.ColleagueTypography;
const Geometry=typeof module!=='undefined'?require('./geometry.js'):root.ColleagueBubbleGeometry;
const Legacy=typeof module!=='undefined'?require('../../stage-layout.js'):root;
const Base=typeof module!=='undefined'?require('../../caption-layout.js'):root.CaptionLayout;
function proseLayout(text,{fontSize=18,maxWidth=500,scale=1}={}){
 const layout=Type.prose(text,{fontSize,maxWidth:maxWidth/scale});
 const width=layout.width*scale,font=layout.fontSize*scale;
 const rows=layout.paragraphs.reduce((n,line)=>n+Math.max(1,Math.ceil(Type.graphemes(line).length*font*1.12/width)),0);
 return {...layout,fontSize:font,width,height:Math.ceil(rows*font*1.6),columns:layout.paragraphs,rows,writingMode:'horizontal',colleague:true};
}
function layoutParts(item,width,font,maxHeight=310){
 const parts=item.parts?.length?item.parts:[{text:item.text}],scale=item.captionScale||1,gap=18*scale,pad=20*scale,writingMode=item.config?.writingMode||'vertical';
 const panels=parts.map(p=>{const maxWidth=Math.max(70,(width-(parts.length-1)*(pad+gap))/parts.length);
  const layout=writingMode==='horizontal'?proseLayout(p.text,{fontSize:font,maxWidth,scale}):{...Base.whole(p.text,{fontSize:font,maxWidth:maxWidth/scale,maxHeight:maxHeight/scale,scale}),writingMode:'vertical',colleague:true};
  return {text:p.text,layout};});
 const connected=parts.length>1,height=Math.max(...panels.map(p=>p.layout.height))+(connected?pad:0),total=panels.reduce((n,p)=>n+p.layout.width+(connected?pad:0),0)+(parts.length-1)*gap;
 let offset=total;for(const p of panels){offset-=p.layout.width+(connected?pad:0);p.left=offset;p.top=0;p.width=p.layout.width+(connected?pad:0);p.height=height;offset-=gap;}
 return {colleague:true,panels:connected?panels:null,paragraphs:panels[0].layout.paragraphs,columns:panels.flatMap(p=>p.layout.columns),width:total,height,fontSize:panels[0].layout.fontSize,writingMode,rows:panels.reduce((n,p)=>n+p.layout.rows,0)};
}
function convertTail(t){if(t.notch)return t;return {...t,notch:t.points,seam:[t.points[0],t.points[2]],connector:[],points:[],handleBase:{x:t.left+(t.points[0][0]+t.points[2][0])/2,y:t.top+(t.points[0][1]+t.points[2][1])/2},handleTip:{x:t.left+t.points[1][0],y:t.top+t.points[1][1]}};}
function place(items,width,height,options){
 let boxes=Geometry.placeBubbles(items,width,height,options);
 // Saved manual placement and pointed-tail controls keep their existing meaning.
 if(items.some(i=>i.config?.manual||i.config?.tailMode==='manual'))boxes=Legacy.placeBubbles(items,width,height,{...options,stable:true});
 if(boxes.length<items.length){const safe=Legacy.placeBubbles(items,width,height,{...options,stable:true});if(safe.length>boxes.length)boxes=safe;}
 return boxes.map(box=>{const item=items.find(i=>i.id===box.id);let tail=convertTail(box.tail),tails;
  if(item.tailTargets?.length){tails=item.tailTargets.map(target=>({...convertTail(target.config?.tailMode==='manual'?Legacy.placeBubbles([{...target,width:box.width,height:box.height,preferred:box}],width,height,{...options,stable:true})[0]?.tail||box.tail:Geometry.bubbleTail(box,{...target,mouth:true,headGap:12,silhouette:target.silhouette||[]})),actor:target.id}));tail=tails[0];}
  return {...box,tail,...(tails?{tails}:{})};
 });
}
function fitCards(items,width,height,options={}){
 let best={boxes:[],cards:[]};
 for(const fraction of [.46,.34,.25,.18,.13]){
  const cards=items.map(item=>{const max=item.sharedChorus?width*.76:Math.max(90,Math.min(item.parts?.length>1?1000:580,width*fraction))*(item.config?.widthScale||1),layout=layoutParts(item,max,Math.max(14,Math.min(18.5,width*.011)),Math.min(360,height*.42)/(item.config?.widthScale||1)),scale=item.captionScale||1;
   return {...item,mouth:true,headGap:12,silhouette:item.silhouette||[],layout,maxHeight:height,width:layout.width+23*scale,height:layout.height+21*scale,panels:layout.panels};});
  const boxes=place(cards,width,height,options);if(boxes.length>best.boxes.length)best={cards,boxes};if(boxes.length===items.length)return {cards,boxes};
 }
 // A constrained layout must never deadlock the proven speech queue.
 if(best.boxes.length<items.length){const fallback=Base.fitCards(items,width,height,{...options,place:Legacy.placeBubbles});if(fallback.boxes.length>best.boxes.length)return fallback;}
 return best;
}
function render(b,text,layout,document){
 const config=b.overlayConfig||{},key=JSON.stringify([text,layout,config]);if(b._colleagueKey===key)return;b._colleagueKey=key;
 const body=b.querySelector('.bubble-text'),parts=layout.panels||[{text,layout}],old=new Map((b._colleagueReveals||[]).map(r=>[r.text,r.clock])),scale=config.scale||1;
 b.classList.add('colleague-bubble');b.dataset.connected=String(parts.length>1);b.dataset.text=text;b.dataset.writingMode=layout.writingMode;b.dataset.page='1';b.dataset.pages='1';b._colleagueReveals=[];
 const nodes=parts.map(part=>{const prose=document.createElement('span');prose.className=layout.writingMode==='vertical'?'caption-vertical':'caption-prose';Object.assign(prose.style,{width:part.layout.width+'px',height:part.layout.height+'px',fontSize:part.layout.fontSize+'px',gap:5*scale+'px'});const glyphs=[];
  for(const sentence of part.layout.paragraphs||part.layout.columns){const line=document.createElement('span');line.className=layout.writingMode==='vertical'?'caption-column':'caption-line';for(const char of Type.graphemes(sentence)){const glyph=document.createElement('span');glyph.className='caption-glyph revealed';glyph.textContent=char;line.append(glyph);glyphs.push(glyph);}prose.append(line);}
  b._colleagueReveals.push({text:part.text,glyphs,clock:old.get(part.text)||new Type.RevealClock()});if(parts.length===1)return prose;
  const card=document.createElement('span');card.className='caption-card';Object.assign(card.style,{width:part.width+'px',height:layout.height+'px',padding:9*scale+'px',border:`${config.borderWidth*scale}px solid ${config.border}`,background:config.fill});card.append(prose);return card;
 });
 body.replaceChildren(...nodes);Object.assign(body.style,{width:layout.width+'px',height:layout.height+'px',fontSize:layout.fontSize+'px',gap:(parts.length>1?18*scale:0)+'px',flexDirection:'row-reverse'});b.setAttribute('aria-label',Type.sentences(text).join('\n'));
}
function advance(b,now,{key,visible=true,durationMs=2000,remainingMs=2000}={}){
 if(b._colleagueMessage!==key){b._colleagueMessage=key;const last=b._colleagueReveals?.at(-1);if(last)last.clock=new Type.RevealClock();}
 const reveals=b._colleagueReveals||[];for(let i=0;i<reveals.length;i++){const r=reveals[i],count=i<reveals.length-1?r.glyphs.length:r.clock.update(now,r.glyphs.length,{visible,durationMs:Math.min(2000,durationMs),remainingMs});
  for(let j=0;j<r.glyphs.length;j++){r.glyphs[j].classList.toggle('revealed',j<count);r.glyphs[j].classList.toggle('pop',j<count);}b.dataset.revealed=String(count);b.dataset.glyphs=String(r.glyphs.length);
 }
}
const api={proseLayout,layoutParts,convertTail,fitCards,render,advance};if(typeof module!=='undefined')module.exports=api;else root.ColleagueBubbles=api;
})(globalThis);
