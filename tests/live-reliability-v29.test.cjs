const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {stage}=require('./helpers/stage-fixture.cjs'),Caption=require('../caption-layout.js'),{placeBubbles}=require('../stage-layout.js'),{CueTracker}=require('../cue-tracker.js');
const script=require('../speeches/2026-120周年校庆/津门风云-9.24-v28.json'),catalog=require('../speeches/2026-120周年校庆/津门风云-9.24-v28-场次.json');
const mistakes=text=>text.replaceAll('亦读书','也读书').replaceAll('亦画画','也画画').replaceAll('袁氏','原氏').replaceAll('北洋','北阳').replaceAll('新开河','新开合').replaceAll('次第','次地').replaceAll('劝业','劝叶').replaceAll('严修之子严智开','严休之子严志开').replaceAll('数字名之','数字名字').replaceAll('纬路','伟路');
test('tall complete cards rewrap into available stage space instead of starving all following replies',()=>{
 const items=script.blocks[2].sentences[0].replies.map((r,id)=>({id,x:600+id*180,y:175,text:r.text})),obstacles=[{left:0,top:190,width:1225,height:499}];
 const result=Caption.fitCards(items,1225,689,{place:placeBubbles,obstacles});assert.equal(result.boxes.length,2);
 for(const card of result.cards){assert.ok(card.layout.height<190);assert.equal(card.layout.columns.join('').replace(/\s/gu,''),card.text.replace(/\s/gu,''));assert.ok(card.layout.fontSize>=10);}
});
for(const mode of ['homophones','missing-tail'])test(`S3 ${mode} matches all 15 sentences once, including short dialogue and the final road names`,()=>{
 let now=0;const tracker=new CueTracker(script,{now:()=>now});tracker.reset(2);const seen=[];
 for(const row of script.blocks[2].sentences){const text=mode==='homophones'?mistakes(row.text):row.text.slice(0,-3);for(let n=3;n<text.length;n+=2){now+=500;seen.push(...tracker.feed(text.slice(0,n),false));}now+=500;seen.push(...tracker.feed(text,true));}
 assert.deepEqual(seen.map(c=>c.key),script.blocks[2].sentences.map(s=>'2:'+s.id));assert.equal(tracker.missing().length,0);
});
test('nearby typo allowance does not fire remote keywords or generic off-script chatter',()=>{
 const tracker=new CueTracker(script);for(const text of ['他们也读书，也画画','天伟路地伟路日伟路月伟路','大家先休息，检查一下麦克风','这是同学们做的实验'])assert.equal(tracker.feed(text,true).length,0);
 tracker.reset(2,5);let now=0;const t=new CueTracker(script,{now:()=>now});t.reset(2,5);t.feed('他们也读书，也画画',false);now=100;t.feed('他们正在等着开会',false);now=500;assert.equal(t.take().length,0);
});
for(const [width,height] of [[1225,689],[768,886]])test(`S3 live delivery at ${width}x${height} exposes all 13 lines promptly with real card dimensions`,async()=>{
 const s=stage({width,height,sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.tick(1);s.command('topic',{topic:2});s.command('scene-take',{sceneId:script.blocks[2].sceneId,revision:0});s.document.fullscreenElement=s.document.getElementById('stage-viewport');s.command('voice-state',{active:true,session:'v29'});let seq=0,maxBlocked=0;const recognized=new Set();
 const tick=dt=>{s.tick(dt);maxBlocked=Math.max(maxBlocked,...s.posted.at(-1).replyFlow.blocked.map(a=>a.waitMs));const follow=s.posted.at(-1).follow;if(follow.matched&&follow.index===2)recognized.add(follow.sentenceIndex);};
 for(const row of script.blocks[2].sentences){const text=mistakes(row.text);for(let n=2;n<text.length;n+=2){s.command('voice-transcript',{session:'v29',seq:++seq,text:text.slice(0,n),final:false});tick(60000*2/220);}s.command('voice-transcript',{session:'v29',seq:++seq,text,final:true});tick(500);}
 for(let i=0;i<40;i++)tick(500);
 const state=s.posted.at(-1);state.cues=state.cues.filter(c=>c.state!=='skipped');const visible=state.cueEvents.filter(e=>e.type==='cue-visible');assert.equal(state.cues.length,6);assert.ok(state.cues.every(c=>c.state==='played'));assert.equal(state.cues.reduce((n,c)=>n+c.completed,0),13);assert.equal(visible.length,13);assert.equal(new Set(visible.map(e=>e.key+':'+e.line)).size,13);assert.equal(state.queue,0);assert.equal(recognized.size,15);assert.equal(state.recognitionScope.first.index,3);assert.equal(maxBlocked,0);
 assert.ok(visible.filter(e=>e.line===0).every(e=>e.waitMs<5500),JSON.stringify(visible));assert.ok(visible.every(e=>e.waitMs<12000),JSON.stringify(visible));s.command('clear');
});
