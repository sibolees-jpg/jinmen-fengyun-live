(function(root){
'use strict';
// Rendering only. Speech recognition, cue order and reading time belong to the
// host controller; mounting this layer never opens a microphone or advances it.
const VERSION=1;
const FONTS={hei:"'Heiti SC','SimHei',sans-serif",song:"'Songti SC','STSong',serif",kangxi:"'JinmenKangxi','康熙字典體','康熙字典体','TypeLand KangXiZiDianTi','Songti SC',serif"};
function fontAsset(value){if(!value)return '';if(!/^\/api\/scene-assets\/[a-f0-9]{64}\.(ttf|otf|woff2?)$/.test(value))throw Error('字体素材引用无效');return value;}
function loadFont(document,config){
 const url=config?.font==='kangxi'?fontAsset(config?.fontAsset):'';if(!url)return FONTS[config?.font]||FONTS.hei;
 const family='JinmenFont-'+url.split('/').pop().split('.')[0],id='font-'+family;
 if(document&&!document.getElementById(id)){const style=document.createElement('style');style.id=id;style.textContent=`@font-face{font-family:'${family}';src:url('${url}');font-display:swap}`;(document.head||document.documentElement).append(style);}
 return `'${family}',${FONTS[config?.font]||FONTS.song}`;
}
function normalize(value={}){
 const num=(key,fallback,min,max)=>{const n=Number(value[key]??fallback);if(!Number.isFinite(n)||n<min||n>max)throw Error('气泡 '+key+' 超出范围');return n;};
 const color=(key,fallback)=>{const v=value[key]??fallback;if(!/^#[0-9a-f]{6}$/i.test(v))throw Error('气泡颜色需为六位色值');return v.toLowerCase();};
 return {writingMode:value.writingMode==='horizontal'?'horizontal':'vertical',tailMode:value.tailMode==='point'?'point':value.tailMode==='manual'||value.tailMode!=='actor'&&value.tailAngle!=null?'manual':'actor',scale:num('scale',1,.05,Infinity),widthScale:num('widthScale',1,.05,Infinity),x:num('x',50,-Infinity,Infinity),y:num('y',15,-Infinity,Infinity),manual:value.manual===true,fill:color('fill','#f8e9ba'),ink:color('ink','#111111'),border:color('border','#29271f'),borderWidth:num('borderWidth',1.725,.5,4),radius:num('radius',4,0,20),font:['song','kangxi'].includes(value.font)?value.font:'hei',...(value.fontAsset?{fontAsset:fontAsset(value.fontAsset)}:{}),...(value.tailMode==='point'?{tailX:num('tailX',50,-Infinity,Infinity),tailY:num('tailY',70,-Infinity,Infinity)}:{}),tailBase:value.tailBase==null?null:num('tailBase',50,0,100),tailWidth:num('tailWidth',6,2,18),tailLength:num('tailLength',12,4,160),tailSide:['top','bottom','left','right'].includes(value.tailSide)?value.tailSide:'auto',tailAngle:value.tailAngle==null?null:num('tailAngle',90,-180,180),tailOffsetX:num('tailOffsetX',0,-15,15),tailOffsetY:num('tailOffsetY',0,-15,15)};
}
// Styles are scene-local. A stable authored sentence ID can override a role's default.
function cueId(message){return String(message?.cueId||message?.cueKey||'').replace(/^\d+:/,'');}
function sharedChorus(scene,message){return message?.chorus===true&&(scene?.sceneBlock?.code==='T1'||scene?.id==='sc-q925-t1');}
const TAIL_KEYS=['tailMode','tailSide','tailAngle','tailBase','tailWidth','tailLength','tailOffsetX','tailOffsetY','tailX','tailY'];
function writingMode(scene,message){return sharedChorus(scene,message)?'horizontal':'vertical';}
function resolveTail(scene,actor,message){const a=typeof actor==='number'?scene?.actors?.[actor]:actor,key=cueId(message);return normalize({...a?.bubble,...(key?a?.bubbleCues?.[key]:{}),writingMode:writingMode(scene,message)});}
function resolve(scene,actor,message){return resolveTail(scene,sharedChorus(scene,message)?0:actor,message);}
function chorusItem(scene,item,figures,rect){
 if(!sharedChorus(scene,item.message))return item;
 const targets=figures.filter(f=>scene.actors[f.id]?.present&&(!scene.actors[f.id].unanchored||scene.composition?.freeLayout)).map(f=>({id:f.id,...(typeof module!=='undefined'?require('./stage-layout.js'):root).speechAnchor(f,scene.actors[f.id]),config:resolveTail(scene,f.id,item.message)}));
 return {...item,sharedChorus:true,text:item.message.text,hideTail:!targets.length,tailTargets:targets,x:rect.left+rect.width/2,y:targets.length?Math.min(...targets.map(t=>t.y)):rect.top+rect.height*.2};
}
function normalizeCues(value){if(value==null)return {};if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>400)throw Error('逐条气泡设置无效');return Object.fromEntries(Object.entries(value).map(([key,style])=>{if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(key))throw Error('逐条气泡编号无效');return [key,normalize(style)];}));}
function decorate(item,config,rect){const s=normalize(config);return {...item,message:item.message??item.key??item.text,config:s,captionScale:s.scale,styleKey:JSON.stringify([s.scale,s.widthScale,s.manual,s.x,s.y,s.font,s.borderWidth,s.radius,s.writingMode]),preferred:s.manual?{left:rect.left+s.x*rect.width/100,top:rect.top+s.y*rect.height/100}:null,tailTarget:s.tailMode==='point'?{x:rect.left+s.tailX*rect.width/100,y:rect.top+s.tailY*rect.height/100}:{x:item.x+s.tailOffsetX*rect.width/100,y:item.y+s.tailOffsetY*rect.height/100}};}
function createCard(document,actor,name=''){
 const b=document.createElement('div');b.overlayDocument=document;b.className='bubble';b.dataset.actor=String(actor);b.setAttribute('aria-hidden','true');
 b.innerHTML='<svg class="bubble-tail" aria-hidden="true"><path></path><path class="bubble-connector"></path><path class="bubble-seam"></path><path class="bubble-notch"></path></svg><div class="bubble-who"></div><p class="bubble-text"></p>';
 b.querySelector('.bubble-who').textContent=name;return b;
}
function styleCard(b,config,renderScale=1){
 const s=normalize(config),scale=s.scale*renderScale;b.style.setProperty('--paper',s.fill);
 Object.assign(b.style,{background:s.fill,borderColor:s.border,borderWidth:s.borderWidth*scale+'px',borderRadius:s.radius*scale+'px',padding:`${10.35*scale}px ${11.5*scale}px`});
 const body=b.querySelector('.bubble-text');Object.assign(body.style,{color:s.ink,fontFamily:loadFont(b.overlayDocument,s),gap:(s.writingMode==='horizontal'?0:5.75*scale)+'px'});
 b.overlayConfig={...s,scale};for(const tail of [b.querySelector('.bubble-tail'),...(b.extraTails||[])])styleTail(tail,b.overlayConfig);
}
function styleTail(tail,s){const scale=s.scale;tail.style.transform=`translate(${-s.borderWidth*scale}px,${-s.borderWidth*scale}px)`;
 for(const [selector,fill,stroke,width] of [['.bubble-seam','none',s.fill,s.borderWidth*2+.3],['.bubble-notch',s.fill,s.border,s.borderWidth],['.bubble-connector','none',s.border,.85],['path','none',s.border,.85]]){const p=tail.querySelector(selector);if(p)Object.assign(p.style,{fill,stroke,strokeWidth:width*scale+'px',...(['path','.bubble-connector'].includes(selector)?{display:'none'}:{})});}
}
function renderText(b,text,layout,document){
 if(layout.colleague&&root.ColleagueBubbles)return root.ColleagueBubbles.render(b,text,layout,document);
 b.classList.remove('colleague-bubble');b.removeAttribute?.('data-connected');
 const key=[text,layout.rows,layout.fontSize,layout.writingMode,layout.width,layout.height].join('|');if(b.dataset.pageKey===key)return;
 const replacing=b.classList.contains('visible')&&b.dataset.text&&b.dataset.text!==text;
 Object.assign(b.dataset,{pageKey:key,text,page:'1',pages:'1'});
 const body=b.querySelector('.bubble-text');Object.assign(body.style,{height:layout.height+'px',width:layout.width+'px',fontSize:layout.fontSize+'px',flexDirection:layout.writingMode==='horizontal'?'column':'row-reverse',gap:layout.writingMode==='horizontal'?'0px':body.style.gap,writingMode:'horizontal-tb'});
 b.dataset.writingMode=layout.writingMode||'vertical';
 body.replaceChildren(...layout.columns.map(text=>{const n=document.createElement('span');n.className=layout.writingMode==='horizontal'?'caption-line':'caption-column';n.textContent=text;return n;}));
 if(replacing)body.animate?.([{opacity:.65},{opacity:1}],{duration:260,easing:'ease-out'});
 b.setAttribute('aria-label',text);
}
function placeCard(b,box){
 const geometries=box.tails?.length?box.tails:[box.tail];b.extraTails??=[];
 while(b.extraTails.length>geometries.length-1)b.extraTails.pop().remove();
 while(b.extraTails.length<geometries.length-1){const doc=b.overlayDocument,svg=doc.createElementNS?doc.createElementNS('http://www.w3.org/2000/svg','svg'):doc.createElement('svg');svg.setAttribute('class','bubble-tail bubble-tail-extra');svg.setAttribute('aria-hidden','true');svg.innerHTML='<path></path><path class="bubble-connector"></path><path class="bubble-seam"></path><path class="bubble-notch"></path>';b.append(svg);b.extraTails.push(svg);}
 Object.assign(b.style,{left:box.left+'px',top:box.top+'px'});b.dataset.tailCount=String(box.hideTail?0:geometries.length);b.querySelector('.bubble-text').style.textAlign=box.tails?.length?'center':'';
 [b.querySelector('.bubble-tail'),...b.extraTails].forEach((tail,i)=>{const t=geometries[i];styleTail(tail,b.overlayConfig||normalize());tail.dataset.actor=String(t.actor??box.id);tail.style.display=box.detached||box.hideTail?'none':'';
  Object.assign(tail.style,{left:t.left+'px',top:t.top+'px',width:t.width+'px',height:t.height+'px'});tail.setAttribute('viewBox',`0 0 ${t.width} ${t.height}`);
  for(const [selector,points] of [['path',t.points],['.bubble-connector',t.connector],['.bubble-seam',t.seam],['.bubble-notch',t.notch]])tail.querySelector(selector)?.setAttribute('d',(points||[]).map(([x,y],j)=>`${j?'L':'M'} ${x} ${y}`).join(' '));
 });
}
// Shadow DOM is used by the editor and by external frontends. No global CSS,
// body listeners, timers, element IDs, React/Vue dependencies or host mutations.
const CSS=`:host{all:initial;position:absolute;inset:0;display:block;pointer-events:none;z-index:240;isolation:isolate}*{box-sizing:content-box}.plane{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}.bubble{position:absolute;width:max-content;margin:0;border:1.725px solid #29271f;background:#f8e9ba;box-shadow:2.3px 3.45px 0 #4f412014;opacity:0;pointer-events:none;transition:opacity .42s ease}.bubble.visible{opacity:1}.bubble-tail{position:absolute;overflow:visible;pointer-events:none}.bubble-tail path{stroke-linejoin:round}.bubble-tail>path:first-child,.bubble-connector{display:none}.bubble-seam{stroke-linecap:butt}.bubble-who{display:none}.bubble-text{margin:0;display:flex;flex-direction:row-reverse;writing-mode:horizontal-tb;line-height:1.12;letter-spacing:.12em;overflow:visible}.caption-column{display:block;flex:none;writing-mode:vertical-rl;text-orientation:upright;white-space:pre;line-height:1.25}.caption-line{display:block;flex:none;writing-mode:horizontal-tb;white-space:pre;line-height:1.4}@media(prefers-reduced-motion:reduce){.bubble{transition:none}}`;
// One canonical 1280×720 canvas for editor, windowed stage and fullscreen.
// Authored free placement stays exact; live replies opt into face-safe packing.
function fitFree(items,rect,{avoidFaces=false,obstacles=[],previous=[]}={}){
 const Caption=typeof module!=='undefined'?require('./caption-layout.js'):root.CaptionLayout,place=typeof module!=='undefined'?require('./stage-layout.js').placeBubbles:root.placeBubbles;
 const width=1280,height=720,ratio=rect.width/width;
 let cards=items.map(item=>{
  const s=normalize(item.config),factor=s.scale,layout=Caption.whole(item.text,{fontSize:item.sharedChorus?20:16,maxHeight:300/s.widthScale,scale:Caption.DISPLAY_SCALE*factor,writingMode:s.writingMode,maxWidth:item.sharedChorus?940*s.widthScale/Caption.DISPLAY_SCALE:340});
  if(item.sharedChorus)layout.width=Math.max(layout.width,940*s.widthScale*factor);
  const edge=(s.borderWidth-1.725)*2*factor;
  const toCanvas=p=>({...p,x:(p.x-rect.left)/ratio,y:(p.y-rect.top)/ratio});
  return {...item,...toCanvas(item),config:s,captionScale:factor,layout,maxHeight:300,renderScale:ratio,preferred:{left:s.manual?width*s.x/100:60+(Number(item.id)||0)*115,top:s.manual?height*s.y/100:65+(Number(item.id)||0)%3*28},tailTarget:item.tailTarget?toCanvas(item.tailTarget):undefined,tailTargets:item.tailTargets?.map(toCanvas),width:layout.width+23*Caption.DISPLAY_SCALE*factor+edge,height:layout.height+21*Caption.DISPLAY_SCALE*factor+edge};
 });
 let placed;
 if(avoidFaces){
  const blocked=obstacles.map(o=>({...o,left:(o.left-rect.left)/ratio,top:(o.top-rect.top)/ratio,width:o.width/ratio,height:o.height/ratio})),base=cards;
  let best={cards,boxes:[]};
  // Live text varies in length: reflow whole turns before reducing their size.
  outer:for(const shrink of [1,.85,.7])for(const maxHeight of [300,230,170,110]){
   const trial=base.map(item=>{
    const config={...item.config,manual:false,tailMode:'actor',tailSide:'auto',tailBase:null,tailOffsetX:0,tailOffsetY:0,scale:item.config.scale*shrink},factor=config.scale;
    const layout=Caption.whole(item.text,{fontSize:16,maxHeight:maxHeight/Math.max(.75,Math.min(1.6,config.widthScale)),maxWidth:340,scale:Caption.DISPLAY_SCALE*factor,writingMode:config.writingMode}),edge=(config.borderWidth-1.725)*2*factor;
    const width=layout.width+23*Caption.DISPLAY_SCALE*factor+edge,height=layout.height+21*Caption.DISPLAY_SCALE*factor+edge;
    const prior=previous.find(p=>p.id===item.id&&p.message===item.message&&Math.abs(p.width/ratio-width)<.01&&Math.abs(p.height/ratio-height)<.01);
    return {...item,config,captionScale:factor,layout,maxHeight,width,height,preferred:null,tailTarget:{x:item.x,y:item.y},...(prior?{previous:{...prior,left:(prior.left-rect.left)/ratio,top:(prior.top-rect.top)/ratio,width,height}}:{})};
   });
   const boxes=place(trial,width,height,{obstacles:blocked,stable:true,preferSides:true});
   if(boxes.length>best.boxes.length)best={cards:trial,boxes};
   if(boxes.length===items.length){best={cards:trial,boxes};break outer;}
  }
  cards=best.cards;placed=best.boxes;
 }
 const scaleTail=tail=>({...tail,...Object.fromEntries(['left','top','width','height'].map(k=>[k,tail[k]*ratio])),...Object.fromEntries(['notch','seam','points','connector'].filter(k=>tail[k]).map(k=>[k,tail[k].map(p=>p.map(n=>n*ratio))])),handleBase:{x:tail.handleBase.x*ratio,y:tail.handleBase.y*ratio},handleTip:{x:tail.handleTip.x*ratio,y:tail.handleTip.y*ratio}});
 const boxes=(placed||place(cards,width,height,{freeLayout:true})).map(b=>({...b,left:rect.left+b.left*ratio,top:rect.top+b.top*ratio,width:b.width*ratio,height:b.height*ratio,tail:scaleTail(b.tail),...(b.tails?{tails:b.tails.map(scaleTail)}:{})}));
 return {boxes,cards:cards.map(c=>({...c,width:c.width*ratio,height:c.height*ratio,layout:{...c.layout,width:c.layout.width*ratio,height:c.layout.height*ratio,fontSize:c.layout.fontSize*ratio}}))};
}
function mount(host,{document=host.ownerDocument,Caption=root.CaptionLayout,place=root.placeBubbles,onVisible=()=>{},editing=false}={}){
 if(!Caption?.fitCards||!place)throw Error('气泡层需要 CaptionLayout 和 placeBubbles');
 const element=document.createElement('jmf-dialogue-layer'),shadow=element.attachShadow({mode:'open'}),style=document.createElement('style'),plane=document.createElement('div');style.textContent=CSS+(root.ColleagueBubbleCSS||'');plane.className='plane';shadow.append(style,plane);host.append(element);
 let previous=[],dead=false;const nodes=new Map(),notified=new Set(),fading=new Map();
 function update({items=[],width,height,reserved=null,obstacles=[],sceneRect={left:0,top:0,width,height},now=0,displayWidth=width,freeLayout=false}){
  if(dead)throw Error('气泡层已卸载');if(!(width>0&&height>0&&displayWidth>0))return {boxes:[],blocked:[]};
  Object.assign(plane.style,{width:width+'px',height:height+'px',transform:`scale(${displayWidth/width})`});
  const current=new Set(items.map(i=>i.id));
  for(const [id,n] of nodes)if(!current.has(id)&&n.classList.contains('visible')){n.classList.remove('visible');n.setAttribute('aria-hidden','true');fading.set(id,now+420);}
  const leaving=previous.filter(p=>!current.has(p.id)&&fading.get(p.id)>now);
  const prepared=items.map(i=>decorate(i,i.config,sceneRect));
  const result=freeLayout?fitFree(prepared,sceneRect):(root.FrontendTrial?.colleague()?root.ColleagueBubbles:Caption).fitCards(prepared,width,height,{place,reserved,obstacles:[...obstacles,...leaving],previous:previous.filter(p=>current.has(p.id))});
  for(const box of result.boxes){const card=result.cards.find(c=>c.id===box.id);let n=nodes.get(box.id);if(!n){n=createCard(document,box.id);nodes.set(box.id,n);plane.append(n);}if(editing)n.style.transition='none';styleCard(n,card.config,card.renderScale||1);renderText(n,card.text,card.layout,document);box.hideTail=card.hideTail===true;placeCard(n,box);n.style.visibility='visible';n.classList.add('visible');n.setAttribute('aria-hidden','false');fading.delete(box.id);const key=card.key??card.message??card.text;if(!notified.has(key)){notified.add(key);onVisible({id:card.id,key,now});}}
  const placed=new Set(result.boxes.map(b=>b.id)),blocked=prepared.filter(i=>!placed.has(i.id)).map(i=>i.id);
  for(const id of blocked){const n=nodes.get(id);if(n){n.style.visibility='hidden';n.classList.remove('visible');n.setAttribute('aria-hidden','true');}}
  previous=[...result.boxes.map(box=>({...result.cards.find(c=>c.id===box.id),...box})),...leaving];
  return {boxes:result.boxes,cards:result.cards,blocked};
 }
 return {version:VERSION,element,update,clear(){previous=[];notified.clear();fading.clear();for(const n of nodes.values())n.remove();nodes.clear();},destroy(){if(dead)return;this.clear();element.remove();dead=true;}};
}
const api={fitFree,loadFont,fontAsset,VERSION,normalize,normalizeCues,cueId,writingMode,sharedChorus,TAIL_KEYS,resolve,resolveTail,chorusItem,decorate,createCard,styleCard,renderText,placeCard,mount};if(typeof module!=='undefined')module.exports=api;else root.DialogueOverlay=api;
})(globalThis);
