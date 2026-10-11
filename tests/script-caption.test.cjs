const {test}=require('node:test'),assert=require('node:assert/strict');
const {ScriptCaptions,ScriptFollower}=require('../script-follow.js'),Script=require('../speech-script.js');
const script=Script.create({title:'字幕稿',text:'天津美院办学120年矣。我们在这里开始一场新的社会实验。我们需要经过认真的观察才可以作出判断。'});
const correct=text=>new ScriptCaptions(script).caption(text,new ScriptFollower(script).feed(text,true));
test('corrects the reported homophone while preserving the spoken full name and punctuation',()=>assert.equal(correct('天津美术学院办学120年以。'),'天津美术学院办学120年矣。'));
test('partial captions only correct heard characters and never reveal the rest of the script',()=>{
 const text='我们在这里开始一场新的社汇';assert.equal(correct(text),'我们在这里开始一场新的社会');assert.ok(!correct(text).includes('实验'));
});
test('numbers and changed negatives are never silently replaced from the script',()=>{
 for(const text of ['天津美院办学121年矣。','我们不要经过认真的观察才可以作出判断。','这个稿子我临时改一下，请大家等一等。'])assert.equal(correct(text),text);
});
test('unmatched speech does not reuse a previously matched line',()=>{
 const f=new ScriptFollower(script),c=new ScriptCaptions(script);f.feed('天津美院办学120年矣。',true);const text='我现在临时说一点别的内容。';assert.equal(c.caption(text,f.feed(text,true)),text);
});
