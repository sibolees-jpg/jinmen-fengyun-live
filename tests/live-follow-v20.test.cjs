const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {CueTracker}=require('../cue-tracker.js'),Script=require('../speech-script.js'),Plan=require('../cue-plan.js'),{stage}=require('./helpers/stage-fixture.cjs');
const script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.23-v20.json')),old=require('../speeches/2026-120周年校庆/津门风云-9.23-v19.json'),recording=require('./fixtures/923-live-asr-regression.json');
const rows=script.blocks.flatMap(b=>b.sentences),keys=script.blocks.flatMap((b,bi)=>b.sentences.map(s=>`${bi}:${s.id}`));
const catalog=structuredClone(require('../speeches/2026-120周年校庆/文档场次-9.23-v18.json'));catalog.openingMode='scene';
test('opening is intentionally silent, next line belongs to Li Hongzhang; every authored word and reply survives',()=>{
 assert.equal(script.text,old.text);assert.deepEqual(script.blocks.map(b=>b.source),old.blocks.map(b=>b.source));
 const replies=s=>s.blocks.flatMap(b=>b.sentences.flatMap(u=>u.replies.map(r=>[r.actor,r.text])));
 assert.deepEqual(replies(script),replies(old));assert.equal(rows.length,134);assert.equal(rows[0].replies.length,0);assert.equal(rows[1].replies[0].actor,1);
 assert.equal(rows.slice(1,-1).every(r=>r.replies.length===1),true);assert.equal(rows.at(-1).replies.length,9);assert.equal(Plan.audit(script).ok,true);
 const rebuilt=Plan.replaceText(script,{title:script.title,text:script.blocks.map(b=>b.source).join('\n\n')});assert.deepEqual(rebuilt.blocks.map(b=>b.sentences),script.blocks.map(b=>b.sentences));
 const invalid=structuredClone(script);invalid.blocks[1].sentences[0].mode='silent';invalid.blocks[1].sentences[0].replies=[];assert.equal(Plan.audit(invalid).ok,false);
});
test('recorded live ASR with split phrases, corrections and repetition reaches real cue playback exactly once',()=>{
 const s=stage({width:239});s.command('speech-script',{script});s.command('voice-state',{active:true,session:'recorded'});let seq=0,last=recording[0].at;
 for(const e of recording){s.tick(Math.max(1,e.at-last));last=e.at;s.command('voice-transcript',{session:'recorded',seq:++seq,text:e.text,final:e.final,source:'doubao-api'});}
 for(let i=0;i<240;i++)s.tick(1000);
 const played=s.posted.at(-1).cues;
 assert.deepEqual(Array.from(played,c=>c.key),['1:v20-s2-6','1:v20-s2-7','1:v20-s2-8','2:one-s3-1']);assert.ok(played.every(c=>c.state==='played'));
 assert.equal(s.posted.at(-1).cueTracking.position.index,s.posted.at(-1).follow.index);s.command('clear');
});
test('filler words and recognition substitutions through the whole manuscript cannot deadlock following cues',()=>{
 const tracker=new CueTracker(script),seen=[];
 for(const row of rows){const heard=row.text.replace(/[，、：；]/g,'，这个，').replace(/天津/g,'天金').replace(/李鸿章/g,'李红章').replace(/美术学院/g,'美院');seen.push(...tracker.feed(heard,true));}
 assert.equal(seen.length,134);assert.deepEqual(seen.map(c=>c.key),keys);assert.equal(tracker.missing().length,0);
});
test('a lost sentence tail is completed by continuous reading into the next sentence, not a global skip',()=>{
 let now=0;const tracker=new CueTracker(script,{now:()=>now});const at=3,first=rows[at];tracker.reset(0,at);
 tracker.feed(first.text.slice(0,-8),true);assert.ok(!tracker.done.has(keys[at]));
 tracker.feed(rows[at+1].text.slice(0,15),false);now=100;tracker.feed(rows[at+1].text.slice(0,18),false);now=400;
 const fired=tracker.take();assert.ok(fired.some(c=>c.key===keys[at]));assert.equal(fired.some(c=>c.key===keys[at+1]),false);
 const far=new CueTracker(script);far.feed(rows[0].text,true);const jump=far.feed(script.blocks[4].sentences[0].text,true);assert.ok(jump.every(c=>c.index===4));assert.ok(far.missing().length>20);
});
test('legacy M1 remains visible throughout opening; all present nameplates stay visible',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.tick(1000);
 assert.equal(s.posted.at(-1).scenery.activeId,'sc-doc923-1');assert.equal(vm.runInContext('openingLayer.style.opacity',s.context),'0');
 assert.equal(vm.runInContext('labelNodes.every(n=>Number(n.style.opacity)>0)',s.context),true);
 s.command('voice-state',{active:true,session:'opening'});s.command('voice-transcript',{session:'opening',seq:1,text:rows[0].text,final:true});s.tick(1000);
 assert.equal(s.posted.at(-1).cues.length,0);assert.equal(vm.runInContext('openingLayer.style.opacity',s.context),'0');
 s.command('voice-transcript',{session:'opening',seq:2,text:rows[1].text,final:true});for(let i=0;i<5;i++)s.tick(1000);
 assert.equal(s.posted.at(-1).actors.filter(a=>a.phase==='speaking')[0].id,1);
 assert.ok(Number(vm.runInContext('labelNodes[1].style.opacity',s.context))>0);assert.equal(vm.runInContext('labelNodes.filter((n,i)=>i!==1).every(n=>Number(n.style.opacity)>0)',s.context),true);s.command('clear');
});

test('loss of the last three recognized characters does not silence subsequent cues or the final chorus',()=>{
 const tracker=new CueTracker(script),seen=[];for(const row of rows){const heard=row.text.replace(/[^\p{L}\p{N}]/gu,'').slice(0,-3);seen.push(...tracker.feed(heard,true));}
 assert.deepEqual(seen.map(c=>c.key),keys);assert.equal(tracker.missing().length,0);
});
