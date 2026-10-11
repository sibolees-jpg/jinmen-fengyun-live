const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {stage}=require('./helpers/stage-fixture.cjs');
const full=JSON.parse(fs.readFileSync(require.resolve('../speeches/2026-120周年校庆/津门风云-蓝字完整编排-v2.json'),'utf8'));
const setup=()=>{const s=stage();s.command('speech-script',{script:full});return s;};
const speech=(s,seq,text,final=false)=>s.command('voice-transcript',{session:'live',seq,text,final,source:'doubao-api'});
test('partial speech advances the director within a section and across sections before final results',()=>{
 const s=setup();s.command('voice-state',{active:true,session:'live'});
 speech(s,1,full.blocks[0].sentences[0].text.slice(0,20));s.tick(350);
 assert.equal(s.posted.at(-1).presentation.sentenceIndex,0);
 speech(s,2,full.blocks[0].sentences[1].text.slice(0,-4));s.tick(350);
 assert.equal(s.posted.at(-1).presentation.sentenceIndex,1);
 speech(s,3,full.blocks[1].sentences[0].text.slice(0,20));s.tick(350);
 assert.equal(s.posted.at(-1).presentation.index,1);assert.equal(s.posted.at(-1).topic,1);
 speech(s,4,full.blocks[0].sentences[0].text,true);s.tick(100);
 assert.equal(s.posted.at(-1).presentation.index,1);assert.equal(s.posted.at(-1).topic,1);
 s.command('clear');
});
test('temporary recognition corrections do not flicker director progress or advance on silence',()=>{
 const s=setup();s.command('voice-state',{active:true,session:'live'});
 speech(s,1,full.blocks[0].sentences[0].text,true);const before=s.posted.at(-1).presentation;
 speech(s,2,full.blocks[1].sentences[0].text.slice(0,20));s.tick(100);speech(s,3,'今天先调整一下话筒');
 for(let i=0;i<100;i++)s.tick(1000);
 assert.equal(s.posted.at(-1).presentation.index,before.index);assert.equal(s.posted.at(-1).presentation.sentenceIndex,before.sentenceIndex);assert.equal(s.posted.at(-1).follow.active,true);s.command('clear');
});
test('220-character rehearsal publishes moving sentence and section progress',()=>{
 const s=setup();s.command('rehearsal-start');assert.equal(s.posted.at(-1).presentation.sentenceIndex,0);
 const seen=new Set();for(let i=0;i<180;i++){s.tick(1000);const p=s.posted.at(-1).presentation;seen.add(`${p.index}:${p.sentenceIndex}`);}
 assert.ok(seen.has('0:1'));assert.ok(seen.has('1:0'));s.command('clear');
});
test('preview completion moves to the next speech card and the next section without replaying fixed lines',()=>{
 const s=setup();s.command('rehearsal-cue',{index:0,sentenceIndex:0});for(let i=0;i<100;i++)s.tick(1000);
 assert.equal(s.posted.at(-1).presentation.source,'ready');assert.equal(s.posted.at(-1).presentation.sentenceIndex,1);
 s.command('rehearsal-discuss',{index:0});for(let i=0;i<160;i++)s.tick(1000);
 assert.equal(s.posted.at(-1).topic,1);assert.equal(s.posted.at(-1).presentation.index,1);assert.equal(s.posted.at(-1).presentation.sentenceIndex,0);
 assert.equal(s.posted.at(-1).cues.filter(c=>c.state==='played').length,2);s.command('clear');
});
test('clear and manual section change preserve open microphone reception; rehearsal cannot take it over',()=>{
 const s=setup();s.command('voice-state',{active:true,session:'live'});s.command('clear');assert.equal(s.posted.at(-1).follow.active,true);
 s.command('topic',{topic:1});assert.equal(s.posted.at(-1).follow.active,true);s.command('rehearsal-start');assert.equal(s.posted.at(-1).follow.active,true);assert.equal(s.posted.at(-1).rehearsal.active,false);
 s.command('voice-state',{active:false,session:'live'});assert.equal(s.posted.at(-1).follow.active,false);
});
test('all 74 manuscript units follow their opening words before final recognition arrives',()=>{
 const s=setup();s.command('voice-state',{active:true,session:'live'});let seq=0,visited=0;
 for(let i=0;i<full.blocks.length;i++)for(let j=0;j<full.blocks[i].sentences.length;j++){
  const row=full.blocks[i].sentences[j];speech(s,++seq,row.text.slice(0,Math.min(24,row.text.length-4)),false);s.tick(350);
  const p=s.posted.at(-1).presentation;assert.equal(`${p.index}:${p.sentenceIndex}`,`${i}:${j}`,row.text);visited++;
  speech(s,++seq,row.text,true);s.tick(50);
 }
 assert.equal(visited,74);s.command('clear');
});
