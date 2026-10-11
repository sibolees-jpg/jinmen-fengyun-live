const {test}=require('node:test'),assert=require('node:assert/strict');
const {AudienceSubtitles}=require('../speech-sentences.js'),{normalizeSpeech}=require('../script-follow.js');
const {stage}=require('./helpers/stage-fixture.cjs');
const script=require('../show/script.json').script;
const catalog=require('../scripts/static-cast-catalog.cjs').staticCastCatalog(require('../show/scenes.json').catalog);
const tick=(f,ms=900)=>{for(let t=0;t<ms;t+=100)f.tick(100);};
const caption=f=>f.elements.get('live-caption').textContent;
const next=f=>{const s=f.posted.at(-1);f.command('force-sentence',{epoch:s.controlEpoch,scriptSignature:s.scriptSignature,expectedIndex:s.presentation.index,expectedSentenceIndex:s.presentation.sentenceIndex});tick(f);};
async function fixture(){const f=stage({sceneCatalog:catalog});f.command('speech-script',{script});await new Promise(r=>setImmediate(r));tick(f);return f;}

test('all manuscript subtitle pages preserve the exact text and punctuation and stay within 36 characters',()=>{
 const sub=new AudienceSubtitles(script);
 for(const [index,b]of script.blocks.entries())for(const [si,line]of b.sentences.entries()){
  const pages=sub.rows.get(`${index}:${si}`);assert.equal(pages.map(p=>p.text).join(''),line.text.trim());
  for(const page of pages){assert.ok([...page.text].length<=36||index===0&&line.text.includes('他们是')&&pages.length===1);assert.ok(!/^[，。、：；。！？!?”’」』）》】]/u.test(page.text),page.text);}
 }
});
test('matched pages appear whole immediately, advance with aligned progress and never flicker backward on ASR revisions',()=>{
 const text='各位朋友，今天我们在天津欢聚一堂，共同见证这所学校走过的漫长岁月，并向未来出发。';
 const sub=new AudienceSubtitles({blocks:[{sentences:[{text}]}]}),pages=sub.rows.get('0:0');
 const follow=end=>sub.follow({matched:true,index:0,sentenceIndex:0,confidence:100,end});
 assert.equal(follow(4),pages[0].text);assert.equal(follow(pages[0].end),pages[0].text);
 assert.equal(follow(pages[0].end+1),pages[1].text);assert.equal(follow(4),pages[1].text);
 assert.equal(sub.follow({matched:false}),pages[1].text);sub.reset();assert.equal(sub.current,'');
});
test('the first partial match shows manuscript spelling and punctuation while diagnostics keep the ASR words',()=>{
 const f=stage();f.command('speech-script',{script:{title:'字幕',text:'天津美院办学120年矣。百廿老人，何来少年心气？'}});
 f.command('voice-state',{active:true,session:'sub'});
 f.command('voice-transcript',{session:'sub',seq:1,text:'天津美术学院办学120年以',final:false});
 assert.equal(caption(f),'天津美院办学120年矣。');assert.equal(f.posted.at(-1).speechRawCaption,'天津美术学院办学120年以');
 f.command('voice-transcript',{session:'sub',seq:2,text:'天津美术学院办学120年以。',final:true});tick(f);
 assert.equal(caption(f),'天津美院办学120年矣。');assert.equal(f.posted.at(-1).presentation.sentenceIndex,1);
 f.command('voice-transcript',{session:'sub',seq:3,text:'请等一下我调整话筒',final:true});assert.equal(caption(f),'天津美院办学120年矣。');
 f.command('voice-transcript',{session:'sub',seq:4,text:'百廿老人何来少年心气',final:false});assert.equal(caption(f),'百廿老人，何来少年心气？');
 assert.equal(f.calls.length,0);f.command('clear');assert.equal(caption(f),'');assert.equal(f.posted.at(-1).speechCaption,'');
});
test('each name keeps the same complete authored list subtitle and the eight-person reveal',async()=>{
 const f=await fixture();f.command('voice-state',{active:true,session:'names'});let seq=0;
 const feed=text=>{f.command('voice-transcript',{session:'names',seq:++seq,text,final:true});tick(f);};
 feed('他们是');for(const [name] of new (require('../opening-cast.js'))(script).names){feed(name);assert.equal(caption(f),script.blocks[0].sentences[4].text.trim());}
 assert.equal(f.posted.at(-1).openingCast.introduced.length,8);assert.equal(f.calls.length,0);f.command('clear');
});
test('manual sentence rescue selects the new manuscript subtitle and old audio cannot overwrite it',async()=>{
 const f=await fixture();f.command('voice-state',{active:true,session:'old'});next(f);const s=f.posted.at(-1),expected=new AudienceSubtitles(script).rows.get('0:1')[0].text;
 assert.equal(caption(f),expected);
 f.command('voice-transcript',{session:'old',seq:999,text:'错误的旧录音',final:true});assert.equal(caption(f),expected);
 f.command('scene-reset');tick(f);assert.equal(caption(f),'');assert.equal(f.posted.at(-1).speechCaption,'');
});
test('opening rehearsal displays whole authored pages without typing partial ASR text',async()=>{
 const f=await fixture();f.command('rehearsal-discuss',{index:0});tick(f,1800);
 assert.equal(caption(f),new AudienceSubtitles(script).rows.get('0:0')[0].text);
 f.command('rehearsal-stop');assert.equal(caption(f),'');
});
test('T2 shows real-time recognition subtitles independently of AI replies',async()=>{
 const f=await fixture();f.command('scene-take',{sceneId:'sc-q925-t2',revision:0});tick(f);f.command('script-improv',{enabled:true});
 f.command('voice-state',{active:true,session:'live'});f.command('voice-transcript',{session:'live',seq:1,text:'今天校园来了小猫。',final:true});tick(f,1000);
 assert.equal(caption(f),'今天校园来了小猫。');assert.equal(f.posted.at(-1).speechRawCaption,'今天校园来了小猫。');assert.equal(f.calls.length,1);assert.equal(f.posted.at(-1).captionMode,'realtime');
 f.command('clear');
});

 test('T2 partial captions are immediate and bounded when the shared reply/subtitle toggle is enabled',async()=>{
 const f=await fixture();f.command('scene-take',{sceneId:'sc-q925-t2',revision:0});tick(f);f.command('script-improv',{enabled:true});f.command('voice-state',{active:true,session:'t2-caption'});
 f.command('voice-transcript',{session:'t2-caption',seq:1,text:'现场提问：百廿老人何来少年心气',final:false});assert.equal(caption(f),'现场提问：百廿老人何来少年心气');assert.equal(f.calls.length,0);
 const text='今天我们在这里欢迎各位朋友畅所欲言，一起谈谈校园里的新鲜事情，也欢迎大家提出未来的愿望。';f.command('voice-transcript',{session:'t2-caption',seq:2,text,final:false});assert.ok([...caption(f)].length<=36);assert.ok(text.endsWith(caption(f)));assert.equal(f.calls.length,0);
 f.command('scene-take',{sceneId:'sc-q925-a1',revision:0});tick(f);assert.equal(caption(f),'');assert.equal(f.posted.at(-1).captionMode,'manuscript');f.command('voice-transcript',{session:'t2-caption',seq:99,text:'过期的临场识别',final:true});assert.equal(caption(f),'');f.command('clear');
});

test('T2 joint toggle hides disabled input immediately and reopens without old subtitles or replies',async()=>{
 const f=await fixture();f.command('scene-take',{sceneId:'sc-q925-t2',revision:0});tick(f);f.command('voice-state',{active:true,session:'joint'});
 f.command('voice-transcript',{session:'joint',seq:1,text:'开关关闭时的发言。',final:true});tick(f);assert.equal(caption(f),'');assert.equal(f.calls.length,0);assert.equal(f.posted.at(-1).captionMode,'off');
 f.command('script-improv',{enabled:true});assert.equal(caption(f),'');tick(f);assert.equal(f.calls.length,0);
 f.command('voice-transcript',{session:'joint',seq:2,text:'这是开启后新说的话',final:false});assert.equal(caption(f),'这是开启后新说的话');
 f.command('script-improv',{enabled:true});assert.equal(caption(f),'这是开启后新说的话','settings resync must not blank the current caption');
 f.command('voice-transcript',{session:'joint',seq:3,text:'这是开启后新说的话。',final:true});tick(f,1500);assert.equal(f.calls.length,1);
 f.command('script-improv',{enabled:false});assert.equal(caption(f),'');assert.equal(f.posted.at(-1).speechCaption,'');
 await f.answer([{actor:0,text:'这条旧回复不能出现。'}]);tick(f,1000);assert.ok(f.posted.at(-1).actors.every(a=>a.phase==='idle'));
 f.command('voice-transcript',{session:'joint',seq:4,text:'关闭期间仍在收音的半句话',final:false});assert.equal(caption(f),'');assert.equal(f.posted.at(-1).follow.active,true);
 f.command('script-improv',{enabled:true});tick(f);assert.equal(caption(f),'');assert.equal(f.calls.length,1);
 f.command('voice-transcript',{session:'joint',seq:3,text:'迟到的旧识别。',final:true});assert.equal(caption(f),'','ASR sequence guard survives the toggle');
 f.command('voice-transcript',{session:'joint',seq:5,text:'再开后的新发言。',final:true});assert.equal(caption(f),'再开后的新发言。');tick(f,1500);assert.equal(f.calls.length,2);assert.equal(f.calls.at(-1).body.text,'再开后的新发言。');f.command('clear');
});
test('T2 switch state never hides or clears manuscript subtitles in regular scenes',()=>{
 const f=stage(),text='天津美院办学120年矣。';f.command('speech-script',{script:{title:'正文字幕',text}});f.command('voice-state',{active:true,session:'normal'});
 f.command('voice-transcript',{session:'normal',seq:1,text:'天津美院办学120年',final:false});assert.equal(caption(f),text);
 for(const enabled of [true,false,true]){f.command('script-improv',{enabled});assert.equal(caption(f),text);assert.equal(f.posted.at(-1).captionMode,'manuscript');}f.command('clear');
});
