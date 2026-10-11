const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const Caption=require('../caption-layout.js'),{DialogueDisplay}=Caption,{placeBubbles}=require('../stage-layout.js'),{stage}=require('./helpers/stage-fixture.cjs');
const script=require('../speeches/2026-120周年校庆/津门风云-9.23-v21.json');
const fixture={blocks:[{sentences:[{id:'lead',text:'这是用来触发原有人物回应的第一句。',replies:[{actor:0,text:'这是一整段需要保留在同一框里的角色台词。'}]},{id:'continue',text:'演讲者继续解释这个问题，最后这一句延续讲话还没有讲完。',dialogueLead:'lead',replies:[]},{id:'next',text:'下面开始另一个新的问题。',replies:[{actor:1,text:'下一个问题。'}]}]}]};
const match=remaining=>({matched:true,confidence:100,index:0,sentenceIndex:1,remaining});
test('all 141 actor turns fit in one complete card without swapping earlier words at any elapsed time',()=>{
 for(const [w,h] of [[1920,1080],[1200,800],[768,887],[390,844]])for(const b of script.blocks)for(const u of b.sentences)for(const reply of u.replies){const maxWidth=Math.max(90,Math.min(340,w*.36)-24),maxHeight=Math.max(80,Math.min(360,h*.42,h-135)),layout=Caption.whole(reply.text,{fontSize:Math.max(12,Math.min(16,w*.0095)),maxHeight,maxWidth});assert.equal(layout.columns.join('').replace(/\s/gu,''),reply.text.replace(/\s/gu,''));assert.ok(layout.width<=maxWidth+1);assert.ok(layout.height<=maxHeight+1);assert.ok(layout.fontSize>=10);}
});
test('stage keeps the complete same turn in one DOM bubble throughout the original page boundary',()=>{
 const s=stage(),text=script.blocks[0].sentences[1].replies[0].text;s.elements.get('bubbles').children.forEach(b=>{b.querySelector('.bubble-text').replaceChildren=function(...nodes){this.children=nodes;};});s.command('speech-script',{script});s.command('rehearsal-cue',{index:0,sentenceIndex:1});for(let i=0;i<10;i++)s.tick(100);const b=s.elements.get('bubbles').children[1],body=b.querySelector('.bubble-text'),first=body.children;assert.equal(b.dataset.pages,'1');
 const all=first.map(c=>c.textContent).join('').replace(/\s/gu,'');assert.equal(all,text.replace(/\s/gu,''));for(let i=0;i<20;i++)s.tick(1000);assert.equal(body.children,first);assert.equal(b.dataset.page,'1');s.command('clear');
});
test('two and three cards use visibly different top edges and avoid cast obstacles',()=>{
 const items=[0,1,2].map(id=>({id,x:480+id*200,y:650,width:170,height:290})),obstacles=[{left:0,top:650,width:1440,height:170}],boxes=placeBubbles(items,1440,900,{obstacles});assert.equal(boxes.length,3);
 for(const a of boxes)for(const b of boxes)if(a.id!==b.id){assert.ok(Math.abs(a.top-b.top)>=40);assert.ok(a.left+a.width<=b.left||b.left+b.width<=a.left||a.top+a.height<=b.top||b.top+b.height<=a.top);}
});
test('finished actor card survives continuation pauses and retains the extra forty percent after the final speech tail',()=>{
 const d=new DialogueDisplay(fixture),m={actor:0,cueKey:'0:lead',text:'完整台词'},a={id:0,phase:'speaking',message:m};d.activate(m.cueKey);d.started(m,0,4000);d.visible(m,0);d.finished(m,4000);a.phase='idle';d.observe(match(18),true,10000);assert.equal(d.message(a,12000),m);d.tick(60000);assert.equal(d.message(a,60000),m,'a long spoken pause must not erase the card');
 d.observe(match(5),false,61000);d.tick(61200);assert.equal(d.message(a,61200),m);d.tick(61300);assert.equal(d.message(a,61300),m);assert.equal(d.message(a,85819),m);assert.equal(d.message(a,85820),null,'the entire 61.3-second original continuation window is multiplied by 1.4');
});
test('only the final continuation controls closing; uncertain or retracted near-end evidence cannot hide a card',()=>{
 const f=structuredClone(fixture);f.blocks[0].sentences.splice(2,0,{id:'continue2',text:'本组还有最后一句完整的补充。',dialogueLead:'lead',replies:[]});const d=new DialogueDisplay(f),m={actor:0,cueKey:'0:lead',text:'完整台词'},a={id:0,phase:'idle'};d.activate(m.cueKey);d.started(m,0,2000);d.visible(m,0);d.observe(match(0),true,1000);d.finished(m,2000);assert.equal(d.message(a,2000),m);d.observe({...match(3),sentenceIndex:2},false,2200);d.observe({...match(20),sentenceIndex:2},false,2300);d.tick(2600);assert.equal(d.message(a,2600),m);d.observe({...match(3),sentenceIndex:2,confidence:60},true,2700);assert.equal(d.message(a,2700),m);
});
test('speech-linked completion can release the slot after actual display while the extra visual dwell remains, and never cancels a late queued line',()=>{
 const d=new DialogueDisplay(fixture),m={actor:0,cueKey:'0:lead',text:'这条人物接话保留为同一个完整对话框'},a={id:0,phase:'speaking',message:m,elapsed:3000};d.activate(m.cueKey);d.started(m,0,18000);d.visible(m,1000);d.observe(match(4),true,3000);
 assert.equal(d.shouldFinish(a,2999),false,'layout waiting must not consume the actual two-second visible minimum');assert.equal(d.shouldFinish(a,3000),true,'the established speech-tail release must not make the next replies wait for an eighteen-second estimate');assert.equal(d.shouldFinish({...a,captionBlocked:true},3000),false);assert.equal(d.shouldFinish({...a,elapsed:100},3000),false);d.finished(m,3000);assert.equal(d.message({id:0,phase:'idle'},3799),m);assert.equal(d.message({id:0,phase:'idle'},3800),null,'two seconds of prior actual display become 2.8 seconds including visual retention');
 const late={actor:1,cueKey:'0:lead',text:'排队迟到的台词'};d.started(late,7100,4000);assert.equal(d.shouldFinish({id:1,phase:'speaking',message:late,elapsed:3000},10000),false);assert.equal(d.message({id:1,phase:'speaking',message:late},10000),late);d.visible(late,10000);d.finished(late,14000);assert.equal(d.message({id:1,phase:'idle'},15599),late);assert.equal(d.message({id:1,phase:'idle'},15600),null);
});
test('reset clears held cards, timing estimates and pending disappearance',()=>{
 const d=new DialogueDisplay(fixture),m={actor:0,cueKey:'0:lead',text:'完整台词'};d.activate(m.cueKey);d.started(m,0,2000);d.visible(m,0);d.finished(m,2000);d.reset();assert.equal(d.message({id:0,phase:'idle'},1000),null);assert.equal(d.snapshot().groups.length,0);
});
test('live ASR closes the continuation group while the complete card keeps its extra forty percent viewing time',()=>{
 const s=stage({width:1200,height:800});s.command('speech-script',{script});s.command('topic',{topic:0});s.command('voice-state',{active:true,session:'v22-hold'});
 const lead=script.blocks[0].sentences[4],tail=script.blocks[0].sentences[5];s.command('voice-transcript',{session:'v22-hold',seq:1,text:lead.text,final:true});for(let i=0;i<70;i++)s.tick(1000);
 const b=s.elements.get('bubbles').children[0];assert.equal(b.getAttribute('aria-hidden'),'false');assert.ok(s.posted.at(-1).captionContinuations.held.includes(0));const shownAt=s.posted.at(-1).cueEvents.find(e=>e.type==='cue-visible'&&e.key==='0:'+lead.id).at;
 s.command('voice-transcript',{session:'v22-hold',seq:2,text:tail.text.slice(0,-5),final:true});s.tick(100);assert.equal(b.getAttribute('aria-hidden'),'false');assert.equal(s.posted.at(-1).captionContinuations.groups.find(g=>g.key==='0:'+lead.id).closed,true);const extra=(70000-shownAt)*.4;for(let elapsed=100;elapsed<extra-200;elapsed+=100)s.tick(100);assert.equal(b.getAttribute('aria-hidden'),'false');for(let i=0;i<10;i++)s.tick(100);assert.equal(b.getAttribute('aria-hidden'),'true');s.command('clear');
});

test('unmatched interim corrections retract a pending close instead of erasing the card',()=>{const d=new DialogueDisplay(fixture),m={actor:0,cueKey:'0:lead',text:'完整台词'},a={id:0,phase:'idle'};d.activate(m.cueKey);d.started(m,0,2000);d.visible(m,0);d.observe(match(3),false,1000);d.observe({matched:false},false,1100);d.finished(m,2000);d.tick(10000);assert.equal(d.message(a,10000),m);});

test('clearing and replaying the same paragraph rebuilds its complete card instead of reusing an empty cached body',()=>{
 const s=stage();s.elements.get('bubbles').children.forEach(b=>{const body=b.querySelector('.bubble-text');Object.defineProperty(body,'textContent',{get(){return this.children.map(c=>c.textContent).join('');},set(){this.children=[];}});body.replaceChildren=function(...nodes){this.children=nodes;};});
 s.command('speech-script',{script});const b=s.elements.get('bubbles').children[1],body=b.querySelector('.bubble-text');
 const play=()=>{s.command('rehearsal-cue',{index:0,sentenceIndex:1});for(let i=0;i<10;i++)s.tick(100);};play();const expected=body.textContent;assert.ok(expected.length>70);s.command('clear');assert.equal(body.textContent,'');play();assert.equal(body.textContent,expected);s.command('clear');
});
