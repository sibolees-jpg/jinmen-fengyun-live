const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const Plan=require('../cue-plan.js'),Script=require('../speech-script.js'),{CueTracker}=require('../cue-tracker.js'),{stage}=require('./helpers/stage-fixture.cjs');
const script=Script.create(require('../speeches/2026-120周年校庆/津门风云-9.23-v21.json')),original=require('../speeches/2026-120周年校庆/津门风云-9.23-v18.json');
const rows=script.blocks.flatMap(b=>b.sentences),keys=script.blocks.flatMap((b,bi)=>b.sentences.map(s=>`${bi}:${s.id}`));
const groups=s=>s.blocks.flatMap(b=>b.sentences.filter(s=>s.replies.length).map(s=>s.replies.map(r=>[r.actor,r.text])));
test('210 punctuation-split cards retain verbatim speech, all 77 original dialogue groups and 141 actor lines',()=>{
 assert.deepEqual(script.blocks.map(b=>b.source),original.blocks.map(b=>b.source));assert.deepEqual(groups(script),groups(original));assert.equal(rows.length,210);assert.ok(rows.every(s=>Plan.splitStops(s.text).length===1&&s.trigger&&s.text.includes(s.trigger)));
 assert.equal(Plan.audit(script).replies,141);assert.equal(Plan.audit(script).continuations,132);assert.equal(rows[0].replies.length,0);assert.equal(rows[1].replies[0].actor,1);assert.equal(rows.at(-1).replies.length,9);
});
for(const mode of ['full','keyword','keyword-typo'])test(`${mode} replay reaches all 210 cue cards once without waiting for sentence-end punctuation`,()=>{
 const t=new CueTracker(script),seen=[];for(const s of rows){let v=mode==='full'?s.text:s.trigger;if(mode==='keyword-typo'&&v.length>=8)v=v.slice(0,3)+'嗯'+v.slice(4);seen.push(...t.feed(v,true));}
 assert.deepEqual(seen.map(c=>c.key),keys);assert.equal(t.missing().length,0);assert.equal(new Set(seen.map(c=>c.key)).size,210);
});
test('middle keyword releases its cue but cannot declare the speech or scene finished',()=>{
 const t=new CueTracker(script),at=6;t.reset(0,at);const cue=t.feed(rows[at].trigger,true);assert.ok(cue.some(c=>c.key===keys[at]));assert.equal(t.follow.complete,false);assert.equal(t.follow.atEnd,false);assert.ok(t.follow.remaining>0);assert.equal(cue.some(c=>c.at>at),false);
});
test('interim keyword must stabilize and can be retracted; repeat finals do not replay',()=>{
 let now=0;const t=new CueTracker(script,{now:()=>now});t.reset(0,6);assert.equal(t.feed(rows[6].trigger,false).length,0);now=100;t.feed('请工作人员调一下灯光',false);now=400;assert.equal(t.take().length,0);t.feed(rows[6].trigger,false);now=700;assert.equal(t.take().length,1);assert.equal(t.feed(rows[6].trigger,true).length,0);
});
test('unrelated chatter and distant isolated keyword do not sweep unread scenes',()=>{
 const t=new CueTracker(script);for(const text of ['请大家先休息一下','我们现在继续开会','金融创新运营示范区'])assert.equal(t.feed(text,true).length,0);
});
test('future replacement retains valid hand-edited keywords and rejects missing triggers, wrong groups and unsplit periods',()=>{
 const unchanged=Plan.replaceText(script,{title:script.title,text:script.blocks.map(b=>b.source).join('\n\n')});assert.deepEqual(unchanged.blocks.map(b=>b.sentences),script.blocks.map(b=>b.sentences));
 for(const edit of [s=>s.blocks[0].sentences[1].trigger='',s=>s.blocks[0].sentences[2].dialogueLead='missing',s=>s.blocks[0].sentences[2].text+='额外一句。',s=>s.blocks[0].sentences[1].mode='silent']){const bad=structuredClone(script);edit(bad);assert.equal(Plan.audit(bad).ok,false);}
 const replacement=Plan.replaceText(script,{title:'新稿',text:script.blocks.map(b=>b.source.replace('。','。新的一句。')).join('\n\n')});assert.ok(Plan.audit(replacement).ok);assert.deepEqual(groups(replacement),groups(script));assert.ok(replacement.blocks.flatMap(b=>b.sentences).every(s=>s.trigger));
});
test('Li and Liang appear with overlap, continuation keywords do not duplicate their dialogue group',()=>{
 const s=stage();s.command('speech-script',{script});s.command('voice-state',{active:true,session:'key'});
 s.command('voice-transcript',{session:'key',seq:1,text:rows[0].trigger,final:true});s.tick(100);assert.equal(s.posted.at(-1).cues.length,0);
 s.command('voice-transcript',{session:'key',seq:2,text:rows[1].trigger,final:true});for(let i=0;i<40;i++)s.tick(100);
 const speakers=s.posted.at(-1).actors.filter(a=>a.phase==='speaking');assert.deepEqual(Array.from(speakers,a=>a.id).sort(),[0,1]);
 s.command('voice-transcript',{session:'key',seq:3,text:rows[2].trigger,final:true});s.tick(100);assert.equal(s.posted.at(-1).cues.length,1);
 for(let i=0;i<100;i++)s.tick(1000);assert.equal(s.posted.at(-1).cues[0].state,'played');s.command('clear');
});
test('whole prepared section enqueues each original dialogue only once despite continuation preview force',()=>{
 const s=stage();s.command('speech-script',{script});s.command('rehearsal-cue',{index:0});s.tick(100);assert.equal(s.posted.at(-1).cues.length,8);assert.equal(vm.runInContext('manualCues.reduce((n,c)=>n+c.messages.length,0)+engine.queue.length+engine.actors.filter(a=>a.message).length',s.context),14);s.command('clear');
});
test('all manuscript cues reach the real stage ledger as 77 groups and 141 played lines',()=>{
 const s=stage();s.command('speech-script',{script});s.command('voice-state',{active:true,session:'all'});let seq=0;
 for(const b of script.blocks)for(const u of b.sentences){s.command('voice-transcript',{session:'all',seq:++seq,text:u.trigger,final:true});for(let i=0;i<50;i++)s.tick(1000);}
 for(let i=0;i<180;i++)s.tick(1000);const cues=s.posted.at(-1).cues;assert.equal(cues.length,77);assert.ok(cues.every(c=>c.state==='played'));assert.equal(cues.reduce((n,c)=>n+c.completed,0),141);s.command('clear');
});
