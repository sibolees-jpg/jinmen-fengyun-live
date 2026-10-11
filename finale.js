(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.JointFinale=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='jinmen-finale-v1';
 const PARTICIPANTS=Object.freeze(['梁启超','李鸿章','严复','李叔同','蔡元培','柏拉图','达芬奇','伽利略','愚公'].map((name,id)=>Object.freeze({id,name})));
 const ENTRANCE_MS=2200,GAP_MS=900;
 const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 function checkedString(value,max,label,{empty=false}={}){
  if(typeof value!=='string')throw new TypeError(`${label}必须是文字`);
  const text=value.trim();
  if((!empty&&!text)||Array.from(text).length>max)throw new RangeError(`${label}须在${empty?0:1}至${max}字之间`);
  return text;
 }
 function checkedNumber(value,min,max,label){
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new RangeError(`${label}须在${min}至${max}之间`);
  return value;
 }
 function normalize(value){
  if(!isObject(value)||value.version!==1)throw new TypeError('联合发布计划版本无效');
  if(value.entrance!=='reveal'&&value.entrance!=='walk-in')throw new TypeError('请选择亮相或走入的登场方式');
  if(typeof value.draft!=='boolean')throw new TypeError('须标明是否为测试草稿');
  if(!isObject(value.anchor))throw new TypeError('旧版兼容站位无效');
  const source=Array.isArray(value.lines)&&value.lines.length===10&&value.lines.filter(l=>l?.actor===9).length===1?value.lines.filter(l=>l.actor!==9):value.lines;
  if(!Array.isArray(source)||source.length!==PARTICIPANTS.length)throw new TypeError('联合发布须有九条倡议，每人一条');
  const ids=new Set(),actors=new Set();
  const lines=source.map(line=>{
   if(!isObject(line))throw new TypeError('倡议行无效');
   const id=checkedString(line.id,100,'倡议编号');
   if(ids.has(id))throw new TypeError('倡议编号不能重复');ids.add(id);
   if(!Number.isInteger(line.actor)||line.actor<0||line.actor>=PARTICIPANTS.length||actors.has(line.actor))throw new TypeError('九位发布者须各有一条倡议，不能重复或遗漏');
   actors.add(line.actor);
   return {id,actor:line.actor,text:checkedString(line.text,160,'倡议内容',{empty:true}),durationMs:checkedNumber(line.durationMs,3000,30000,'显示时长')};
  });
  return {
   version:1,title:checkedString(value.title,100,'发布标题'),draft:value.draft,entrance:value.entrance,
   anchor:{x:checkedNumber(value.anchor.x,.05,.25,'横向站位'),y:checkedNumber(value.anchor.y,.9,.98,'地面站位'),scale:checkedNumber(value.anchor.scale,.6,1.5,'人物大小')},lines
  };
 }
 function defaultPlan(){
  // Editorial rehearsal copy, not historical quotations or an approved public initiative.
  const draft=[
   [0,'让求新的勇气与独立的判断同行，为每一种有根据的新思想留下试验的空间。'],
   [1,'让知识走进真实的建设，在制作、协作和实践中，检验改变世界的办法。'],
   [2,'让不同语言与文化彼此照见，以开放的眼光学习世界，也保持清醒的自省。'],
   [3,'让美育进入日常生活，在一笔一画、一言一行中，培养感受、理解与关怀。'],
   [4,'让每一个人都能发展完整的人格，让大学成为自由探究、平等交流的共同体。'],
   [5,'让提问成为共同学习的起点，在彼此质疑与倾听中，寻找更好的生活。'],
   [6,'让艺术与科学相互启发，让想象能够动手，让技艺能够思考。'],
   [7,'让观察、证据与实验检验我们的想法，也让失败成为可以分享的知识。'],
   [8,'让人工智能帮助我们劳动，而由人决定值得追求的理想；力学力行，一点一点改变世界。']
  ];
  return {version:1,title:'新艺科倡议 · 联合发布',draft:true,entrance:'reveal',anchor:{x:.13,y:.96,scale:1},lines:draft.map(([actor,text],index)=>({id:`initiative-${index+1}`,actor,text,durationMs:8000}))};
 }
 class Player{
  constructor(plan){this.setPlan(plan);}
  setPlan(plan){this.plan=normalize(plan);this.reset();return this.plan;}
  reset(){this.state='idle';this.index=-1;this.elapsed=0;this.paused=false;return this;}
  get active(){return this.state!=='idle';}
  get hasReady(){return this.plan.lines.every(line=>line.text.trim().length>0);}
  get speaking(){return this.state==='speaking'?this.plan.lines[this.index]:null;}
  get movementProgress(){return this.state==='idle'?0:this.state==='entering'?Math.min(1,this.elapsed/ENTRANCE_MS):1;}
  start(){
   if(!this.hasReady)throw new Error('请先填写全部九位发布者的倡议内容');
   this.reset();this.state='entering';return this;
  }
  pause(){if(this.active&&this.state!=='ended')this.paused=!this.paused;return this.paused;}
  next(){
   if(!this.active||this.state==='ended')return this;
   this.elapsed=0;
   if(this.index+1>=this.plan.lines.length){this.state='ended';this.paused=false;}
   else{this.index++;this.state='speaking';}
   return this;
  }
  update(dt){
   if(typeof dt!=='number'||!Number.isFinite(dt)||dt<0)throw new RangeError('播放间隔须为非负毫秒数');
   if(!this.active||this.paused||this.state==='ended')return this;
   this.elapsed+=dt;
   while(this.state!=='ended'){
    const limit=this.state==='entering'?ENTRANCE_MS:this.state==='speaking'?this.speaking.durationMs:GAP_MS;
    if(this.elapsed<limit)break;
    const remainder=this.elapsed-limit;
    if(this.state==='speaking'&&this.index<this.plan.lines.length-1)this.state='gap';
    else this.next();
    this.elapsed=this.state==='ended'?0:remainder;
   }
   return this;
  }
 }
 return {KEY,PARTICIPANTS,defaultPlan,normalize,Player};
});
