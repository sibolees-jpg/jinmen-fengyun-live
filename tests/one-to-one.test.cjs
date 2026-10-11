const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const Plan=require('../cue-plan.js'),Script=require('../speech-script.js'),{CueTracker}=require('../cue-tracker.js'),{stage}=require('./helpers/stage-fixture.cjs');
const original=require('../speeches/2026-120周年校庆/津门风云-9.23-v18.json');
const script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.23-v19.json'));
const rows=script.blocks.flatMap(b=>b.sentences),clean=s=>s.replace(/[^\p{L}\p{N}]/gu,'');
test('idle and reset have no missed-cue warning; a genuine skipped unit remains visible for rescue',()=>{
 const tracker=new CueTracker(script);assert.equal(tracker.missing().length,0);tracker.feed(rows[1].text,true);assert.equal(tracker.missing().length,1);tracker.reset();assert.equal(tracker.missing().length,0);
});
test('all authored speech, reply text, actors and scene bindings survive the 133 one-to-one cues',()=>{
 assert.equal(script.text,original.text);assert.deepEqual(script.blocks.map(b=>b.source),original.blocks.map(b=>b.source));
 const replies=s=>s.blocks.flatMap(b=>b.sentences.flatMap(r=>r.replies.map(m=>[m.actor,m.text])));
 assert.deepEqual(replies(script),replies(original));assert.equal(rows.length,133);assert.equal(rows.at(-1).replies.length,9);assert.equal(rows.slice(0,-1).every(r=>r.replies.length===1),true);
 assert.equal(Plan.audit(script).minChars,18);assert.ok(Plan.audit(script).maxChars<=60);assert.deepEqual(script.blocks.map(b=>b.sceneId),original.blocks.map(b=>b.sceneId));
});
test('the guard rejects silent gaps, short speech, multiple replies, early triggers and missing scenes',()=>{
 for(const change of [s=>s.text='太短',s=>{s.mode='silent';s.replies=[];},s=>{s.mode='discussion';s.replies.push({...s.replies[0],replyTo:0});},s=>s.cuePolicy='early']){
  const copy=structuredClone(script);change(copy.blocks[0].sentences[0]);assert.equal(Plan.audit(copy).ok,false);
 }
 const copy=structuredClone(script);delete copy.blocks[0].sceneId;assert.throws(()=>Script.create(copy),/场次/);
 assert.throws(()=>Plan.partition('这一段正文太短了',3),/不足/);
});
test('changing text preserves scene-local reply order and refuses missing scene divisions',()=>{
 const rebuilt=Plan.replaceText(script,{title:'新稿',text:script.blocks.map(b=>b.source).join('\n\n')});assert.equal(Plan.audit(rebuilt).ok,true);
 assert.deepEqual(rebuilt.blocks.flatMap(b=>b.sentences.flatMap(s=>s.replies.map(r=>r.actor))),rows.flatMap(s=>s.replies.map(r=>r.actor)));
 assert.throws(()=>Plan.replaceText(script,{text:'只有一段'}),/8 个场次/);
});
test('one ASR substitution in each unit still confirms every authored reply exactly once',()=>{
 const tracker=new CueTracker(script),seen=[];
 for(const s of rows){const raw=clean(s.text);const damaged=raw.slice(0,-2)+'啊'+raw.slice(-1);seen.push(...tracker.feed(damaged,true));}
 assert.equal(seen.length,133);assert.equal(new Set(seen.map(r=>r.key)).size,133);assert.equal(tracker.missing().length,0);
});
test('accented and split live recognition still advances one reply per completed manuscript sentence',()=>{
 const heard=[
  '流亡归来的第二天，就在这个理工祠的民主党直隶支部的欢迎会上进行了演讲。',
  '在此创办了中国最早的大学北洋大学堂，就是今天的天津大学。',
  '四联帮南下上海创办南洋公学。',
  '记后来的上海交大前身。',
  '在南阳工学，李叔同成为了。',
  '在南洋公学，李叔同成为蔡元培的学生。在说起天时之天时正值。',
  '中国现代化转型之初，封建王朝已近尾声，现代国家治理方兴未艾。',
  '顾彼时，天津。'
 ];
 const tracker=new CueTracker(script);tracker.reset(1,3);
 const fired=heard.flatMap(text=>tracker.feed(text,true).map(row=>`${row.index+1}-${row.sentenceIndex+1}`));
 assert.deepEqual(fired,['2-4','2-5','2-6','2-7','3-1']);
 assert.equal(new Set(fired).size,fired.length);
});
test('a partial or unrelated final does not trigger the relaxed recognition fallback',()=>{
 const tracker=new CueTracker(script);
 assert.equal(tracker.feed('尊敬的项部长高主席各位领导各位嘉宾',true).length,0);
 assert.equal(tracker.feed('请工作人员检查音响并把话筒音量调低',true).length,0);
});
test('no authored unit triggers from its first 80 percent, including repeated endings',()=>{
 for(const [index,block] of script.blocks.entries())for(const [sentenceIndex,sentence] of block.sentences.entries()){
  const tracker=new CueTracker(script);tracker.reset(index,sentenceIndex);
  const prefix=[...sentence.text].slice(0,Math.floor([...sentence.text].length*.8)).join('');
  assert.equal(tracker.feed(prefix,true).some(c=>c.index===index&&c.sentenceIndex===sentenceIndex),false,`S${index+1} 第 ${sentenceIndex+1} 句提前接话`);
 }
});
test('arbitrary seven-character final packets do not require punctuation to confirm all units',()=>{
 const tracker=new CueTracker(script),seen=[];for(const b of script.blocks){const text=clean(b.source);for(let i=0;i<text.length;i+=7)seen.push(...tracker.feed(text.slice(i,i+7),true));}
 assert.equal(seen.length,133);assert.equal(tracker.missing().length,0);
});
test('stable partial evidence survives extension into the next unit; final replays never duplicate it',()=>{
 let now=0;const tracker=new CueTracker(script,{now:()=>now}),first=rows[0].text,next=rows[1].text;
 assert.equal(tracker.feed(first,false).length,0);now=150;assert.equal(tracker.feed(first+next.slice(0,8),false).length,0);now=300;assert.equal(tracker.take().length,1);
 assert.equal(tracker.feed(first,true).length,0);assert.equal(tracker.feed(next,true).length,1);
});
test('retracted interim evidence, unrelated speech and unread duplicate phrases do not fire',()=>{
 let now=0;const repeat=script.blocks[0].sentences[0],synthetic={blocks:[{sentences:[{...repeat,id:'a'},{...repeat,id:'b'}]}]};const tracker=new CueTracker(synthetic,{now:()=>now});
 tracker.feed(repeat.text,false);tracker.feed('请工作人员把话筒音量再调大一些',false);now=1000;assert.equal(tracker.take().length,0);
 assert.equal(tracker.feed(repeat.text,true).length,1);assert.equal(tracker.feed(repeat.text,true).length,1);
});
test('protected stage triggers all cues under burst input and presents only one regular speaker',()=>{
 const s=stage({width:239});s.command('speech-script',{script});s.command('voice-state',{active:true,session:'guard'});
 let seq=0;for(const row of rows)s.command('voice-transcript',{session:'guard',seq:++seq,text:row.text,final:true,source:'doubao-api'});
 let max=0,ended=false;for(let i=0;i<18000;i++){s.tick(1000);const active=vm.runInContext('engine.actors.filter(a=>a.phase==="speaking"&&!a.message?.chorus).length',s.context);max=Math.max(max,active);const ledger=s.posted.at(-1).cues;if(ledger.length===133&&ledger.every(c=>c.state==='played')){ended=true;break;}}
 assert.equal(max,1);assert.equal(ended,true);assert.equal(s.posted.at(-1).cues.reduce((n,r)=>n+r.completed,0),141);s.command('clear');
});
