const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {stage}=require('./helpers/stage-fixture.cjs'),{CueTracker}=require('../cue-tracker.js');
const script=require('../speeches/2026-120周年校庆/津门风云-9.24-v28.json'),catalog=require('../speeches/2026-120周年校庆/津门风云-9.24-v28-场次.json');
const units=index=>script.blocks[index].sentences.map((_,sentenceIndex)=>({index,sentenceIndex}));
test('rescue matching is limited to the selected scene and acquires a distant middle keyword without backfill',()=>{
 const t=new CueTracker(script);t.setScope(units(9));
 for(const i of [0,6,8,10,12])for(const r of script.blocks[i].sentences)t.feed(r.text,true);
 assert.equal(t.done.size,0,'other scenes cannot trigger');
 const rows=script.blocks[9].sentences,si=rows.findIndex((r,i)=>i>=4&&r.replies.length&&r.trigger.length>=8);assert.ok(si>=4);
 const events=t.feed(rows[si].trigger,true);assert.equal(events.length,1);assert.equal(events[0].sentenceIndex,si);assert.equal(events[0].index,9);assert.equal(t.missing().length,0);
 assert.equal(t.feed(rows[0].text,true).length,0,'skipped earlier lines never replay');
 t.reset(0);assert.equal(t.scope,null,'normal full rehearsal can start over');
});
test('insurance next scene clears old queues and transcripts, rejects the old session, then resumes within the new scene',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.tick(1);
 s.command('scene-take',{sceneId:script.blocks[8].sceneId,revision:0});s.command('voice-state',{active:true,session:'old-s9'});
 s.command('voice-transcript',{session:'old-s9',seq:1,text:script.blocks[8].sentences[0].text,final:true});s.tick(200);
 s.command('scene-next',{expectedIndex:s.posted.at(-1).scenery.shot.index});s.command('hello');
 let state=s.posted.at(-1);assert.equal(state.scenery.activeId,script.blocks[9].sceneId);assert.equal(state.presentation.index,9);assert.equal(state.presentation.sentenceIndex,0);assert.equal(state.replyFlow.pendingLines,0);assert.ok(state.actors.every(a=>a.phase==='idle'));assert.equal(state.speechRawCaption,'');assert.equal(state.voiceReset.pending,true);
 const epoch=state.controlEpoch,token=state.voiceReset.token;
 s.command('voice-state',{active:true,session:'old-s9'});s.command('voice-transcript',{session:'old-s9',seq:900,epoch,text:script.blocks[8].sentences[3].text,final:true});
 s.command('hello');assert.equal(s.posted.at(-1).inputSeq,0);
 s.command('voice-state',{active:true,session:'fresh-s10',resetToken:token});s.command('voice-state',{active:true,session:'old-s9',resetToken:token});s.command('hello');assert.equal(s.posted.at(-1).inputSession,'fresh-s10','a retired session cannot be reattached even with the new token');
 const rows=script.blocks[9].sentences,si=rows.findIndex((r,i)=>i>=4&&r.replies.length&&r.trigger.length>=8);
 s.command('voice-transcript',{session:'fresh-s10',seq:1,epoch,text:rows[si].trigger,final:true});s.tick(1000);state=s.posted.at(-1);
 assert.equal(state.follow.index,9);assert.equal(state.follow.sentenceIndex,si);assert.equal(state.voiceReset.pending,false);assert.ok(state.cues.some(c=>c.key==='9:'+rows[si].id&&['queued','playing','played'].includes(c.state)));
 assert.ok(!state.cues.some(c=>c.key.startsWith('8:')&&['queued','playing'].includes(c.state)));s.command('clear');
});
test('scene-local tracking rolls forward only after the last sentence, without searching remote scenes',()=>{
 const t=new CueTracker(script);t.setScope(units(9));const last=script.blocks[9].sentences.at(-1);const out=t.feed(last.text,true);assert.ok(out.length);assert.ok(out.every(r=>r.index===9));assert.equal(t.feed(script.blocks[12].sentences[0].text,true).length,0);
});

test('after a rescue, a confirmed scene ending moves the restricted recognition range to the next scene',async()=>{
 const s=stage({sceneCatalog:catalog});s.command('speech-script',{script});await new Promise(r=>setImmediate(r));s.tick(1);s.command('scene-take',{sceneId:script.blocks[8].sceneId,revision:0});s.command('scene-next');s.command('hello');const saved=s.posted.at(-1);s.command('voice-state',{active:true,session:'rolling-s10',resetToken:saved.voiceReset.token});s.command('voice-transcript',{session:'rolling-s10',seq:1,text:script.blocks[9].sentences.at(-1).text,final:true});s.tick(100);s.command('hello');assert.equal(s.posted.at(-1).recognitionScope.sceneId,script.blocks[10].sceneId);s.command('voice-transcript',{session:'rolling-s10',seq:2,text:script.blocks[10].sentences[0].text,final:true});s.tick(100);s.command('hello');assert.equal(s.posted.at(-1).follow.index,10);s.command('clear');
});
