(function(root){
'use strict';
const IDS=['original','polyhedron_scholar','medal_elder','square_cap','cane_elder','tunic_man','turban_scholar'];
const PERSONS=[{"id":"liang-qichao","name":"梁启超","actor":0,"legacySkins":[]},{"id":"li-hongzhang","name":"李鸿章","actor":1,"legacySkins":["medal_elder"]},{"id":"yan-fu","name":"严复","actor":2,"legacySkins":["square_cap"]},{"id":"li-shutong","name":"李叔同","actor":3,"legacySkins":["tunic_man"]},{"id":"cai-yuanpei","name":"蔡元培","actor":4,"legacySkins":["cane_elder"]},{"id":"plato","name":"柏拉图","actor":5,"legacySkins":["polyhedron_scholar"]},{"id":"leonardo","name":"达芬奇","actor":6,"legacySkins":["turban_scholar"]},{"id":"","name":"","actor":7,"disabled":true,"legacySkins":[]},{"id":"yu-gong","name":"愚公","actor":8,"legacySkins":[]},{"id":"qiu-zhijie","name":"邱志杰","actor":9,"legacySkins":["original"]}];
const SKIN_PERSON={"original":"qiu-zhijie","polyhedron_scholar":"plato","medal_elder":"li-hongzhang","square_cap":"yan-fu","cane_elder":"cai-yuanpei","tunic_man":"li-shutong","turban_scholar":"leonardo"};
const NAMES=["邱志杰（行走）","柏拉图（行走）","李鸿章（行走）","严复（行走）","蔡元培（行走）","李叔同（行走）","达芬奇（行走）"];
const ART_IDS=IDS.slice();const STAGE_NAMES=['梁启超','李鸿章','严复','李叔同','蔡元培','柏拉图','达芬奇','','愚公','邱志杰'];for(let i=0;i<10;i++){if(!STAGE_NAMES[i])continue;IDS.push('stage_'+i);NAMES.push(STAGE_NAMES[i]+'（原演出）');}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const num=(v,d,a,b)=>{if(v===undefined)return d;if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw Error('透视与人物数值超出范围');return v;};
const NPC_FIELDS=[['size',.01,50],['speed',0,20],['interval',0,300],['intervalRandom',0,1],['distance',0,20480],['distanceRandom',0,1],['avoidance',0,5]];
const npcSettings=(config,id)=>({...config.npc,...config.npc.overrides?.[id]});
const point=p=>{if(!Array.isArray(p)||p.length!==2)throw Error('出生点坐标无效');return p.map(v=>num(v,0,-10000,10000));};
function defaults(){return {version:1,enabled:false,grid:true,gridDensity:1,gridColor:'#668376',pinBirths:false,birthScreens:{},birthScales:{},camera:{yaw:90,pitch:90,strength:0,horizon:.15,height:.55,zoom:1,focus:[0,0],locked:false},area:[],births:{},names:{},speakers:{},placed:false,seed:1,npc:{selection:'mixed',overrides:{},size:1,speed:3.2,interval:1,intervalRandom:.5,distance:6,distanceRandom:.5,avoidance:.5,eventEnabled:false,eventProbability:.3,speechDuration:1.8,speechRandom:.4,speechProbability:1}};}
function normalize(v){
 const d=defaults();if(v==null)return d;if(v.version!==1)throw Error('不支持的透视平面版本');
 for(const k of ['enabled','grid','placed','pinBirths'])d[k]=v[k]===undefined?d[k]:v[k]===true;
 d.gridDensity=num(v.gridDensity,1,.25,4);d.seed=num(v.seed,1,0,4294967295)>>>0;d.gridColor=/^#[0-9a-f]{6}$/i.test(v.gridColor)?v.gridColor:d.gridColor;
 const c=v.camera||{};for(const [k,a,b] of [['yaw',-36000,36000],['pitch',0,90],['strength',0,3],['horizon',0,1],['height',.01,10],['zoom',.02,30]])d.camera[k]=num(c[k],d.camera[k],a,b);
 if(c.frameAspect!==undefined)d.camera.frameAspect=num(c.frameAspect,2,.2,6);if(c.contentAnchors===true)d.camera.contentAnchors=true;
 d.camera.focus=c.focus?point(c.focus):[0,0];d.camera.locked=c.locked===true;if(c.theatreZoom!==undefined)d.camera.theatreZoom=num(c.theatreZoom,1,.25,5);
 if(v.names)for(const id of IDS){if(v.names[id]===undefined)continue;const name=v.names[id];if(typeof name!=='string'||!name.trim()||name.trim().length>40||/[\u0000-\u001f]/.test(name))throw Error('人物名字需为 1 至 40 个字符');d.names[id]=name.trim();}
 if(v.speakers)for(const id of IDS)if(Object.hasOwn(v.speakers,id)){const person=v.speakers[id]==='galileo'?'':v.speakers[id];if(person!==''&&!PERSONS.some(p=>p.id===person))throw Error('讲话人物绑定无效');d.speakers[id]=person;}
 const n=v.npc||{};d.npc.selection=n.selection==='mixed'||IDS.includes(n.selection)?n.selection:'mixed';d.npc.eventEnabled=n.eventEnabled===true;
 for(const [k,a,b] of [['size',.01,50],['speed',0,20],['interval',0,300],['intervalRandom',0,1],['distance',0,20480],['distanceRandom',0,1],['avoidance',0,5],['eventProbability',0,1],['speechDuration',.2,30],['speechRandom',0,1],['speechProbability',0,1]])d.npc[k]=num(n[k],d.npc[k],a,b);
 if(n.overrides)for(const id of IDS){const value=n.overrides[id];if(!value)continue;const settings={};for(const [key,min,max] of NPC_FIELDS)if(value[key]!==undefined)settings[key]=num(value[key],d.npc[key],min,max);if(Object.keys(settings).length)d.npc.overrides[id]=settings;}
 if(v.births)for(const id of IDS)if(v.births[id])d.births[id]=point(v.births[id]);
 if(v.birthScreens)for(const id of IDS)if(d.births[id]&&v.birthScreens[id])d.birthScreens[id]=point(v.birthScreens[id]);
 if(v.birthScales)for(const id of IDS)if(d.birthScreens[id]&&v.birthScales[id]!==undefined)d.birthScales[id]=num(v.birthScales[id],1,.000001,10000);
 if(!Array.isArray(v.area)||v.area.length>200000)throw Error('活动范围格式无效');
 let cells=0;const rows=new Map();for(const r of v.area){if(!Array.isArray(r)||r.length!==3||r.some(x=>!Number.isInteger(x)||Math.abs(x)>10000)||r[2]<r[1])throw Error('活动范围坐标无效');cells+=r[2]-r[1]+1;if(cells>200000)throw Error('活动范围最多支持二十万格');if(!rows.has(r[0]))rows.set(r[0],[]);rows.get(r[0]).push([r[1],r[2]]);}
 for(const [y,runs] of [...rows].sort((a,b)=>a[0]-b[0])){runs.sort((a,b)=>a[0]-b[0]);for(const r of runs){const last=d.area.at(-1);if(last&&last[0]===y&&r[0]<=last[2]+1)last[2]=Math.max(last[2],r[1]);else d.area.push([y,...r]);}}
 return d;
}
class Projection{
 constructor(camera,w=1280,h=800){this.set(camera,w,h);}
 set(c,w,h,frame=null){this.c=c;this.w=w;this.h=h;
  // Reference-aligned scenes use the background's fitted rectangle in both editor and stage.
  const fw=c.frameAspect?Math.min(w,h*c.frameAspect):w,fh=c.frameAspect?fw/c.frameAspect:h;
  this.frame=c.frameAspect?(frame||{left:(w-fw)/2,top:(h-fh)/2,width:fw,height:fh}):{left:0,top:0,width:w,height:h};
  this.cell=Math.min(this.frame.width/12,this.frame.height/8)*c.zoom;const a=c.yaw*Math.PI/180;this.co=Math.cos(a);this.si=Math.sin(a);this.ps=Math.max(.0001,Math.sin(c.pitch*Math.PI/180));
  // Linearize near-field displacement instead of feeding a linear slider into 1/depth.
  // Pitch controls base cell foreshortening; strength independently controls depth.
  // Do not disable the strength slider at the square-grid (90 degree) default.
  const response=.5-.15*clamp((this.ps-Math.SQRT1_2)/(1-Math.SQRT1_2),0,1);
  const strength=3*c.strength/(3*response+(1-response)*c.strength);this.k=strength/(.56*this.frame.height);this.gap=c.height*this.frame.height;this.hy=this.frame.top+c.horizon*this.frame.height;this.oy=this.hy+this.gap;
  // At zero, vertical gain must approach 1, not 0. A fixed finite vanishing line
  // cannot be imposed on parallel projection without flattening the whole plane.
  // Approach that line smoothly while retaining the independent anchor/guide controls.
  this.gain=(1+(this.k*this.gap)**4)**.25;this.vy=this.k?this.oy-this.gain/this.k:-Infinity;return this;
 }
 // Frame-relative anchors survive editor/stage letterboxing and scene saves.
 screen(p){const f=this.frame;return [(p[0]-f.left)/f.width,(p[1]-f.top)/f.height];}
 fromScreen(p){const f=this.frame;return [f.left+p[0]*f.width,f.top+p[1]*f.height];}
 actor(a){return a.screenAnchor?[...this.fromScreen(a.screenAnchor),a.screenSize/this.cell]:this.project(a.p);}
 flat(p){const x=p[0]-this.c.focus[0],y=p[1]-this.c.focus[1];return [(this.co*x-this.si*y)*this.cell,(this.si*x+this.co*y)*this.cell*this.ps];}
 project(p){const [x,y]=this.flat(p),d=1-this.k*y;if(d<.05)return null;const s=1/d;return [this.w/2+x*s,this.oy+this.gain*y*s,s];}
 unproject(p,worldLimit=10000){const dy=p[1]-this.oy,s=1+this.k*dy/this.gain;if(s<=0||s>20+1e-8)return null;const x=(p[0]-this.w/2)/s/this.cell,y=dy/(this.gain*s*this.cell*this.ps);const v=[this.co*x+this.si*y+this.c.focus[0],-this.si*x+this.co*y+this.c.focus[1]];return v.every(Number.isFinite)&&v.every(n=>Math.abs(n)<=worldLimit)?v:null;}
 // Clip a projected world line against the viewport and the near plane before drawing.
 line(a,b,rect=[0,0,this.w,this.h]){const fa=this.flat(a),fb=this.flat(b),map=([x,y])=>[this.w/2*(1-this.k*y)+x,this.oy*(1-this.k*y)+this.gain*y,1-this.k*y];const [left,top,right,bottom]=rect;let u=map(fa),v=map(fb),lo=0,hi=1;for(const f of [q=>q[2]-.05,q=>q[0]-left*q[2],q=>right*q[2]-q[0],q=>q[1]-top*q[2],q=>bottom*q[2]-q[1]]){const x=f(u),y=f(v);if(x<0&&y<0)return null;if(x<0)lo=Math.max(lo,x/(x-y));if(y<0)hi=Math.min(hi,x/(x-y));}if(lo>hi)return null;const at=t=>{const q=u.map((x,i)=>mix(x,v[i],t));return [clamp(q[0]/q[2],left,right),clamp(q[1]/q[2],top,bottom)];};return [at(lo),at(hi)];}
 polygon(points){let poly=points.map(p=>{const [x,y]=this.flat(p),d=1-this.k*y;return [this.w/2*d+x,this.oy*d+this.gain*y,d];});for(const f of [q=>q[2]-.05,q=>q[0],q=>this.w*q[2]-q[0],q=>q[1],q=>this.h*q[2]-q[1]]){const clipped=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=f(a),fb=f(b);if(fa>=0)clipped.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);clipped.push(a.map((v,j)=>mix(v,b[j],t)));}}poly=clipped;if(!poly.length)break;}return poly.map(q=>[clamp(q[0]/q[2],0,this.w),clamp(q[1]/q[2],0,this.h)]);}
 groundRect(){return [0,this.k?Math.max(0,this.vy+1):0,this.w,this.k?Math.min(this.h,this.oy+19*this.gain/this.k):this.h];}
 gridRect(){
  const rect=this.groundRect();if(!this.k)return rect;
  // Cull unreadable distant cells before inverse projection or grid enumeration.
  // Keep the near guide even at nearly edge-on angles or extreme zoom-out.
  const readableScale=Math.min(.35,Math.max(2/this.cell,Math.sqrt(2/(this.cell*this.gain*this.ps))));
  rect[1]=Math.max(rect[1],this.oy+this.gain*(readableScale-1)/this.k);return rect;
 }
 bounds(rect=this.groundRect()){
  const [left,top,right,bottom]=rect;if(bottom<=top)return null;
  // Drawing an infinite plane must not inherit the editable-area coordinate limit.
  // Dropping out-of-range corners used to collapse this rectangle to its bottom edge.
  const pts=[[left,top],[right,top],[left,bottom],[right,bottom]].map(p=>this.unproject(p,Infinity));
  if(pts.some(p=>!p))return null;
  return [Math.floor(Math.min(...pts.map(p=>p[0]))),Math.floor(Math.min(...pts.map(p=>p[1]))),Math.ceil(Math.max(...pts.map(p=>p[0]))),Math.ceil(Math.max(...pts.map(p=>p[1])))];
 }
 gridLines(budget=360,density=1){
 const spacing=1/clamp(density,.25,4);
 // One continuous density rule at zero and nonzero strength. Integer world
 // bounds and a special orthographic branch caused whole rows to pop away.
 const rect=this.gridRect();if(rect[3]<=rect[1])return [];
 const depth=this.k*this.h/this.gain,bands=8,slots=budget/(4+6*depth/(1+depth))-1,groups=new Map();
 const edge=i=>this.k?rect[1]+(rect[1]-this.vy)*Math.expm1(Math.log1p((rect[3]-rect[1])/(rect[1]-this.vy))*i/bands):rect[1]+(rect[3]-rect[1])*i/bands;
 for(let band=0;band<bands;band++){
  const clip=[0,edge(band),this.w,edge(band+1)],points=[[clip[0],clip[1]],[clip[2],clip[1]],[clip[0],clip[3]],[clip[2],clip[3]]].map(q=>this.unproject(q,Infinity));if(points.some(q=>!q))continue;
  const b=[Math.min(...points.map(q=>q[0])),Math.min(...points.map(q=>q[1])),Math.max(...points.map(q=>q[0])),Math.max(...points.map(q=>q[1]))];
  const mid=(clip[1]+clip[3])/2,center=this.unproject([this.w/2,mid],Infinity),dx=this.unproject([this.w/2+1,mid],Infinity),dy=this.unproject([this.w/2,mid+.001],Infinity);if(!center||!dx||!dy)continue;const spans=[0,1].map(i=>Math.abs(dx[i]-center[i])*this.w+Math.abs(dy[i]-center[i])*this.h*1000);
  const level=Math.max(0,Math.log2(Math.max(1,...spans.map(v=>v/slots/spacing)))),stride=spacing*2**Math.floor(level),minorAlpha=1-(level-Math.floor(level));
  for(let axis=0;axis<2;axis++)for(let v=Math.ceil(b[axis]/stride)*stride;v<=b[axis+2]+1e-8;v+=stride){
   const line=axis===0?this.line([v,b[1]],[v,b[3]],clip):this.line([b[0],v],[b[2],v],clip);if(!line||Math.hypot(line[1][0]-line[0][0],line[1][1]-line[0][1])<.01)continue;
   line.alpha=Math.abs(Math.round(v/stride)%2)===1?minorAlpha:1;
   const key=axis+':'+v;let parts=groups.get(key);if(!parts)groups.set(key,parts=[]);parts.push(line);
  }
 }
 // Join the same world line across depth bands. Opacity gradients preserve
 // density transitions without repeatedly drawing or resizing whole cells.
 const out=[];
 for(const parts of groups.values()){
  const points=parts.flat(),vertical=Math.abs(points[0][1]-points[1][1])>Math.abs(points[0][0]-points[1][0]),axis=vertical?1:0;
  parts.forEach(p=>{if(p[0][axis]>p[1][axis])[p[0],p[1]]=[p[1],p[0]];});parts.sort((a,b)=>a[0][axis]-b[0][axis]);
  let current=null;
  for(const p of parts){if(current&&p[0][axis]<=current[1][axis]+1e-6){if(p[1][axis]>current[1][axis]+1e-6){current[1]=p[1];current.samples.push({p:p[1],alpha:p.alpha});}current.alpha=Math.max(current.alpha,p.alpha);}else{current=[p[0],p[1]];current.alpha=p.alpha;current.samples=[{p:p[0],alpha:p.alpha},{p:p[1],alpha:p.alpha}];out.push(current);}}
 }
 for(const line of out){const length=Math.hypot(line[1][0]-line[0][0],line[1][1]-line[0][1]);line.stops=line.samples.map(s=>({t:Math.min(1,Math.hypot(s.p[0]-line[0][0],s.p[1]-line[0][1])/length),alpha:s.alpha}));delete line.samples;}
 return out;
}
}
class Area{
 constructor(runs=[]){this.set(runs);}
 set(runs){this.rows=new Map();this.runs=runs;this.count=0;this.prefix=[];this.minX=Infinity;this.maxX=-Infinity;this.minY=Infinity;this.maxY=-Infinity;for(const [y,l,r] of runs){if(!this.rows.has(y))this.rows.set(y,[]);this.rows.get(y).push([l,r]);this.count+=r-l+1;this.prefix.push(this.count);this.minX=Math.min(this.minX,l);this.maxX=Math.max(this.maxX,r);this.minY=Math.min(this.minY,y);this.maxY=Math.max(this.maxY,y);}return this;}
 *visible(bounds){const [x0,y0,x1,y1]=bounds;let lo=0,hi=this.runs.length;while(lo<hi){const m=(lo+hi)>>1;if(this.runs[m][0]<y0-1)lo=m+1;else hi=m;}for(let i=lo;i<this.runs.length;i++){const [y,l,r]=this.runs[i];if(y>y1+1)break;if(r>=x0&&l<=x1)yield [y,Math.max(l,x0),Math.min(r,x1)];}}
 has(x,y){const row=this.rows.get(y);if(!row)return false;let lo=0,hi=row.length-1;while(lo<=hi){const mid=(lo+hi)>>1,r=row[mid];if(x<r[0])hi=mid-1;else if(x>r[1])lo=mid+1;else return true;}return false;}
 contains(p,r=.08){const x0=Math.floor(p[0]-r),x1=Math.floor(p[0]+r),y0=Math.floor(p[1]-r),y1=Math.floor(p[1]+r);if(y1-y0>1000)return false;for(let y=y0;y<=y1;y++){const row=this.rows.get(y);if(!row||!row.some(([a,b])=>a<=x0&&b>=x1))return false;}return true;}
 sample(rng){if(!this.count)return null;const target=Math.floor(rng()*this.count);let lo=0,hi=this.prefix.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(target<this.prefix[mid])hi=mid;else lo=mid+1;}const [y,x]=this.runs[lo];return [x+target-(lo?this.prefix[lo-1]:0)+.5,y+.5];}
 ray(a,b,r=.08){const d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!this.contains(a,r))return null;const steps=Math.max(1,Math.ceil(d/.25));if(steps>2048)b=[mix(a[0],b[0],2048/steps),mix(a[1],b[1],2048/steps)];const n=Math.min(steps,2048);let last=a;for(let i=1;i<=n;i++){const p=[mix(a[0],b[0],i/n),mix(a[1],b[1],i/n)];if(!this.contains(p,r))return last;last=p;}return last;}
 paint(a,b,enabled){const n=Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))*2);if(n>4096)throw Error('靠近透视线的格子太密，请放大后绘制');if(enabled){const additions=new Set();for(let i=0;i<=n;i++){const x=Math.floor(mix(a[0],b[0],n?i/n:0)),y=Math.floor(mix(a[1],b[1],n?i/n:0));if(Math.abs(x)<=10000&&Math.abs(y)<=10000&&!this.has(x,y))additions.add(x+','+y);}if(this.count+additions.size>200000)throw Error('活动范围最多支持二十万格');}for(let i=0;i<=n;i++){const x=Math.floor(mix(a[0],b[0],n?i/n:0)),y=Math.floor(mix(a[1],b[1],n?i/n:0));if(Math.abs(x)>10000||Math.abs(y)>10000)continue;const row=this.rows.get(y)||[];if(enabled){row.push([x,x]);row.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of row){if(merged.length&&r[0]<=merged.at(-1)[1]+1)merged.at(-1)[1]=Math.max(merged.at(-1)[1],r[1]);else merged.push(r);}this.rows.set(y,merged);}else{const next=[];for(const [l,r] of row){if(x<l||x>r)next.push([l,r]);else{if(l<x)next.push([l,x-1]);if(x<r)next.push([x+1,r]);}}if(next.length)this.rows.set(y,next);else this.rows.delete(y);}}return this.sync();}
 sync(){const runs=[];for(const [y,row] of [...this.rows].sort((a,b)=>a[0]-b[0]))for(const r of row)runs.push([y,...r]);this.set(runs);return runs;}
 fill(p){const sx=Math.floor(p[0]),sy=Math.floor(p[1]);if(this.has(sx,sy))return this.runs;const w=this.maxX-this.minX+3,h=this.maxY-this.minY+3;if(!Number.isFinite(w)||w*h>250000)throw Error('闭合区域过大，请分区填充');if(sx<this.minX||sx>this.maxX||sy<this.minY||sy>this.maxY)throw Error('请先画出闭合的活动范围');const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),baseX=this.minX-1,baseY=this.minY-1;let head=0,tail=1;queue[0]=(sy-baseY)*w+sx-baseX;seen[queue[0]]=1;while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);if(x===0||y===0||x===w-1||y===h-1)throw Error('活动范围没有闭合，未填充');for(const j of [i-1,i+1,i-w,i+w])if(!seen[j]&&!this.has(j%w+baseX,Math.floor(j/w)+baseY)){seen[j]=1;queue[tail++]=j;}}
 if(this.count+tail>200000)throw Error('活动范围最多支持二十万格');for(let y=0;y<h;y++){let start=-1;for(let x=0;x<=w;x++){const on=x<w&&seen[y*w+x];if(on&&start<0)start=x;if(!on&&start>=0){const wy=y+baseY,row=this.rows.get(wy)||[];row.push([start+baseX,x-1+baseX]);row.sort((a,b)=>a[0]-b[0]);this.rows.set(wy,row);start=-1;}}}return this.set(normalize({...defaults(),area:this.sync()}).area).runs;
 }
}
function random(seed){let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
class Buckets{
 constructor(size=5){this.size=size;this.bins=new Map();}
 key(p){return Math.floor(p[0]/this.size)+','+Math.floor(p[1]/this.size);}
 add(a){const k=this.key(a.p);if(!this.bins.has(k))this.bins.set(k,[]);this.bins.get(k).push(a);}
 near(p){const x=Math.floor(p[0]/this.size),y=Math.floor(p[1]/this.size),out=[];for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const bin=this.bins.get((x+i)+','+(y+j));if(bin)out.push(...bin);}return out;}
}
class Simulation{
 constructor(config,roster=ART_IDS){this.roster=roster;this.reset(config);}
 reset(config){this.config=config;this.n=config.npc;this.area=new Area(config.area);this.rng=random(config.seed);this.actors=[];this.actorsById=new Map();this.time=0;this.pairWait=1;this.pairs=[];this.pathChecks=0;if(config.placed)this.place();}
 radius(a){return 1.7*(a?.settings?.size??this.n.size);}
 updateSettings(){for(const a of this.actors)a.settings=npcSettings(this.config,a.id);}
 birthIds(){return [...new Set(this.roster)].filter(id=>IDS.includes(id)&&this.config.births[id]);}
 canMove(a){const birth=this.config.births[a.id],ground=this.area.base||this.area;return !a.screenAnchor&&!a.stationary&&Boolean(birth)&&ground.has(Math.floor(birth[0]),Math.floor(birth[1]))&&this.area.contains(a.p,0);}
 movementRadius(a){
  // The painted foot cell enables movement. Sprite-width clearance is a routing
  // preference, not a reason to freeze a valid birth beside furniture or an edge.
  // Fit the starting clearance only when planning a destination; retain all solid
  // obstacle/ground checks along the entire path. Re-expand in open ground.
  let lo=0,hi=this.radius(a);if(this.area.contains(a.p,hi))return hi;
  for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(this.area.contains(a.p,mid))lo=mid;else hi=mid;}
  // Leave turning room rather than fitting exactly between two boundaries.
  return Math.max(0,lo*.8-1e-6);
 }
 place(preserve=false){
  const previous=new Map(this.actors.map(a=>[a.id,a])),actors=[];
  // A birth marker is the explicit scene roster. Area size and the old "mixed"
  // selector must never opt every available portrait into the scene.
  for(const id of this.config.placed?this.birthIds():[]){const birth=this.config.births[id],existing=previous.get(id);
   if(preserve&&existing&&existing.birth?.every((v,i)=>v===birth[i])){existing.settings=npcSettings(this.config,id);actors.push(existing);continue;}
   actors.push({id,p:birth.slice(),birth:birth.slice(),settings:npcSettings(this.config,id),goal:null,wait:this.rng(),phase:0,posePhase:0,poseMode:'idle',poseElapsed:0,amount:0,walk:false,facing:1,pair:null,mouth:false,breath:this.rng(),period:3.5+this.rng()*2,blinkWait:2+this.rng()*5,blinkTime:0});
  }
  for(const pair of [...this.pairs])if(!actors.includes(pair.a)||!actors.includes(pair.b))this.release(pair);
  this.actors=actors;this.actorsById=new Map(actors.map(a=>[a.id,a]));return this.actors;
 }
 choose(a,buckets,projection){const n=a.settings,r=this.movementRadius(a),desired=n.distance/4*(1+(this.rng()*2-1)*n.distanceRandom);let best=null,bestScore=-Infinity;for(let j=0;j<10;j++){const angle=this.rng()*Math.PI*2,len=desired*(.65+.35*this.rng()),q=this.area.ray(a.p,[a.p[0]+Math.cos(angle)*len,a.p[1]+Math.sin(angle)*len],r);this.pathChecks++;if(!q)continue;const dist=Math.hypot(q[0]-a.p[0],q[1]-a.p[1]);if(dist<.06)continue;const neighbors=buckets.near(q),u=n.avoidance&&projection?projection.project(q):null;let crowd=0;for(const b of neighbors){if(a===b)continue;crowd+=1/(.5+Math.hypot(q[0]-b.p[0],q[1]-b.p[1]));if(n.avoidance&&projection){const v=projection.actor(b);if(u&&v){const height=projection.cell*7.5*b.settings.size*v[2];crowd+=n.avoidance*Math.max(0,1-Math.abs(u[0]-v[0])/(height*.4+1))*Math.max(0,1-Math.abs(u[1]-v[1])/(height+1));}}}const score=dist*.3-crowd+this.rng()*.15;if(score>bestScore){bestScore=score;best=q;}}return best;}
 startPair(a,b,projection){const u=projection.project(a.p),v=projection.project(b.p);if(!u||!v)return false;const mid=[(u[0]+v[0])/2,(u[1]+v[1])/2],gap=Math.max(18,projection.cell*7.5*(a.settings.size*u[2]+b.settings.size*v[2])*.15),left=projection.unproject([mid[0]-gap,mid[1]]),right=projection.unproject([mid[0]+gap,mid[1]]);if(!left||!right)return false;const goals=u[0]<v[0]?[left,right]:[right,left];for(const [i,actor] of [a,b].entries()){const target=this.area.ray(actor.p,goals[i],this.movementRadius(actor));if(!target||Math.hypot(target[0]-goals[i][0],target[1]-goals[i][1])>.02)return false;}const pair={a,b,age:0,talk:0,turn:0,remaining:0,arrived:false};a.pair=b.pair=pair;a.goal=goals[0];b.goal=goals[1];this.pairs.push(pair);return true;}
 release(pair){for(const a of [pair.a,pair.b]){a.pair=null;a.mouth=false;a.goal=null;a.wait=.5+this.rng();}this.pairs=this.pairs.filter(p=>p!==pair);}
 step(dt,projection,speaking=new Set()){
 dt=clamp(dt,0,.05);this.time+=dt;const buckets=new Buckets(Math.max(5,...this.actors.map(a=>this.radius(a)*4)));for(const a of this.actors)buckets.add(a);
 for(const a of this.actors){const n=a.settings;a.breath+=dt/a.period;if(a.breath>=1){a.breath%=1;a.period=3.5+this.rng()*2;}a.blinkWait-=dt;if(a.blinkWait<=0){a.blinkTime=.13;a.blinkWait=2.5+this.rng()*4.5;}a.blinkTime=Math.max(0,a.blinkTime-dt);a.walk=false;
 if(speaking.has(a.id)){a.goal=null;if(a.pair)this.release(a.pair);}a.mouth=speaking.has(a.id)&&Math.sin(this.time*14)>-.3;if(!this.canMove(a)||n.speed===0||n.distance===0||speaking.has(a.id)){a.goal=null;continue;}
 if(!a.goal&&!a.pair){a.wait-=dt;if(a.wait<=0){a.goal=this.choose(a,buckets,projection);if(!a.goal)a.wait=.3+this.rng();}}
 if(a.goal){const dx=a.goal[0]-a.p[0],dy=a.goal[1]-a.p[1],d=Math.hypot(dx,dy),step=Math.min(d,n.speed*.25*dt),before=projection.project(a.p);if(d>1e-7){a.p[0]+=dx/d*step;a.p[1]+=dy/d*step;a.walk=step>0;a.phase+=step/Math.max(.15,n.size*.6);const after=projection.project(a.p);if(before&&after&&Math.abs(after[0]-before[0])>.001)a.facing=Math.sign(after[0]-before[0]);}if(d<=step+.001){a.goal=null;a.wait=n.interval*(1+(this.rng()*2-1)*n.intervalRandom);}}
 }
 for(const pair of [...this.pairs]){pair.age+=dt;if(!this.n.eventEnabled||(!pair.arrived&&pair.age>35)||!this.canMove(pair.a)||!this.canMove(pair.b)){this.release(pair);continue;}if(pair.a.goal||pair.b.goal)continue;if(!pair.arrived){pair.arrived=true;const pa=projection.project(pair.a.p),pb=projection.project(pair.b.p);pair.a.facing=pa&&pb?Math.sign(pb[0]-pa[0]):1;pair.b.facing=-pair.a.facing;}pair.talk+=dt;pair.remaining-=dt;if(pair.remaining<=0){pair.turn++;if(pair.turn>4){this.release(pair);continue;}pair.remaining=this.n.speechDuration*(1+(this.rng()*2-1)*this.n.speechRandom);}// Silent social turns only orient the partners; output text owns the mouth.
 }
 this.pairWait-=dt;if(this.pairWait<=0){this.pairWait=1;if(this.n.eventEnabled&&this.rng()<this.n.eventProbability){const a=this.actors.find(a=>!a.pair&&!speaking.has(a.id)&&this.canMove(a));if(a){const b=buckets.near(a.p).filter(b=>b!==a&&!b.pair&&!speaking.has(b.id)&&this.canMove(b)).sort((b,c)=>Math.hypot(a.p[0]-b.p[0],a.p[1]-b.p[1])-Math.hypot(a.p[0]-c.p[0],a.p[1]-c.p[1]))[0];if(b)this.startPair(a,b,projection);}}}
 }
}
const characterName=(config,id)=>config.names?.[id]||NAMES[IDS.indexOf(id)]||'人物';
// Resolve once per scene/configuration change, never by filename or display-name substring.
function speakerId(config,id,scene){
 if(Object.hasOwn(config.speakers||{},id))return config.speakers[id];
 if(id.startsWith('stage_')){const slot=scene?.actors?.[Number(id.slice(6))];return slot?.characterId||PERSONS[Number(id.slice(6))]?.id||'';}
 return SKIN_PERSON[id]||'';
}
class SpeakerBindings{
 constructor(config,scene,ids){this.byInstance=new Map();this.byActor=new Map();for(const id of ids){const person=PERSONS.find(p=>p.id===speakerId(config,id,scene));if(!person||person.disabled)continue;this.byInstance.set(id,person.actor);if(!this.byActor.has(person.actor))this.byActor.set(person.actor,[]);this.byActor.get(person.actor).push(id);}for(const [actor,list]of this.byActor)list.sort((a,b)=>Number(b==='stage_'+actor)-Number(a==='stage_'+actor));}
 speaking(states){const result=new Set();for(const key of states){const actor=typeof key==='number'?key:Number(String(key).replace(/^stage_/,''));for(const id of this.byActor.get(actor)||[])result.add(id);}return result;}
}
function speakerSlots(scene){
 if(!Object.keys(scene.plane?.speakers||{}).length)return scene.actors;
 const bindings=new SpeakerBindings(scene.plane,scene,scene.actors.map(a=>'stage_'+a.id));
 return scene.actors.map((slot,index)=>{const id=bindings.byActor.get(index)?.[0];return id?{...scene.actors[Number(id.slice(6))],id:index,characterId:PERSONS[index].id}:{...slot,present:false,poses:{idle:'',speaking:'',walkLeft:'',walkRight:''},animation:null,npcArt:''};});
}
const api={speakerSlots,speakerId,SpeakerBindings,PERSONS,SKIN_PERSON,IDS,ART_IDS,NAMES,defaults,normalize,npcSettings,characterName,Projection,Area,Simulation,random,clamp,mix};if(typeof module!=='undefined')module.exports=api;else root.MapPlane=api;
})(globalThis);
