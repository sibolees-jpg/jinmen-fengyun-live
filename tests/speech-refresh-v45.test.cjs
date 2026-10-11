const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {AudienceSubtitles,SpeechSentences}=require('../speech-sentences.js'),Opening=require('../opening-cast.js'),{stage}=require('./helpers/stage-fixture.cjs');
const script=require('../show/script.json').script,catalog=require('../show/scenes.json').catalog;
const settle=()=>new Promise(r=>setImmediate(r)),advance=(s,ms)=>{for(let t=0;t<ms;t+=100)s.tick(100);};
test('S0 names come from the new introduction and each has its own exact keyword',()=>{
 const opening=new Opening(script);assert.deepEqual(opening.names.map(x=>x[0]),['李鸿章','梁启超','严复','蔡元培','李叔同','柏拉图','达芬奇','愚公']);
 for(const [name] of opening.names)assert.equal(script.blocks[0].sentences.filter(s=>s.text.includes('他们是')&&s.text.includes(name)).length,1);
 opening.feed('各位领导，大家好',true,0);assert.equal(opening.seen.size,0);
 let time=100;for(const [name,id] of opening.names){opening.feed(name,true,time);assert.ok(opening.seen.has(id));assert.equal(opening.transitioned,false);time+=1000;}
 opening.feed('伽利略',true,time);assert.equal(opening.seen.has(7),false);assert.equal(opening.seen.size,8);
 const missingStart=new Opening(script);missingStart.feed('蔡元培',false,0);assert.deepEqual([...missingStart.seen.keys()],[4]);
 assert.equal(opening.feed('我们一起来说说',false,time+1000),true);
 opening.configure({blocks:[{source:'他们是李鸿章、伽利略。'}]});assert.equal(opening.seen.size,0);assert.deepEqual(opening.names.map(x=>x[0]),['李鸿章','伽利略']);
});
test('subtitle pages use actual received words, honor script boundaries without punctuation and remain short',()=>{
 const sub=new AudienceSubtitles(script);
 assert.equal(sub.caption(''), '');assert.equal(sub.caption('我们一起来说说'), '我们一起来说说');
 assert.equal(sub.caption('天津美院办学120年矣。百廿老人，何来少年心气？'),'百廿老人，何来少年心气？');
 assert.equal(sub.caption('关键词曰实验场此后北洋女师学堂数易其名各学科'),'此后北洋女师学堂数易其名各学科');
 const raw='今天我临时补充一段没有写进稿子的话，'.repeat(12)+'现在看向这里';assert.ok(sub.caption(raw).length<=36);assert.ok(raw.includes(sub.caption(raw)));assert.ok(sub.caption(raw).endsWith('现在看向这里'));
 const long='这是一段没有标点的识别结果'.repeat(12);assert.ok(sub.caption(long).length<=36);assert.ok(long.endsWith(sub.caption(long)));
 assert.equal(sub.caption('完全跑题的现场发言。'),'完全跑题的现场发言。');assert.equal(sub.caption('苏冬坡来了'),'苏冬坡来了');assert.equal(sub.caption('苏东坡来了'),'苏东坡来了');
});
test('subtitle formatting never consumes or rewrites the AI sentence queue',()=>{
 const raw='前面的句子。现在的话还没说完',speech=new SpeechSentences(),sub=new AudienceSubtitles(script);speech.update({seq:1,text:raw,final:true});const before=structuredClone(speech);sub.caption(speech.lastCaption);assert.deepEqual({...speech},before);assert.equal(speech.take(),'前面的句子。');assert.equal(speech.preview(),'现在的话还没说完');
});
test('real stage name fragments reveal eight people once and captions reset with rescue',async()=>{
 const f=stage({sceneCatalog:catalog,frontendTrial:true,width:1920,height:1080});f.command('speech-script',{script});await settle();f.command('voice-state',{active:true,session:'eight-fragments'});let seq=0;
 const feed=text=>{f.command('voice-transcript',{session:'eight-fragments',seq:++seq,text,final:true});advance(f,700);};
 feed('他们是');for(const [i,[name]] of new Opening(script).names.entries()){feed(name);assert.equal(f.elements.get('actors').children.filter(a=>!a.hidden).length,i+1);assert.equal(f.posted.at(-1).scenery.activeId,catalog.standbySceneId);}
 assert.equal(f.elements.get('live-caption').textContent.includes('愚公'),true);assert.equal(f.calls.length,0);
 feed('我们一起来说说');advance(f,2400);assert.equal(f.posted.at(-1).scenery.activeId,'sc-q925-a1');f.command('clear');assert.equal(f.elements.get('live-caption').textContent,'');
});
test('standalone audience caption is outside the input form hidden by fullscreen',()=>{
 const {parseHTML}=require('linkedom'),{document}=parseHTML(fs.readFileSync(require.resolve('../index.html'),'utf8')),caption=document.querySelector('#live-caption');assert.equal(caption.parentNode.id,'stage');assert.equal(caption.closest('form'),null);
});
test('every new manuscript keyword reaches its own card once, including all eight short names',()=>{
 const {CueTracker:Tracker}=require('../cue-tracker.js'),tracker=new Tracker(script),received=[];
 for(const b of script.blocks)for(const line of b.sentences){received.push(...tracker.feed(line.trigger,true));received.push(...tracker.feed(line.trigger,true));}
 const expected=script.blocks.flatMap((b,index)=>b.sentences.map(line=>`${index}:${line.id}`));assert.deepEqual(received.map(c=>c.key),expected);assert.equal(new Set(received.map(c=>c.key)).size,127);
});
