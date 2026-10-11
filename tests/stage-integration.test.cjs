const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function stage({finale=false}={}){
 const elements=new Map();
 function el(){const classes=new Set(),children=new Map();return {style:{setProperty(){}},dataset:{},children:[],value:'',offsetTop:680,offsetWidth:120,offsetHeight:210,clientWidth:1200,clientHeight:800,readOnly:false,textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,b){b??=!classes.has(c);b?classes.add(c):classes.delete(c);}},append(...nodes){this.children.push(...nodes);},replaceChildren(){},setAttribute(k,v){this[k]=v;},getAttribute(k){return this[k];},addEventListener(){},focus(){},querySelector(s){if(!children.has(s))children.set(s,el());if(s==='.nameplate'){children.get(s).offsetWidth=18;children.get(s).offsetHeight=40;}return children.get(s);}};}
 const document={body:el(),querySelector(){return el();},getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el,addEventListener(){}};
 const intervals=[],calls=[],posted=[];let channel,now=0,frame;
 const context=vm.createContext({document,innerWidth:1200,innerHeight:800,performance:{now:()=>now},ResizeObserver:class{observe(){}},BroadcastChannel:class{constructor(){channel=this;}postMessage(m){posted.push(m);}},requestAnimationFrame(fn){frame=fn;},setInterval(fn){intervals.push(fn);},setTimeout,clearTimeout,AbortController,Response,fetch(_url,options){if(!options?.body)return new Promise(()=>{});return new Promise(resolve=>calls.push({body:JSON.parse(options.body),resolve}));}});
 context.window=context;context.addEventListener=()=>{};
 if(finale){context.setupFinaleStage=({beforeEnter,onExit})=>{
  const {Player,defaultPlan}=require('../finale.js'),player=new Player(defaultPlan());
  return {get active(){return player.active;},syncStatus(){},render(_w,_h,dt){player.update(dt);},command(m){if(!m.action.startsWith('finale-'))return false;if(m.action==='finale-start'){player.start();beforeEnter();}if(m.action==='finale-reset'){player.reset();onExit();}return true;}};
 };}
 for(const filename of ['dialogue-overlay.js','data.js','scene-script.js','caption-layout.js','scene-plan.js','cue-ledger.js','speech-calibration.js','cue-plan.js','cue-tracker.js','speech-script.js','script-sync.js','script-follow.js','rehearsal.js','engine.js','avatars.js','content.js','input-scheduler.js','speech-sentences.js','dialogue.js','round-pipeline.js','response-client.js','motion.js','stage-layout.js','opening-cast.js','stage.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',filename),'utf8'),context);
 return {elements,calls,posted,command(action,args={}){channel.onmessage({data:{type:'command',action,...args}});},tick(ms=100){now+=ms;frame(now);for(const fn of intervals)fn();},async answer(messages){calls.at(-1).resolve(new Response(JSON.stringify({messages})));await new Promise(r=>setImmediate(r));}};
}
test('joint release blocks ordinary speech and AI until the operator exits',()=>{
 const s=stage({finale:true});s.command('script-improv',{enabled:true});s.elements.get('test-text').value='测试即兴发言。';s.tick();assert.equal(s.calls.length,0);
 s.command('finale-start');s.command('voice-state',{active:true,session:'late'});s.command('voice-transcript',{seq:1,session:'late',text:'迟来的识别句子。',final:true});s.command('say',{actor:0,text:'不应在发布中插话。'});for(let i=0;i<120;i++)s.tick();assert.equal(s.calls.length,0);assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));s.command('finale-reset');s.command('say',{actor:0,text:'回到演讲舞台。'});for(let i=0;i<20;i++)s.tick();assert.ok(s.posted.at(-1).actors.some(a=>a.phase!=='idle'));
});
test('a retained speech bubble stays still while its pointer follows the returning character',()=>{
 const s=stage();s.command('say',{actor:0,text:'这句说完，我走回去。'});
 for(let i=0;i<500&&s.posted.at(-1).actors[0].phase!=='leaving';i++)s.tick(40);
 assert.equal(s.posted.at(-1).actors[0].phase,'leaving');
 const actor=s.elements.get('actors').children[0],bubble=s.elements.get('bubbles').children[0],before={actor:actor.style.transform,left:parseFloat(bubble.style.left),top:parseFloat(bubble.style.top),tail:JSON.stringify([bubble.querySelector('.bubble-tail').querySelector('.bubble-notch').getAttribute('d'),bubble.querySelector('.bubble-tail').style.left,bubble.querySelector('.bubble-tail').style.top])};
 s.tick(40);assert.notEqual(actor.style.transform,before.actor);
 assert.ok(Math.hypot(parseFloat(bubble.style.left)-before.left,parseFloat(bubble.style.top)-before.top)<.01,'the text must remain stable while the person moves');assert.notEqual(JSON.stringify([bubble.querySelector('.bubble-tail').querySelector('.bubble-notch').getAttribute('d'),bubble.querySelector('.bubble-tail').style.left,bubble.querySelector('.bubble-tail').style.top]),before.tail,'the pointer must continue following its person');
 s.command('clear');
});
test('stage applies the saved bubble layer and keeps captions out of the presenter corner',()=>{
 const s=stage();s.command('speech-script',{script:{title:'分层测试',text:'我们一起动手。',blocks:[{title:'实验',source:'我们一起动手。',sentences:[{id:'layer',text:'我们一起动手。',mode:'discussion',replies:[{actor:0,text:'先提问题。',replyTo:null,presentation:'upper',durationMs:2000},{actor:1,text:'然后试一试。',replyTo:0,durationMs:2000}]}]}]}});
 s.command('rehearsal-cue',{index:0,sentenceIndex:0});
 for(let n=0;n<60;n++)s.tick();
 assert.equal(s.elements.get('bubbles').children[0].dataset.presentation,'upper');
 assert.equal(s.elements.get('bubbles').children[1].dataset.presentation,'background');
 const zone=require('../stage-layout.js').presenterZone(1200,800);
 const c=s.elements.get('test-composer');assert.ok(parseFloat(c.style.left)-parseFloat(c.style.width)/2>=zone.width,'subtitle covers presenter');s.command('clear');
});
test('ordinary-stage captions render interim and final speech without any AI request',()=>{
 const s=stage();s.command('script-improv',{enabled:true});s.command('voice-state',{active:true,session:'test'});s.command('voice-transcript',{session:'test',seq:1,text:'我们讨论艺术。',final:false});s.tick();assert.equal(s.elements.get('live-caption').textContent,'我们讨论艺术。');s.command('voice-transcript',{session:'test',seq:2,text:'我们讨论艺术。还有一点',final:true});s.tick();assert.equal(s.elements.get('live-caption').textContent,'还有一点');assert.equal(s.calls.length,0);s.command('clear');
});
test('ordinary-stage typed sentences never prefetch AI replies even with the switch enabled',()=>{
 const s=stage();s.command('script-improv',{enabled:true});s.elements.get('test-text').value='第一句。第二句。第三句。';for(let i=0;i<100;i++)s.tick();assert.equal(s.calls.length,0);assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));s.command('clear');
});

test('replacing a fixed manuscript does not enable AI or old demo dialogue',()=>{
 const s=stage();s.command('script-improv',{enabled:true});for(const title of ['去年开学典礼','今年开学典礼']){s.command('speech-script',{script:{title,text:'从认识彼此开始。'}});s.elements.get('test-text').value='我们应该如何开始？';s.tick();assert.equal(s.calls.length,0);assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));}s.command('clear');
});

test('prepared rehearsal is silent until started, plays without API, and clears hidden text on purge',()=>{
 const s=stage(),pack={kind:'rehearsal',id:'fixture',title:'合成稿',text:'先观察花朵。',blocks:[{title:'观察',source:'先观察花朵。',cues:['观察花朵'],replies:[{actor:0,text:'先看清花瓣。',replyTo:null}]}]};
 s.command('speech-script',{script:pack});for(let i=0;i<20;i++)s.tick();assert.equal(s.calls.length,0);assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));
 s.command('rehearsal-start');let spoke=false;for(let i=0;i<45;i++){s.tick();spoke||=s.posted.at(-1).actors.some(a=>a.phase==='speaking');}assert.equal(s.calls.length,0);assert.ok(spoke);
 s.command('speech-script',{script:null});for(let i=0;i<250;i++)s.tick();assert.equal(s.calls.length,0);assert.equal(s.elements.get('live-caption').textContent,'');assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));
});

test('selecting a topic keeps recognition connected while AI stays unavailable outside T2',()=>{
 const s=stage();s.command('speech-script',{script:{title:'新稿',text:'第一段。\n第二段。'}});s.command('script-improv',{enabled:true});s.command('voice-state',{active:true,session:'live'});s.command('topic',{topic:1});s.command('voice-transcript',{session:'live',seq:1,text:'继续说下一句。',final:true});s.tick();assert.equal(s.calls.length,0);assert.equal(s.posted.at(-1).follow.active,true);assert.equal(s.posted.at(-1).inputSession,'live');s.command('clear');
});

test('script cue previews keep each sentence discussion separate and preserve its delay',()=>{
 const s=stage(),pack={kind:'rehearsal',id:'cues',title:'合成剧本',text:'先观察。再讨论。',blocks:[{title:'观察',source:'先观察。再讨论。',sentences:[
  {id:'a',text:'先观察。',trigger:'先观察',mode:'discussion',delayMs:1000,replies:[{actor:0,text:'先看清。',replyTo:null},{actor:1,text:'我补充。',replyTo:0}]},
  {id:'b',text:'再讨论。',trigger:'再讨论',mode:'reply',replies:[{actor:2,text:'再验证。',replyTo:null}]}
 ]}]};
 s.command('speech-script',{script:pack});s.command('rehearsal-cue',{index:0,sentenceIndex:0});
 for(let i=0;i<9;i++)s.tick();assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));
 const speakers=new Set();for(let i=0;i<150;i++){s.tick();s.posted.at(-1).actors.filter(a=>a.phase==='speaking').forEach(a=>speakers.add(a.id));}
 assert.deepEqual([...speakers].sort(),[0,1]);assert.equal(s.calls.length,0);
 s.command('rehearsal-cue',{index:0,sentenceIndex:1});const next=new Set();for(let i=0;i<100;i++){s.tick();s.posted.at(-1).actors.filter(a=>a.phase==='speaking').forEach(a=>next.add(a.id));}
 assert.deepEqual([...next],[2]);assert.equal(s.calls.length,0);s.command('clear');
});

test('live interim speech follows the script and a confirmed cue is presented once without a model request',()=>{
 const s=stage();s.command('speech-script',{script:{title:'跟稿合成稿',text:'我们在这里开始一场新的社会实验。',blocks:[{title:'实验',source:'我们在这里开始一场新的社会实验。',sentences:[{id:'follow-cue',text:'我们在这里开始一场新的社会实验。',trigger:'',mode:'reply',replies:[{actor:0,text:'让我们从观察开始。',replyTo:null}],holdMs:1200}]}]}});
 s.command('voice-state',{active:true,session:'follow'});s.command('voice-transcript',{session:'follow',seq:1,text:'我们在这里开始一场新的',final:false});s.tick();assert.equal(s.posted.at(-1).follow.sentenceIndex,0);assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));
 s.command('voice-transcript',{session:'follow',seq:2,text:'我们在这里开始一场新的社会实验。',final:true});for(let i=0;i<15;i++)s.tick();assert.ok(s.posted.at(-1).actors.some(a=>a.phase==='speaking'));assert.equal(s.calls.length,0);
 for(let i=0;i<200;i++)s.tick();s.command('voice-transcript',{session:'follow',seq:3,text:'我们在这里开始一场新的社会实验。',final:true});s.tick();assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));assert.equal(s.calls.length,0);
});

test('a matched silent script sentence stays silent even when off-script improv is enabled',()=>{
 const s=stage();s.command('speech-script',{script:{title:'静默稿',text:'天津美院办学120年矣。'}});s.command('script-improv',{enabled:true});s.command('voice-state',{active:true,session:'silent'});s.command('voice-transcript',{session:'silent',seq:1,text:'天津美院办学一百二十年矣。',final:true});for(let i=0;i<100;i++)s.tick();s.command('clear');assert.equal(s.calls.length,0);assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));
});
test('audience captions display the matched manuscript while raw recognition remains available',()=>{
 const s=stage();s.command('speech-script',{script:{title:'字幕稿',text:'天津美院办学120年矣。'}});s.command('voice-state',{active:true,session:'caption'});s.command('voice-transcript',{session:'caption',seq:1,text:'天津美术学院办学120年以。',final:true});s.tick();assert.equal(s.elements.get('live-caption').textContent,'天津美院办学120年矣。');assert.equal(s.posted.at(-1).speechRawCaption,'天津美术学院办学120年以。');assert.equal(s.calls.length,0);
 s.command('voice-transcript',{session:'caption',seq:2,text:'现在临时停一下调整话筒。',final:true});s.tick();assert.equal(s.elements.get('live-caption').textContent,'天津美院办学120年矣。');
});

function mainlineFixture(){
 return {title:'配角互斥回归',text:'我们在这里开始一场新的社会实验。\n我们接下来还要勇敢走向未来。',blocks:[
  {title:'实验',source:'我们在这里开始一场新的社会实验。',sentences:[{id:'main',text:'我们在这里开始一场新的社会实验。',trigger:'新的社会实验',mode:'discussion',replies:[{actor:0,text:'固定第一句。',replyTo:null},{actor:1,text:'固定第二句。',replyTo:0}],delayMs:0}]},
  {title:'未来',source:'我们接下来还要勇敢走向未来。',sentences:[{id:'future',text:'我们接下来还要勇敢走向未来。',trigger:'走向未来',mode:'reply',replies:[{actor:2,text:'未来的固定台词。',replyTo:null}]}]}
 ]};
}
function startImprov(s){s.command('speech-script',{script:mainlineFixture()});s.command('script-improv',{enabled:true});s.command('voice-state',{active:true,session:'support'});}
function speech(s,seq,text,final=true){s.command('voice-transcript',{session:'support',seq,text,final});}

test('off-script speech cannot start AI before a normal fixed cue',()=>{
 const s=stage();startImprov(s);speech(s,1,'今天临时聊聊校园里的一只小猫。');s.tick();assert.equal(s.calls.length,0);speech(s,2,'我们在这里开始一场新的社会实验。');const seen=new Set();for(let i=0;i<170;i++){s.tick();for(const a of s.posted.at(-1).actors)if(a.phase==='speaking')seen.add(a.text);}assert.deepEqual([...seen],['固定第一句。','固定第二句。']);assert.equal(s.calls.length,0);s.command('clear');
});

test('off-script speech during a fixed round is dropped rather than replayed later',()=>{
 const s=stage();startImprov(s);speech(s,1,'我们在这里开始一场新的社会实验。');for(let i=0;i<15;i++)s.tick();speech(s,2,'临时补充一件小事。');
 for(let i=0;i<180;i++)s.tick();assert.equal(s.calls.length,0);assert.equal(s.posted.at(-1).speechQueue,0);s.command('clear');
});

test('no supporting cast means no model call even when improv is enabled',()=>{
 const s=stage(),sentences=Array.from({length:9},(_,actor)=>({id:'all-'+actor,text:'固定演讲第'+actor+'句。',mode:'reply',replies:[{actor,text:'固定台词。'}]})),text=sentences.map(v=>v.text).join(''),script={text,blocks:[{title:'全员主线',source:text,sentences}]};
 s.command('speech-script',{script});s.command('script-improv',{enabled:true});s.elements.get('test-text').value='忽然想到一只校园小猫。';s.tick();assert.equal(s.calls.length,0);assert.match(s.posted.at(-1).ai.message,/T2/);s.command('clear');
});
test('typed script still triggers fixed replies without requiring AI or an explicit keyword',()=>{
 const s=stage(),script=mainlineFixture();script.blocks[0].sentences[0].trigger='';s.command('speech-script',{script});s.command('script-improv',{enabled:true});s.elements.get('test-text').value='临时说说校园小猫的故事。';s.tick();assert.equal(s.calls.length,0);s.elements.get('test-text').value=script.blocks[0].source;s.tick();const spoken=new Set();for(let i=0;i<170;i++){s.tick();for(const a of s.posted.at(-1).actors)if(a.phase==='speaking')spoken.add(a.text);}assert.deepEqual([...spoken],['固定第一句。','固定第二句。']);assert.equal(s.calls.length,0);s.command('clear');
});
test('typed off-script input during a delayed cue is discarded, not saved for later',()=>{
 const s=stage(),script=mainlineFixture();script.blocks[0].sentences[0].delayMs=2500;s.command('speech-script',{script});s.command('script-improv',{enabled:true});
 s.command('rehearsal-cue',{index:0,sentenceIndex:0});s.elements.get('test-text').value='临时说说校园小猫的故事。';s.tick();assert.equal(s.elements.get('test-text').value,'');
 for(let i=0;i<180;i++)s.tick();assert.equal(s.calls.length,0);s.command('clear');
});


test('manual insurance preserves voice, rejects stale input and duplicate clicks, and never wraps',()=>{
 const s=stage();startImprov(s);s.command('hello');let state=s.posted.at(-1),epoch=state.controlEpoch;
 s.command('force-next',{expectedTopic:0,epoch});state=s.posted.at(-1);assert.equal(state.topic,1);assert.equal(state.inputSession,'support');assert.equal(state.follow.active,true);assert.equal(state.awaitingSection,true);
 s.command('force-next',{expectedTopic:0,epoch});assert.equal(s.posted.at(-1).topic,1);
 s.command('voice-transcript',{session:'support',seq:1,epoch,text:'我们一起动手。',final:true,source:'doubao-input'});assert.equal(s.posted.at(-1).inputSeq,0);
 speech(s,2,'我们一起动手。');assert.equal(s.posted.at(-1).topic,1);assert.equal(s.posted.at(-1).cues.length,0);
 s.command('force-next',{expectedTopic:1,epoch:state.controlEpoch});assert.equal(s.posted.at(-1).topic,1);s.command('clear');
});
test('force next removes delayed old cue; new section cues can still play in the same voice session',()=>{
 const s=stage(),script=mainlineFixture();script.blocks[0].sentences[0].delayMs=5000;s.command('speech-script',{script});s.command('voice-state',{active:true,session:'support'});speech(s,1,script.blocks[0].source);s.command('hello');const old=s.posted.at(-1);assert.equal(old.cues[0].state,'queued');s.command('force-next',{expectedTopic:0,epoch:old.controlEpoch});speech(s,2,script.blocks[1].source);for(let i=0;i<50;i++)s.tick();assert.equal(s.posted.at(-1).topic,1);assert.equal(s.posted.at(-1).cues.find(c=>c.key.startsWith('0:')).state,'cancelled');assert.ok(s.posted.at(-1).cues.some(c=>c.key.startsWith('1:')&&c.state!=='cancelled'));s.command('clear');
});
test('cancelled queued fixed replies can be heard again; completed manual previews deduplicate live cues',()=>{
 const s=stage(),script=mainlineFixture();script.blocks[0].sentences[0].delayMs=1500;s.command('speech-script',{script});s.command('voice-state',{active:true,session:'support'});speech(s,1,script.blocks[0].source);s.command('topic',{topic:0});speech(s,2,script.blocks[0].source);assert.equal(s.posted.at(-1).cues[0].state,'queued');s.command('rehearsal-cue',{index:0,sentenceIndex:0});for(let i=0;i<600;i++)s.tick();assert.equal(s.posted.at(-1).cues[0].state,'played');speech(s,3,script.blocks[0].source);for(let i=0;i<20;i++)s.tick();assert.ok(s.posted.at(-1).actors.every(a=>a.phase==='idle'));assert.equal(s.posted.at(-1).cues[0].state,'played');s.command('clear');
});
test('manual cue rescue starts the first unplayed cue once and leaves speech capture running',()=>{
 const s=stage();startImprov(s);s.command('hello');const state=s.posted.at(-1);const command={expectedTopic:0,epoch:state.controlEpoch};s.command('force-cue',command);s.command('force-cue',command);assert.equal(s.posted.at(-1).cues.length,1);assert.equal(s.posted.at(-1).follow.active,true);for(let i=0;i<500;i++)s.tick();assert.equal(s.posted.at(-1).cues[0].state,'played');s.command('clear');
});
test('Doubao committed text without punctuation triggers fixed cues but no ordinary-scene AI',()=>{
 const s=stage();startImprov(s);const send=(seq,text)=>s.command('voice-transcript',{session:'support',seq,text,final:true,source:'doubao-input'});send(1,mainlineFixture().blocks[0].source.replace(/。/g,''));assert.equal(s.posted.at(-1).cues.length,1);for(let i=0;i<500;i++)s.tick();send(2,'校园里的小猫今天也来听课');s.tick();assert.equal(s.calls.length,0);s.command('clear');
});
test('the current 22-section script queues all 12 cues and completes its unchanged 18 replies',()=>{
 const script=JSON.parse(fs.readFileSync(path.join(__dirname,'../speeches/2026-120周年校庆/邱志杰120周年校庆讲话-测试接话-v1.json'),'utf8')),s=stage();s.command('speech-script',{script});s.command('voice-state',{active:true,session:'support'});let seq=0;for(const block of script.blocks)for(const sentence of block.sentences)speech(s,++seq,sentence.text);
 assert.equal(s.posted.at(-1).cues.length,12);for(let i=0;i<6000;i++)s.tick(80);const cues=s.posted.at(-1).cues;assert.equal(cues.filter(v=>v.state==='played').length,12);assert.equal(cues.reduce((n,v)=>n+v.completed,0),18);assert.equal(s.calls.length,0);s.command('clear');
});

test('changing capacity preserves a pending fixed cue rather than leaving a queued tombstone',()=>{const s=stage(),script=mainlineFixture();script.blocks[0].sentences[0].delayMs=1500;s.command('speech-script',{script});s.command('voice-state',{active:true,session:'support'});speech(s,1,script.blocks[0].source);s.command('capacity',{value:1});for(let i=0;i<650;i++)s.tick();assert.equal(s.posted.at(-1).cues[0].state,'played');s.command('clear');});
test('a single unpunctuated final across sections preserves the order of all detected cues',()=>{const s=stage(),script=mainlineFixture();script.blocks.forEach(b=>b.sentences.forEach(v=>v.trigger=''));s.command('speech-script',{script});s.command('voice-state',{active:true,session:'support'});speech(s,1,script.blocks.map(b=>b.source.replace(/。/g,'')).join(''));const keys=s.posted.at(-1).cues.map(v=>v.key);assert.deepEqual([...keys],['0:main','1:future']);for(let i=0;i<1000;i++)s.tick();assert.ok(s.posted.at(-1).cues.every(v=>v.state==='played'));assert.equal(s.posted.at(-1).topic,1);s.command('clear');});
