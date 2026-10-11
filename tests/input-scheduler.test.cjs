const {test}=require('node:test');const assert=require('node:assert/strict');
const {InputScheduler}=require('../input-scheduler.js');
test('unfinished text never sends merely because time passes',()=>{
 const s=new InputScheduler();assert.equal(s.poll(0,'艺术教育'),null);assert.equal(s.poll(60000,'艺术教育'),null);assert.equal(s.poll(60001,'艺术教育。'),'艺术教育。');assert.equal(s.poll(65000,'艺术教育。'),null);
});
test('one complete sentence at a time preserves the remaining draft',()=>{
 const s=new InputScheduler();assert.equal(s.poll(0,'第一句。第二句！还没讲完'),'第一句。');
 assert.equal(s.consume('第一句。第二句！还没讲完','第一句。'),'第二句！还没讲完');
 assert.equal(s.poll(1,'第二句！还没讲完'),'第二句！');assert.equal(s.poll(2,'还没讲完'),null);
});
test('busy stage waits for a complete sentence and uses the edited draft',()=>{
 const s=new InputScheduler();assert.equal(s.poll(0,'旧句。',{busy:true}),null);assert.equal(s.poll(1,'新句。',{busy:true}),null);assert.equal(s.poll(2,'新句。'),'新句。');
});
test('Chinese composition is never submitted halfway',()=>{
 const s=new InputScheduler();assert.equal(s.poll(0,'你好。',{composing:true}),null);assert.equal(s.poll(1,'你好。'),'你好。');
});
test('decimal points do not end a sentence and quote endings stay attached',()=>{
 const s=new InputScheduler();assert.equal(s.poll(0,'数值是3.14'),null);assert.equal(s.poll(1,'他说：“数值是3.14。”然后'),'他说：“数值是3.14。”');
});
test('manual submission confirms an unfinished sentence and waits through busy state',()=>{
 const s=new InputScheduler();assert.equal(s.submit(0,'继续说',{busy:true}),null);assert.equal(s.poll(1,'继续说'),'继续说');assert.equal(s.poll(2,'继续说'),null);
});
test('clearing the input cancels pending manual work and allows repeating a sentence',()=>{
 const s=new InputScheduler();s.submit(0,'旧句',{busy:true});assert.equal(s.poll(1,''),null);assert.equal(s.poll(2,'你好。'),'你好。');s.poll(3,'');assert.equal(s.poll(4,'你好。'),'你好。');
});
test('a failed draft stays available for explicit retry without auto repeating',()=>{
 const s=new InputScheduler();s.poll(0,'你好。');s.poll(1,'');const draft=s.restoreFailed(2,'你好。','');assert.equal(s.poll(60000,draft),null);assert.equal(s.submit(60001,draft),'你好。');
 assert.equal(s.restoreFailed(2,'旧问题','新问题'),'新问题');assert.equal(s.restoreFailed(2,'旧问题','',{composing:true}),'');
});
