const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const Caption=require('../caption-layout.js');
const {StageEngine}=require('../engine.js');
const {placeBubbles}=require('../stage-layout.js');
const {stage}=require('./helpers/stage-fixture.cjs');
const catalog=require('../speeches/2026-120周年校庆/津门风云-9.24-v28-场次.json');

const spoken=text=>String(text).replace(/[\p{P}\p{S}\s]/gu,'');
const script={blocks:[{sentences:[
 {id:'lead',text:'这是演讲者引出本组人物讨论的完整讲话。'},
 {id:'tail',text:'演讲者继续补充本组观点之后才会转到下一个问题。',dialogueLead:'lead'},
 {id:'next',text:'这是下一组人物对话的引导讲话。'}
]}]};
const actor=(id,message,phase='idle')=>({id,message,phase,elapsed:10000});
const tailMatch={matched:true,confidence:100,index:0,sentenceIndex:1,remaining:0};

// Compare the same wrapping at logical bounds. Enlarging a container alone
// would pass a screenshot glance but leave the words too small.
test('caption, typography and column gaps scale together by fifteen percent without losing the complete turn',()=>{
 assert.equal(Caption.DISPLAY_SCALE,1.15);
 assert.equal(Caption.DWELL_SCALE,1.4);
 for(const text of ['先贤的完整话语，须让现场观众有足够时间读完。','我们讨论的是一段不可被分页截断的完整人物台词。'.repeat(4)]){
  const base=Caption.whole(text,{fontSize:16,maxHeight:300,maxWidth:420,scale:1});
  const larger=Caption.whole(text,{fontSize:16,maxHeight:300,maxWidth:420,scale:1.15});
  assert.deepEqual(larger.columns,base.columns,'the same logical rectangle must preserve the authored turn and wrapping');
  assert.equal(spoken(larger.columns.join('')),spoken(text));
  assert.ok(Math.abs(larger.fontSize/base.fontSize-1.15)<1e-9);
  assert.ok(Math.abs(larger.width-base.width*1.15)<=2);
  assert.ok(Math.abs(larger.height-base.height*1.15)<=2);
 }
});

test('a second card entering and leaving does not move or rewrap an already readable card',()=>{
 const first={id:0,x:450,y:600,text:'这段人物发言正在阅读中，另一个角色进入时应该保持原位。',message:{id:'first'}};
 const second={id:1,x:1080,y:620,text:'另一个人物接话，稍稍错开出现。',message:{id:'second'}};
 const options={place:placeBubbles,obstacles:[{left:0,top:660,width:1440,height:240}]};
 const one=Caption.fitCards([first],1440,900,options);
 const merge=r=>r.boxes.map(box=>({...r.cards.find(card=>card.id===box.id),...box}));
 const old=merge(one)[0];assert.ok(old);
 const two=Caption.fitCards([first,second],1440,900,{...options,previous:merge(one)});
 assert.equal(two.boxes.length,2);
 const retained=merge(two).find(card=>card.id===0);
 assert.equal(retained.left,old.left);assert.equal(retained.top,old.top);
 assert.deepEqual(retained.layout,old.layout);
 const again=Caption.fitCards([first],1440,900,{...options,previous:merge(two)});
 assert.equal(again.boxes[0].left,old.left);assert.equal(again.boxes[0].top,old.top);
 assert.deepEqual(again.cards[0].layout,old.layout);
});

test('forty percent extra dwell starts when the bubble is actually visible, not while it is waiting for space',()=>{
 const d=new Caption.DialogueDisplay(script),m={actor:0,cueKey:'0:next',text:'观众需要看完的完整人物台词。'};
 d.started(m,0,4000);d.visible(m,5000);d.finished(m,9000);
 assert.equal(d.message(actor(0,m),10599),m);
 assert.equal(d.message(actor(0,m),12000),null,'a completed card eventually clears, rather than becoming permanent');
});

test('near-end speech evidence cannot consume the actual visible minimum or remove the retained card immediately',()=>{
 const d=new Caption.DialogueDisplay(script),m={actor:0,cueKey:'0:lead',text:'刚刚上屏的完整人物台词不能因为演讲者已读到句尾而闪退。'};
 d.activate(m.cueKey);d.started(m,0,4000);d.visible(m,1000);
 d.observe(tailMatch,true,1500);d.finished(m,5000);
 assert.equal(d.message(actor(0,m),6599),m);
 assert.equal(d.shouldFinish({...actor(0,m,'speaking'),elapsed:10000},2000),false);
 assert.equal(d.message(actor(0,m),9000),null);
});

test('continuation still survives a long live pause and two people close at distinct times',()=>{
 const d=new Caption.DialogueDisplay(script),messages=[0,1].map(i=>({actor:i,cueLine:i,cueKey:'0:lead',text:'完整的本组人物台词。'}));
 d.activate(messages[0].cueKey);
 messages.forEach((m,i)=>{d.started(m,i*800,3000);d.visible(m,i*800);d.finished(m,3000+i*800);});
 d.tick(60000);
 messages.forEach(m=>assert.equal(d.message(actor(m.actor,m),60000),m,'a pause is not a reason to erase continuation text'));
 d.observe(tailMatch,true,61000);
 const ended=messages.map(m=>{for(let now=61000;now<=90000;now+=25)if(!d.message(actor(m.actor,m),now))return now;return Infinity;});
 assert.ok(Number.isFinite(ended[0])&&Number.isFinite(ended[1]));
 assert.deepEqual(ended,[85400,86050],'the full original continuation window gains forty percent, with the second close staggered by 650 ms');
});

test('the engine can preserve an actor’s old card without stopping another actor from answering',()=>{
 const e=new StageEngine(2,2),started=[];e.travelTime=()=>0;
 let retainFirst=true;e.canStart=m=>!(m.actor===0&&retainFirst);
 e.onMessageStart=m=>started.push({actor:m.actor,at:e.time});
 e.enqueueDiscussion([{actor:0,topic:0,text:'这条排队台词暂时等待旧框读完。',durationMs:2000}]);
 e.enqueueDiscussion([{actor:1,topic:0,text:'其他人物应当仍可及时回答。',durationMs:2000}]);
 for(let i=0;i<20;i++)e.step(50);
 assert.deepEqual(started.map(m=>m.actor),[1]);assert.equal(e.queue.length,1);
 retainFirst=false;for(let i=0;i<20;i++)e.step(50);
 assert.deepEqual(started.map(m=>m.actor),[1,0]);assert.equal(e.queue.length,0);
});

test('live stage enlarges every visible actor nameplate by fifteen percent',async()=>{
 for(const [width,height] of [[1225,689],[1920,1080]]){
  const s=stage({width,height,sceneCatalog:catalog});await new Promise(resolve=>setImmediate(resolve));
  const scenery=catalog.maps[1].scenes[0];s.command('scene-take',{sceneId:scenery.id,revision:0});s.tick(1000);
  const labels=s.elements.get('labels').children;
  assert.ok(labels.length>=9);
  const baseline=Math.max(9,Math.min(15,width*.0085)*(scenery.nameplateScale||1));
  for(const label of labels)if(!label.hidden){
   assert.ok(Math.abs(parseFloat(label.style.fontSize)-baseline*1.15)<.001,label.style.fontSize);
   assert.equal(label.style.padding,`${4*(scenery.nameplateScale||1)*1.15}px ${2*(scenery.nameplateScale||1)*1.15}px`);
  }
  s.command('clear');
 }
});

test('late display recovery staggers actual reveal and never hides the first person again when the second arrives',()=>{
 const d=new Caption.DialogueDisplay(script),a={actor:0,cueKey:'0:lead',text:'第一位人物完整接话。'},b={actor:1,cueKey:'0:lead',text:'第二位人物完整接话。'};
 d.activate(a.cueKey);d.started(a,0,4000);d.started(b,800,4000);
 // Both engine turns have started while captions were waiting for layout.
 assert.equal(d.canReveal(a,5000),true);d.visible(a,5000);
 assert.equal(d.canReveal(b,5000),false);assert.equal(d.canReveal(b,5799),false);
 assert.equal(d.canReveal(b,5800),true);d.visible(b,5800);
 assert.equal(d.canReveal(a,5850),true,'a newcomer must not make an existing visible bubble flicker');
 assert.equal(d.canReveal(b,5850),true);
 const chorus={actor:2,cueKey:'0:lead',text:'全体齐声祝贺！',chorus:true};d.started(chorus,5800,4000);
 assert.equal(d.canReveal(chorus,5800),true,'the authored final chorus remains the simultaneous exception');
});

test('the same actor keeps a 2.8-second visible minimum, then the next formal line can take over an open continuation',()=>{
 const d=new Caption.DialogueDisplay(script),old={actor:0,cueKey:'0:lead',text:'这段完整台词需要保留。'},next={actor:0,cueKey:'0:next',text:'同一人物的新台词。'};
 d.activate(old.cueKey);d.started(old,0,4000);d.visible(old,1000);
 assert.equal(d.canStart(next,3799),false);
 assert.equal(d.canStart(next,3800),true,'a visible minimum protects the card without locking the queue through every visual extension');
 d.finished(old,5000);
 assert.equal(d.canStart({...next,actor:1},5001),true,'visual retention does not reserve unrelated actors');
 assert.equal(d.message(actor(0,old),5001),old,'the original continuation remains visible until someone actually takes over');
 assert.equal(d.canStart(next,5001),true,'a finished continuation must not hold back the same actor’s next formal line');
 d.started(next,5100,3000);d.visible(next,5100);d.finished(next,8100);
 assert.equal(d.message(actor(0,next),9000),next);
});

test('extra forty-percent visual retention does not become a same-person queue lock after a long reply has finished',()=>{
 const d=new Caption.DialogueDisplay(script),old={actor:0,cueKey:'0:next',text:'这条原本显示十八秒的完整台词结束后仍可留在画面。'},next={actor:0,cueKey:'0:after',text:'下一条正式接话需要及时跟上演讲。'};
 d.started(old,0,18000);d.visible(old,0);d.finished(old,18000);
 assert.equal(d.message(actor(0,old),18001),old,'without a replacement the old card retains its forty-percent visual tail');
 assert.equal(d.message(actor(0,old),25199),old);
 assert.equal(d.canStart(next,18001),true,'the next cue must not wait an unnecessary 7.2 seconds for a visual-only tail');
 d.started(next,18001,4000);d.visible(next,18001);d.finished(next,22001);
 assert.equal(d.message(actor(0,next),22001),next,'the full new paragraph takes over the existing actor card');
});

// The requested increase applies to the previous actual screen time. Keeping an
// engine slot occupied for the whole nominal script estimate would regress P0.
test('an eighteen-second estimate may release after two actual visible seconds but its whole card remains for 2.8 seconds',()=>{
 const d=new Caption.DialogueDisplay(script),m={actor:0,cueKey:'0:lead',text:'这是一条仍以完整一框显示的人物接话，原来的十八秒估算不应堵住下一位人物。'};
 d.activate(m.cueKey);d.started(m,0,18000);d.visible(m,0);d.observe(tailMatch,true,2000);
 assert.equal(d.shouldFinish({...actor(0,m,'speaking'),elapsed:2000},2000),true);
 d.finished(m,2000);
 assert.equal(d.message(actor(0,m),2799),m);
 assert.equal(d.message(actor(0,m),2800),null);
 assert.equal(d.canStart({actor:0,cueKey:'0:next',text:'同一人物下一句。'},2800),true);
});

test('simultaneously recovered layout still reveals two pending people on distinct rendering frames',()=>{
 const s=stage({width:1440,height:900});
 vm.runInContext(`
  const visualV30Fit=CaptionLayout.fitCards;
  CaptionLayout.fitCards=(...args)=>({...visualV30Fit(...args),boxes:[]});
  engine.travelTime=()=>0;
  engine.enqueueDiscussion([0,1].map(actor=>({actor,topic:0,text:'这段人物接话必须错开出框，并保留完整文字。',durationMs:4000,staggerMs:0,cueKey:'0:visual-v30-recovery',cueLine:actor,queuedAt:0,source:'演练预备',ordered:true})));
 `,s.context);
 for(let i=0;i<20;i++)s.tick(100);
 let events=s.posted.at(-1).cueEvents.filter(e=>e.key==='0:visual-v30-recovery');
 assert.equal(s.posted.at(-1).actors.filter(a=>a.phase==='speaking').length,2);
 assert.equal(events.filter(e=>e.type==='cue-visible').length,0);
 vm.runInContext('CaptionLayout.fitCards=visualV30Fit;bubbleLayoutKey="";',s.context);
 s.tick(100);
 events=s.posted.at(-1).cueEvents.filter(e=>e.key==='0:visual-v30-recovery'&&e.type==='cue-visible');
 assert.equal(events.length,1,'both cards fitting in the same frame must not bypass actual-reveal staggering');
 const first=events[0];
 for(let i=0;i<12;i++)s.tick(100);
 events=s.posted.at(-1).cueEvents.filter(e=>e.key==='0:visual-v30-recovery'&&e.type==='cue-visible');
 assert.equal(events.length,2);
 assert.ok(events[1].waitMs-first.waitMs>=800,JSON.stringify(events));
 s.command('clear');
});

test('continuation lifetime includes its original held interval in the forty-percent increase while engine release stays independent',()=>{
 const d=new Caption.DialogueDisplay(script),m={actor:0,cueKey:'0:lead',text:'本段角色原先说完后，仍随演讲者延续句留在画面。'};
 d.activate(m.cueKey);d.started(m,0,4000);d.visible(m,1000);d.finished(m,5000);
 d.observe(tailMatch,true,10000);
 // Original visible window: 1000 -> 10000 (9 s, including 5 s of hold).
 // Increased window: 9 s * 1.4 = 12.6 s, ending at 13600.
 assert.equal(d.message(actor(0,m),13599),m);
 assert.equal(d.message(actor(0,m),13600),null);
 assert.equal(d.shouldFinish({...actor(0,m,'speaking'),elapsed:4000},10000),true,'engine release must not wait for the later visual deadline');
 assert.equal(d.canStart({actor:0,cueKey:'0:next',text:'同人的下一正式句。'},10000),true);
});

test('the real final manuscript cue speaks with all nine people together and uses exactly one shared bubble',async()=>{
 const manuscript=require('../speeches/2026-120周年校庆/津门风云-9.24-v28.json');
 const index=manuscript.blocks.length-1,block=manuscript.blocks[index],sentenceIndex=block.sentences.length-1,key=index+':'+block.sentences[sentenceIndex].id;
 assert.equal(block.sentences[sentenceIndex].replies.length,9);
 assert.ok(block.sentences[sentenceIndex].replies.every(m=>m.chorus));
 const s=stage({width:1920,height:1080,sceneCatalog:catalog});s.command('speech-script',{script:manuscript});await new Promise(resolve=>setImmediate(resolve));
 s.command('scene-take',{sceneId:block.sceneId,revision:0});await new Promise(resolve=>setImmediate(resolve));s.tick(1);
 s.command('rehearsal-cue',{index,sentenceIndex});await new Promise(resolve=>setImmediate(resolve));
 let maxSpeaking=0,maxBubbles=0,maxBlocked=0,sawNineSameClock=false;
 for(let i=0;i<100;i++){
  s.tick(100);
  const state=s.posted.at(-1),speaking=state.actors.filter(a=>a.phase==='speaking'&&a.cueKey===key);
  maxSpeaking=Math.max(maxSpeaking,speaking.length);maxBlocked=Math.max(maxBlocked,speaking.filter(a=>a.captionBlocked).length);
  const bubbles=s.elements.get('bubbles').children.filter(b=>b.classList.contains('visible')&&b.style.visibility!=='hidden');
  maxBubbles=Math.max(maxBubbles,bubbles.length);
  if(speaking.length===9){const clocks=vm.runInContext('engine.actors.filter(a=>a.phase==="speaking").map(a=>a.elapsed)',s.context);assert.equal(new Set(clocks).size,1,'all nine chorus clocks must advance together');sawNineSameClock=true;assert.equal(bubbles.length,1,'nine speakers share one whole chorus card');}
 }
 const state=s.posted.at(-1),cue=state.cues.find(c=>c.key===key),started=state.trace.filter(e=>e.type==='cue-start'&&e.key===key),visible=state.cueEvents.filter(e=>e.type==='cue-visible'&&e.key===key),finished=state.cueEvents.filter(e=>e.type==='cue-line-done'&&e.key===key);
 assert.equal(maxSpeaking,9);assert.equal(sawNineSameClock,true);assert.equal(maxBlocked,0,'intentionally hidden duplicate chorus cards cannot freeze eight speakers');assert.equal(maxBubbles,1);
 assert.equal(started.length,9);assert.equal(new Set(started.map(e=>e.at)).size,1,'the chorus must not become nine sequential entries');
 assert.equal(visible.length,1,'only the shared chorus card is actually displayed');
 assert.equal(finished.length,9);assert.equal(new Set(finished.map(e=>e.at)).size,1,'all nine logical lines finish together');
 assert.equal(cue.total,9);assert.equal(cue.completed,9);assert.equal(cue.state,'played');assert.equal(state.queue,0);
 s.command('clear');
});

test('the nine-person chorus does not freeze on the previous group’s still-visible or fading cards',async()=>{
 const manuscript=require('../speeches/2026-120周年校庆/津门风云-9.24-v28.json'),index=manuscript.blocks.length-1,block=manuscript.blocks[index],key=index+':'+block.sentences.at(-1).id;
 const s=stage({width:1920,height:1080,sceneCatalog:catalog});s.command('speech-script',{script:manuscript});await new Promise(resolve=>setImmediate(resolve));
 s.command('topic',{topic:index});s.command('scene-take',{sceneId:block.sceneId,revision:0});await new Promise(resolve=>setImmediate(resolve));s.tick(1);s.command('voice-state',{active:true,session:'v30-final-chorus'});
 let seq=0;
 s.command('voice-transcript',{session:'v30-final-chorus',seq:++seq,text:block.sentences[0].text,final:true});
 for(let i=0;i<120;i++)s.tick(100);
 assert.ok(s.posted.at(-1).captionContinuations.held.length>=2,'this regression must begin with the preceding people’s retained text');
 for(const sentence of block.sentences.slice(1,-1)){s.command('voice-transcript',{session:'v30-final-chorus',seq:++seq,text:sentence.text,final:true});s.tick(200);}
 s.command('voice-transcript',{session:'v30-final-chorus',seq:++seq,text:block.sentences.at(-1).text,final:true});
 let sawNine=false,maxBlocked=0;
 for(let i=0;i<100;i++){
  s.tick(100);const state=s.posted.at(-1),speaking=state.actors.filter(a=>a.phase==='speaking'&&a.cueKey===key);
  maxBlocked=Math.max(maxBlocked,speaking.filter(a=>a.captionBlocked).length);
  if(speaking.length===9){sawNine=true;const clocks=vm.runInContext('engine.actors.filter(a=>a.phase==="speaking"&&a.message?.chorus).map(a=>a.elapsed)',s.context);assert.equal(new Set(clocks).size,1,'a previous bubble’s visual fade must not stop a chorus actor’s clock');}
 }
 const state=s.posted.at(-1),cue=state.cues.find(c=>c.key===key),visible=state.cueEvents.filter(e=>e.type==='cue-visible'&&e.key===key),finished=state.cueEvents.filter(e=>e.type==='cue-line-done'&&e.key===key);
 assert.equal(sawNine,true);assert.equal(maxBlocked,0);assert.equal(visible.length,1);assert.equal(finished.length,9);assert.equal(new Set(finished.map(e=>e.at)).size,1);assert.equal(cue.completed,9);assert.equal(cue.state,'played');assert.equal(state.queue,0);
 s.command('clear');
});
