const {test}=require('node:test'),assert=require('node:assert/strict');
const {ScriptFollower}=require('../script-follow.js');
const Script=require('../speech-script.js');
const script=Script.create({title:'合成稿',text:'尊敬的各位领导，各位嘉宾，大家好！天津美院办学120年矣。百廿老人，何来少年心气？\n我们在这里开始一场新的社会实验。让科学和艺术互相启发。'});
test('partial speech finds its sentence, then confirmed speech advances without requiring five seconds',()=>{
 const f=new ScriptFollower(script);let m=f.feed('尊敬的各位领导各位嘉宾',false);assert.equal(m.sentenceIndex,0);assert.equal(m.complete,false);
 m=f.feed('尊敬的各位领导各位嘉宾大家好',true);assert.equal(m.sentenceIndex,0);assert.equal(m.complete,true);
 m=f.feed('天津美院办学一百二十年',true);assert.equal(m.sentenceIndex,1);
 m=f.feed('百廿老人何来少年心气',false);assert.equal(m.sentenceIndex,2);assert.equal(m.complete,false);
});
test('off-script remarks keep the last location and do not confirm a planned cue',()=>{
 const f=new ScriptFollower(script);f.feed('我们在这里开始一场新的社会实验',true);const m=f.feed('请后排的工作人员把话筒音量调低一点',true);assert.equal(m.matched,false);assert.equal(m.index,1);assert.equal(m.sentenceIndex,0);assert.equal(m.complete,false);
});
test('small recognition errors can match, and explicit seek permits rehearsal from another point',()=>{
 const f=new ScriptFollower(script);let m=f.feed('我们在这里开始一场新的社汇实验',true);assert.equal(m.index,1);assert.equal(m.sentenceIndex,0);f.seek(0,0);m=f.feed('尊敬的各位领导各位嘉宾大家好',true);assert.equal(m.index,0);
});
test('a short transition sentence is followed locally without skipping it',()=>{
 const f=new ScriptFollower(Script.create({title:'短句',text:'现代美术教育开始走向大众生活。中国亦然。我们继续讨论新的教育实验。'}));
 f.feed('现代美术教育开始走向大众生活',true);
 const m=f.feed('中国亦然',true);assert.equal(m.sentenceIndex,1);assert.equal(m.complete,true);
});
test('full school name and a homophone at the sentence end still locate the written sentence',()=>{
 const f=new ScriptFollower(script);const m=f.feed('天津美术学院办学120年以。',true);assert.equal(m.matched,true);assert.equal(m.sentenceIndex,1);
});

test('an interim match in a later paragraph does not prevent correction to an earlier final',()=>{
 const {ScriptFollower}=require('../script-follow.js'),Script=require('../speech-script.js');const follower=new ScriptFollower(Script.create({text:'让我们一起观察天津的历史。\n人工智能成为今天的话题。'}));
 assert.equal(follower.feed('人工智能成为今天的话题。',false).index,1);const final=follower.feed('让我们一起观察天津的历史。',true);assert.equal(final.index,0);assert.equal(final.complete,true);
});
