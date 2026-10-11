const {test}=require('node:test');const assert=require('node:assert/strict');
const {SpeechSentences}=require('../speech-sentences.js');
test('interim revisions are preview only and final sentences arrive once in order',()=>{
 const s=new SpeechSentences();s.update({seq:1,text:'今天。',final:false});assert.equal(s.take(),null);
 s.update({seq:2,text:'今天我们讨论美。下一句？还没',final:true});assert.equal(s.take(),'今天我们讨论美。');assert.equal(s.take(),'下一句？');assert.equal(s.take(),null);assert.equal(s.preview(),'还没');
 s.update({seq:2,text:'今天我们讨论美。下一句？还没',final:true});assert.equal(s.take(),null);
 s.update({seq:3,text:'讲完。',final:true});assert.equal(s.take(),'还没讲完。');
});
test('new interim text replaces earlier guesses without overwriting finalized tail',()=>{
 const s=new SpeechSentences();s.update({seq:1,text:'如果',final:true});s.update({seq:2,text:'今天下雨。',final:false});s.update({seq:3,text:'明天下雨',final:false});assert.equal(s.preview(),'如果明天下雨');assert.equal(s.take(),null);
 s.update({seq:4,text:'明天下雨，我们就带伞。',final:true});assert.equal(s.take(),'如果明天下雨，我们就带伞。');
});
test('clear cancels queued utterances and incomplete previews',()=>{
 const s=new SpeechSentences();s.update({seq:1,text:'一句。尾巴',final:true});s.clear();assert.equal(s.take(),null);assert.equal(s.preview(),'');
});
test('live captions roll to a bounded recent excerpt without losing submitted text',()=>{
 const s=new SpeechSentences();const text='这是现场正在说的一段长句，'.repeat(8);
 s.update({seq:1,text,final:false});assert.ok(Array.from(s.caption(40)).length<=40);assert.ok(s.caption(40).endsWith('一段长句，'));assert.equal(s.take(),null);
 s.update({seq:2,text:text+'结束。',final:true});assert.equal(s.take(),text+'结束。');assert.ok(s.caption(40).endsWith('结束。'));
});
test('corrected interim words replace rather than pile onto the caption',()=>{
 const s=new SpeechSentences();s.update({seq:1,text:'苏冬坡',final:false});s.update({seq:2,text:'苏东坡',final:false});assert.equal(s.caption(),'苏东坡');
 s.update({seq:3,text:'苏东坡来了。',final:true});s.take();assert.equal(s.caption(),'苏东坡来了。');
});
